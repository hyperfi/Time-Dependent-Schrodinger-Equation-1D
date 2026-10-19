/**
 * Time-Dependent Schrödinger Equation Solver
 * Using Split-Operator FFT Method
 *
 * The TDSE: iℏ ∂ψ/∂t = Ĥψ = (T̂ + V̂)ψ
 * Split-operator: e^(-iĤΔt/ℏ) ≈ e^(-iV̂Δt/2ℏ) · e^(-iT̂Δt/ℏ) · e^(-iV̂Δt/2ℏ)
 */

import FFT from "fft.js";
import type { ParameterSet } from "./parameters";
import { compileWavefunction } from "./wavefunctions";

export interface SimulationParameters {
  gridSize: number; // Number of spatial grid points (power of 2)
  xMin: number; // Minimum x coordinate
  xMax: number; // Maximum x coordinate
  dt: number; // Time step
  hbar: number; // Reduced Planck constant (ℏ)
  mass: number; // Particle mass
  abcEnabled?: boolean; // Enable absorbing boundary conditions
  abcWidth?: number; // Spatial width of absorbing region
  abcStrength?: number; // Absorption strength
}

export interface WavefunctionState {
  real: Float64Array; // Real part of wavefunction
  imag: Float64Array; // Imaginary part of wavefunction
  time: number; // Current time
}

export interface Eigenmode {
  energy: number;
  state: WavefunctionState;
  residual: number;
  converged: boolean;
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
  private expVhalf_real: Float64Array; // cos(-VΔt/2ℏ)
  private expVhalf_imag: Float64Array; // sin(-VΔt/2ℏ)
  private expT_real: Float64Array; // cos(-ℏk²Δt/2m)
  private expT_imag: Float64Array; // sin(-ℏk²Δt/2m)

  // Absorbing boundary mask
  private abcMask: Float64Array;

  // Current potential
  private potential: Float64Array;
  private workInput: number[];
  private workMomentum: number[];
  private workOutput: number[];

  constructor(params: SimulationParameters) {
    if (
      !Number.isInteger(params.gridSize) ||
      params.gridSize < 64 ||
      params.gridSize > 4096 ||
      (params.gridSize & (params.gridSize - 1)) !== 0
    )
      throw new Error("Grid must be a power of two between 64 and 4096.");
    if (
      ![params.xMin, params.xMax, params.dt, params.hbar, params.mass].every(
        Number.isFinite,
      ) ||
      params.xMax <= params.xMin ||
      params.dt <= 0 ||
      params.hbar <= 0 ||
      params.mass <= 0
    )
      throw new Error(
        "Use a positive time step and an increasing finite domain.",
      );
    this.params = { ...params };

    // Ensure grid size is power of 2 for FFT
    const n = Math.pow(2, Math.ceil(Math.log2(params.gridSize)));
    this.params.gridSize = n;

    // Initialize FFT
    this.fft = new FFT(n);
    this.ifft = new FFT(n);
    this.workInput = this.fft.createComplexArray();
    this.workMomentum = this.fft.createComplexArray();
    this.workOutput = this.fft.createComplexArray();

    // Setup spatial grid
    this.dx = (params.xMax - params.xMin) / n;
    this.x = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      this.x[i] = params.xMin + i * this.dx;
    }

    // Setup momentum grid (for FFT convention)
    this.dk = (2 * Math.PI) / (params.xMax - params.xMin);
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
    this.abcMask = new Float64Array(n);

