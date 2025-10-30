/**
 * Control Panel Component
 * Provides all simulation controls following Swiss Design specs
 */

import { useState } from 'react';
import { Play, Pause, RotateCcw, Upload, Download, Video, Camera } from 'lucide-react';
import { PotentialType, PRESET_POTENTIALS } from '../lib/potentials';
import { WavefunctionType, PRESET_WAVEFUNCTIONS } from '../lib/wavefunctions';
import { ParameterSet } from '../lib/parameters';
import { ParameterControls } from './ParameterControls';

export interface SimulationConfig {
  // Potential settings
  potentialType: PotentialType;
  potentialV0: number;
  potentialX0: number;
  potentialWidth: number;
  potentialOmega: number;
  customPotentialFunction: string;
  potentialParameters: ParameterSet;
  
  // Wavefunction settings
  wavefunctionType: WavefunctionType;
  wavefunctionX0: number;
  wavefunctionSigma: number;
  wavefunctionK0: number;
  wavefunctionAmplitude: number;
  wavefunctionQuantumNumber: number;
  wavefunctionWellWidth: number;
  wavefunctionRealExpr: string;
  wavefunctionImagExpr: string;
  wavefunctionParameters: ParameterSet;
  
  // Simulation settings
  gridSize: number;
  xMin: number;
  xMax: number;
  dt: number;
  stepsPerFrame: number;
  
  // Plot range settings
  plotXMin: number;
  plotXMax: number;
  plotYMin: number;
  plotYMax: number;
}

interface ControlPanelProps {
  config: SimulationConfig;
  isRunning: boolean;
  onConfigChange: (config: Partial<SimulationConfig>) => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onDownloadCurrentFrame: () => void;
  onDownloadVideo: (format: string, frameRate: number, quality: string, startTime: number, endTime: number) => void;
  isRecording?: boolean;
  recordingProgress?: number;
}

