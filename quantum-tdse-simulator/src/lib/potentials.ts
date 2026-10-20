/**
 * Potential Functions for TDSE Simulation
 * Provides preset potentials and custom function parsing
 */

import type { ParameterSet } from "./parameters";
import { compileRealExpression } from "./expressions";

export type PotentialType =
  | "free"
  | "barrier"
  | "well"
  | "harmonic"
  | "custom-function"
  | "custom-draw";

export interface PotentialConfig {
  type: PotentialType;
  // Barrier/Well parameters
  v0?: number; // Potential height/depth
  x0?: number; // Center position
  width?: number; // Width
  // Harmonic oscillator parameters
  omega?: number; // Angular frequency
  // Custom function
  customFunction?: string;
  // Custom draw
  customPoints?: { x: number; y: number }[];
}

/**
 * Generate free particle potential (V = 0)
 */
export function createFreePotential(x: Float64Array): Float64Array {
  return new Float64Array(x.length); // All zeros
}

/**
 * Generate potential barrier
 * V(x) = V₀ for |x - x₀| < w/2, else 0
 */
export function createBarrierPotential(
  x: Float64Array,
  v0: number,
  x0: number,
  width: number,
): Float64Array {
  const V = new Float64Array(x.length);
  const halfWidth = width / 2;

  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i] - x0) < halfWidth) {
      V[i] = v0;
    } else {
      V[i] = 0;
    }
  }

  return V;
}

/**
 * Generate finite potential well
 * V(x) = -V₀ for |x - x₀| < w/2, else 0
 */
export function createWellPotential(
  x: Float64Array,
  v0: number,
  x0: number,
  width: number,
): Float64Array {
  const V = new Float64Array(x.length);
  const halfWidth = width / 2;

  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i] - x0) < halfWidth) {
      V[i] = -v0;
    } else {
      V[i] = 0;
    }
  }

  return V;
}

/**
 * Generate harmonic oscillator potential
 * V(x) = ½mω²(x - x₀)²
 */
export function createHarmonicPotential(
  x: Float64Array,
  mass: number,
  omega: number,
  x0: number,
): Float64Array {
  const V = new Float64Array(x.length);

  for (let i = 0; i < x.length; i++) {
    const dx = x[i] - x0;
    V[i] = 0.5 * mass * omega * omega * dx * dx;
  }

  return V;
}

/**
 * Parse and evaluate custom potential function with parameter support
 * Supports: x, parameters (A, k, phi, etc.), numbers, +, -, *, /, ^, sin, cos, tan, exp, sqrt, abs, log, ln, sinh, cosh, tanh
 */
export function createCustomFunctionPotential(
  x: Float64Array,
  expression: string,
  parameters: ParameterSet = {},
): Float64Array {
  if (/\bt\b/.test(expression))
    throw new Error(
      "This release supports static V(x). Time-dependent potentials are not implemented.",
    );
  const evaluate = compileRealExpression(expression, parameters);
  return Float64Array.from(x, (xi) => evaluate(xi));
}

/**
 * Create potential from drawn points (interpolation)
 */
export function createDrawnPotential(
  x: Float64Array,
  points: { x: number; y: number }[],
): Float64Array {
  const V = new Float64Array(x.length);

  if (points.length === 0) {
    return V; // All zeros
  }

  // Sort points by x
  const sortedPoints = [...points].sort((a, b) => a.x - b.x);

  // Linear interpolation
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];

    // Find surrounding points
    let leftIdx = 0;
    let rightIdx = sortedPoints.length - 1;

    for (let j = 0; j < sortedPoints.length - 1; j++) {
      if (xi >= sortedPoints[j].x && xi <= sortedPoints[j + 1].x) {
        leftIdx = j;
        rightIdx = j + 1;
        break;
      }
    }

    // Interpolate
    if (xi <= sortedPoints[0].x) {
      V[i] = sortedPoints[0].y;
    } else if (xi >= sortedPoints[sortedPoints.length - 1].x) {
      V[i] = sortedPoints[sortedPoints.length - 1].y;
    } else {
      const x1 = sortedPoints[leftIdx].x;
      const x2 = sortedPoints[rightIdx].x;
      const y1 = sortedPoints[leftIdx].y;
      const y2 = sortedPoints[rightIdx].y;

      const t = (xi - x1) / (x2 - x1);
      V[i] = y1 + t * (y2 - y1);
    }
  }

  return V;
}

/**
 * Generate potential based on configuration
 */
export function generatePotential(
  x: Float64Array,
  config: PotentialConfig,
  mass: number = 1,
  parameters: ParameterSet = {},
): Float64Array {
  switch (config.type) {
    case "free":
      return createFreePotential(x);

    case "barrier":
      return createBarrierPotential(
        x,
        config.v0 ?? 5,
        config.x0 ?? 0,
        config.width ?? 2,
      );

    case "well":
      return createWellPotential(
        x,
        config.v0 ?? 5,
        config.x0 ?? 0,
        config.width ?? 2,
      );

    case "harmonic":
      return createHarmonicPotential(
        x,
        mass,
        config.omega ?? 1,
        config.x0 ?? 0,
      );

    case "custom-function":
      if (!config.customFunction) {
        throw new Error("Custom function not provided");
      }
      return createCustomFunctionPotential(
        x,
        config.customFunction,
        parameters,
      );

    case "custom-draw":
      if (!config.customPoints || config.customPoints.length === 0) {
        return createFreePotential(x);
      }
      return createDrawnPotential(x, config.customPoints);

    default:
      return createFreePotential(x);
  }
}

/**
 * Validate potential function string with comprehensive error reporting and parameter support
 */
export function validatePotentialFunction(
  expression: string,
  parameters: ParameterSet = {},
): { valid: boolean; error?: string; examples?: string[] } {
  try {
    if (/\bt\b/.test(expression))
      throw new Error(
        "This release supports static V(x). Time-dependent potentials are not implemented.",
      );
    const evaluate = compileRealExpression(expression, parameters);
    [0, 1, -1, 0.5, -0.5].forEach((x) => evaluate(x));
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get preset potential configurations
 */
export const PRESET_POTENTIALS = {
  free: {
    type: "free" as PotentialType,
    label: "Free Particle",
    description: "No potential (V = 0)",
  },
  barrier: {
    type: "barrier" as PotentialType,
    label: "Potential Barrier",
    description: "Step potential barrier",
    defaultParams: {
      v0: 5,
      x0: 0,
      width: 2,
    },
  },
  well: {
    type: "well" as PotentialType,
    label: "Finite Well",
    description: "Finite potential well",
    defaultParams: {
      v0: 5,
      x0: 0,
      width: 4,
    },
  },
  harmonic: {
    type: "harmonic" as PotentialType,
    label: "Harmonic Oscillator",
    description: "Quadratic potential V = ½mω²x²",
    defaultParams: {
      omega: 1,
      x0: 0,
    },
  },
};
