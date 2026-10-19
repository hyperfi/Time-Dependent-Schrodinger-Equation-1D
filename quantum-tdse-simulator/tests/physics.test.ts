import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileExpression, expressionSymbols } from "../src/lib/expressions";
import { isValidParameterName, createParameter } from "../src/lib/parameters";
import {
  checkpoint,
  cloneState,
  createRuntime,
  DEFAULT_CONFIG,
  deserializeSession,
  observe,
  serializeSession,
  setRuntimePotential,
} from "../src/lib/experiment";
import { isolatedRuntimes } from "../src/lib/export";
import { compileWavefunction } from "../src/lib/wavefunctions";
import { createCustomFunctionPotential } from "../src/lib/potentials";

let checks = 0;
const close = (actual: number, expected: number, tolerance = 1e-9) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`,
  );
const test = (name: string, run: () => void) => {
  run();
  checks++;
  console.log(`PASS ${name}`);
};
const freeConfig = {
  ...DEFAULT_CONFIG,
  potentialType: "free" as const,
  abcEnabled: false,
};

test("complex arithmetic and documented Gaussian syntax", () => {
  const z = compileWavefunction("exp(i*x)", "")(1);
  close(z.real, Math.cos(1));
  close(z.imag, Math.sin(1));
  close(compileExpression("exp(-x^2/2)")(2).real, Math.exp(-2));
  const parts = compileWavefunction("cos(3*x)", "sin(3*x)")(1);
  close(parts.real, Math.cos(3));
  close(parts.imag, Math.sin(3));
});
test("mathematical precedence and scientific notation", () => {
  close(compileExpression("-2^2")(0).real, -4);
  close(compileExpression("(-2)^2")(0).real, 4);
  close(compileExpression("2^-2")(0).real, 0.25);
  close(compileExpression("2^3^2")(0).real, 512);
  close(compileExpression("1e-3*x")(2).real, 0.002);
  assert.deepEqual(expressionSymbols("A*exp(-(x-x0)^2/(4*sigma^2))+1e-3"), [
    "A",
    "x0",
    "sigma",
  ]);
});
test("single-letter parameters, reserved names, and bounded grammar", () => {
  assert.ok(isValidParameterName("A"));
  assert.ok(isValidParameterName("k"));
  assert.ok(!isValidParameterName("i"));
  assert.ok(!isValidParameterName("pi"));
  close(
    compileExpression("A*cos(k*x)", {
      A: createParameter("A", 2),
      k: createParameter("k", 3),
    })(0).real,
    2,
  );
  for (const text of [
    "Math.sin(x)",
    "constructor(x)",
    "x;alert(1)",
    "x[0]",
    "import(x)",
    "1/0",
  ])
    assert.throws(() => compileExpression(text)(0));
  assert.throws(() => compileExpression("x".repeat(513)));
  assert.throws(() => compileExpression("(" + "x+".repeat(210) + "x)"));
});
test("potential requires finite real values across the full grid", () => {
  assert.throws(() =>
    createCustomFunctionPotential(Float64Array.of(0, 5), "1/(x-5)"),
  );
  assert.throws(() => createCustomFunctionPotential(Float64Array.of(1), "i*x"));
});
test("free Gaussian mean, spreading, and raw norm at t=1", () => {
  const r = createRuntime(freeConfig);
  r.solver.advanceTo(r.state, 1);
  const s = observe(r, { left: -1, right: 1 });
  close(s.mean, -3, 1e-5);
  close(s.sigmaX ** 2, 1.25, 1e-4);
  close(s.meanP, 3, 1e-8);
  close(s.norm, 1, 1e-10);
});
test("real-time propagation does not forcibly normalize; energy is conditional", () => {
  const r = createRuntime(freeConfig),
    reference = r.solver.getEnergy(r.state);
  r.state.real.forEach((_, i) => {
    r.state.real[i] *= 0.5;
    r.state.imag[i] *= 0.5;
  });
  r.solver.step(r.state);
  close(r.solver.getTotalProbability(r.state), 0.25);
  close(r.solver.getEnergy(r.state), reference);
  close(r.solver.getEnergyIntegral(r.state), reference * 0.25);
});
test("momentum density integrates to spatial norm with matching moments", () => {
  const r = createRuntime(freeConfig),
    distribution = r.solver.getMomentumDistribution(r.state),
    dp = distribution.p[1] - distribution.p[0];
  close(
    distribution.density.reduce((s, v) => s + v * dp, 0),
    r.solver.getTotalProbability(r.state),
  );
  const s = observe(r, { left: -1, right: 1 });
  close(s.meanP, 3);
  close(s.sigmaP, 0.5);
  close(s.sigmaX * s.sigmaP, 0.5);
});
test("fractional export times correspond to the propagated state", () => {
  const r = createRuntime(freeConfig);
  r.solver.advanceTo(r.state, 1 / 24);
  close(r.state.time, 1 / 24, 1e-14);
  close(observe(r, { left: -1, right: 1 }).mean, -6 + 3 / 24, 1e-6);
  r.solver.advanceTo(r.state, 1);
  close(observe(r, { left: -1, right: 1 }).mean, -3, 1e-5);
  assert.throws(() => r.solver.advanceTo(r.state, 0.5));
});
test("absorbed probability plus all detector regions closes the initial budget", () => {
  const r = createRuntime({ ...DEFAULT_CONFIG, potentialType: "free" });
  r.solver.advanceTo(r.state, 7);
  const s = observe(r, { left: -1, right: 1 });
  assert.ok(s.lost > 0.01);
  close(s.left + s.center + s.right + s.lost, r.initialNorm, 1e-9);
  assert.ok(s.norm < 1);
});
test("checkpoint branch is independent and time synchronized", () => {
  const a = createRuntime(DEFAULT_CONFIG);
  a.solver.advanceTo(a.state, 0.13);
  const saved = checkpoint(a),
    b = createRuntime(saved.config, saved);
  assert.deepEqual(a.state, b.state);
  setRuntimePotential(b, { ...b.config, potentialWidth: 2.4 });
  assert.notDeepEqual(a.potential, b.potential);
  assert.deepEqual(a.state, b.state);
  a.solver.advanceTo(a.state, 3);
  b.solver.advanceTo(b.state, 3);
  close(a.state.time, b.state.time, 1e-14);
  assert.ok(a.state.real.some((v, i) => Math.abs(v - b.state.real[i]) > 1e-4));
});
test("save/load round trip preserves both wavefunctions, drawn potentials, origins, and fork", () => {
  const a = createRuntime({ ...DEFAULT_CONFIG, potentialType: "custom-draw" });
  setRuntimePotential(
    a,
    a.config,
    Float64Array.from(a.solver.x, (x) => Math.sin(x)),
  );
  a.origin = checkpoint(a);
  a.solver.advanceTo(a.state, 0.1);
  const fork = checkpoint(a),
    b = createRuntime(fork.config, fork);
  b.solver.advanceTo(b.state, 0.2);
  a.solver.advanceTo(a.state, 0.2);
  const restored = deserializeSession(
    serializeSession({ a, b, fork }, "Saved test", { left: -1, right: 1 }),
  );
  assert.deepEqual(checkpoint(restored.session.a), checkpoint(a));
  assert.deepEqual(checkpoint(restored.session.b!), checkpoint(b));
  assert.deepEqual(restored.session.a.origin, a.origin);
  assert.deepEqual(restored.session.fork, fork);
});
test("invalid imports are rejected before replacing the live experiment", () => {
  const a = createRuntime(DEFAULT_CONFIG),
    data = JSON.parse(
      serializeSession({ a, b: null, fork: null }, "Bad", {
        left: -1,
        right: 1,
      }),
    );
  data.a.current.real = [0];
  assert.throws(() => deserializeSession(JSON.stringify(data)));
  assert.throws(() => createRuntime({ ...DEFAULT_CONFIG, dt: 0 }));
  assert.throws(() => createRuntime({ ...DEFAULT_CONFIG, gridSize: 500 }));
  assert.throws(() =>
    createRuntime({
      ...DEFAULT_CONFIG,
      wavefunctionType: "custom-function",
      wavefunctionRealExpr: "0",
    }),
  );
});
test("export copies preserve a loaded non-Gaussian state and do not mutate the live state", () => {
  const a = createRuntime({
      ...freeConfig,
      wavefunctionType: "custom-function",
      wavefunctionRealExpr: "exp(-x^2/2)*(1+i*x)",
      wavefunctionImagExpr: "",
    }),
    saved = checkpoint(a),
    copies = isolatedRuntimes(a, null);
  assert.deepEqual(copies.a.state, a.state);
  copies.a.solver.advanceTo(copies.a.state, 0.25);
  assert.deepEqual(checkpoint(a), saved);
});
test("correct coherent width remains constant over a quarter oscillation", () => {
  const r = createRuntime({
    ...DEFAULT_CONFIG,
    potentialType: "harmonic",
    wavefunctionX0: -3,
    wavefunctionK0: 0,
    wavefunctionSigma: Math.SQRT1_2,
    abcEnabled: false,
    dt: 0.002,
  });
  r.solver.advanceTo(r.state, Math.PI / 2);
  const s = observe(r, { left: -1, right: 1 });
  close(s.sigmaX, Math.SQRT1_2, 2e-5);
  close(s.mean, 0, 2e-5);
});
test("harmonic eigenmodes satisfy energy, residual, and orthogonality gates", () => {
  const r = createRuntime({
      ...DEFAULT_CONFIG,
      potentialType: "harmonic",
      abcEnabled: false,
    }),
    modes = r.solver.findEigenstates(4);
  modes.forEach((mode, i) => {
    close(mode.energy, i + 0.5, 3e-5);
    assert.ok(mode.residual < 0.002, `Mode ${i} residual ${mode.residual}`);
    close(r.solver.getTotalProbability(mode.state), 1, 1e-10);
    for (let j = 0; j < i; j++) {
      let overlap = 0;
      mode.state.real.forEach((v, k) => {
        overlap +=
          (v * modes[j].state.real[k] +
            mode.state.imag[k] * modes[j].state.imag[k]) *
          r.solver.dx;
      });
      close(overlap, 0, 1e-8);
    }
  });
  const first = cloneState(modes[0].state);
  r.solver.advanceTo(first, 0.5);
  close(r.solver.getTotalProbability(first), 1, 1e-10);
});
test("default barrier collision conserves energy and agrees with time refinement", () => {
  const coarse = createRuntime({ ...DEFAULT_CONFIG, abcEnabled: false });
  const fine = createRuntime({
    ...DEFAULT_CONFIG,
    dt: DEFAULT_CONFIG.dt / 2,
    abcEnabled: false,
  });
  coarse.solver.advanceTo(coarse.state, 3);
  fine.solver.advanceTo(fine.state, 3);
  const c = observe(coarse, { left: -1.1, right: 1.1 }),
    f = observe(fine, { left: -1.1, right: 1.1 });
  assert.ok(c.energyDrift < 1e-4, `Energy drift ${c.energyDrift}`);
  close(c.right, f.right, 1e-5);
});
test("credit and sticky navigation remain part of the shipped surface", () => {
  const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
  const css = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");
  assert.ok(
    app.includes("Dr. Abhishek") &&
      app.includes("https://www.dr-abhishek.com/"),
  );
  assert.match(css, /\.app-header\s*\{[^}]*position:\s*sticky;[^}]*top:\s*0;/);
});
console.log(`\n${checks} scientific/workflow checks passed.`);
