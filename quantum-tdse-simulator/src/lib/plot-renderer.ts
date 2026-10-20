import type { Runtime, Detectors } from "./experiment";
export type PlotView = "density" | "components" | "phase";
export const PLOT_COLORS = {
  a: "#168577",
  b: "#ba6747",
  potential: "#b78336",
  real: "#6275bc",
  imag: "#b85b78",
};
const font = '11px "IBM Plex Mono", Consolas, monospace';
const margin = { left: 49, right: 49, top: 32, bottom: 39 };
const nice = (v: number) =>
  Math.abs(v) < 1e-9
    ? "0"
    : Math.abs(v) < 0.01
      ? v.toExponential(1)
      : Number(v.toFixed(2)).toString();

export function potentialBounds(runtime: Runtime) {
  const min = Math.min(0, ...runtime.potential),
    max = Math.max(6, ...runtime.potential);
  // Very tall confining walls may leave the plot; keep the central dynamics readable.
  return { min: Math.max(-30, min * 1.15), max: Math.min(30, max * 1.2) };
}

/** Fit at least 99.9% of each actual branch distribution, capped by Nyquist. */
export function momentumDisplayLimit(
  distributions: { p: Float64Array; density: Float64Array }[],
) {
  let extent = 8,
    nyquist = Infinity;
  for (const { p, density } of distributions) {
    nyquist = Math.min(nyquist, Math.abs(p[0]));
    const total = density.reduce((sum, value) => sum + value, 0);
    if (!(total > 1e-100)) continue;
    let cumulative = 0;
    for (let i = 0; i < p.length; i++) {
      const previous = cumulative;
      cumulative += density[i] / total;
      if (cumulative >= 0.0005 && previous <= 0.9995)
        extent = Math.max(extent, Math.abs(p[i]) * 1.1);
    }
  }
  return Math.min(nyquist, extent);
}

