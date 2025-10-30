/**
 * Parameter Controls Component
 * Provides Desmos-style sliders for custom function parameters
 */

import { useState } from 'react';
import { Plus, X, Sliders } from 'lucide-react';
import { Parameter, ParameterSet, createParameter, updateParameter, isValidParameterName, detectParameterType } from '../lib/parameters';

interface ParameterControlsProps {
  parameters: ParameterSet;
  onParametersChange: (parameters: ParameterSet) => void;
  expression: string;
  label?: string;
  disabled?: boolean;
}

export function ParameterControls({
  parameters,
  onParametersChange,
  expression,
  label = 'Parameters',
  disabled = false
}: ParameterControlsProps) {
  const [newParamName, setNewParamName] = useState('');
  const [newParamValue, setNewParamValue] = useState(1);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');

  const parameterList = Object.values(parameters);

  const handleParameterUpdate = (paramName: string, newValue: number) => {
    const updatedParameters = {
      ...parameters,
      [paramName]: updateParameter(parameters[paramName], newValue)
    };
    onParametersChange(updatedParameters);
  };

  const handleParameterRangeUpdate = (paramName: string, field: 'min' | 'max' | 'step', newValue: number) => {
    const updatedParameters = {
      ...parameters,
      [paramName]: {
        ...parameters[paramName],
        [field]: newValue
      }
    };
    onParametersChange(updatedParameters);
  };

  const handleRemoveParameter = (paramName: string) => {
    const updatedParameters = { ...parameters };
    delete updatedParameters[paramName];
    onParametersChange(updatedParameters);
  };

  const handleAddParameter = () => {
    setError('');
    
    if (!newParamName.trim()) {
      setError('Parameter name is required');
      return;
    }

    if (!isValidParameterName(newParamName)) {
      setError('Parameter name must start with a letter and contain only letters and numbers (minimum 2 characters)');
      return;
    }

    if (parameters[newParamName]) {
      setError('Parameter already exists');
      return;
    }

    const newParam = detectParameterType(newParamName);
    newParam.value = newParamValue;

    const updatedParameters = {
      ...parameters,
      [newParamName]: newParam
    };

    onParametersChange(updatedParameters);
    setNewParamName('');
    setNewParamValue(1);
    setShowAddForm(false);
  };

  const handleAutoDetect = () => {
    // This would be called by parent components to auto-detect parameters from expression
    // For now, we'll rely on the parent to call this
  };

  const formatValue = (value: number) => {
    if (Math.abs(value) >= 1000 || (Math.abs(value) < 0.01 && value !== 0)) {
      return value.toExponential(2);
    }
    return value.toFixed(3).replace(/\.?0+$/, '');
  };

  if (disabled) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-surface-tertiary border border-border-default rounded-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-text-secondary" />
          <label className="text-sm font-medium text-text-secondary uppercase tracking-wide">
            {label}
          </label>
          <span className="text-xs text-text-tertiary">({parameterList.length})</span>
        </div>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1 hover:bg-surface-secondary rounded transition-fast"
          title="Add Parameter"
        >
          <Plus size={16} className="text-text-secondary" />
        </button>
      </div>

      {/* Add Parameter Form */}
      {showAddForm && (
        <div className="mb-4 p-3 bg-surface-secondary border border-border-default rounded">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                Parameter Name
              </label>
              <input
                type="text"
                value={newParamName}
                onChange={(e) => setNewParamName(e.target.value)}
                placeholder="e.g., A, k, phi"
                className="w-full h-8 px-2 bg-surface-primary border border-border-default rounded text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                disabled={disabled}
              />
            </div>
            
            <div>
              <label className="block text-xs text-text-secondary mb-1">
                Initial Value
              </label>
              <input
                type="number"
                value={newParamValue}
                onChange={(e) => setNewParamValue(parseFloat(e.target.value) || 0)}
                step="0.1"
                className="w-full h-8 px-2 bg-surface-primary border border-border-default rounded text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                disabled={disabled}
              />
            </div>
            
            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={handleAddParameter}
                className="flex-1 h-8 bg-accent-primary hover:bg-accent-dark text-surface-primary text-xs font-medium rounded transition-fast"
                disabled={disabled}
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewParamName('');
                  setNewParamValue(1);
                  setError('');
                }}
                className="flex-1 h-8 bg-surface-secondary border border-border-default hover:bg-surface-tertiary text-text-primary text-xs font-medium rounded transition-fast"
                disabled={disabled}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parameter List */}
      {parameterList.length === 0 ? (
        <div className="text-center py-4 text-text-tertiary text-sm">
          No parameters defined
          <div className="text-xs mt-1">
            Add parameters like A, k, phi to use in your functions
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {parameterList.map((param) => (
            <div key={param.name} className="bg-surface-secondary border border-border-default rounded p-3">
              {/* Parameter Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-text-primary">
                    {param.name}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    = {formatValue(param.value)}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveParameter(param.name)}
                  className="p-1 hover:bg-surface-primary rounded transition-fast"
                  title={`Remove ${param.name}`}
                >
                  <X size={14} className="text-text-tertiary hover:text-red-500" />
                </button>
              </div>

              {/* Slider */}
              <div className="mb-3">
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={param.value}
                  onChange={(e) => handleParameterUpdate(param.name, parseFloat(e.target.value))}
                  className="w-full h-2 bg-surface-primary rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((param.value - param.min) / (param.max - param.min)) * 100}%, #374151 ${((param.value - param.min) / (param.max - param.min)) * 100}%, #374151 100%)`
                  }}
                  disabled={disabled}
                />
              </div>

              {/* Range Controls */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Min</label>
                  <input
                    type="number"
                    value={param.min}
                    onChange={(e) => handleParameterRangeUpdate(param.name, 'min', parseFloat(e.target.value))}
                    step={param.step}
                    className="w-full h-8 px-2 bg-surface-primary border border-border-default rounded text-xs font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                    disabled={disabled}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Step</label>
                  <input
                    type="number"
                    value={param.step}
                    onChange={(e) => handleParameterRangeUpdate(param.name, 'step', Math.max(0.001, parseFloat(e.target.value)))}
                    step="0.001"
                    min="0.001"
                    className="w-full h-8 px-2 bg-surface-primary border border-border-default rounded text-xs font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                    disabled={disabled}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-text-secondary mb-1">Max</label>
                  <input
                    type="number"
                    value={param.max}
                    onChange={(e) => handleParameterRangeUpdate(param.name, 'max', parseFloat(e.target.value))}
                    step={param.step}
                    className="w-full h-8 px-2 bg-surface-primary border border-border-default rounded text-xs font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Precise Value Input */}
              <div className="mt-2">
                <label className="block text-xs text-text-secondary mb-1">Precise Value</label>
                <input
                  type="number"
                  value={param.value}
                  onChange={(e) => handleParameterUpdate(param.name, parseFloat(e.target.value))}
                  step={param.step}
                  min={param.min}
                  max={param.max}
                  className="w-full h-8 px-2 bg-surface-primary border border-border-default rounded text-xs font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  disabled={disabled}
                />
              </div>

              {/* Description */}
              {param.description && (
                <div className="mt-2 text-xs text-text-tertiary">
                  {param.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Help Text */}
      <div className="mt-3 text-xs text-text-tertiary">
        <div className="font-medium mb-1">Using Parameters:</div>
        <div>• Use parameter names in your functions (e.g., "A*sin(k*x+phi)")</div>
        <div>• Adjust sliders to see real-time changes</div>
        <div>• Set ranges and step sizes for fine control</div>
      </div>
    </div>
  );
}

/**
 * Hook for managing parameter state
 */
export function useParameters(initialParameters: ParameterSet = {}) {
  const [parameters, setParameters] = useState<ParameterSet>(initialParameters);

  const updateParameter = (name: string, updates: Partial<Parameter>) => {
    setParameters(prev => ({
      ...prev,
      [name]: { ...prev[name], ...updates }
    }));
  };

  const addParameter = (param: Parameter) => {
    setParameters(prev => ({
      ...prev,
      [param.name]: param
    }));
  };

  const removeParameter = (name: string) => {
    setParameters(prev => {
      const newParams = { ...prev };
      delete newParams[name];
      return newParams;
    });
  };

  const clearParameters = () => {
    setParameters({});
  };

  const setParametersFromSet = (newParameters: ParameterSet) => {
    setParameters(newParameters);
  };

  return {
    parameters,
    updateParameter,
    addParameter,
    removeParameter,
    clearParameters,
    setParameters: setParametersFromSet,
    parameterCount: Object.keys(parameters).length
  };
}