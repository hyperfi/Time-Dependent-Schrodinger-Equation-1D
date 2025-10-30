/**
 * Time-Dependent Schrödinger Equation Solver
 * Using Split-Operator FFT Method
 * 
 * The TDSE: iℏ ∂ψ/∂t = Ĥψ = (T̂ + V̂)ψ
 * Split-operator: e^(-iĤΔt/ℏ) ≈ e^(-iV̂Δt/2ℏ) · e^(-iT̂Δt/ℏ) · e^(-iV̂Δt/2ℏ)
 */

import FFT from 'fft.js';
import { ParameterSet, substituteParameters } from './parameters';

export interface SimulationParameters {
  gridSize: number;           // Number of spatial grid points (power of 2)
  xMin: number;               // Minimum x coordinate
  xMax: number;               // Maximum x coordinate
  dt: number;                 // Time step
  hbar: number;               // Reduced Planck constant (ℏ)
  mass: number;               // Particle mass
}

export interface WavefunctionState {
  real: Float64Array;         // Real part of wavefunction
  imag: Float64Array;         // Imaginary part of wavefunction
  time: number;               // Current time
}

export class TDSESolver {
  private params: SimulationParameters;
  private fft: FFT;
  private ifft: FFT;
  
  // Spatial grid
  public x: Float64Array;
  public dx: number;
  
  // Momentum grid
  private k: Float64Array;
  private dk: number;
  
  // Evolution operators (pre-computed for efficiency)
  private expVhalf_real: Float64Array;  // cos(-VΔt/2ℏ)
  private expVhalf_imag: Float64Array;  // sin(-VΔt/2ℏ)
  private expT_real: Float64Array;      // cos(-ℏk²Δt/2m)
  private expT_imag: Float64Array;      // sin(-ℏk²Δt/2m)
  
  // Current potential
  private potential: Float64Array;
  
  constructor(params: SimulationParameters) {
    this.params = params;
    
    // Ensure grid size is power of 2 for FFT
    const n = Math.pow(2, Math.ceil(Math.log2(params.gridSize)));
    this.params.gridSize = n;
    
    // Initialize FFT
    this.fft = new FFT(n);
    this.ifft = new FFT(n);
    
    // Setup spatial grid
    this.dx = (params.xMax - params.xMin) / n;
    this.x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.x[i] = params.xMin + i * this.dx;
    }
    
    // Setup momentum grid (for FFT convention)
    this.dk = 2 * Math.PI / (params.xMax - params.xMin);
    this.k = new Float64Array(n);
    for (let i = 0; i < n / 2; i++) {
      this.k[i] = i * this.dk;
    }
    for (let i = n / 2; i < n; i++) {
      this.k[i] = (i - n) * this.dk;
    }
    
    // Initialize operators
    this.expVhalf_real = new Float64Array(n);
    this.expVhalf_imag = new Float64Array(n);
    this.expT_real = new Float64Array(n);
    this.expT_imag = new Float64Array(n);
    this.potential = new Float64Array(n);
    