    // Pre-compute kinetic operator (doesn't change with potential)
    this.updateKineticOperator();
    // Pre-compute absorbing boundary mask
    this.updateAbsorbingMask();
  }

  /**
   * Update kinetic evolution operator
   */
  private updateKineticOperator(): void {
    const { dt, hbar, mass } = this.params;
    const n = this.params.gridSize;

    for (let i = 0; i < n; i++) {
      const phase = (-hbar * this.k[i] * this.k[i] * dt) / (2 * mass);
      this.expT_real[i] = Math.cos(phase);
      this.expT_imag[i] = Math.sin(phase);
    }
  }

  /**
   * Pre-compute the absorbing boundary mask
   */
  public updateAbsorbingMask(): void {
    const { gridSize, xMin, xMax, abcEnabled, abcWidth, abcStrength, dt } =
      this.params;
    const n = gridSize;
    const width = abcWidth ?? 2.0;
    const strength = abcStrength ?? 0.5;
    const enabled = abcEnabled ?? false;

    for (let i = 0; i < n; i++) {
      const xi = this.x[i];
      // Distance from boundary (if within width)
      const distL = Math.max(0, xMin + width - xi);
      const distR = Math.max(0, xi - (xMax - width));
      const dist = Math.max(distL, distR);

      if (enabled && dist > 0) {
        // Smooth quadratic absorption. Scale dt to make strength parameter intuitive.
        const frac = dist / width;
        this.abcMask[i] = Math.exp(-strength * frac * frac * dt * 100);
      } else {
        this.abcMask[i] = 1.0;
      }
    }
  }

  /**
   * Update ABC settings dynamically
   */
  public setABC(enabled: boolean, width: number, strength: number): void {
    this.params.abcEnabled = enabled;
    this.params.abcWidth = width;
    this.params.abcStrength = strength;
    this.updateAbsorbingMask();
  }

  /**
   * Update potential and recompute potential evolution operator
   */
  setPotential(V: Float64Array): void {
    if (V.length !== this.params.gridSize) {
      throw new Error(
        `Potential array size ${V.length} doesn't match grid size ${this.params.gridSize}`,
      );
    }

    if (!V.every(Number.isFinite))
      throw new Error("Potential contains non-finite values.");
    this.potential = new Float64Array(V);

    // Update potential operator
    const { dt, hbar } = this.params;
    const n = this.params.gridSize;

    for (let i = 0; i < n; i++) {
      const phase = (-V[i] * dt) / (2 * hbar);
      this.expVhalf_real[i] = Math.cos(phase);
      this.expVhalf_imag[i] = Math.sin(phase);
    }
  }

  /**
   * Apply potential evolution operator: ψ → exp(-iVΔt/2ℏ)ψ
   */
  private applyPotentialOperator(
    psi_real: Float64Array,
    psi_imag: Float64Array,
  ): void {
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
  private applyKineticOperator(
    psi_k_real: Float64Array,
    psi_k_imag: Float64Array,
  ): void {
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

    // Reuse FFT scratch storage, avoiding allocations in each evolution step.
    for (let i = 0; i < n; i++) {
      this.workInput[2 * i] = state.real[i];
      this.workInput[2 * i + 1] = state.imag[i];
    }
    this.fft.transform(this.workMomentum, this.workInput);
    for (let i = 0; i < n; i++) {
      const re = this.workMomentum[2 * i],
        im = this.workMomentum[2 * i + 1];
      this.workMomentum[2 * i] =
        re * this.expT_real[i] - im * this.expT_imag[i];
      this.workMomentum[2 * i + 1] =
        re * this.expT_imag[i] + im * this.expT_real[i];
    }
    this.fft.inverseTransform(this.workOutput, this.workMomentum);
    for (let i = 0; i < n; i++) {
      state.real[i] = this.workOutput[2 * i];
      state.imag[i] = this.workOutput[2 * i + 1];
    }

    // Step 5: Apply potential operator (half step)
    this.applyPotentialOperator(state.real, state.imag);

    // Apply absorbing boundary condition mask
    if (this.params.abcEnabled) {
      for (let i = 0; i < n; i++) {
        state.real[i] *= this.abcMask[i];
        state.imag[i] *= this.abcMask[i];
      }
    }

    // Update time
    state.time += this.params.dt;

    // Expose raw norm drift: never renormalize real-time propagation.

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
  getEnergyIntegral(state: WavefunctionState): number {
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
      const re = psi_k[2 * i];
      const im = psi_k[2 * i + 1];
      kineticEnergy +=
        ((re * re + im * im) * hbar * hbar * this.k[i] * this.k[i]) /
        (2 * mass);
    }
    // Correct scale is dx / n instead of dx / n^2
    kineticEnergy *= this.dx / n;

    // Potential energy contribution
    let potentialEnergy = 0;
    for (let i = 0; i < n; i++) {
      const prob =
        state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
      potentialEnergy += prob * this.potential[i];
    }
    potentialEnergy *= this.dx;

    return kineticEnergy + potentialEnergy;
  }

  /** Conditional energy of the surviving state. */
  getEnergy(state: WavefunctionState): number {
    const norm = this.getTotalProbability(state);
    return norm > 1e-14 ? this.getEnergyIntegral(state) / norm : NaN;
  }

  /** Includes a final fractional step; no falsified timestamp. */
  advanceTo(state: WavefunctionState, target: number): void {
    if (!Number.isFinite(target) || target < state.time - 1e-10)
      throw new Error(
        "Target time must be finite and cannot precede the checkpoint.",
      );
    const dt = this.params.dt;
    while (target - state.time >= dt - 1e-12) this.step(state);
    const remaining = target - state.time;
    if (remaining > 1e-11) {
      this.params.dt = remaining;
      this.updateKineticOperator();
      this.setPotential(this.potential);
      this.updateAbsorbingMask();
      try {
        this.step(state);
      } finally {
        this.params.dt = dt;
        this.updateKineticOperator();
        this.setPotential(this.potential);
        this.updateAbsorbingMask();
      }
    }
    state.time = target;
  }

  getMomentumDistribution(state: WavefunctionState): {
    p: Float64Array;
    density: Float64Array;
  } {
    const n = this.x.length,
      input = this.fft.createComplexArray(),
      output = this.fft.createComplexArray();
    for (let i = 0; i < n; i++) {
      input[2 * i] = state.real[i];
      input[2 * i + 1] = state.imag[i];
    }
    this.fft.transform(output, input);
    const p = new Float64Array(n),
      density = new Float64Array(n);
    for (let j = 0; j < n; j++) {
      const i = (j + n / 2) % n;
      p[j] = this.params.hbar * this.k[i];
      density[j] =
        ((output[2 * i] ** 2 + output[2 * i + 1] ** 2) * this.dx) /
        (n * this.dk * this.params.hbar);
    }
    return { p, density };
  }

  eigenResidual(
    state: WavefunctionState,
    energy = this.getEnergy(state),
  ): number {
    const n = this.x.length,
      input = this.fft.createComplexArray(),
      output = this.fft.createComplexArray(),
      back = this.fft.createComplexArray();
    for (let i = 0; i < n; i++) {
      input[2 * i] = state.real[i];
      input[2 * i + 1] = state.imag[i];
    }
    this.fft.transform(output, input);
    for (let i = 0; i < n; i++) {
      const kinetic =
        (this.params.hbar ** 2 * this.k[i] ** 2) / (2 * this.params.mass);
      output[2 * i] *= kinetic;
      output[2 * i + 1] *= kinetic;
    }
    this.fft.inverseTransform(back, output);
    let residual = 0;
    for (let i = 0; i < n; i++)
      residual +=
        (back[2 * i] + (this.potential[i] - energy) * state.real[i]) ** 2 +
        (back[2 * i + 1] + (this.potential[i] - energy) * state.imag[i]) ** 2;
    return Math.sqrt((residual * this.dx) / this.getTotalProbability(state));
  }

  /**
   * Check if wavefunction has significant probability near boundaries
   */
  checkBoundaries(state: WavefunctionState, threshold: number = 0.01): boolean {
    const n = this.params.gridSize;
    const boundarySize = Math.floor(n * 0.1); // Check 10% from each edge

    let boundaryProb = 0;
    for (let i = 0; i < boundarySize; i++) {
      boundaryProb +=
        state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
      const j = n - 1 - i;
      boundaryProb +=
        state.real[j] * state.real[j] + state.imag[j] * state.imag[j];
    }
    boundaryProb *= this.dx;

    return boundaryProb > threshold;
  }

  /**
   * Perform single imaginary time step evolution: dt -> -i * dTau
   * Kinetic and potential steps act as damping operations, decaying higher energy states.
   */
  imaginaryTimeStep(state: WavefunctionState, dTau: number): void {
    const n = this.params.gridSize;
    const { hbar, mass } = this.params;

    // A constant shift changes only imaginary-time normalization and avoids overflow in deep wells.
    const potentialFloor = Math.min(...this.potential);
    // 1. Apply potential decay (half step)
    for (let i = 0; i < n; i++) {
      const factor = Math.exp(
        (-(this.potential[i] - potentialFloor) * dTau) / (2 * hbar),
      );
      state.real[i] *= factor;
      state.imag[i] *= factor;
    }

    // 2. FFT to momentum space
    const psi_interleaved = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) {
      psi_interleaved[2 * i] = state.real[i];
      psi_interleaved[2 * i + 1] = state.imag[i];
    }
    const psi_k = this.fft.createComplexArray();
    this.fft.transform(psi_k, psi_interleaved);

    // 3. Apply kinetic decay in momentum space
    for (let i = 0; i < n; i++) {
      const kVal = this.k[i];
      const factor = Math.exp(-((hbar * kVal * kVal) / (2 * mass)) * dTau);
      psi_k[2 * i] *= factor;
      psi_k[2 * i + 1] *= factor;
    }

    // 4. IFFT back to position space
    const psi_out = this.fft.createComplexArray();
    this.fft.inverseTransform(psi_out, psi_k);

    for (let i = 0; i < n; i++) {
      state.real[i] = psi_out[2 * i];
      state.imag[i] = psi_out[2 * i + 1];
    }

    // 5. Apply potential decay (half step)
    for (let i = 0; i < n; i++) {
      const factor = Math.exp(
        (-(this.potential[i] - potentialFloor) * dTau) / (2 * hbar),
      );
      state.real[i] *= factor;
      state.imag[i] *= factor;
    }
  }

  /**
   * Find first N bound eigenstates and their corresponding energy eigenvalues
   * uses imaginary time propagation combined with Gram-Schmidt orthogonalization.
   */
  findEigenstates(
    count: number = 4,
    maxIterations: number = 2400,
  ): Eigenmode[] {
    const eigenstates: Eigenmode[] = [];
    const n = this.params.gridSize;
    const dTau = 0.02; // imaginary step size

    // Helper to generate a localized broad Gaussian trial state
    const createTrialState = (shift: number): WavefunctionState => {
      const real = new Float64Array(n);
      const imag = new Float64Array(n);
      const xMin = this.params.xMin;
      const xMax = this.params.xMax;
      const width = xMax - xMin;
      const sigma = width / 4;

      const center = (xMin + xMax) / 2 + shift;
      for (let i = 0; i < n; i++) {
        const dx = this.x[i] - center;
        // Broad gaussian + random noise to break parity symmetry
        real[i] =
          Math.exp((-dx * dx) / (2 * sigma * sigma)) +
          Math.sin(i * 12.9898 + shift * 78.233) * 0.01;
        imag[i] = 0;
      }
      const state = { real, imag, time: 0 };
      this.normalize(state);
      return state;
    };

    for (let s = 0; s < count; s++) {
      // Alternate centers and add noise to ensure overlapping excited states converge
      const trial = createTrialState(s % 2 === 0 ? 0 : 0.8);

      let prevEnergy = this.getEnergy(trial);

      for (let iter = 0; iter < maxIterations; iter++) {
        this.imaginaryTimeStep(trial, dTau);

        // Gram-Schmidt orthogonalization against all lower found eigenstates
        for (let k = 0; k < s; k++) {
          const lowerState = eigenstates[k].state;
          let overlapReal = 0;
          let overlapImag = 0;

          for (let i = 0; i < n; i++) {
            // Correct inner product: <lowerState | trial> = \int lowerState^*(x) * trial(x) dx
            overlapReal +=
              trial.real[i] * lowerState.real[i] +
              trial.imag[i] * lowerState.imag[i];
            overlapImag +=
              trial.imag[i] * lowerState.real[i] -
              trial.real[i] * lowerState.imag[i];
          }
          overlapReal *= this.dx;
          overlapImag *= this.dx;

          for (let i = 0; i < n; i++) {
            trial.real[i] -=
              overlapReal * lowerState.real[i] -
              overlapImag * lowerState.imag[i];
            trial.imag[i] -=
              overlapReal * lowerState.imag[i] +
              overlapImag * lowerState.real[i];
          }
        }

        this.normalize(trial);

        // Check energy convergence every 10 iterations
        if (iter > 0 && iter % 10 === 0) {
          const currentEnergy = this.getEnergy(trial);
          if (
            Math.abs(currentEnergy - prevEnergy) < 1e-9 &&
            this.eigenResidual(trial, currentEnergy) < 1e-3
          ) {
            prevEnergy = currentEnergy;
            break;
          }
          prevEnergy = currentEnergy;
        }
      }

      const finalEnergy = this.getEnergy(trial);

      // Rotate phase so the maximum peak lies on the real axis (textbook look)
      let maxVal = -1;
      let maxIdx = 0;
      for (let i = 0; i < n; i++) {
        const amp =
          trial.real[i] * trial.real[i] + trial.imag[i] * trial.imag[i];
        if (amp > maxVal) {
          maxVal = amp;
          maxIdx = i;
        }
      }
      const phase = Math.atan2(trial.imag[maxIdx], trial.real[maxIdx]);
      const cosPhase = Math.cos(phase);
      const sinPhase = Math.sin(phase);
      for (let i = 0; i < n; i++) {
        const re = trial.real[i];
        const im = trial.imag[i];
        trial.real[i] = re * cosPhase + im * sinPhase;
        trial.imag[i] = im * cosPhase - re * sinPhase;
      }

      eigenstates.push({
        energy: finalEnergy,
        residual: this.eigenResidual(trial, finalEnergy),
        converged: this.eigenResidual(trial, finalEnergy) < 1e-3,
        state: {
          real: new Float64Array(trial.real),
          imag: new Float64Array(trial.imag),
          time: 0,
        },
      });
    }

    return eigenstates;
  }
}

