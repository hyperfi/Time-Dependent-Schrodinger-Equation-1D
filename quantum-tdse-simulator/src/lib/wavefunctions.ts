import type { ParameterSet } from './parameters';
import { compileExpression, compileRealExpression } from './expressions';
export type WavefunctionType = 'gaussian' | 'plane-wave' | 'bound-state' | 'custom-function';
export interface WavefunctionConfig {
  type: WavefunctionType; x0?: number; sigma?: number; k0?: number; amplitude?: number;
  n?: number; L?: number; realFunction?: string; imagFunction?: string;
}
/** A full complex expression is allowed when the imaginary component field is empty. */
export function compileWavefunction(realExpr: string, imagExpr: string, parameters: ParameterSet = {}) {
  if (!realExpr.trim() && !imagExpr.trim()) throw new Error('Enter a wavefunction expression.');
  if (!imagExpr.trim()) return compileExpression(realExpr, parameters);
  const real = realExpr.trim() ? compileRealExpression(realExpr, parameters) : () => 0;
  const imag = compileRealExpression(imagExpr, parameters);
  return (x: number, t = 0) => ({ real: real(x, t), imag: imag(x, t) });
}
export function parseComplexFunction(realExpr: string, imagExpr: string, x: number, t = 0, parameters: ParameterSet = {}) {
  return compileWavefunction(realExpr, imagExpr, parameters)(x, t);
}
export function validateWavefunctionFunctions(realExpr: string, imagExpr: string, parameters: ParameterSet = {}) {
  try {
    const evaluate = compileWavefunction(realExpr, imagExpr, parameters);
    [0, 1, -1, .5].forEach(x => evaluate(x));
    return { valid: true, error: undefined as string | undefined };
  } catch (error) { return { valid: false, error: error instanceof Error ? error.message : String(error) }; }
}

/**
 * Get preset wavefunction configurations
 */
export const PRESET_WAVEFUNCTIONS = {
  gaussian: {
    type: 'gaussian' as WavefunctionType,
    label: 'Gaussian Wave Packet',
    description: 'ψ(x,0) = A·exp(-(x-x₀)²/(4σ²))·exp(ik₀x)',
    defaultParams: {
      x0: 0,
      sigma: 1,
      k0: 0
    }
  },
  'plane-wave': {
    type: 'plane-wave' as WavefunctionType,
    label: 'Plane Wave',
    description: 'ψ(x,0) = A·exp(ik₀x)',
    defaultParams: {
      amplitude: 1,
      k0: 1
    }
  },
  'bound-state': {
    type: 'bound-state' as WavefunctionType,
    label: 'Infinite Square Well',
    description: 'ψₙ(x) = √(2/L)·sin(nπx/L)',
    defaultParams: {
      n: 1,
      L: 4
    }
  },
  'custom-function': {
    type: 'custom-function' as WavefunctionType,
    label: 'Custom Function',
    description: 'User-defined complex wavefunction',
    defaultParams: {}
  }
};