    // Pre-compute kinetic operator (doesn't change with potential)
    this.updateKineticOperator();
  }
  
  /**
   * Update kinetic evolution operator
   */
  private updateKineticOperator(): void {
    const { dt, hbar, mass } = this.params;
    const n = this.params.gridSize;
    
    for (let i = 0; i < n; i++) {
      const phase = -hbar * this.k[i] * this.k[i] * dt / (2 * mass);
      this.expT_real[i] = Math.cos(phase);
      this.expT_imag[i] = Math.sin(phase);
    }
  }
  
  /**
   * Update potential and recompute potential evolution operator
   */
  setPotential(V: Float64Array): void {
    if (V.length !== this.params.gridSize) {
      throw new Error(`Potential array size ${V.length} doesn't match grid size ${this.params.gridSize}`);
    }
    
    this.potential = V;
    
    // Update potential operator
    const { dt, hbar } = this.params;
    const n = this.params.gridSize;
    
    for (let i = 0; i < n; i++) {
      const phase = -V[i] * dt / (2 * hbar);
      this.expVhalf_real[i] = Math.cos(phase);
      this.expVhalf_imag[i] = Math.sin(phase);
    }
  }
  
  /**
   * Apply potential evolution operator: ψ → exp(-iVΔt/2ℏ)ψ
   */
  private applyPotentialOperator(psi_real: Float64Array, psi_imag: Float64Array): void {
    const n = this.params.gridSize;
    
    for (let i = 0; i < n; i++) {
      const re = psi_real[i];
      const im = psi_imag[i];
      const cos_v = this.expVhalf_real[i];
      const sin_v = this.expVhalf_imag[i];
      
      // Complex multiplication: (re + i*im) * (cos_v + i*sin_v)
      psi_real[i] = re * cos_v - im * sin_v;
      psi_imag[i] = re * sin_v + im * cos_v;
    }
  }
  
  /**
   * Apply kinetic evolution operator in momentum space
   */
  private applyKineticOperator(psi_k_real: Float64Array, psi_k_imag: Float64Array): void {
    const n = this.params.gridSize;
    
    for (let i = 0; i < n; i++) {
      const re = psi_k_real[i];
      const im = psi_k_imag[i];
      const cos_t = this.expT_real[i];
      const sin_t = this.expT_imag[i];
      
      // Complex multiplication
      psi_k_real[i] = re * cos_t - im * sin_t;
      psi_k_imag[i] = re * sin_t + im * cos_t;
    }
  }
  
  /**
   * Perform single time step evolution
   */
  step(state: WavefunctionState): WavefunctionState {
    const n = this.params.gridSize;
    
    // Step 1: Apply potential operator (half step)
    this.applyPotentialOperator(state.real, state.imag);
    
    // Step 2: Transform to momentum space
    const psi_interleaved = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      psi_interleaved[2 * i] = state.real[i];
      psi_interleaved[2 * i + 1] = state.imag[i];
    }
    
    const psi_k = this.fft.createComplexArray();
    this.fft.transform(psi_k, psi_interleaved);
    
    // Extract real and imaginary parts
    const psi_k_real = new Float64Array(n);
    const psi_k_imag = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      psi_k_real[i] = psi_k[2 * i];
      psi_k_imag[i] = psi_k[2 * i + 1];
    }
    
    // Step 3: Apply kinetic operator in momentum space
    this.applyKineticOperator(psi_k_real, psi_k_imag);
    
    // Step 4: Transform back to position space
    const psi_k_interleaved = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      psi_k_interleaved[2 * i] = psi_k_real[i];
      psi_k_interleaved[2 * i + 1] = psi_k_imag[i];
    }
    
    const psi_out = this.fft.createComplexArray();
    this.fft.inverseTransform(psi_out, psi_k_interleaved);
    
    // Extract and normalize by FFT size
    for (let i = 0; i < n; i++) {
      state.real[i] = psi_out[2 * i] / n;
      state.imag[i] = psi_out[2 * i + 1] / n;
    }
    
    // Step 5: Apply potential operator (half step)
    this.applyPotentialOperator(state.real, state.imag);
    
    // Update time
    state.time += this.params.dt;
    
    // Normalize wavefunction to ensure probability conservation
    this.normalize(state);
    
    return state;
  }
  
  /**
   * Normalize wavefunction: ∫|ψ|²dx = 1
   */
  private normalize(state: WavefunctionState): void {
    const n = this.params.gridSize;
    let norm = 0;
    
    for (let i = 0; i < n; i++) {
      norm += state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
    }
    norm = Math.sqrt(norm * this.dx);
    
    if (norm > 0) {
      for (let i = 0; i < n; i++) {
        state.real[i] /= norm;
        state.imag[i] /= norm;
      }
    }
  }
  
  /**
   * Calculate probability density |ψ|²
   */
  getProbabilityDensity(state: WavefunctionState): Float64Array {
    const n = this.params.gridSize;
    const prob = new Float64Array(n);
    
    for (let i = 0; i < n; i++) {
      prob[i] = state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
    }
    
    return prob;
  }
  
  /**
   * Calculate total probability (should be 1)
   */
  getTotalProbability(state: WavefunctionState): number {
    const n = this.params.gridSize;
    let prob = 0;
    
    for (let i = 0; i < n; i++) {
      prob += state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
    }
    
    return prob * this.dx;
  }
  
  /**
   * Calculate expectation value of energy: <E> = <ψ|Ĥ|ψ>
   */
  getEnergy(state: WavefunctionState): number {
    const n = this.params.gridSize;
    const { hbar, mass } = this.params;
    
    // Kinetic energy contribution (in momentum space)
    const psi_interleaved = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      psi_interleaved[2 * i] = state.real[i];
      psi_interleaved[2 * i + 1] = state.imag[i];
    }
    
    const psi_k = this.fft.createComplexArray();
    this.fft.transform(psi_k, psi_interleaved);
    
    let kineticEnergy = 0;
    for (let i = 0; i < n; i++) {
      const re = psi_k[2 * i] / n;
      const im = psi_k[2 * i + 1] / n;
      kineticEnergy += (re * re + im * im) * hbar * hbar * this.k[i] * this.k[i] / (2 * mass);
    }
    kineticEnergy *= this.dx;
    
    // Potential energy contribution
    let potentialEnergy = 0;
    for (let i = 0; i < n; i++) {
      const prob = state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
      potentialEnergy += prob * this.potential[i];
    }
    potentialEnergy *= this.dx;
    
    return kineticEnergy + potentialEnergy;
  }
  
  /**
   * Check if wavefunction has significant probability near boundaries
   */
  checkBoundaries(state: WavefunctionState, threshold: number = 0.01): boolean {
    const n = this.params.gridSize;
    const boundarySize = Math.floor(n * 0.1); // Check 10% from each edge
    
    let boundaryProb = 0;
    for (let i = 0; i < boundarySize; i++) {
      boundaryProb += state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
      const j = n - 1 - i;
      boundaryProb += state.real[j] * state.real[j] + state.imag[j] * state.imag[j];
    }
    boundaryProb *= this.dx;
    
    return boundaryProb > threshold;
  }
}

