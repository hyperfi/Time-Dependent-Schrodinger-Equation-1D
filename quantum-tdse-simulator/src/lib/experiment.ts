import type { SimulationConfig } from '../components/ControlPanel';
import { TDSESolver, createBoundState, createCustomWavefunction, createGaussianWavepacket, createPlaneWave, type WavefunctionState } from './tdse-solver';
import { generatePotential } from './potentials';
import { isValidParameterName } from './parameters';

export type Config = SimulationConfig;
export const DEFAULT_CONFIG: Config = {
  potentialType: 'barrier', potentialV0: 5, potentialX0: 0, potentialWidth: 1.2, potentialOmega: 1,
  customPotentialFunction: '0.05*(x^2-4)^2', potentialParameters: {},
  wavefunctionType: 'gaussian', wavefunctionX0: -6, wavefunctionSigma: 1, wavefunctionK0: 3,
  wavefunctionAmplitude: 1, wavefunctionQuantumNumber: 1, wavefunctionWellWidth: 4,
  wavefunctionRealExpr: 'exp(-(x+6)^2/4)*exp(3*i*x)', wavefunctionImagExpr: '', wavefunctionParameters: {},
  gridSize: 512, xMin: -16, xMax: 16, dt: .005, stepsPerFrame: 2,
  plotXMin: -16, plotXMax: 16, plotYMin: 0, plotYMax: .6,
  abcEnabled: true, abcWidth: 3, abcStrength: .12,
};
export const SCENARIOS: { name: string; subtitle: string; description: string; config: Partial<Config> }[] = [
  { name: 'Quantum tunneling', subtitle: 'A barrier is not the end.', description: 'Watch an incoming packet split at a barrier. Compare widths to explore how the outgoing probabilities change.', config: {} },
  { name: 'Free expansion', subtitle: 'A packet finds its space.', description: 'With no external force, the mean position moves uniformly while the packet spreads. Inspect its momentum distribution.', config: { potentialType: 'free', wavefunctionX0: -3, wavefunctionK0: 1, abcEnabled: false } },
  { name: 'Coherent oscillation', subtitle: 'A quantum rhythm.', description: 'A displaced ground-width Gaussian oscillates in a harmonic trap. Its width stays constant to numerical accuracy.', config: { potentialType: 'harmonic', wavefunctionX0: -3, wavefunctionK0: 0, wavefunctionSigma: Math.SQRT1_2, abcEnabled: false } },
  { name: 'Double-well dynamics', subtitle: 'Two wells. One wave.', description: 'Explore a packet prepared in one well. Its dynamics contain several energy components; this is not a pure two-state model.', config: { potentialType: 'custom-function', customPotentialFunction: '0.05*(x^2-4)^2', wavefunctionX0: -2, wavefunctionK0: 0, wavefunctionSigma: .7, abcEnabled: false } },
  { name: 'Finite-well capture', subtitle: 'Explore what stays.', description: 'A localized packet overlaps bound and extended finite-domain modes. Inspect their residuals before loading a mode.', config: { potentialType: 'well', potentialV0: 5, potentialWidth: 4, wavefunctionX0: 0, wavefunctionK0: 0, abcEnabled: true } },
];
export interface Checkpoint {
  config: Config; real: number[]; imag: number[]; time: number; potential: number[]; initialNorm: number;
}
export interface Runtime {
  config: Config; solver: TDSESolver; state: WavefunctionState; potential: Float64Array;
  origin: Checkpoint; initialNorm: number;
}
export interface Session { a: Runtime; b: Runtime | null; fork: Checkpoint | null }
export interface Detectors { left: number; right: number }
export const cloneConfig = (config: Config): Config => JSON.parse(JSON.stringify(config));
export const cloneState = (state: WavefunctionState): WavefunctionState => ({ real: new Float64Array(state.real), imag: new Float64Array(state.imag), time: state.time });