/**
 * Create Gaussian wavepacket initial state
 */
export function createGaussianWavepacket(
  solver: TDSESolver,
  x0: number,
  sigma: number,
  k0: number,
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
  k0: number,
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
  L: number,
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
      state.real[i] = Math.sqrt(2 / L) * Math.sin((n * Math.PI * x) / L);
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

/** Compile once, evaluate the entire grid, and reject invalid/zero states atomically. */
export function createCustomWavefunction(
  solver: TDSESolver,
  realExpr: string,
  imagExpr: string,
  parameters: ParameterSet = {},
): WavefunctionState {
  const evaluate = compileWavefunction(realExpr, imagExpr, parameters);
  const state: WavefunctionState = {
    real: new Float64Array(solver.x.length),
    imag: new Float64Array(solver.x.length),
    time: 0,
  };
  solver.x.forEach((x, i) => {
    const value = evaluate(x);
    state.real[i] = value.real;
    state.imag[i] = value.imag;
  });
  const norm = Math.sqrt(solver.getTotalProbability(state));
  if (!(norm > 1e-100) || !Number.isFinite(norm))
    throw new Error(
      "The wavefunction must have finite, nonzero probability on this grid.",
    );
  state.real.forEach((_, i) => {
    state.real[i] /= norm;
    state.imag[i] /= norm;
  });
  return state;
}
