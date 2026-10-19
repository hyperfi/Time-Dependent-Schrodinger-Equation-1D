import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  SlidersHorizontal,
  Waves,
  Mountain,
  ArrowRight,
  X,
} from "lucide-react";
import type { Config, Runtime } from "../lib/experiment";
import { createParameter, type ParameterSet } from "../lib/parameters";
import { expressionSymbols } from "../lib/expressions";
import type { Eigenmode } from "../lib/tdse-solver";

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
  range = false,
  help,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  range?: boolean;
  help?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(Number(value.toFixed(6)))), [value]);
  const commit = () => {
    const parsed = Number(text);
    if (
      text.trim() &&
      Number.isFinite(parsed) &&
      (min === undefined || parsed >= min) &&
      (max === undefined || parsed <= max)
    )
      onChange(parsed);
    else setText(String(value));
  };
  return (
    <label className={`number-field ${disabled ? "field-disabled" : ""}`}>
      <span className="field-line">
        <span>{label}</span>
        <input
          aria-label={label}
          type="number"
          value={text}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </span>
      {range && (
        <input
          className="range-input"
          aria-label={`${label} slider`}
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          style={
            {
              "--range-progress": `${Math.max(0, Math.min(100, ((value - (min ?? 0)) / ((max ?? 1) - (min ?? 0))) * 100))}%`,
            } as React.CSSProperties
          }
        />
      )}
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}

function ExpressionEditor({
  config,
  kind,
  onApply,
  disabled,
}: {
  config: Config;
  kind: "potential" | "state";
  onApply: (config: Partial<Config>) => void;
  disabled: boolean;
}) {
  const initial =
      kind === "potential"
        ? config.customPotentialFunction
        : config.wavefunctionRealExpr,
    initialImag = kind === "state" ? config.wavefunctionImagExpr : "";
  const [expression, setExpression] = useState(initial),
    [imag, setImag] = useState(initialImag),
    [parameters, setParameters] = useState<ParameterSet>(
      kind === "potential"
        ? config.potentialParameters
        : config.wavefunctionParameters,
    );
  useEffect(() => {
    setExpression(initial);
    setImag(initialImag);
    setParameters(
      kind === "potential"
        ? config.potentialParameters
        : config.wavefunctionParameters,
    );
  }, [
    initial,
    initialImag,
    kind,
    config.potentialParameters,
    config.wavefunctionParameters,
  ]);
  const names = expressionSymbols(`${expression} ${imag}`).slice(0, 16),
    resolved = Object.fromEntries(
      names.map((name) => [name, parameters[name] ?? createParameter(name)]),
    );
  return (
    <div className="expression-editor">
      <label className="text-field">
        {kind === "potential" ? "Potential V(x)" : "Wavefunction ψ(x,0)"}
        <textarea
          spellCheck={false}
          value={expression}
          onChange={(e) => setExpression(e.target.value)}
          disabled={disabled}
          rows={2}
        />
      </label>
      {kind === "state" && (
        <label className="text-field">
          Imaginary component (optional)
          <input
            spellCheck={false}
            value={imag}
            onChange={(e) => setImag(e.target.value)}
            disabled={disabled}
            placeholder="Leave empty for exp(i*k*x)"
          />
        </label>
      )}
      <p className="field-help">
        {kind === "potential"
          ? "Real-valued functions of x."
          : "Complex expressions work when the imaginary field is empty."}{" "}
        Use ^ for powers and * for multiplication.
      </p>
      {names.length > 0 && (
        <div className="expression-parameters">
          <h3>Detected parameters</h3>
          {names.map((name) => (
            <NumberField
              key={name}
              label={name}
              value={resolved[name].value}
              min={resolved[name].min}
              max={resolved[name].max}
              step={resolved[name].step}
              range
              disabled={disabled}
              onChange={(value) =>
                setParameters({
                  ...resolved,
                  [name]: { ...resolved[name], value },
                })
              }
            />
          ))}
        </div>
      )}
      <button
        className="button primary small"
        disabled={disabled}
        onClick={() =>
          onApply(
            kind === "potential"
              ? {
                  customPotentialFunction: expression,
                  potentialParameters: resolved,
                }
              : {
                  wavefunctionRealExpr: expression,
                  wavefunctionImagExpr: imag,
                  wavefunctionParameters: resolved,
                },
          )
        }
      >
        Apply expression <ArrowRight size={14} />
      </button>
    </div>
  );
}