export function validateConfig(input: unknown): Config {
  if (!input || typeof input !== 'object') throw new Error('The file does not contain an experiment configuration.');
  const source = input as Partial<Config>, config = cloneConfig(DEFAULT_CONFIG);
  for (const key of Object.keys(DEFAULT_CONFIG) as (keyof Config)[]) {
    if (source[key] !== undefined) (config as any)[key] = source[key];
    if (typeof DEFAULT_CONFIG[key] === 'number' && (typeof config[key] !== 'number' || !Number.isFinite(config[key]))) throw new Error(`Use a finite number for ${key}.`);
  }
  if (!['free', 'barrier', 'well', 'harmonic', 'custom-function', 'custom-draw'].includes(config.potentialType)) throw new Error('Unknown potential type.');
  if (!['gaussian', 'plane-wave', 'bound-state', 'custom-function'].includes(config.wavefunctionType)) throw new Error('Unknown initial state type.');
  if (![256, 512, 1024, 2048].includes(config.gridSize)) throw new Error('Choose 256, 512, 1024, or 2048 grid points.');
  const span = config.xMax - config.xMin;
  if (!(span >= 4 && span <= 200) || Math.abs(config.xMin) > 1000 || Math.abs(config.xMax) > 1000) throw new Error('Use a spatial domain between 4 and 200 units wide.');
  if (!(config.dt >= .0001 && config.dt <= .05)) throw new Error('Time step must be between 0.0001 and 0.05.');
  if (config.wavefunctionSigma < .05 || config.wavefunctionSigma > span / 2) throw new Error('Packet width must be at least 0.05 and less than half the domain.');
  if (config.potentialWidth <= 0 || config.potentialWidth > span || config.potentialOmega <= 0 || config.potentialOmega > 10 || Math.abs(config.potentialV0) > 1000) throw new Error('Check potential width, height, and frequency.');
  if (!Number.isInteger(config.wavefunctionQuantumNumber) || config.wavefunctionQuantumNumber < 1 || config.wavefunctionQuantumNumber > 32 || config.wavefunctionWellWidth <= 0 || config.wavefunctionWellWidth > span || Math.abs(config.wavefunctionAmplitude) < 1e-12) throw new Error('Check the state quantum number, well width, and nonzero amplitude.');
  if (Math.abs(config.wavefunctionK0) > 100 || Math.abs(config.wavefunctionX0) > 1000 || Math.abs(config.potentialX0) > 1000) throw new Error('Position or wave number is outside the supported range.');
  if (typeof config.abcEnabled !== 'boolean' || !(config.abcWidth > 0 && config.abcWidth < span / 2) || config.abcStrength < 0 || config.abcStrength > 5) throw new Error('Absorbing layers must fit inside the domain, with strength between 0 and 5.');
  for (const field of ['customPotentialFunction', 'wavefunctionRealExpr', 'wavefunctionImagExpr'] as const) if (typeof config[field] !== 'string' || config[field].length > 512) throw new Error('Expressions must be text below 512 characters.');
  for (const field of ['potentialParameters', 'wavefunctionParameters'] as const) {
    const parameters = config[field];
    if (!parameters || typeof parameters !== 'object' || Object.keys(parameters).length > 16) throw new Error('Use at most 16 named parameters.');
    for (const [key, p] of Object.entries(parameters)) if (!p || !isValidParameterName(key) || p.name !== key || ![p.value, p.min, p.max, p.step].every(Number.isFinite) || p.min >= p.max || p.step <= 0 || Math.abs(p.value) > 1e6) throw new Error(`Invalid parameter “${key}”. Check its name, value, and range.`);
  }
  return config;
}

export function checkpoint(runtime: Runtime): Checkpoint {
  return { config: cloneConfig(runtime.config), real: Array.from(runtime.state.real), imag: Array.from(runtime.state.imag), time: runtime.state.time, potential: Array.from(runtime.potential), initialNorm: runtime.initialNorm };
}

export function createRuntime(input: Config, saved?: Checkpoint): Runtime {
  const config = validateConfig(input);
  const solver = new TDSESolver({ gridSize: config.gridSize, xMin: config.xMin, xMax: config.xMax, dt: config.dt, mass: 1, hbar: 1, abcEnabled: config.abcEnabled, abcWidth: config.abcWidth, abcStrength: config.abcStrength });
  const potential = saved ? Float64Array.from(saved.potential) : generatePotential(solver.x, { type: config.potentialType, v0: config.potentialV0, x0: config.potentialX0, width: config.potentialWidth, omega: config.potentialOmega, customFunction: config.customPotentialFunction }, 1, config.potentialParameters);
  solver.setPotential(potential);
  let state: WavefunctionState;
  if (saved) state = { real: Float64Array.from(saved.real), imag: Float64Array.from(saved.imag), time: saved.time };
  else switch (config.wavefunctionType) {
    case 'gaussian': state = createGaussianWavepacket(solver, config.wavefunctionX0, config.wavefunctionSigma, config.wavefunctionK0); break;
    case 'plane-wave': state = createPlaneWave(solver, config.wavefunctionAmplitude, config.wavefunctionK0); break;
    case 'bound-state': state = createBoundState(solver, config.wavefunctionQuantumNumber, config.wavefunctionWellWidth); break;
    default: state = createCustomWavefunction(solver, config.wavefunctionRealExpr, config.wavefunctionImagExpr, config.wavefunctionParameters);
  }
  const norm = solver.getTotalProbability(state);
  if (!(norm > 1e-100) || !Number.isFinite(norm)) throw new Error('The initial state has no finite probability on this domain.');
  const runtime = { config, solver, state, potential, initialNorm: saved?.initialNorm ?? norm, origin: null as Checkpoint | null } as Runtime;
  runtime.origin = checkpoint(runtime);
  return runtime;
}

export function setRuntimePotential(runtime: Runtime, input: Config, drawn?: Float64Array) {
  const config = validateConfig(input);
  const potential = drawn ? new Float64Array(drawn) : generatePotential(runtime.solver.x, { type: config.potentialType, v0: config.potentialV0, x0: config.potentialX0, width: config.potentialWidth, omega: config.potentialOmega, customFunction: config.customPotentialFunction }, 1, config.potentialParameters);
  runtime.solver.setPotential(potential);
  runtime.solver.setABC(config.abcEnabled, config.abcWidth, config.abcStrength);
  runtime.config = config; runtime.potential = potential;
}