export function renderPosition(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  a: Runtime,
  b: Runtime | null,
  detectors: Detectors,
  view: PlotView,
  showDetectors = true,
) {
  const { left, right, top, bottom } = margin,
    w = width - left - right,
    h = height - top - bottom;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (w < 10 || h < 10) return;
  const xMin = a.config.plotXMin,
    xMax = a.config.plotXMax;
  const mapX = (x: number) => left + ((x - xMin) / (xMax - xMin)) * w;
  let peak = 0.1;
  for (const runtime of [a, b])
    if (runtime)
      runtime.state.real.forEach((v, i) => {
        peak = Math.max(
          peak,
          view === "components"
            ? Math.abs(v)
            : v * v + runtime.state.imag[i] ** 2,
          view === "components" ? Math.abs(runtime.state.imag[i]) : 0,
        );
      });
  const yMax = Math.max(view === "components" ? 0.9 : 0.52, peak * 1.16),
    yMin = view === "components" ? -yMax : 0;
  const mapY = (y: number) => top + h - ((y - yMin) / (yMax - yMin)) * h;
  const boundsA = potentialBounds(a),
    boundsB = b ? potentialBounds(b) : boundsA;
  const bounds = {
      min: Math.min(boundsA.min, boundsB.min),
      max: Math.max(boundsA.max, boundsB.max),
    },
    mapV = (y: number) =>
      top + h - ((y - bounds.min) / (bounds.max - bounds.min)) * h;
  ctx.font = font;
  ctx.lineWidth = 1;
  for (let j = 0; j <= 4; j++) {
    const y = yMin + ((yMax - yMin) * j) / 4,
      py = mapY(y);
    ctx.strokeStyle = "#edf1ee";
    ctx.beginPath();
    ctx.moveTo(left, py);
    ctx.lineTo(left + w, py);
    ctx.stroke();
    ctx.fillStyle = "#637268";
    ctx.textAlign = "right";
    ctx.fillText(nice(y), left - 10, py + 4);
    ctx.fillStyle = "#936423";
    ctx.textAlign = "left";
    ctx.fillText(
      nice(bounds.min + ((bounds.max - bounds.min) * j) / 4),
      left + w + 10,
      py + 4,
    );
  }
  for (let j = 0; j <= 4; j++) {
    const x = xMin + ((xMax - xMin) * j) / 4,
      px = mapX(x);
    ctx.strokeStyle = "#edf1ee";
    ctx.beginPath();
    ctx.moveTo(px, top);
    ctx.lineTo(px, top + h);
    ctx.stroke();
    ctx.fillStyle = "#637268";
    ctx.textAlign = "center";
    ctx.fillText(nice(x), px, height - 17);
  }
  ctx.fillStyle = "#637268";
  ctx.textAlign = "left";
  ctx.fillText(view === "components" ? "Amplitude" : "Density |ψ|²", left, 15);
  ctx.fillStyle = "#936423";
  ctx.textAlign = "right";
  ctx.fillText("V(x) · right axis", left + w, 15);
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, w, h);
  ctx.clip();
  if (showDetectors) {
    for (const boundary of [detectors.left, detectors.right]) {
      ctx.strokeStyle = "#b6c9be";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(mapX(boundary), top);
      ctx.lineTo(mapX(boundary), top + h);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(22,133,119,.025)";
    ctx.fillRect(left, top, mapX(detectors.left) - left, h);
    ctx.fillRect(
      mapX(detectors.right),
      top,
      left + w - mapX(detectors.right),
      h,
    );
  }
  const drawPotential = (runtime: Runtime, dashed: boolean) => {
    ctx.beginPath();
    runtime.solver.x.forEach((x, i) =>
      i === 0
        ? ctx.moveTo(mapX(x), mapV(runtime.potential[i]))
        : ctx.lineTo(mapX(x), mapV(runtime.potential[i])),
    );
    ctx.strokeStyle = PLOT_COLORS.potential;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(dashed ? [5, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!dashed) {
      ctx.lineTo(mapX(runtime.solver.x[runtime.solver.x.length - 1]), mapV(0));
      ctx.lineTo(mapX(runtime.solver.x[0]), mapV(0));
      ctx.closePath();
      ctx.fillStyle = "rgba(183,131,54,.07)";
      ctx.fill();
    }
  };
  drawPotential(a, false);
  if (b) drawPotential(b, true);
  const drawCurve = (
    runtime: Runtime,
    part: "density" | "real" | "imag",
    color: string,
    dashed = false,
  ) => {
    ctx.beginPath();
    runtime.solver.x.forEach((x, i) => {
      const value =
        part === "density"
          ? runtime.state.real[i] ** 2 + runtime.state.imag[i] ** 2
          : runtime.state[part][i];
      if (i === 0) ctx.moveTo(mapX(x), mapY(value));
      else ctx.lineTo(mapX(x), mapY(value));
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [6, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (part === "density") {
      ctx.lineTo(mapX(runtime.solver.x[runtime.solver.x.length - 1]), mapY(0));
      ctx.lineTo(mapX(runtime.solver.x[0]), mapY(0));
      ctx.closePath();
      ctx.fillStyle =
        color === PLOT_COLORS.a
          ? "rgba(22,133,119,.10)"
          : "rgba(186,103,71,.06)";
      ctx.fill();
    }
  };
  if (view === "components") {
    drawCurve(a, "real", PLOT_COLORS.real);
    drawCurve(a, "imag", PLOT_COLORS.imag);
    if (b) {
      drawCurve(b, "real", PLOT_COLORS.b, true);
      drawCurve(b, "imag", PLOT_COLORS.b, true);
    }
  } else {
    drawCurve(a, "density", PLOT_COLORS.a);
    if (b) drawCurve(b, "density", PLOT_COLORS.b, true);
    if (view === "phase")
      for (let i = 1; i < a.solver.x.length; i++) {
        const density = a.state.real[i] ** 2 + a.state.imag[i] ** 2;
        if (density < 0.0001) continue;
        const phase = Math.atan2(a.state.imag[i], a.state.real[i]);
        ctx.strokeStyle = `hsl(${((phase + Math.PI) * 360) / (2 * Math.PI)},55%,48%)`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(
          mapX(a.solver.x[i - 1]),
          mapY(a.state.real[i - 1] ** 2 + a.state.imag[i - 1] ** 2),
        );
        ctx.lineTo(mapX(a.solver.x[i]), mapY(density));
        ctx.stroke();
      }
  }
  ctx.restore();
  ctx.strokeStyle = "#dce5df";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, top + h);
  ctx.lineTo(left + w, top + h);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#637268";
  ctx.fillText("Position x", width / 2, height - 1);
}
