// Read-only audit probes. Run from quantum-tdse-simulator:
// node docs/audit/solver-probes.mjs
// esbuild is supplied by the existing Vite installation. No application files change.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const bundle = await build({
  stdin: {
    contents: `export * from './src/lib/tdse-solver';
      export {parseComplexFunction, validateWavefunctionFunctions} from './src/lib/wavefunctions';
      export {isValidParameterName} from './src/lib/parameters';`,
    resolveDir: root,
  },
  bundle: true, write: false, platform: 'node', format: 'cjs',
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(
  createRequire(import.meta.url), module, module.exports,
);
const {
  TDSESolver, createGaussianWavepacket, parseComplexFunction,
  validateWavefunctionFunctions, isValidParameterName,
} = module.exports;
const parameters = {
  gridSize: 512, xMin: -10, xMax: 10, dt: 0.005,
  hbar: 1, mass: 1, abcEnabled: false,
};
function moments(solver, state) {
  let norm = 0, mean = 0, second = 0;
  for (let i = 0; i < solver.x.length; i++) {
    const weight = (state.real[i] ** 2 + state.imag[i] ** 2) * solver.dx;
    norm += weight;
    mean += solver.x[i] * weight;
    second += solver.x[i] ** 2 * weight;
  }
  return { norm, mean: mean / norm, variance: second / norm - (mean / norm) ** 2 };
}
const free = new TDSESolver({ ...parameters });
free.setPotential(new Float64Array(512));
const packet = createGaussianWavepacket(free, -4, 1, 3);
for (let i = 0; i < 200; i++) free.step(packet);
const harmonic = new TDSESolver({ ...parameters });
harmonic.setPotential(Float64Array.from(harmonic.x, x => 0.5 * x * x));
const harmonicEnergies = harmonic.findEigenstates(4).map(entry => entry.energy);
const presetSolver = new TDSESolver({ ...parameters, dt: 0.001 });
presetSolver.setPotential(Float64Array.from(presetSolver.x, x => 0.5 * x * x));
const presetPacket = createGaussianWavepacket(presetSolver, -3, 1, 0);
for (let i = 0; i < 1571; i++) presetSolver.step(presetPacket);
const previousError = console.error;
let gaussianValidation;
try {
  console.error = () => {};
  gaussianValidation = validateWavefunctionFunctions('exp(-x^2/2)', '');
} finally {
  console.error = previousError;
}
const scaled = {
  real: Float64Array.from(packet.real, x => x / 2),
  imag: Float64Array.from(packet.imag, x => x / 2), time: packet.time,
};
console.log(JSON.stringify({
  scope: 'Selected local numerical probes; not a convergence study or full validation suite.',
  parameters,
  stochasticNote: 'ITP currently uses Math.random; eigenvalue results may vary between runs.',
  freeGaussian: {
    time: packet.time, observed: moments(free, packet),
    expected: { mean: -1, variance: 1.25 },
    caveat: 'step() forcibly normalizes with absorption disabled; reported norm is not raw drift.',
  },
  harmonicEigenvalues: { observed: harmonicEnergies, expected: [0.5, 1.5, 2.5, 3.5] },
  documentedComplexExpression: {
    expression: 'exp(i*x)', x: 1, observed: parseComplexFunction('exp(i*x)', '', 1),
    expected: { real: Math.cos(1), imag: Math.sin(1) },
  },
  documentedGaussianExpression: gaussianValidation,
  parameterNames: { A: isValidParameterName('A'), k: isValidParameterName('k'), phi: isValidParameterName('phi') },
  coherentPreset: {
    initialVariance: 1, time: presetPacket.time, observed: moments(presetSolver, presetPacket),
    coherentRequiredSigma: Math.sqrt(0.5),
  },
  energyOfScaledState: {
    probability: free.getTotalProbability(scaled),
    displayedEnergy: free.getEnergy(scaled),
    conditionalEnergy: free.getEnergy(scaled) / free.getTotalProbability(scaled),
    normalizedReferenceEnergy: free.getEnergy(packet),
  },
  freePotentialEigenstates: {
    energies: free.findEigenstates(4).map(entry => entry.energy),
    interpretation: 'Finite periodic-box modes; not localized bound states of a free particle on the line.',
  },
}, null, 2));
