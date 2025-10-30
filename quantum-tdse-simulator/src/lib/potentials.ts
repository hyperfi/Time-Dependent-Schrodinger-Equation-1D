/**
 * Potential Functions for TDSE Simulation
 * Provides preset potentials and custom function parsing
 */

import { ParameterSet, substituteParameters } from './parameters';

export type PotentialType = 
  | 'free'
  | 'barrier'
  | 'well'
  | 'harmonic'
  | 'custom-function'
  | 'custom-draw';

export interface PotentialConfig {
  type: PotentialType;
  // Barrier/Well parameters
  v0?: number;       // Potential height/depth
  x0?: number;       // Center position
  width?: number;    // Width
  // Harmonic oscillator parameters
  omega?: number;    // Angular frequency
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
  width: number
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
  width: number
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
  x0: number
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
  functionString: string,
  parameters: ParameterSet = {}
): Float64Array {
  const V = new Float64Array(x.length);
  
  // Enhanced expression parser with parameter support
  const safeEval = (expr: string, xVal: number): number => {
    try {
      // Basic validation
      if (!expr || expr.trim() === '') {
        throw new Error('Empty expression');
      }
      
      // Replace parameters with their values
      let evalExpr = substituteParameters(expr, parameters);
      
      // Replace x with actual value
      evalExpr = evalExpr.replace(/\bx\b/g, `(${xVal})`);
      
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
      
      // Evaluate (using Function constructor for safety)
      const result = new Function('Math', `return ${evalExpr}`)(Math);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error(`Expression evaluates to non-finite number: ${result}`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error evaluating expression "${expr}" at x=${xVal}:`, error);
      throw error; // Re-throw to be caught at higher level
    }
  };
  
  for (let i = 0; i < x.length; i++) {
    try {
      V[i] = safeEval(functionString, x[i]);
    } catch (error) {
      // If evaluation fails, set to a reasonable default or throw
      throw new Error(`Failed to evaluate potential function at x=${x[i]}: ${error}`);
    }
  }
  
  return V;
}

/**
 * Create potential from drawn points (interpolation)
 */
export function createDrawnPotential(
  x: Float64Array,
  points: { x: number; y: number }[]
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
  parameters: ParameterSet = {}
): Float64Array {
  switch (config.type) {
    case 'free':
      return createFreePotential(x);
    
    case 'barrier':
      return createBarrierPotential(
        x,
        config.v0 ?? 5,
        config.x0 ?? 0,
        config.width ?? 2
      );
    
    case 'well':
      return createWellPotential(
        x,
        config.v0 ?? 5,
        config.x0 ?? 0,
        config.width ?? 2
      );
    
    case 'harmonic':
      return createHarmonicPotential(
        x,
        mass,
        config.omega ?? 1,
        config.x0 ?? 0
      );
    
    case 'custom-function':
      if (!config.customFunction) {
        throw new Error('Custom function not provided');
      }
      return createCustomFunctionPotential(x, config.customFunction, parameters);
    
    case 'custom-draw':
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
export function validatePotentialFunction(functionString: string, parameters: ParameterSet = {}): {
  valid: boolean;
  error?: string;
  examples?: string[];
} {
  try {
    if (!functionString || functionString.trim() === '') {
      return { 
        valid: false, 
        error: 'Expression cannot be empty',
        examples: ['0.5*x^2', 'exp(-x^2)', 'sin(x)', 'sinh(x)', 'A*sin(k*x+phi)']
      };
    }
    
    // Test with multiple sample values
    const testValues = [0, 1, -1, 0.5, -0.5];
    
    for (const testX of testValues) {
      let testExpr = substituteParameters(functionString, parameters);
      testExpr = testExpr.replace(/\bx\b/g, `(${testX})`);
      testExpr = testExpr.replace(/\^/g, '**');
      testExpr = testExpr.replace(/\bsin\s*\(/g, 'Math.sin(');
      testExpr = testExpr.replace(/\bcos\s*\(/g, 'Math.cos(');
      testExpr = testExpr.replace(/\btan\s*\(/g, 'Math.tan(');
      testExpr = testExpr.replace(/\bexp\s*\(/g, 'Math.exp(');
      testExpr = testExpr.replace(/\bsqrt\s*\(/g, 'Math.sqrt(');
      testExpr = testExpr.replace(/\babs\s*\(/g, 'Math.abs(');
      testExpr = testExpr.replace(/\blog\s*\(/g, 'Math.log(');
      testExpr = testExpr.replace(/\bln\s*\(/g, 'Math.log(');
      
      // Add hyperbolic functions
      testExpr = testExpr.replace(/\bsinh\s*\(/g, 'Math.sinh(');
      testExpr = testExpr.replace(/\bcosh\s*\(/g, 'Math.cosh(');
      testExpr = testExpr.replace(/\btanh\s*\(/g, 'Math.tanh(');
      
      // Constants
      testExpr = testExpr.replace(/\bpi\b/gi, 'Math.PI');
      testExpr = testExpr.replace(/\be\b/g, 'Math.E');
      
      const result = new Function('Math', `return ${testExpr}`)(Math);
      
      if (typeof result !== 'number' || !isFinite(result)) {
        return { 
          valid: false, 
          error: `Expression does not evaluate to a finite number at x=${testX}`,
          examples: ['0.5*x^2', 'exp(-x^2)', 'sin(x)', 'sinh(x)', 'A*sin(k*x+phi)']
        };
      }
    }
    
    return { 
      valid: true,
      examples: [
        '0.5*x^2', 
        'exp(-x^2)', 
        'sin(x)', 
        'sinh(x)', 
        'cosh(x)+1',
        'A*sin(k*x+phi)',  // With parameters
        'A*exp(-x^2/2)',   // With parameters
        'k*x^2 + offset'   // With parameters
      ]
    };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Invalid expression',
      examples: ['0.5*x^2', 'exp(-x^2)', 'sin(x)', 'sinh(x)', 'A*sin(k*x+phi)']
    };
  }
}

/**
 * Get preset potential configurations
 */
export const PRESET_POTENTIALS = {
  free: {
    type: 'free' as PotentialType,
    label: 'Free Particle',
    description: 'No potential (V = 0)'
  },
  barrier: {
    type: 'barrier' as PotentialType,
    label: 'Potential Barrier',
    description: 'Step potential barrier',
    defaultParams: {
      v0: 5,
      x0: 0,
      width: 2
    }
  },
  well: {
    type: 'well' as PotentialType,
    label: 'Finite Well',
    description: 'Finite potential well',
    defaultParams: {
      v0: 5,
      x0: 0,
      width: 4
    }
  },
  harmonic: {
    type: 'harmonic' as PotentialType,
    label: 'Harmonic Oscillator',
    description: 'Quadratic potential V = ½mω²x²',
    defaultParams: {
      omega: 1,
      x0: 0
    }
  }
};