/**
 * Create Gaussian wavepacket initial state
 */
export function createGaussianWavepacket(
  solver: TDSESolver,
  x0: number,
  sigma: number,
  k0: number
): WavefunctionState {
  const n = solver.x.length;
  const state: WavefunctionState = {
    real: new Float64Array(n),
    imag: new Float64Array(n),
    time: 0,
  };
  
  // ψ(x,0) = A·exp(-((x-x₀)²)/(4σ²))·exp(ik₀x)
  for (let i = 0; i < n; i++) {
    const x = solver.x[i];
    const gaussian = Math.exp(-Math.pow(x - x0, 2) / (4 * sigma * sigma));
    state.real[i] = gaussian * Math.cos(k0 * x);
    state.imag[i] = gaussian * Math.sin(k0 * x);
  }
  
  // Normalize
  let norm = 0;
  for (let i = 0; i < n; i++) {
    norm += state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
  }
  norm = Math.sqrt(norm * solver.dx);
  
  for (let i = 0; i < n; i++) {
    state.real[i] /= norm;
    state.imag[i] /= norm;
  }
  
  return state;
}

/**
 * Create plane wave initial state
 */
export function createPlaneWave(
  solver: TDSESolver,
  amplitude: number,
  k0: number
): WavefunctionState {
  const n = solver.x.length;
  const state: WavefunctionState = {
    real: new Float64Array(n),
    imag: new Float64Array(n),
    time: 0,
  };
  
  // ψ(x,0) = A·exp(ik₀x)
  for (let i = 0; i < n; i++) {
    const x = solver.x[i];
    state.real[i] = amplitude * Math.cos(k0 * x);
    state.imag[i] = amplitude * Math.sin(k0 * x);
  }
  
  // Normalize
  let norm = 0;
  for (let i = 0; i < n; i++) {
    norm += state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
  }
  norm = Math.sqrt(norm * solver.dx);
  
  for (let i = 0; i < n; i++) {
    state.real[i] /= norm;
    state.imag[i] /= norm;
  }
  
  return state;
}

/**
 * Create bound state in infinite square well
 */
export function createBoundState(
  solver: TDSESolver,
  n: number,
  L: number
): WavefunctionState {
  const nPoints = solver.x.length;
  const state: WavefunctionState = {
    real: new Float64Array(nPoints),
    imag: new Float64Array(nPoints),
    time: 0,
  };
  
  // ψₙ(x) = √(2/L)·sin(nπx/L) for 0 < x < L, else 0
  for (let i = 0; i < nPoints; i++) {
    const x = solver.x[i];
    if (x > 0 && x < L) {
      state.real[i] = Math.sqrt(2 / L) * Math.sin(n * Math.PI * x / L);
      state.imag[i] = 0;
    } else {
      state.real[i] = 0;
      state.imag[i] = 0;
    }
  }
  
  // Normalize (should already be normalized)
  let norm = 0;
  for (let i = 0; i < nPoints; i++) {
    norm += state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
  }
  norm = Math.sqrt(norm * solver.dx);
  
  for (let i = 0; i < nPoints; i++) {
    state.real[i] /= norm;
    state.imag[i] /= norm;
  }
  
  return state;
}

