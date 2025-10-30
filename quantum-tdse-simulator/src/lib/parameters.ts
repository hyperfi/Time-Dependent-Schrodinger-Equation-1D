/**
 * Parameter Management System for Desmos-style Custom Functions
 * Supports parameter-based function evaluation with sliders
 */

export interface Parameter {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  description?: string;
}

export interface ParameterSet {
  [parameterName: string]: Parameter;
}

/**
 * Create a new parameter
 */
export function createParameter(
  name: string,
  value: number = 1,
  min: number = -10,
  max: number = 10,
  step: number = 0.1,
  description?: string
): Parameter {
  return {
    name,
    value: Math.max(min, Math.min(max, value)), // Clamp to range
    min,
    max,
    step,
    description
  };
}

/**
 * Update parameter value and ensure it's within bounds
 */
export function updateParameter(
  parameter: Parameter,
  newValue: number
): Parameter {
  return {
    ...parameter,
    value: Math.max(parameter.min, Math.min(parameter.max, newValue))
  };
}

/**
 * Extract parameter names from a function expression
 */
export function extractParameterNames(expression: string): string[] {
  // Find all potential parameter names (single letters followed by optional digits)
  const parameterPattern = /\b([a-zA-Z][a-zA-Z0-9]*)(?!\s*\()/g;
  const matches = expression.match(parameterPattern) || [];
  
  // Reserved keywords that shouldn't be treated as parameters
  const reservedKeywords = new Set([
    'x', 't', 'i', 'pi', 'e', 'sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh',
    'exp', 'sqrt', 'abs', 'log', 'ln', 'true', 'false', 'if', 'else'
  ]);
  
  // Filter out reserved keywords and variables
  const potentialParameters = matches.filter(name => 
    !reservedKeywords.has(name.toLowerCase()) && 
    name.length > 1 // Only multi-character names can be parameters
  );
  
  // Get unique parameter names
  return [...new Set(potentialParameters)];
}

/**
 * Extract all single-letter variables that could be parameters
 */
export function extractSingleLetterVariables(expression: string): string[] {
  const singleLetterPattern = /\b([a-zA-Z])(?!\s*\()/g;
  const matches = expression.match(singleLetterPattern) || [];
  
  // Variables that are built-in
  const builtInVariables = new Set(['x', 't', 'i']);
  
  // Filter out built-in variables
  const potentialParameters = matches.filter(letter => 
    !builtInVariables.has(letter.toLowerCase())
  );
  
  return [...new Set(potentialParameters)];
}

/**
 * Validate parameter names (must be valid identifiers)
 */
export function isValidParameterName(name: string): boolean {
  // Parameter names must start with letter, can contain letters and numbers
  const namePattern = /^[a-zA-Z][a-zA-Z0-9]*$/;
  return namePattern.test(name) && name.length > 1; // At least 2 characters
}

/**
 * Replace parameters in expression with their values
 */
export function substituteParameters(
  expression: string,
  parameters: ParameterSet
): string {
  let result = expression;
  
  // Replace each parameter with its value
  Object.values(parameters).forEach(param => {
    const paramPattern = new RegExp(`\\b${param.name}\\b`, 'g');
    result = result.replace(paramPattern, `(${param.value})`);
  });
  
  return result;
}

/**
 * Validate expression with parameters
 */
export function validateParameterExpression(
  expression: string,
  parameters: ParameterSet
): {
  valid: boolean;
  error?: string;
  missingParameters?: string[];
} {
  try {
    // Check for missing parameters
    const singleLetterParams = extractSingleLetterVariables(expression);
    const allParams = [
      ...extractParameterNames(expression),
      ...singleLetterParams
    ];
    
    const missingParameters = allParams.filter(paramName => 
      !parameters[paramName]
    );
    
    if (missingParameters.length > 0) {
      return {
        valid: false,
        error: `Missing parameters: ${missingParameters.join(', ')}`,
        missingParameters
      };
    }
    
    // Test expression with parameter values substituted
    const substitutedExpression = substituteParameters(expression, parameters);
    
    // Basic syntax validation by attempting to parse
    const testEval = new Function('Math', `return ${substitutedExpression}`)(Math);
    
    if (typeof testEval !== 'number' || !isFinite(testEval)) {
      return {
        valid: false,
        error: 'Expression evaluates to non-finite number'
      };
    }
    
    return { valid: true };
    
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid expression'
    };
  }
}

/**
 * Get suggested parameters based on expression analysis
 */
export function getSuggestedParameters(expression: string): Parameter[] {
  const suggestions: Parameter[] = [];
  
  // Analyze single-letter parameters
  const singleLetters = extractSingleLetterVariables(expression);
  singleLetters.forEach(letter => {
    suggestions.push(createParameter(letter, 1, -10, 10, 0.1));
  });
  
  // Analyze multi-character parameters
  const multiCharParams = extractParameterNames(expression);
  multiCharParams.forEach(param => {
    suggestions.push(createParameter(param, 1, -10, 10, 0.1));
  });
  
  return suggestions;
}

/**
 * Create a complete parameter set from suggestions
 */
export function createParameterSet(suggestions: Parameter[]): ParameterSet {
  const parameterSet: ParameterSet = {};
  
  suggestions.forEach(param => {
    parameterSet[param.name] = param;
  });
  
  return parameterSet;
}

/**
 * Generate parameter display value
 */
export function formatParameterValue(param: Parameter): string {
  return param.value.toString();
}

/**
 * Check if parameter value is at bounds
 */
export function isParameterAtBound(param: Parameter): {
  atMin: boolean;
  atMax: boolean;
} {
  const epsilon = 1e-10; // Account for floating point precision
  return {
    atMin: Math.abs(param.value - param.min) < epsilon,
    atMax: Math.abs(param.value - param.max) < epsilon
  };
}

/**
 * Create common parameter presets
 */
export const PARAMETER_PRESETS = {
  amplitude: createParameter('A', 1, -5, 5, 0.1, 'Amplitude parameter'),
  frequency: createParameter('k', 1, -10, 10, 0.1, 'Frequency/Wave number'),
  phase: createParameter('phi', 0, -Math.PI * 2, Math.PI * 2, 0.1, 'Phase shift'),
  offset: createParameter('offset', 0, -10, 10, 0.1, 'Vertical offset'),
  scale: createParameter('scale', 1, -5, 5, 0.1, 'Scale factor'),
  omega: createParameter('omega', 1, 0, 10, 0.1, 'Angular frequency'),
  sigma: createParameter('sigma', 1, 0.1, 10, 0.1, 'Width parameter'),
  x0: createParameter('x0', 0, -10, 10, 0.1, 'Center position'),
  m: createParameter('m', 1, 0.1, 10, 0.1, 'Mass parameter'),
  hbar: createParameter('hbar', 1, 0.1, 5, 0.1, 'Reduced Planck constant')
};

/**
 * Auto-detect parameter types from parameter names
 */
export function detectParameterType(paramName: string): Parameter {
  const lowerName = paramName.toLowerCase();
  
  // Common parameter patterns
  if (lowerName.includes('amp') || lowerName.includes('a')) {
    return createParameter(paramName, 1, -5, 5, 0.1, 'Amplitude');
  }
  if (lowerName.includes('freq') || lowerName.includes('k')) {
    return createParameter(paramName, 1, -10, 10, 0.1, 'Frequency');
  }
  if (lowerName.includes('phase') || lowerName.includes('phi')) {
    return createParameter(paramName, 0, -Math.PI * 2, Math.PI * 2, 0.1, 'Phase');
  }
  if (lowerName.includes('offset') || lowerName.includes('b')) {
    return createParameter(paramName, 0, -10, 10, 0.1, 'Offset');
  }
  if (lowerName.includes('scale') || lowerName.includes('c')) {
    return createParameter(paramName, 1, -5, 5, 0.1, 'Scale');
  }
  if (lowerName.includes('omega') || lowerName.includes('ω')) {
    return createParameter(paramName, 1, 0, 10, 0.1, 'Angular frequency');
  }
  if (lowerName.includes('sigma') || lowerName.includes('σ')) {
    return createParameter(paramName, 1, 0.1, 10, 0.1, 'Standard deviation');
  }
  if (lowerName.includes('center') || lowerName.includes('x0')) {
    return createParameter(paramName, 0, -10, 10, 0.1, 'Center position');
  }
  if (lowerName.includes('mass') || lowerName === 'm') {
    return createParameter(paramName, 1, 0.1, 10, 0.1, 'Mass');
  }
  if (lowerName.includes('hbar') || lowerName.includes('ℏ')) {
    return createParameter(paramName, 1, 0.1, 5, 0.1, 'Reduced Planck constant');
  }
  
  // Default parameter
  return createParameter(paramName, 1, -10, 10, 0.1, 'Custom parameter');
}