export function ControlPanel({
  config,
  isRunning,
  onConfigChange,
  onPlay,
  onPause,
  onReset,
  onSave,
  onLoad,
  onDownloadCurrentFrame,
  onDownloadVideo,
  isRecording = false,
  recordingProgress = 0
}: ControlPanelProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [videoFormat, setVideoFormat] = useState('mp4');
  const [frameRate, setFrameRate] = useState(30);
  const [frameRateError, setFrameRateError] = useState('');
  const [quality, setQuality] = useState('high');
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(5);
  const [wavefunctionError, setWavefunctionError] = useState('');
  const [potentialError, setPotentialError] = useState('');
  
  // Parameter management
  const [potentialParameters, setPotentialParameters] = useState<ParameterSet>(config.potentialParameters || {});
  const [wavefunctionParameters, setWavefunctionParameters] = useState<ParameterSet>(config.wavefunctionParameters || {});
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoad(file);
    }
    // Reset input to allow loading same file again
    e.target.value = '';
  };
  
  return (
    <div className="w-full h-full bg-surface-secondary border-r border-border-default overflow-y-auto">
      <div className="p-8 pt-8">
        {/* Title */}
        <h1 className="text-2xl font-bold text-text-primary mb-8">
          Quantum TDSE Simulator
        </h1>
        
        {/* Potential Section */}
        <section className="mb-6">
          <label className="block text-sm font-medium uppercase tracking-wide text-text-secondary mb-3">
            Potential Type
          </label>
          
          <select
            value={config.potentialType}
            onChange={(e) => onConfigChange({ potentialType: e.target.value as PotentialType })}
            className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-regular focus:outline-none focus:border-2 focus:border-border-focus transition-fast"
          >
            {Object.entries(PRESET_POTENTIALS).map(([key, preset]) => (
              <option key={key} value={preset.type}>
                {preset.label}
              </option>
            ))}
            <option value="custom-function">Custom Function</option>
            <option value="custom-draw">Draw Custom</option>
          </select>
          
          {/* Potential Parameters */}
          {(config.potentialType === 'barrier' || config.potentialType === 'well') && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Height/Depth (V₀)
                </label>
                <input
                  type="number"
                  value={config.potentialV0}
                  onChange={(e) => onConfigChange({ potentialV0: parseFloat(e.target.value) })}
                  step="0.5"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Center Position (x₀)
                </label>
                <input
                  type="number"
                  value={config.potentialX0}
                  onChange={(e) => onConfigChange({ potentialX0: parseFloat(e.target.value) })}
                  step="0.5"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Width
                </label>
                <input
                  type="number"
                  value={config.potentialWidth}
                  onChange={(e) => onConfigChange({ potentialWidth: parseFloat(e.target.value) })}
                  step="0.5"
                  min="0.1"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
            </div>
          )}
          
          {config.potentialType === 'harmonic' && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Angular Frequency (ω)
                </label>
                <input
                  type="number"
                  value={config.potentialOmega}
                  onChange={(e) => onConfigChange({ potentialOmega: parseFloat(e.target.value) })}
                  step="0.1"
                  min="0.1"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Center Position (x₀)
                </label>
                <input
                  type="number"
                  value={config.potentialX0}
                  onChange={(e) => onConfigChange({ potentialX0: parseFloat(e.target.value) })}
                  step="0.5"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
            </div>
          )}
          
          {config.potentialType === 'custom-function' && (
            <div className="mt-3">
              <label className="block text-sm text-text-secondary mb-1">
                Function V(x)
              </label>
              <input
                type="text"
                value={config.customPotentialFunction}
                onChange={(e) => {
                  const newFunc = e.target.value;
                  onConfigChange({ 
                    customPotentialFunction: newFunc,
                    potentialParameters: potentialParameters
                  });
                  
                  // Validate in real-time
                  if (newFunc.trim()) {
                    try {
                      const { validatePotentialFunction } = require('../lib/potentials');
                      const validation = validatePotentialFunction(newFunc, potentialParameters);
                      if (!validation.valid) {
                        setPotentialError(validation.error || 'Invalid function');
                      } else {
                        setPotentialError('');
                      }
                    } catch (error) {
                      setPotentialError('Function validation failed');
                    }
                  } else {
                    setPotentialError('');
                  }
                }}
                placeholder="e.g., 0.5*x^2, exp(-x^2), A*sin(k*x+phi)"
                className={`w-full h-[48px] px-4 bg-surface-primary border text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus ${
                  potentialError ? 'border-red-500' : 'border-border-default'
                }`}
                disabled={isRunning}
              />
              <div className="mt-2">
                <p className="text-xs text-text-tertiary mb-1">
                  Supports: x, parameters (A, k, phi, etc.), +, -, *, /, ^, sin, cos, tan, exp, sqrt, abs, log, ln, sinh, cosh, tanh, pi, e
                </p>
                {potentialError && (
                  <p className="text-xs text-red-500 mb-1">
                    Error: {potentialError}
                  </p>
                )}
                <div className="text-xs text-text-secondary">
                  Examples: 
                  <br /><span className="font-mono">0.5*x^2</span>, <span className="font-mono">exp(-x^2)</span>, <span className="font-mono">sinh(x)</span>
                  <br /><span className="font-mono">A*sin(k*x+phi)</span>, <span className="font-mono">A*exp(-x^2/2)</span>
                </div>
              </div>

              {/* Potential Parameter Controls */}
              <ParameterControls
                parameters={potentialParameters}
                onParametersChange={(params) => {
                  setPotentialParameters(params);
                  onConfigChange({ potentialParameters: params });
                }}
                expression={config.customPotentialFunction}
                label="Potential Parameters"
                disabled={isRunning}
              />
            </div>
          )}
        </section>
        
        {/* Wavefunction Section */}
        <section className="mb-6 pt-6 border-t border-border-default">
          <label className="block text-sm font-medium uppercase tracking-wide text-text-secondary mb-3">
            Initial Wavefunction
          </label>
          
          <select
            value={config.wavefunctionType}
            onChange={(e) => onConfigChange({ wavefunctionType: e.target.value as WavefunctionType })}
            className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-regular focus:outline-none focus:border-2 focus:border-border-focus"
            disabled={isRunning}
          >
            {Object.entries(PRESET_WAVEFUNCTIONS).map(([key, preset]) => (
              <option key={key} value={preset.type}>
                {preset.label}
              </option>
            ))}
          </select>
          
          {/* Wavefunction Parameters */}
          {config.wavefunctionType === 'gaussian' && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Center Position (x₀)
                </label>
                <input
                  type="number"
                  value={config.wavefunctionX0}
                  onChange={(e) => onConfigChange({ wavefunctionX0: parseFloat(e.target.value) })}
                  step="0.5"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  disabled={isRunning}
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Width (σ)
                </label>
                <input
                  type="number"
                  value={config.wavefunctionSigma}
                  onChange={(e) => onConfigChange({ wavefunctionSigma: parseFloat(e.target.value) })}
                  step="0.1"
                  min="0.1"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  disabled={isRunning}
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Momentum (k₀)
                </label>
                <input
                  type="number"
                  value={config.wavefunctionK0}
                  onChange={(e) => onConfigChange({ wavefunctionK0: parseFloat(e.target.value) })}
                  step="0.5"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  disabled={isRunning}
                />
              </div>
            </div>
          )}
          
          {config.wavefunctionType === 'plane-wave' && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Amplitude (A)
                </label>
                <input
                  type="number"
                  value={config.wavefunctionAmplitude}
                  onChange={(e) => onConfigChange({ wavefunctionAmplitude: parseFloat(e.target.value) })}
                  step="0.1"
                  min="0.1"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  disabled={isRunning}
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Wave Number (k₀)
                </label>
                <input
                  type="number"
                  value={config.wavefunctionK0}
                  onChange={(e) => onConfigChange({ wavefunctionK0: parseFloat(e.target.value) })}
                  step="0.5"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  disabled={isRunning}
                />
              </div>
            </div>
          )}
          
          {config.wavefunctionType === 'bound-state' && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Quantum Number (n)
                </label>
                <input
                  type="number"
                  value={config.wavefunctionQuantumNumber}
                  onChange={(e) => onConfigChange({ wavefunctionQuantumNumber: parseInt(e.target.value) })}
                  step="1"
                  min="1"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  disabled={isRunning}
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Well Width (L)
                </label>
                <input
                  type="number"
                  value={config.wavefunctionWellWidth}
                  onChange={(e) => onConfigChange({ wavefunctionWellWidth: parseFloat(e.target.value) })}
                  step="0.5"
                  min="1"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  disabled={isRunning}
                />
              </div>
            </div>
          )}
          
          {config.wavefunctionType === 'custom-function' && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Real Part ψ₍r₎(x,0)
                </label>
                <input
                  type="text"
                  value={config.wavefunctionRealExpr}
                  onChange={(e) => {
                    const newExpr = e.target.value;
                    onConfigChange({ 
                      wavefunctionRealExpr: newExpr,
                      wavefunctionParameters: wavefunctionParameters
                    });
                    
                    // Validate in real-time
                    if (newExpr.trim() || config.wavefunctionImagExpr.trim()) {
                      try {
                        const { validateWavefunctionFunctions } = require('../lib/wavefunctions');
                        const validation = validateWavefunctionFunctions(newExpr, config.wavefunctionImagExpr, wavefunctionParameters);
                        if (!validation.valid) {
                          setWavefunctionError(validation.error || 'Invalid function');
                        } else {
                          setWavefunctionError('');
                        }
                      } catch (error) {
                        setWavefunctionError('Function validation failed');
                      }
                    } else {
                      setWavefunctionError('');
                    }
                  }}
                  placeholder="e.g., exp(-x^2/2), A*cos(k*x), A*exp(-x^2/2)"
                  className={`w-full h-[48px] px-4 bg-surface-primary border text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus ${
                    wavefunctionError ? 'border-red-500' : 'border-border-default'
                  }`}
                  disabled={isRunning}
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Imaginary Part ψ₍i₎(x,0)
                </label>
                <input
                  type="text"
                  value={config.wavefunctionImagExpr}
                  onChange={(e) => {
                    const newExpr = e.target.value;
                    onConfigChange({ 
                      wavefunctionImagExpr: newExpr,
                      wavefunctionParameters: wavefunctionParameters
                    });
                    
                    // Validate in real-time
                    if (newExpr.trim() || config.wavefunctionRealExpr.trim()) {
                      try {
                        const { validateWavefunctionFunctions } = require('../lib/wavefunctions');
                        const validation = validateWavefunctionFunctions(config.wavefunctionRealExpr, newExpr, wavefunctionParameters);
                        if (!validation.valid) {
                          setWavefunctionError(validation.error || 'Invalid function');
                        } else {
                          setWavefunctionError('');
                        }
                      } catch (error) {
                        setWavefunctionError('Function validation failed');
                      }
                    } else {
                      setWavefunctionError('');
                    }
                  }}
                  placeholder="Optional - leave empty for real wavefunction"
                  className={`w-full h-[48px] px-4 bg-surface-primary border text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus ${
                    wavefunctionError ? 'border-red-500' : 'border-border-default'
                  }`}
                  disabled={isRunning}
                />
              </div>
              
              <div className="mt-2">
                <p className="text-xs text-text-tertiary mb-1">
                  Supports: x, t, parameters (A, k, phi, etc.), i, +, -, *, /, ^, sin, cos, exp, sqrt, abs, log, ln, sinh, cosh, tanh, pi, e
                </p>
                {wavefunctionError && (
                  <p className="text-xs text-red-500 mb-1">
                    Error: {wavefunctionError}
                  </p>
                )}
                <div className="text-xs text-text-secondary">
                  Examples:
                  <br />Real: <span className="font-mono">exp(-x^2/2)</span>, <span className="font-mono">A*exp(-x^2/2)</span>
                  <br />Complex: <span className="font-mono">A*cos(k*x)</span> and <span className="font-mono">A*sin(k*x)</span>
                  <br />Plane: <span className="font-mono">cos(k*x+phi)</span> and <span className="font-mono">sin(k*x+phi)</span>
                </div>
              </div>

              {/* Wavefunction Parameter Controls */}
              <ParameterControls
                parameters={wavefunctionParameters}
                onParametersChange={(params) => {
                  setWavefunctionParameters(params);
                  onConfigChange({ wavefunctionParameters: params });
                }}
                expression={`${config.wavefunctionRealExpr} ${config.wavefunctionImagExpr}`}
                label="Wavefunction Parameters"
                disabled={isRunning}
              />
            </div>
          )}
        </section>
        
        {/* Advanced Settings */}
        <section className="mb-6 pt-6 border-t border-border-default">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="block text-sm font-medium uppercase tracking-wide text-text-secondary mb-3 hover:text-text-primary transition-fast"
          >
            Advanced Settings {showAdvanced ? '▲' : '▼'}
          </button>
          
          {showAdvanced && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Grid Size (N)
                </label>
                <select
                  value={config.gridSize}
                  onChange={(e) => onConfigChange({ gridSize: parseInt(e.target.value) })}
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                >
                  <option value="256">256</option>
                  <option value="512">512</option>
                  <option value="1024">1024</option>
                  <option value="2048">2048</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Spatial Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={config.xMin}
                    onChange={(e) => onConfigChange({ xMin: parseFloat(e.target.value) })}
                    placeholder="xMin"
                    className="w-1/2 h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  />
                  <input
                    type="number"
                    value={config.xMax}
                    onChange={(e) => onConfigChange({ xMax: parseFloat(e.target.value) })}
                    placeholder="xMax"
                    className="w-1/2 h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Time Step (Δt)
                </label>
                <input
                  type="number"
                  value={config.dt}
                  onChange={(e) => onConfigChange({ dt: parseFloat(e.target.value) })}
                  step="0.001"
                  min="0.001"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Steps Per Frame
                </label>
                <input
                  type="number"
                  value={config.stepsPerFrame}
                  onChange={(e) => onConfigChange({ stepsPerFrame: parseInt(e.target.value) })}
                  min="1"
                  max="10"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
            </div>
          )}
        </section>
        
        {/* Export Section */}
        <section className="mb-6 pt-6 border-t border-border-default">
          <label className="block text-sm font-medium uppercase tracking-wide text-text-secondary mb-3">
            Export
          </label>
          
          <div className="space-y-4">
            {/* Download Current Frame */}
            <button
              onClick={onDownloadCurrentFrame}
              className="w-full h-[48px] bg-surface-primary border-2 border-text-primary hover:bg-surface-tertiary text-text-primary text-sm font-bold uppercase tracking-wide rounded-sm transition-fast flex items-center justify-center gap-2"
              disabled={isRecording}
            >
              <Camera size={16} />
              Download Current Frame
            </button>
            
            {/* Video Settings */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Format
                  </label>
                  <select
                    value={videoFormat}
                    onChange={(e) => setVideoFormat(e.target.value)}
                    className="w-full h-[40px] px-2 bg-surface-primary border border-border-default rounded-none text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                    disabled={isRecording}
                  >
                    <option value="mp4">MP4</option>
                    <option value="webm">WebM</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Frame Rate (FPS)
                  </label>
                  <input
                    type="number"
                    value={frameRate || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value)) {
                        setFrameRate(value);
                        
                        // Validate frame rate
                        if (value < 1 || value > 120) {
                          setFrameRateError('Frame rate must be between 1 and 120');
                        } else {
                          setFrameRateError('');
                        }
                      } else {
                        setFrameRateError('Please enter a valid number');
                      }
                    }}
                    placeholder="30"
                    min="1"
                    max="120"
                    step="1"
                    className={`w-full h-[40px] px-2 bg-surface-primary border rounded-none text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus ${
                      frameRateError 
                        ? 'border-red-500 focus:border-red-500' 
                        : 'border-border-default'
                    }`}
                    disabled={isRecording}
                    style={{
                      WebkitAppearance: 'none',
                      MozAppearance: 'textfield'
                    }}
                  />
                  {frameRateError && (
                    <p className="text-xs text-red-500 mt-1">
                      {frameRateError}
                    </p>
                  )}
                  <p className="text-xs text-text-tertiary mt-1">
                    Recommended: 15, 24, 30, 60 fps
                  </p>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Quality
                </label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="w-full h-[40px] px-2 bg-surface-primary border border-border-default rounded-none text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  disabled={isRecording}
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    Start Time
                  </label>
                  <input
                    type="number"
                    value={startTime}
                    onChange={(e) => setStartTime(parseFloat(e.target.value))}
                    step="0.1"
                    min="0"
                    className="w-full h-[40px] px-2 bg-surface-primary border border-border-default rounded-none text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                    disabled={isRecording}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-text-secondary mb-1">
                    End Time
                  </label>
                  <input
                    type="number"
                    value={endTime}
                    onChange={(e) => setEndTime(parseFloat(e.target.value))}
                    step="0.1"
                    min={startTime}
                    className="w-full h-[40px] px-2 bg-surface-primary border border-border-default rounded-none text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                    disabled={isRecording}
                  />
                </div>
              </div>
              
              <button
                onClick={() => onDownloadVideo(videoFormat, frameRate, quality, startTime, endTime)}
                className={`w-full h-[48px] text-sm font-bold uppercase tracking-wide rounded-sm transition-fast flex items-center justify-center gap-2 ${
                  isRecording || frameRateError || frameRate < 1 || frameRate > 120
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-accent-primary hover:bg-accent-dark text-surface-primary'
                }`}
                disabled={isRecording || endTime <= startTime || !!frameRateError || frameRate < 1 || frameRate > 120}
              >
                <Video size={16} />
                {isRecording 
                  ? `Recording... ${recordingProgress.toFixed(0)}%`
                  : 'Download Video'
                }
              </button>
            </div>
          </div>
        </section>
        
        {/* Plot Range Section */}
        <section className="mb-6 pt-6 border-t border-border-default">
          <label className="block text-sm font-medium uppercase tracking-wide text-text-secondary mb-3">
            Plot Range
          </label>
          
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  X Min
                </label>
                <input
                  type="number"
                  value={config.plotXMin}
                  onChange={(e) => {
                    const newXMin = parseFloat(e.target.value);
                    if (newXMin < config.plotXMax) {
                      onConfigChange({ plotXMin: newXMin });
                    }
                  }}
                  step="1"
                  className="w-full h-[40px] px-2 bg-surface-primary border border-border-default rounded-none text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  X Max
                </label>
                <input
                  type="number"
                  value={config.plotXMax}
                  onChange={(e) => {
                    const newXMax = parseFloat(e.target.value);
                    if (newXMax > config.plotXMin) {
                      onConfigChange({ plotXMax: newXMax });
                    }
                  }}
                  step="1"
                  className="w-full h-[40px] px-2 bg-surface-primary border border-border-default rounded-none text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Y Min
                </label>
                <input
                  type="number"
                  value={config.plotYMin}
                  onChange={(e) => {
                    const newYMin = parseFloat(e.target.value);
                    if (newYMin < config.plotYMax) {
                      onConfigChange({ plotYMin: newYMin });
                    }
                  }}
                  step="0.5"
                  className="w-full h-[40px] px-2 bg-surface-primary border border-border-default rounded-none text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
              
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Y Max
                </label>
                <input
                  type="number"
                  value={config.plotYMax}
                  onChange={(e) => {
                    const newYMax = parseFloat(e.target.value);
                    if (newYMax > config.plotYMin) {
                      onConfigChange({ plotYMax: newYMax });
                    }
                  }}
                  step="0.5"
                  className="w-full h-[40px] px-2 bg-surface-primary border border-border-default rounded-none text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>
            </div>
          </div>
        </section>
        
        {/* Control Buttons */}
        <section className="pt-6 border-t border-border-default space-y-2">
          <button
            onClick={isRunning ? onPause : onPlay}
            className="w-full h-[48px] bg-accent-primary hover:bg-accent-dark text-surface-primary text-sm font-bold uppercase tracking-wide rounded-sm transition-fast flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <Pause size={16} />
                Pause
              </>
            ) : (
              <>
                <Play size={16} />
                Play
              </>
            )}
          </button>
          
          <button
            onClick={onReset}
            className="w-full h-[48px] bg-surface-primary border-2 border-text-primary hover:bg-surface-tertiary text-text-primary text-sm font-bold uppercase tracking-wide rounded-sm transition-fast flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={onSave}
              className="flex-1 h-[48px] bg-surface-primary border-2 border-text-primary hover:bg-surface-tertiary text-text-primary text-sm font-bold uppercase tracking-wide rounded-sm transition-fast flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Save
            </button>
            
            <label className="flex-1">
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="h-[48px] bg-surface-primary border-2 border-text-primary hover:bg-surface-tertiary text-text-primary text-sm font-bold uppercase tracking-wide rounded-sm transition-fast flex items-center justify-center gap-2 cursor-pointer">
                <Upload size={16} />
                Load
              </div>
            </label>
          </div>
        </section>
      </div>
    </div>
  );
}