/**
 * Parse complex function for custom wavefunctions with parameter support
 */
function parseComplexFunction(
  realExpr: string,
  imagExpr: string,
  x: number,
  t: number = 0,
  parameters: ParameterSet = {}
): { real: number; imag: number } {
  const safeEval = (expr: string, xVal: number, tVal: number = 0): number => {
    try {
      if (!expr || expr.trim() === '') {
        return 0;
      }
      
      // Replace parameters with their values
      let evalExpr = substituteParameters(expr, parameters);
      
      evalExpr = evalExpr
        .replace(/\bx\b/g, `(${xVal})`)
        .replace(/\bt\b/g, `(${tVal})`)
        .replace(/\bi\b/g, '(1)');
      
      evalExpr = evalExpr.replace(/\^/g, '**');
      evalExpr = evalExpr.replace(/\bsin\s*\(/g, 'Math.sin(');
      evalExpr = evalExpr.replace(/\bcos\s*\(/g, 'Math.cos(');
      evalExpr = evalExpr.replace(/\btan\s*\(/g, 'Math.tan(');
      evalExpr = evalExpr.replace(/\bsinh\s*\(/g, 'Math.sinh(');
      evalExpr = evalExpr.replace(/\bcosh\s*\(/g, 'Math.cosh(');
      evalExpr = evalExpr.replace(/\btanh\s*\(/g, 'Math.tanh(');
      evalExpr = evalExpr.replace(/\bexp\s*\(/g, 'Math.exp(');
      evalExpr = evalExpr.replace(/\bsqrt\s*\(/g, 'Math.sqrt(');
      evalExpr = evalExpr.replace(/\babs\s*\(/g, 'Math.abs(');
      evalExpr = evalExpr.replace(/\blog\s*\(/g, 'Math.log(');
      evalExpr = evalExpr.replace(/\bln\s*\(/g, 'Math.log(');
      evalExpr = evalExpr.replace(/\bpi\b/gi, 'Math.PI');
      evalExpr = evalExpr.replace(/\be\b/g, 'Math.E');
      
      const result = new Function('Math', `return ${evalExpr}`)(Math);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error(`Non-finite result: ${result}`);
      }
      
      return result;
    } catch (error) {
      throw new Error(`Failed to evaluate "${expr}" at x=${xVal}, t=${tVal}: ${error}`);
    }
  };
  
  const real = realExpr.trim() ? safeEval(realExpr, x, t) : 0;
  const imag = imagExpr.trim() ? safeEval(imagExpr, x, t) : 0;
  
  return { real, imag };
}

/**
 * Create custom wavefunction from mathematical expressions with parameter support
 */
export function createCustomWavefunction(
  solver: TDSESolver,
  realExpr: string,
  imagExpr: string,
  parameters: ParameterSet = {}
): WavefunctionState {
  const n = solver.x.length;
  const state: WavefunctionState = {
    real: new Float64Array(n),
    imag: new Float64Array(n),
    time: 0,
  };
  
  // Evaluate at each grid point
  for (let i = 0; i < n; i++) {
    const x = solver.x[i];
    try {
      const { real, imag } = parseComplexFunction(realExpr, imagExpr, x, 0, parameters);
      state.real[i] = real;
      state.imag[i] = imag;
    } catch (error) {
      // Set to zero if evaluation fails
      console.warn(`Failed to evaluate wavefunction at x=${x}:`, error);
      state.real[i] = 0;
      state.imag[i] = 0;
    }
  }
  
  // Normalize
  let norm = 0;
  for (let i = 0; i < n; i++) {
    norm += state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
  }
  norm = Math.sqrt(norm * solver.dx);
  
  if (norm > 0) {
    for (let i = 0; i < n; i++) {
      state.real[i] /= norm;
      state.imag[i] /= norm;
    }
  }
  
  return state;
}
