/**
 * Wavefunction Utilities for TDSE Simulation
 * Provides preset wavefunctions and custom function parsing
 */

import { ParameterSet, substituteParameters } from './parameters';

export type WavefunctionType = 
  | 'gaussian'
  | 'plane-wave'
  | 'bound-state'
  | 'custom-function';

export interface WavefunctionConfig {
  type: WavefunctionType;
  // Gaussian parameters
  x0?: number;
  sigma?: number;
  k0?: number;
  
  // Plane wave parameters
  amplitude?: number;
  
  // Bound state parameters
  n?: number;  // quantum number
  L?: number;  // well width
  
  // Custom function
  realFunction?: string;
  imagFunction?: string;
}

/**
 * Parse and evaluate custom wavefunction components with parameter support
 * Supports: x, t (for time-dependent), i (imaginary unit), parameters (A, k, phi, etc.), numbers, +, -, *, /, ^, sin, cos, exp, sqrt, abs
 */
export function parseComplexFunction(
  realExpr: string,
  imagExpr: string,
  x: number,
  t: number = 0,
  parameters: ParameterSet = {}
): { real: number; imag: number } {
  // Enhanced expression parser for wavefunctions with parameter support
  const safeEval = (expr: string, xVal: number, tVal: number = 0): number => {
    try {
      // Basic validation
      if (!expr || expr.trim() === '') {
        throw new Error('Empty expression');
      }
      
      // Replace parameters with their values
      let evalExpr = substituteParameters(expr, parameters);
      
      // Replace variables with actual values
      evalExpr = evalExpr
        .replace(/\bx\b/g, `(${xVal})`)
        .replace(/\bt\b/g, `(${tVal})`)
        .replace(/\bi\b/g, '(1)'); // We'll handle i separately for complex numbers
      
      // Replace ^ with ** for JavaScript
      evalExpr = evalExpr.replace(/\^/g, '**');
      
      // Replace mathematical functions
      evalExpr = evalExpr.replace(/\bsin\s*\(/g, 'Math.sin(');
      evalExpr = evalExpr.replace(/\bcos\s*\(/g, 'Math.cos(');
      evalExpr = evalExpr.replace(/\btan\s*\(/g, 'Math.tan(');
      evalExpr = evalExpr.replace(/\bexp\s*\(/g, 'Math.exp(');
      evalExpr = evalExpr.replace(/\bsqrt\s*\(/g, 'Math.sqrt(');
      evalExpr = evalExpr.replace(/\babs\s*\(/g, 'Math.abs(');
      evalExpr = evalExpr.replace(/\blog\s*\(/g, 'Math.log(');
      evalExpr = evalExpr.replace(/\bln\s*\(/g, 'Math.log(');
      
      // Add hyperbolic functions
      evalExpr = evalExpr.replace(/\bsinh\s*\(/g, 'Math.sinh(');
      evalExpr = evalExpr.replace(/\bcosh\s*\(/g, 'Math.cosh(');
      evalExpr = evalExpr.replace(/\btanh\s*\(/g, 'Math.tanh(');
      
      // Constants
      evalExpr = evalExpr.replace(/\bpi\b/gi, 'Math.PI');
      evalExpr = evalExpr.replace(/\be\b/g, 'Math.E');
      
      // Additional safety checks
      if (!/^[\d\s\+\-\*\/\.\(\)\w\^\s]*$/.test(evalExpr)) {
        throw new Error('Invalid characters in expression');
      }
      
      // Evaluate
      const result = new Function('Math', `return ${evalExpr}`)(Math);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error(`Expression evaluates to non-finite number: ${result}`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error evaluating expression "${expr}" at x=${xVal}, t=${tVal}:`, error);
      throw error;
    }
  };
  
  let real: number, imag: number;
  
  try {
    if (realExpr.trim() && imagExpr.trim()) {
      // Both real and imaginary parts specified
      real = safeEval(realExpr, x, t);
      imag = safeEval(imagExpr, x, t);
    } else if (realExpr.trim()) {
      // Only real part specified - assume real wavefunction
      real = safeEval(realExpr, x, t);
      imag = 0;
    } else if (imagExpr.trim()) {
      // Only imaginary part specified
      real = 0;
      imag = safeEval(imagExpr, x, t);
    } else {
      throw new Error('At least one component (real or imaginary) must be specified');
    }
  } catch (error) {
    throw new Error(`Failed to evaluate wavefunction at x=${x}, t=${t}: ${error}`);
  }
  
  return { real, imag };
}

/**
 * Validate wavefunction function strings with parameter support
 */
export function validateWavefunctionFunctions(
  realExpr: string,
  imagExpr: string,
  parameters: ParameterSet = {}
): {
  valid: boolean;
  error?: string;
  examples?: string[];
} {
  try {
    if (!realExpr && !imagExpr) {
      return {
        valid: false,
        error: 'At least one component (real or imaginary) must be specified',
        examples: [
          'exp(-x^2/2)', 
          'exp(i*x)', 
          'exp(-x^2/2)*exp(i*x)',
          'A*exp(-x^2/2)', // With parameters
          'A*cos(k*x)'     // With parameters
        ]
      };
    }
    
    // Test with sample values
    const testValues = [0, 1, -1, 0.5];
    
    for (const testX of testValues) {
      try {
        const result = parseComplexFunction(realExpr, imagExpr, testX, 0, parameters);
        if (!isFinite(result.real) || !isFinite(result.imag)) {
          return {
            valid: false,
            error: `Wavefunction does not evaluate to finite values at x=${testX}`,
            examples: [
              'exp(-x^2/2)', 
              'exp(i*x)', 
              'exp(-x^2/2)*exp(i*x)',
              'A*exp(-x^2/2)', // With parameters
              'A*cos(k*x)'     // With parameters
            ]
          };
        }
      } catch (error) {
        return {
          valid: false,
          error: `Invalid expression at x=${testX}: ${error}`,
          examples: [
            'exp(-x^2/2)', 
            'exp(i*x)', 
            'exp(-x^2/2)*exp(i*x)',
            'A*exp(-x^2/2)', // With parameters
            'A*cos(k*x)'     // With parameters
          ]
        };
      }
    }
    
    return {
      valid: true,
      examples: [
        'exp(-x^2/2)', // Gaussian
        'exp(i*x)',    // Plane wave
        'exp(-x^2/2)*exp(i*x)', // Gaussian wave packet
        'sqrt(2)*sin(n*pi*x/L)', // Bound state in infinite well
        'A*exp(-x^2/2)', // Gaussian with amplitude parameter
        'A*exp(-(x-x0)^2/(2*sigma^2))', // Gaussian with multiple parameters
        'A*cos(k*x+phi)' // Oscillating wave with parameters
      ]
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid wavefunction expression',
      examples: [
        'exp(-x^2/2)', 
        'exp(i*x)', 
        'exp(-x^2/2)*exp(i*x)',
        'A*exp(-x^2/2)', // With parameters
        'A*cos(k*x)'     // With parameters
      ]
    };
  }
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