export function SetupPanel({
  runtime,
  branch,
  comparison,
  locked,
  onChange,
  onClose,
  modes,
  onCompute,
  onCancel,
  computing,
  onLoadMode,
  onClearDraw,
}: {
  runtime: Runtime;
  branch: "a" | "b";
  comparison: boolean;
  locked: boolean;
  onChange: (change: Partial<Config>, structural?: boolean) => void;
  onClose: () => void;
  modes: Eigenmode[];
  onCompute: () => void;
  onCancel: () => void;
  computing: boolean;
  onLoadMode: (mode: Eigenmode) => void;
  onClearDraw: () => void;
}) {
  const [tab, setTab] = useState<"potential" | "state" | "numerics">(
      "potential",
    ),
    c = runtime.config;
  const update = (key: keyof Config, value: any, structural = false) =>
    onChange({ [key]: value }, structural);
  const structuralDisabled = comparison || locked;
  return (
    <aside className="setup-panel" aria-label="Experiment setup">
      <div className="setup-heading">
        <div>
          <h2>Experiment setup</h2>
          <p>
            {comparison
              ? `Editing branch ${branch.toUpperCase()}`
              : "Prepare your quantum system"}
          </p>
        </div>
        <button
          className="icon-button mobile-close"
          aria-label="Close setup"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="setup-tabs" role="tablist" aria-label="Setup section">
        {(
          [
            ["potential", Mountain, "Potential"],
            ["state", Waves, "State"],
            ["numerics", SlidersHorizontal, "Numerics"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
      <div
        className="setup-content"
        role="tabpanel"
        aria-label={`${tab} settings`}
      >
        {tab === "potential" && (
          <>
            <section className="setup-section">
              <h3>Potential landscape</h3>
              <label className="select-field">
                Potential type
                <div className="select-wrap">
                  <select
                    value={c.potentialType}
                    disabled={locked}
                    onChange={(e) => update("potentialType", e.target.value)}
                  >
                    <option value="barrier">Rectangular barrier</option>
                    <option value="free">Free particle</option>
                    <option value="well">Finite square well</option>
                    <option value="harmonic">Harmonic oscillator</option>
                    <option value="custom-function">Custom expression</option>
                    <option value="custom-draw">Draw on canvas</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
              {["barrier", "well"].includes(c.potentialType) && (
                <>
                  <NumberField
                    label={
                      c.potentialType === "well" ? "Depth V₀" : "Height V₀"
                    }
                    value={c.potentialV0}
                    min={0.1}
                    max={20}
                    step={0.1}
                    range
                    disabled={locked}
                    onChange={(v) => update("potentialV0", v)}
                  />
                  <NumberField
                    label="Width w"
                    value={c.potentialWidth}
                    min={0.2}
                    max={8}
                    step={0.1}
                    range
                    disabled={locked}
                    onChange={(v) => update("potentialWidth", v)}
                  />
                </>
              )}
              {c.potentialType === "harmonic" && (
                <NumberField
                  label="Frequency ω"
                  value={c.potentialOmega}
                  min={0.1}
                  max={3}
                  step={0.05}
                  range
                  disabled={locked}
                  onChange={(v) => update("potentialOmega", v)}
                />
              )}
              {["barrier", "well", "harmonic"].includes(c.potentialType) && (
                <NumberField
                  label="Center x₀"
                  value={c.potentialX0}
                  min={c.xMin + 1}
                  max={c.xMax - 1}
                  step={0.1}
                  range
                  disabled={locked}
                  onChange={(v) => update("potentialX0", v)}
                />
              )}
              {c.potentialType === "free" && (
                <p className="context-note">
                  V(x) = 0. With no external force, a free packet spreads while
                  its mean momentum stays constant.
                </p>
              )}
              {c.potentialType === "custom-function" && (
                <ExpressionEditor
                  config={c}
                  kind="potential"
                  disabled={locked}
                  onApply={(value) => onChange(value)}
                />
              )}
              {c.potentialType === "custom-draw" && (
                <>
                  <p className="context-note">
                    Drag across the position plot to paint V(x). The amber right
                    axis gives the potential scale.
                  </p>
                  <button
                    className="button small"
                    disabled={locked}
                    onClick={onClearDraw}
                  >
                    Clear drawing
                  </button>
                  <p className="field-help">
                    For a keyboard alternative, choose Custom expression.
                  </p>
                </>
              )}
            </section>
            <section className="setup-section">
              <h3>Boundary behavior</h3>
              <label className="switch-field">
                <span>
                  Absorbing edges
                  <span className="field-help">
                    Let outgoing probability leave
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={c.abcEnabled}
                  disabled={locked}
                  onChange={(e) => update("abcEnabled", e.target.checked)}
                />
              </label>
              <p className="context-note">
                {c.abcEnabled
                  ? "Absorbed probability is tracked separately. The remaining state is not renormalized."
                  : "FFT boundaries are periodic: a packet reaching one edge can re-enter at the other."}
              </p>
            </section>
            <section className="setup-section modes-section">
              <h3>Energy eigenmodes</h3>
              <p className="field-help">
                Finite-domain modes, not automatically physical bound states.
                Residual target: 10⁻³.
              </p>
              <button
                className="button full small"
                disabled={computing || locked}
                onClick={onCompute}
              >
                {computing ? "Finding eigenmodes…" : "Find 4 eigenmodes"}
                <ArrowRight size={14} />
              </button>
              {computing && (
                <button className="text-button" onClick={onCancel}>
                  Cancel calculation
                </button>
              )}
              {modes.map((mode, i) => (
                <div className="mode-row" key={i}>
                  <div>
                    <strong>n = {i}</strong>
                    <span>E = {mode.energy.toFixed(4)}</span>
                    <small className={mode.converged ? "" : "warning-text"}>
                      residual {mode.residual.toExponential(1)}
                      {mode.converged ? "" : " · unconverged"}
                    </small>
                  </div>
                  <button
                    className="button small"
                    disabled={structuralDisabled || !mode.converged}
                    onClick={() => onLoadMode(mode)}
                  >
                    Load
                  </button>
                </div>
              ))}
            </section>
          </>
        )}
        {tab === "state" && (
          <>
            <section className="setup-section">
              <h3>Initial wavefunction</h3>
              {comparison && (
                <p className="context-note">
                  Both branches share the prepared state. End comparison before
                  preparing a new state.
                </p>
              )}
              <label className="select-field">
                State type
                <div className="select-wrap">
                  <select
                    value={c.wavefunctionType}
                    disabled={structuralDisabled}
                    onChange={(e) =>
                      update("wavefunctionType", e.target.value, true)
                    }
                  >
                    <option value="gaussian">Gaussian wave packet</option>
                    <option value="plane-wave">Periodic plane wave</option>
                    <option value="bound-state">Square-well profile</option>
                    <option value="custom-function">Custom expression</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
              {c.wavefunctionType === "gaussian" && (
                <>
                  <NumberField
                    label="Position x₀"
                    value={c.wavefunctionX0}
                    min={c.xMin + 1}
                    max={c.xMax - 1}
                    step={0.1}
                    range
                    disabled={structuralDisabled}
                    onChange={(v) => update("wavefunctionX0", v, true)}
                  />
                  <NumberField
                    label="Width σ"
                    value={c.wavefunctionSigma}
                    min={0.1}
                    max={4}
                    step={0.05}
                    range
                    disabled={structuralDisabled}
                    onChange={(v) => update("wavefunctionSigma", v, true)}
                  />
                </>
              )}
              {["gaussian", "plane-wave"].includes(c.wavefunctionType) && (
                <NumberField
                  label="Wave number k₀"
                  value={c.wavefunctionK0}
                  min={-8}
                  max={8}
                  step={0.1}
                  range
                  disabled={structuralDisabled}
                  onChange={(v) => update("wavefunctionK0", v, true)}
                  help="Momentum p₀ = ℏk₀; here ℏ = 1."
                />
              )}
              {c.wavefunctionType === "plane-wave" && (
                <p className="context-note">
                  For a smooth periodic plane wave choose k₀ = 2πn/L. Other
                  values introduce an edge discontinuity.
                </p>
              )}
              {c.wavefunctionType === "bound-state" && (
                <>
                  <NumberField
                    label="Quantum number n"
                    value={c.wavefunctionQuantumNumber}
                    min={1}
                    max={12}
                    step={1}
                    disabled={structuralDisabled}
                    onChange={(v) =>
                      update("wavefunctionQuantumNumber", v, true)
                    }
                  />
                  <NumberField
                    label="Profile width L"
                    value={c.wavefunctionWellWidth}
                    min={0.2}
                    max={12}
                    step={0.1}
                    disabled={structuralDisabled}
                    onChange={(v) => update("wavefunctionWellWidth", v, true)}
                  />
                  <p className="context-note">
                    A sine profile on 0 &lt; x &lt; L. It is an initial shape,
                    not an eigenstate of an arbitrary potential.
                  </p>
                </>
              )}
              {c.wavefunctionType === "custom-function" && (
                <ExpressionEditor
                  config={c}
                  kind="state"
                  disabled={structuralDisabled}
                  onApply={(value) => onChange(value, true)}
                />
              )}
            </section>
            <div className="equation-note">
              <span>iℏ ∂ψ/∂t = Ĥψ</span>
              <p>
                The state evolves with the time-dependent Schrödinger equation.
                Preparing a state resets time to zero.
              </p>
            </div>
          </>
        )}
        {tab === "numerics" && (
          <>
            <section className="setup-section">
              <h3>Numerical grid</h3>
              <label className="select-field">
                Grid points
                <div className="select-wrap">
                  <select
                    value={c.gridSize}
                    disabled={structuralDisabled}
                    onChange={(e) =>
                      update("gridSize", Number(e.target.value), true)
                    }
                  >
                    {[256, 512, 1024, 2048].map((n) => (
                      <option key={n} value={n}>
                        {n} points
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} />
                </div>
              </label>
              <NumberField
                label="Domain minimum"
                value={c.xMin}
                min={-100}
                max={c.xMax - 4}
                step={1}
                disabled={structuralDisabled}
                onChange={(v) => onChange({ xMin: v, plotXMin: v }, true)}
              />
              <NumberField
                label="Domain maximum"
                value={c.xMax}
                min={c.xMin + 4}
                max={100}
                step={1}
                disabled={structuralDisabled}
                onChange={(v) => onChange({ xMax: v, plotXMax: v }, true)}
              />
              <NumberField
                label="Time step Δt"
                value={c.dt}
                min={0.0001}
                max={0.05}
                step={0.001}
                disabled={structuralDisabled}
                onChange={(v) => update("dt", v, true)}
              />
              <p className="context-note">
                Split-operator FFT · Δx = {runtime.solver.dx.toFixed(4)}.
                Smaller Δt and finer grids need convergence checks;
                normalization alone does not establish accuracy.
              </p>
            </section>
            <section className="setup-section">
              <h3>Absorbing layer</h3>
              <NumberField
                label="Layer width"
                value={c.abcWidth}
                min={0.2}
                max={(c.xMax - c.xMin) / 2 - 0.1}
                step={0.1}
                disabled={locked}
                onChange={(v) => update("abcWidth", v)}
              />
              <NumberField
                label="Layer strength"
                value={c.abcStrength}
                min={0}
                max={1}
                step={0.01}
                disabled={locked}
                onChange={(v) => update("abcStrength", v)}
              />
            </section>
            <section className="setup-section">
              <h3>Plot window</h3>
              <NumberField
                label="Visible x minimum"
                value={c.plotXMin}
                min={c.xMin}
                max={c.plotXMax - 0.1}
                step={1}
                onChange={(v) => onChange({ plotXMin: v })}
              />
              <NumberField
                label="Visible x maximum"
                value={c.plotXMax}
                min={c.plotXMin + 0.1}
                max={c.xMax}
                step={1}
                onChange={(v) => onChange({ plotXMax: v })}
              />
            </section>
            <div className="equation-note">
              <span>ℏ = 1 · m = 1</span>
              <p>
                All quantities use dimensionless units. Energy is the
                conditional mean of the surviving packet.
              </p>
            </div>
          </>
        )}
      </div>
      <div className="setup-footnote">
        <span className="status-dot" />
        Local simulation · your browser
      </div>
    </aside>
  );
}

export function Drawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={(node) => {
          if (node && !node.contains(document.activeElement)) node.focus();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const items = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]",
            ),
          );
          const first = items[0],
            last = items[items.length - 1];
          if (
            e.shiftKey &&
            (document.activeElement === first ||
              document.activeElement === e.currentTarget)
          ) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="drawer-title">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label={`Close ${title}`}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