export function observe(runtime: Runtime, detectors: Detectors) {
  const { solver, state } = runtime, norm = solver.getTotalProbability(state);
  let mean = 0, second = 0, left = 0, right = 0, center = 0, edge = 0;
  solver.x.forEach((x, i) => {
    const weight = (state.real[i]**2 + state.imag[i]**2) * solver.dx;
    mean += x * weight; second += x*x * weight;
    if (x < detectors.left) left += weight; else if (x > detectors.right) right += weight; else center += weight;
    if (i < state.real.length * .1 || i >= state.real.length * .9) edge += weight;
  });
  const momentum = solver.getMomentumDistribution(state), dp = momentum.p[1] - momentum.p[0];
  let meanP = 0, secondP = 0, cutoff = 0;
  momentum.p.forEach((p, i) => {
    const weight = momentum.density[i] * dp; meanP += p*weight; secondP += p*p*weight;
    if (Math.abs(p) > Math.abs(momentum.p[0]) * .8) cutoff += weight;
  });
  const valid = norm > 1e-14;
  return { norm, energy: solver.getEnergy(state), mean: valid ? mean/norm : NaN,
    sigmaX: valid ? Math.sqrt(Math.max(0, second/norm - (mean/norm)**2)) : NaN,
    meanP: valid ? meanP/norm : NaN, sigmaP: valid ? Math.sqrt(Math.max(0, secondP/norm - (meanP/norm)**2)) : NaN,
    left, right, center, lost: Math.max(0, runtime.initialNorm - norm), edge, cutoff, momentum,
    drift: Math.abs(norm - runtime.initialNorm),
  };
}

export function serializeSession(session: Session, name: string, detectors: Detectors) {
  return JSON.stringify({ kind: 'quantum-tdse-experiment', version: 2, name, units: 'hbar=mass=1', detectors,
    a: { current: checkpoint(session.a), origin: session.a.origin }, b: session.b ? { current: checkpoint(session.b), origin: session.b.origin } : null, fork: session.fork }, null, 2);
}
function readCheckpoint(value: unknown): Checkpoint {
  if (!value || typeof value !== 'object') throw new Error('A checkpoint is missing.');
  const data = value as Checkpoint, config = validateConfig(data.config);
  for (const key of ['real', 'imag', 'potential'] as const) if (!Array.isArray(data[key]) || data[key].length !== config.gridSize || !data[key].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e12)) throw new Error(`Checkpoint ${key} must contain ${config.gridSize} finite numbers.`);
  if (!Number.isFinite(data.time) || data.time < 0 || data.time > 1e6 || !Number.isFinite(data.initialNorm) || data.initialNorm <= 0) throw new Error('Invalid checkpoint time or reference probability.');
  return { ...data, config };
}
export function deserializeSession(text: string): { session: Session; name: string; detectors: Detectors; legacy: boolean } {
  const data = JSON.parse(text);
  let a: Runtime, b: Runtime | null = null, fork: Checkpoint | null = null, legacy = false;
  if (data.kind === 'quantum-tdse-experiment' && data.version === 2) {
    const current = readCheckpoint(data.a?.current); a = createRuntime(current.config, current); a.origin = readCheckpoint(data.a.origin);
    if (data.b) {
      const currentB = readCheckpoint(data.b.current); b = createRuntime(currentB.config, currentB); b.origin = readCheckpoint(data.b.origin); fork = readCheckpoint(data.fork);
      if (Math.abs(a.state.time - b.state.time) > 1e-8 || a.config.gridSize !== b.config.gridSize || a.config.xMin !== b.config.xMin || a.config.xMax !== b.config.xMax || a.config.dt !== b.config.dt) throw new Error('Comparison branches must share a grid, time step, and current time.');
    }
  } else if (data.config && !data.kind) {
    const config = validateConfig(data.config);
    if (config.potentialType === 'custom-draw') throw new Error('This legacy file has no drawn potential data. Open a version 2 experiment instead.');
    a = createRuntime(config); legacy = true;
    if (data.state) {
      const saved = readCheckpoint({ config, ...data.state, potential: Array.from(a.potential), initialNorm: 1 });
      a = createRuntime(config, saved);
    }
  } else throw new Error('Unsupported file. Choose a saved Quantum TDSE experiment.');
  const detectors = data.detectors ?? { left: -1.1, right: 1.1 };
  if (![detectors.left, detectors.right].every(Number.isFinite) || detectors.left >= detectors.right || detectors.left <= a.config.xMin || detectors.right >= a.config.xMax) throw new Error('Detector boundaries must be ordered and inside the domain.');
  return { session: { a, b, fork }, name: typeof data.name === 'string' ? data.name.slice(0, 80) : 'Imported experiment', detectors, legacy };
}
