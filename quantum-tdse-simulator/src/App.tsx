import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Atom,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  FlaskConical,
  GitBranch,
  Layers2,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SkipForward,
  Upload,
  Waves,
  X,
} from "lucide-react";
import {
  checkpoint,
  cloneConfig,
  cloneState,
  createRuntime,
  DEFAULT_CONFIG,
  deserializeSession,
  observe,
  SCENARIOS,
  serializeSession,
  setRuntimePotential,
  type Config,
  type Detectors,
  type Session,
} from "./lib/experiment";
import { Drawer, NumberField, SetupPanel } from "./components/SetupPanel";
import {
  MomentumPlot,
  SpaceTimePlot,
  WavePlot,
  type HistoryRow,
  type PlotView,
} from "./components/WavePlot";
import { canvasBlob, download, exportSequence } from "./lib/export";
import type { Eigenmode } from "./lib/tdse-solver";
import "./App.css";

const format = (v: number, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const percent = (v: number) => `${Math.max(0, v * 100).toFixed(1)}%`;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function App() {
  const session = useRef<Session | null>(null);
  if (!session.current)
    session.current = { a: createRuntime(DEFAULT_CONFIG), b: null, fork: null };
  const [version, setVersion] = useState(0),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [name, setName] = useState("Quantum tunneling");
  const [active, setActive] = useState<"a" | "b">("a"),
    [view, setView] = useState<PlotView>("density"),
    [lowerView, setLowerView] = useState<"momentum" | "history">("momentum");
  const [detectors, setDetectors] = useState<Detectors>({
      left: -1.1,
      right: 1.1,
    }),
    [showDetectors, setShowDetectors] = useState(true),
    [mobileSetup, setMobileSetup] = useState(false);
  const [drawer, setDrawer] = useState<
      "experiments" | "export" | "help" | null
    >(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [modes, setModes] = useState<Eigenmode[]>([]),
    [computing, setComputing] = useState(false),
    worker = useRef<Worker | null>(null);
  const [exporting, setExporting] = useState(false),
    [progress, setProgress] = useState(0),
    [duration, setDuration] = useState(3),
    [fps, setFps] = useState(24),
    exportAbort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    plotCanvas = useRef<HTMLCanvasElement | null>(null),
    history = useRef<HistoryRow[]>([]);
  const { a, b, fork } = session.current,
    runtime = active === "b" && b ? b : a,
    stats = observe(a, detectors),
    statsB = b ? observe(b, detectors) : null;
  const locked = !!b && a.state.time > (fork?.time ?? 0) + 1e-9;
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const recordHistory = useCallback(() => {
    const current = session.current!.a,
      last = history.current[history.current.length - 1];
    if (!last || current.state.time - last.time >= 0.06) {
      history.current.push({
        time: current.state.time,
        density: Float32Array.from(
          current.state.real,
          (v, i) => v * v + current.state.imag[i] ** 2,
        ),
      });
      if (history.current.length > 180) history.current.shift();
    }
  }, []);
  const cancelModes = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    setComputing(false);
  }, []);
  const invalidate = () => {
    cancelModes();
    setModes([]);
  };
  useEffect(
    () => () => {
      worker.current?.terminate();
      exportAbort.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!running) return;
    let frame = 0,
      last = 0,
      accumulator = 0;
    const advance = (now: number) => {
      if (!last) {
        last = now;
        frame = requestAnimationFrame(advance);
        return;
      }
      accumulator += Math.min((now - last) / 1000, 0.05) * speed;
      last = now;
      const s = session.current!,
        dt = s.a.config.dt,
        steps = Math.min(200, Math.floor(accumulator / dt));
      try {
        for (let i = 0; i < steps; i++) {
          s.a.solver.step(s.a.state);
          s.b?.solver.step(s.b.state);
        }
        accumulator -= steps * dt;
        if (steps) {
          recordHistory();
          refresh();
        }
      } catch (e) {
        setError(message(e));
        setRunning(false);
        return;
      }
      frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [running, speed, refresh, recordHistory]);

  const changeConfig = (change: Partial<Config>, structural = false) => {
    if (exporting) return;
    setRunning(false);
    setError("");
    try {
      const s = session.current!,
        target = active === "b" && s.b ? s.b : s.a,
        plotOnly = Object.keys(change).every(
          (k) => k === "plotXMin" || k === "plotXMax",
        );
      if (!plotOnly && locked)
        throw new Error(
          "Reset to the comparison checkpoint before changing the potential, or end comparison.",
        );
      if (structural && s.b)
        throw new Error("End comparison before preparing a new state or grid.");
      const config = { ...target.config, ...change };
      if (config.plotXMin >= config.plotXMax)
        throw new Error("The plot minimum must be below its maximum.");
      if (structural) {
        const replacement = createRuntime(config);
        if (config.potentialType === "custom-draw") {
          const oldX = target.solver.x,
            oldV = target.potential,
            newV = Float64Array.from(replacement.solver.x, (x) => {
              const f = (x - oldX[0]) / target.solver.dx,
                i = Math.max(0, Math.min(oldX.length - 2, Math.floor(f))),
                alpha = Math.max(0, Math.min(1, f - i));
              return oldV[i] * (1 - alpha) + oldV[i + 1] * alpha;
            });
          setRuntimePotential(replacement, config, newV);
          replacement.origin = checkpoint(replacement);
        }
        s.a = replacement;
        history.current = [];
        setDetectors((d) =>
          d.left > config.xMin && d.right < config.xMax
            ? d
            : {
                left: config.xMin + (config.xMax - config.xMin) * 0.45,
                right: config.xMin + (config.xMax - config.xMin) * 0.55,
              },
        );
        setNotice("Initial state prepared. Time reset to zero.");
      } else if (plotOnly) {
        s.a.config = { ...s.a.config, ...change };
        if (s.b) s.b.config = { ...s.b.config, ...change };
      } else {
        setRuntimePotential(
          target,
          config,
          config.potentialType === "custom-draw" &&
            target.config.potentialType === "custom-draw"
            ? target.potential
            : undefined,
        );
        target.origin = checkpoint(target);
        if (!s.b && target.state.time > 0)
          setNotice(
            "Potential changed at the current time. Reset now returns to this new preparation checkpoint.",
          );
        if (s.b && active === "a")
          s.fork = {
            ...s.fork!,
            config: cloneConfig(config),
            potential: Array.from(target.potential),
          };
        history.current = [];
      }
      invalidate();
      refresh();
    } catch (e) {
      setError(message(e));
    }
  };
  const drawPotential = (values: Float64Array) => {
    if (locked || exporting) return;
    setRunning(false);
    const s = session.current!,
      target = active === "b" && s.b ? s.b : s.a;
    setRuntimePotential(target, target.config, values);
    target.origin = checkpoint(target);
    if (s.b && active === "a")
      s.fork = { ...s.fork!, potential: Array.from(values) };
    invalidate();
    refresh();
  };
  const reset = () => {
    setRunning(false);
    setError("");
    invalidate();
    const s = session.current!;
    if (s.b && s.fork) {
      const origin = s.a.origin;
      s.a = createRuntime(s.fork.config, s.fork);
      s.a.origin = origin;
      s.b = createRuntime(s.b.origin.config, s.b.origin);
    } else s.a = createRuntime(s.a.origin.config, s.a.origin);
    history.current = [];
    recordHistory();
    refresh();
  };
  const step = () => {
    setRunning(false);
    const s = session.current!;
    try {
      s.a.solver.step(s.a.state);
      s.b?.solver.step(s.b.state);
      recordHistory();
      refresh();
    } catch (e) {
      setError(message(e));
    }
  };
  const toggleCompare = () => {
    setRunning(false);
    invalidate();
    const s = session.current!;
    if (s.b) {
      s.b = null;
      s.fork = null;
      setActive("a");
      setNotice("Comparison ended. Branch A is your current experiment.");
    } else {
      s.fork = checkpoint(s.a);
      s.b = createRuntime(s.fork.config, s.fork);
      setActive("b");
      setNotice(
        "Branch B starts from the identical wavefunction. Change its potential, then play both branches together.",
      );
    }
    refresh();
  };
  const loadScenario = (index: number) => {
    try {
      setRunning(false);
      invalidate();
      const config = {
        ...cloneConfig(DEFAULT_CONFIG),
        ...SCENARIOS[index].config,
      };
      session.current = { a: createRuntime(config), b: null, fork: null };
      history.current = [];
      setActive("a");
      setName(SCENARIOS[index].name);
      setDetectors({
        left: config.potentialX0 - config.potentialWidth / 2 - 0.5,
        right: config.potentialX0 + config.potentialWidth / 2 + 0.5,
      });
      setDrawer(null);
      setError("");
      setNotice(SCENARIOS[index].description);
      refresh();
    } catch (e) {
      setError(message(e));
    }
  };
  const computeModes = () => {
    setRunning(false);
    setComputing(true);
    setError("");
    worker.current?.terminate();
    const task = new Worker(
      new URL("./lib/eigenstates.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = task;
    task.onmessage = (e) => {
      if (e.data.error) setError(e.data.error);
      else setModes(e.data.modes);
      cancelModes();
    };
    task.onerror = () => {
      setError(
        "Eigenmode calculation failed. Try a smoother potential or smaller grid.",
      );
      cancelModes();
    };
    task.postMessage({
      config: runtime.config,
      potential: Array.from(runtime.potential),
    });
  };
  const loadMode = (mode: Eigenmode) => {
    if (b) return;
    setRunning(false);
    a.state = cloneState(mode.state);
    a.initialNorm = 1;
    a.referenceEnergy = a.solver.getEnergy(a.state);
    a.origin = checkpoint(a);
    history.current = [];
    setNotice(
      `Finite-domain mode loaded. E = ${mode.energy.toFixed(4)}, residual ${mode.residual.toExponential(2)}.`,
    );
    setMobileSetup(false);
    refresh();
  };
  const save = () => {
    download(
      new Blob([serializeSession(session.current!, name, detectors)], {
        type: "application/json",
      }),
      "quantum-tdse-experiment.json",
    );
    setNotice("Saved wavefunctions, potentials, and comparison checkpoints.");
  };
  const loadFile = async (file?: File) => {
    if (!file) return;
    setRunning(false);
    setError("");
    try {
      if (file.size > 4_000_000)
        throw new Error("Choose an experiment smaller than 4 MB.");
      const loaded = deserializeSession(await file.text());
      invalidate();
      session.current = loaded.session;
      setName(loaded.name);
      setDetectors(loaded.detectors);
      setActive("a");
      history.current = [];
      setNotice(
        loaded.legacy
          ? "Legacy state restored. Its original reset checkpoint was not saved."
          : "Experiment restored at its saved time, with saved potentials.",
      );
      refresh();
    } catch (e) {
      setError(message(e));
    }
  };
  const startExport = async (format: "video" | "zip") => {
    setRunning(false);
    setExporting(true);
    setProgress(0);
    setError("");
    const controller = new AbortController();
    exportAbort.current = controller;
    try {
      setNotice(
        await exportSequence({
          a: session.current!.a,
          b: session.current!.b,
          detectors,
          view,
          duration,
          fps,
          format,
          signal: controller.signal,
          onProgress: setProgress,
        }),
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError")
        setNotice("Export cancelled. Your experiment is unchanged.");
      else setError(message(e));
    } finally {
      setExporting(false);
      exportAbort.current = null;
    }
  };
  const capture = async () => {
    try {
      if (plotCanvas.current)
        download(
          await canvasBlob(plotCanvas.current),
          "quantum-tdse-position.png",
        );
      setNotice("Position plot saved as PNG.");
    } catch (e) {
      setError(message(e));
    }
  };
  const closeDrawer = useCallback(() => setDrawer(null), []),
    setCanvas = useCallback((canvas: HTMLCanvasElement) => {
      plotCanvas.current = canvas;
    }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,select,button,a,[role="dialog"]',
        ) ||
        drawer ||
        mobileSetup ||
        exporting ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setRunning((v) => !v);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const hasWarning =
    stats.cutoff > 1e-3 ||
    (!a.config.abcEnabled && stats.edge > 0.01) ||
    (!a.config.abcEnabled &&
      (stats.drift > 1e-6 || stats.energyDrift > 1e-3)) ||
    (statsB &&
      (statsB.cutoff > 1e-3 ||
        (!b!.config.abcEnabled &&
          (statsB.edge > 0.01 ||
            statsB.drift > 1e-6 ||
            statsB.energyDrift > 1e-3))));
  const csv = () => {
    const rows = [
      ["A", a, stats],
      ...(b && statsB ? [["B", b, statsB]] : []),
    ].map(([label, r, s]: any) =>
      [
        label,
        r.state.time,
        s.norm,
        s.mean,
        s.meanP,
        s.sigmaX,
        s.sigmaP,
        s.energy,
        s.left,
        s.center,
        s.right,
        s.lost,
      ].join(","),
    );
    download(
      new Blob(
        [
          "branch,time,norm,mean_x,mean_p,sigma_x,sigma_p,conditional_energy,left,center,right,absorbed\n" +
            rows.join("\n"),
        ],
        { type: "text/csv" },
      ),
      "quantum-tdse-measurements.csv",
    );
  };

  return (
    <div className="lab-shell">
      <a href="#workbench" className="skip-link">
        Skip to simulation
      </a>
      <header className="app-header">
        <a
          className="brand"
          href="#workbench"
          aria-label="Quantum TDSE workbench"
        >
          <span className="brand-mark">
            <Atom size={23} strokeWidth={1.6} />
          </span>
          <span>
            Quantum <strong>TDSE</strong>
            <small>Interactive quantum mechanics</small>
          </span>
        </a>
        <nav className="header-nav" aria-label="Workspace">
          <button
            className="nav-link active"
            onClick={() => {
              setDrawer(null);
              setMobileSetup(false);
            }}
          >
            <Activity size={15} />
            Workbench
          </button>
          <button className="nav-link" onClick={() => setDrawer("experiments")}>
            <FlaskConical size={15} />
            Experiments
          </button>
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Open experiment"
            title="Open saved experiment"
            disabled={exporting}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={17} />
          </button>
          <button className="button small" disabled={exporting} onClick={save}>
            Save<span className="desktop-text"> experiment</span>
          </button>
          <button
            className="button dark small"
            onClick={() => setDrawer("export")}
          >
            <Download size={15} />
            Export
          </button>
          <button
            className="icon-button help-button"
            aria-label="Help and keyboard shortcuts"
            onClick={() => setDrawer("help")}
          >
            <CircleHelp size={18} />
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void loadFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </header>
      <div className="workspace">
        <div className={`setup-slot ${mobileSetup ? "is-open" : ""}`}>
          {mobileSetup && (
            <button
              className="setup-scrim"
              aria-label="Close experiment setup"
              onClick={() => setMobileSetup(false)}
            />
          )}
          <SetupPanel
            runtime={runtime}
            branch={active}
            comparison={!!b}
            locked={locked || exporting}
            onChange={changeConfig}
            onClose={() => setMobileSetup(false)}
            modes={modes}
            onCompute={computeModes}
            computing={computing}
            onCancel={cancelModes}
            onLoadMode={loadMode}
            onClearDraw={() =>
              drawPotential(new Float64Array(runtime.solver.x.length))
            }
          />
        </div>
        <main id="workbench" className="workbench" tabIndex={-1}>
          <div className="workbench-heading">
            <div>
              <h1>{name}</h1>
              <p>
                {b
                  ? "One checkpoint. Two possible outcomes."
                  : "Prepare a wave. See where it takes you."}
              </p>
            </div>
            <button
              className={`button compare-button ${b ? "comparison-active" : ""}`}
              disabled={exporting || computing}
              onClick={toggleCompare}
            >
              <GitBranch size={16} />
              {b ? "End comparison" : "Compare"}
              {!b && <Plus size={13} />}
            </button>
          </div>
          <div className="workspace-toolbar">
            <button
              className="button small mobile-setup-button"
              disabled={exporting}
              onClick={() => setMobileSetup(true)}
            >
              <Settings2 size={15} />
              Setup
            </button>
            <div className="experiment-path">
              <FlaskConical size={14} />
              <button onClick={() => setDrawer("experiments")}>
                Experiments
              </button>
              <ChevronRight size={12} />
              <span>{name}</span>
            </div>
            <span className={`run-status ${running ? "is-running" : ""}`}>
              <span className="status-dot" />
              {running ? "Evolving" : "Paused"}
            </span>
          </div>
          {error && (
            <div className="message error" role="alert">
              <strong>Check your experiment</strong>
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="message info" role="status">
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notice"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {b && (
            <div className="comparison-strip">
              <div className="branch-selector" aria-label="Branch to edit">
                <button
                  className={active === "a" ? "selected" : ""}
                  aria-pressed={active === "a"}
                  onClick={() => {
                    setActive("a");
                    invalidate();
                  }}
                >
                  <i className="branch-dot a" />A · Baseline
                </button>
                <button
                  className={active === "b" ? "selected" : ""}
                  aria-pressed={active === "b"}
                  onClick={() => {
                    setActive("b");
                    invalidate();
                  }}
                >
                  <i className="branch-dot b" />B · Variant
                </button>
              </div>
              <span>
                {locked ? "Reset to fork to edit" : "Edit potential, then play"}{" "}
                · t = {format(fork?.time ?? 0)}
              </span>
            </div>
          )}
          <div className="analysis-layout">
            <div className="plots-column">
              <section
                className="plot-panel position-panel"
                aria-label="Position visualization"
              >
                <div className="plot-heading">
                  <h2>Position space</h2>
                  <div
                    className="segmented"
                    role="group"
                    aria-label="Wavefunction view"
                  >
                    {(
                      [
                        ["density", "Probability"],
                        ["components", "Real / Imag"],
                        ["phase", "Phase"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={view === id}
                        className={view === id ? "selected" : ""}
                        onClick={() => setView(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    className="icon-button fit-button"
                    title="Fit full domain"
                    aria-label="Fit full spatial domain"
                    onClick={() =>
                      changeConfig({
                        plotXMin: runtime.config.xMin,
                        plotXMax: runtime.config.xMax,
                      })
                    }
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
                <WavePlot
                  a={a}
                  b={b}
                  editRuntime={runtime}
                  detectors={detectors}
                  view={view}
                  version={version}
                  onDraw={!locked && !exporting ? drawPotential : undefined}
                  canvasRef={setCanvas}
                  showDetectors={showDetectors}
                />
                <div className="plot-legend">
                  <span>
                    <i className="legend-line teal" />
                    {b ? "Branch A" : "Wavefunction"}{" "}
                    {view === "components" ? "components" : "|ψ|²"}
                  </span>
                  {b && (
                    <span>
                      <i className="legend-line coral" />
                      Branch B
                    </span>
                  )}
                  {view === "components" && (
                    <>
                      <span>
                        <i className="legend-line blue" />
                        Real
                      </span>
                      <span>
                        <i className="legend-line pink" />
                        Imaginary
                      </span>
                    </>
                  )}
                  <span>
                    <i className="legend-line amber" />
                    Potential V(x){b ? " · B dashed" : ""}
                  </span>
                  {view === "phase" && (
                    <span className="phase-key">
                      −π <i /> +π
                    </span>
                  )}
                </div>
              </section>
              <section className="plot-panel secondary-panel">
                <div className="plot-heading">
                  <div
                    className="plot-tabs"
                    role="group"
                    aria-label="Secondary visualization"
                  >
                    <button
                      className={lowerView === "momentum" ? "selected" : ""}
                      aria-pressed={lowerView === "momentum"}
                      onClick={() => setLowerView("momentum")}
                    >
                      Momentum space
                    </button>
                    <button
                      className={lowerView === "history" ? "selected" : ""}
                      aria-pressed={lowerView === "history"}
                      onClick={() => setLowerView("history")}
                    >
                      Space–time map
                    </button>
                  </div>
                  <span className="plot-caption">
                    {lowerView === "momentum"
                      ? "Fourier view of ψ"
                      : "Density · branch A"}
                  </span>
                </div>
                {lowerView === "momentum" ? (
                  <MomentumPlot a={a} b={b} version={version} />
                ) : (
                  <SpaceTimePlot
                    rows={history.current}
                    a={a}
                    version={version}
                  />
                )}
              </section>
              <div className="insight-line">
                <Waves size={18} />
                <p>
                  {b
                    ? "Both branches evolve for the same elapsed time. Compare how their region probabilities change."
                    : "A packet has a spread of momenta. Its mean energy alone does not determine the transmitted probability."}
                </p>
              </div>
            </div>
            <aside className="measurements" aria-label="Numerical measurements">
              <div className="measurements-title">
                <h2>Measurements</h2>
                <span>ℏ = m = 1</span>
              </div>
              <dl className="observables">
                {(
                  [
                    ["Mean position", "⟨x⟩", stats.mean, statsB?.mean],
                    ["Mean momentum", "⟨p⟩", stats.meanP, statsB?.meanP],
                    ["Position spread", "Δx", stats.sigmaX, statsB?.sigmaX],
                    ["Momentum spread", "Δp", stats.sigmaP, statsB?.sigmaP],
                    ["Mean energy", "⟨E⟩", stats.energy, statsB?.energy],
                  ] as const
                ).map(([label, symbol, value, valueB]) => (
                  <div key={label}>
                    <dt>
                      <span>{label}</span>
                      <i>{symbol}</i>
                    </dt>
                    <dd className={b ? "two-values" : ""}>
                      <span className={b ? "value-a" : ""}>
                        {format(value)}
                      </span>
                      {b && (
                        <span className="value-b">{format(valueB ?? NaN)}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {b && (
                <p className="values-key">
                  <span className="value-a">A baseline</span>
                  <span className="value-b">B variant</span>
                </p>
              )}
              <p className="measurement-help">
                Means and spreads are conditional on probability remaining in
                the domain.
              </p>
              <section className="detector-section">
                <div className="section-title">
                  <h3>Probability regions</h3>
                  <button
                    className={`icon-button ${showDetectors ? "is-active" : ""}`}
                    aria-label={
                      showDetectors
                        ? "Hide detector guides"
                        : "Show detector guides"
                    }
                    aria-pressed={showDetectors}
                    onClick={() => setShowDetectors((v) => !v)}
                  >
                    <Layers2 size={15} />
                  </button>
                </div>
                <p className="field-help">
                  Current probability, not final transmission or reflection.
                </p>
                {(
                  [
                    ["Left region", stats.left, statsB?.left, "teal"],
                    ["Between guides", stats.center, statsB?.center, "muted"],
                    ["Right region", stats.right, statsB?.right, "coral"],
                    ["Absorbed", stats.lost, statsB?.lost, "amber"],
                  ] as const
                ).map(([label, value, valueB, color]) => (
                  <div className="probability-row" key={label}>
                    <div>
                      <span>{label}</span>
                      <strong className={b ? "two-values" : ""}>
                        <span>{percent(value / a.initialNorm)}</span>
                        {b && (
                          <span className="value-b">
                            {percent((valueB ?? 0) / b.initialNorm)}
                          </span>
                        )}
                      </strong>
                    </div>
                    <div className={`probability-track ${color}`}>
                      <span
                        style={{
                          width: `${Math.min(100, (value / a.initialNorm) * 100)}%`,
                        }}
                      />
                    </div>
                    {b && (
                      <div className="probability-track branch-b-track">
                        <span
                          style={{
                            width: `${Math.min(100, ((valueB ?? 0) / b.initialNorm) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                <details className="detector-settings">
                  <summary>
                    Adjust boundaries <ChevronDown size={13} />
                  </summary>
                  <NumberField
                    label="Left guide x"
                    value={detectors.left}
                    min={a.config.xMin + 0.1}
                    max={detectors.right - 0.1}
                    step={0.1}
                    onChange={(v) => setDetectors((d) => ({ ...d, left: v }))}
                  />
                  <NumberField
                    label="Right guide x"
                    value={detectors.right}
                    min={detectors.left + 0.1}
                    max={a.config.xMax - 0.1}
                    step={0.1}
                    onChange={(v) => setDetectors((d) => ({ ...d, right: v }))}
                  />
                </details>
              </section>
              <section
                className={`numerical-health ${hasWarning ? "has-warning" : ""}`}
              >
                <div>
                  <span className="status-dot" />
                  <h3>
                    {hasWarning
                      ? "Inspect numerical limits"
                      : b
                        ? "Diagnostics · A / B"
                        : "Simulation diagnostics"}
                  </h3>
                </div>
                <p>
                  {hasWarning && b
                    ? "A branch is near a numerical limit. Inspect edges and refine the grid."
                    : !a.config.abcEnabled && stats.energyDrift > 1e-3
                      ? "Energy drift exceeds 0.1%. Reduce the time step and compare refined results."
                      : stats.cutoff > 1e-3
                        ? "Momentum is near the grid cutoff. Refine the grid."
                        : !a.config.abcEnabled && stats.edge > 0.01
                          ? "Probability is near periodic edges and can wrap around."
                          : a.config.abcEnabled
                            ? "Absorbing layers active. Loss is expected."
                            : "Periodic domain. Raw norm drift is visible."}
                </p>
                <dl>
                  <div>
                    <dt>Surviving norm</dt>
                    <dd>
                      {format(stats.norm, 6)}
                      {statsB && (
                        <span className="value-b">
                          {" "}
                          / {format(statsB.norm, 6)}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      {a.config.abcEnabled ? "Edge weight" : "Raw norm drift"}
                    </dt>
                    <dd>
                      {(a.config.abcEnabled
                        ? stats.edge
                        : stats.drift
                      ).toExponential(1)}
                    </dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
          <div className="transport">
            <div className="transport-controls">
              <button
                className="icon-button"
                aria-label={
                  b ? "Reset to comparison checkpoint" : "Reset experiment"
                }
                disabled={exporting}
                onClick={reset}
              >
                <RotateCcw size={17} />
              </button>
              <button
                className="play-button"
                aria-label={running ? "Pause simulation" : "Play simulation"}
                disabled={exporting || computing}
                onClick={() => setRunning((v) => !v)}
              >
                {running ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
                <span>{running ? "Pause" : "Play"}</span>
              </button>
              <button
                className="icon-button"
                aria-label="Advance one time step"
                title="One step · right arrow"
                disabled={exporting || computing}
                onClick={step}
              >
                <SkipForward size={17} />
              </button>
            </div>
            <div className="transport-time">
              <span>Simulation time</span>
              <strong>t = {format(a.state.time)}</strong>
            </div>
            <div className="transport-speed">
              <label htmlFor="playback-speed">Playback</label>
              <div className="select-wrap">
                <select
                  id="playback-speed"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                >
                  {[0.25, 0.5, 1, 2, 4].map((v) => (
                    <option key={v} value={v}>
                      {v}×
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </div>
            </div>
            <span className="transport-key">
              <kbd>space</kbd> play / pause
            </span>
          </div>
          <footer className="workbench-footer">
            <span>
              Split-operator FFT <i /> {a.config.gridSize} points <i /> Δt{" "}
              {a.config.dt}
            </span>
            <span>
              Created by{" "}
              <a
                href="https://www.dr-abhishek.com/"
                target="_blank"
                rel="noreferrer"
              >
                Dr. Abhishek
              </a>
            </span>
          </footer>
        </main>
      </div>
      {drawer === "experiments" && (
        <Drawer title="Choose an experiment" onClose={closeDrawer}>
          <p className="drawer-intro">
            A few starting points for a good question. Loading a scenario
            prepares a new state and ends comparison.
          </p>
          <div className="scenario-list">
            {SCENARIOS.map((scenario, index) => (
              <button
                key={scenario.name}
                className="scenario-option"
                disabled={exporting}
                onClick={() => loadScenario(index)}
              >
                <span className="scenario-icon">
                  <FlaskConical size={21} strokeWidth={1.4} />
                </span>
                <span>
                  <strong>{scenario.name}</strong>
                  <em>{scenario.subtitle}</em>
                  <small>{scenario.description}</small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
        </Drawer>
      )}
      {drawer === "help" && (
        <Drawer title="A small guide to the quantum lab" onClose={closeDrawer}>
          <div className="help-content">
            <h3>Prepare, evolve, compare</h3>
            <p>
              Choose an experiment, adjust its potential or state, and press
              Play. Potential edits preserve ψ; state and grid edits prepare
              again at t = 0.
            </p>
            <h3>Ask “what if?”</h3>
            <p>
              Compare copies the exact current state into B. Edit a potential at
              the fork, then evolve both together. Reset returns both to the
              fork; End comparison retains A.
            </p>
            <h3>Read probability honestly</h3>
            <p>
              Regions show probability currently inside them. Initially the left
              region contains an incoming packet, so it cannot yet be called
              reflection. Absorption is probability lost from the domain. Region
              totals plus loss close the budget.
            </p>
            <h3>Know the model</h3>
            <p>
              Dimensionless ℏ = m = 1; a periodic FFT grid; optional absorbing
              layers. Absorber reflections and accuracy depend on settings.
              Diagnostics are warnings, not a numerical certification.
              Eigenmodes are finite-domain solutions; inspect their residuals.
            </p>
            <h3>Save and export</h3>
            <p>
              Save preserves ψ, potential arrays, reset checkpoints, and
              comparison. Open restores the saved time. Export evolves a
              separate copy. ZIP frames have exact simulated timestamps; browser
              video pacing may vary.
            </p>
            <h3>Keyboard</h3>
            <p>
              <kbd>space</kbd> Play / pause · <kbd>→</kbd> One step ·{" "}
              <kbd>Esc</kbd> Close dialog. Shortcuts stay inactive while typing.
            </p>
          </div>
        </Drawer>
      )}
      {drawer === "export" && (
        <Drawer title="Take your experiment with you" onClose={closeDrawer}>
          <p className="drawer-intro">
            Export this checkpoint. Comparison exports include both branches.
          </p>
          <div className="export-options">
            {(
              [
                ["Position plot", "PNG · current view and axes", capture],
                [
                  "Resumable experiment",
                  "JSON · states, potentials, and checkpoints",
                  save,
                ],
                [
                  "Measurement table",
                  "CSV · numerical values at this time",
                  csv,
                ],
              ] as const
            ).map(([title, description, action]) => (
              <button key={title} className="export-option" onClick={action}>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ArrowDownToLine size={19} />
              </button>
            ))}
          </div>
          <section className="export-sequence">
            <h3>Export an evolution</h3>
            <p className="field-help">
              From t = {format(a.state.time)}. One simulation time unit per
              output second. The live experiment stays unchanged.
            </p>
            <NumberField
              label="Duration"
              value={duration}
              min={0.25}
              max={10}
              step={0.25}
              disabled={exporting}
              onChange={setDuration}
            />
            <label className="select-field">
              Frames per second
              <div className="select-wrap">
                <select
                  disabled={exporting}
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                >
                  {[15, 24, 30, 60].map((n) => (
                    <option key={n} value={n}>
                      {n} fps
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </div>
            </label>
            <div className="export-buttons">
              <button
                className="button primary"
                disabled={exporting}
                onClick={() => startExport("video")}
              >
                <Play size={14} />
                Video
              </button>
              <button
                className="button"
                disabled={exporting}
                onClick={() => startExport("zip")}
              >
                <Download size={14} />
                PNG frames ZIP
              </button>
            </div>
            <p className="field-help">
              Video selects a supported codec. ZIP includes exact timestamps and
              starting checkpoints.
            </p>
            {error && (
              <p className="export-feedback error" role="alert">
                {error}
              </p>
            )}
            {!exporting && notice && (
              <p className="export-feedback" role="status">
                {notice}
              </p>
            )}
            {exporting && (
              <div className="export-progress" role="status">
                <progress value={progress} max={1} />
                <span>
                  {Math.round(progress * 100)}%{" "}
                  <button
                    className="text-button"
                    onClick={() => exportAbort.current?.abort()}
                  >
                    Cancel export
                  </button>
                </span>
              </div>
            )}
          </section>
        </Drawer>
      )}
      {exporting && drawer !== "export" && (
        <button
          className="export-floating button"
          onClick={() => setDrawer("export")}
        >
          <Loader2 size={16} className="spin" />
          Exporting · {Math.round(progress * 100)}%
        </button>
      )}
    </div>
  );
}
export default App;
