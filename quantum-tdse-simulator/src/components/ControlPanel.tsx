/**
 * Control Panel Component
 * Provides all simulation controls following Swiss Design specs
 */

import { useState } from 'react';
import { Play, Pause, RotateCcw, Upload, Download, Video, Camera, FileArchive } from 'lucide-react';
import { PotentialType, PRESET_POTENTIALS } from '../lib/potentials';
import { WavefunctionType, PRESET_WAVEFUNCTIONS } from '../lib/wavefunctions';
import { ParameterSet } from '../lib/parameters';
import { ParameterControls } from './ParameterControls';
import { WavefunctionState } from '../lib/tdse-solver';

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

  // Absorbing boundary settings
  abcEnabled: boolean;
  abcWidth: number;
  abcStrength: number;
}

interface ControlPanelProps {
  config: SimulationConfig;
  isRunning: boolean;
  onConfigChange: (config: Partial<SimulationConfig>, shouldSwitchTab?: boolean) => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSave: () => void;
  onLoad: (file: File) => void;
  onDownloadCurrentFrame: () => void;
  onDownloadVideo: (format: string, frameRate: number, quality: string, startTime: number, endTime: number) => void;
  onDownloadFramesAsZip: (frameRate: number, startTime: number, endTime: number) => void;
  onClearDrawnPotential?: () => void;
  isRecording?: boolean;
  recordingProgress?: number;
  isExportingZip?: boolean;
  zipProgress?: number;
  eigenstates?: { energy: number; state: WavefunctionState }[];
  previewEigenstateIndex?: number | null;
  onComputeEigenstates?: () => void;
  onPreviewEigenstate?: (index: number | null) => void;
  onLoadEigenstate?: (index: number) => void;
  activeTab?: 'parameters' | 'presets';
  onTabChange?: (tab: 'parameters' | 'presets') => void;
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
  onDownloadFramesAsZip,
  onClearDrawnPotential,
  isRecording = false,
  recordingProgress = 0,
  isExportingZip = false,
  zipProgress = 0,
  eigenstates = [],
  previewEigenstateIndex = null,
  onComputeEigenstates,
  onPreviewEigenstate,
  onLoadEigenstate,
  activeTab: propActiveTab,
  onTabChange: propOnTabChange
}: ControlPanelProps) {
  const numValue = (val: number | undefined | null) => (val === undefined || val === null || isNaN(val)) ? '' : val;

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [localActiveTab, setLocalActiveTab] = useState<'parameters' | 'presets'>('parameters');
  const activeTab = propActiveTab !== undefined ? propActiveTab : localActiveTab;
  const setActiveTab = propOnTabChange !== undefined ? propOnTabChange : setLocalActiveTab;
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
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          Quantum TDSE Simulator
        </h1>
        <div className="text-[10px] uppercase tracking-wider text-text-tertiary mb-6 font-sans">
          Developed by{' '}
          <a
            href="https://www.dr-abhishek.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-primary hover:text-accent-dark hover:underline font-bold transition-fast"
          >
            Dr. Abhishek
          </a>
        </div>
        
        {/* Tabs */}
        <div className="hidden md:flex border-b border-border-default mb-6 font-sans">
          <button
            type="button"
            onClick={() => setActiveTab('parameters')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-fast ${
              activeTab === 'parameters' 
                ? 'border-b-2 border-text-primary text-text-primary' 
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            Parameters
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-fast ${
              activeTab === 'presets' 
                ? 'border-b-2 border-text-primary text-text-primary' 
                : 'text-text-tertiary hover:text-text-primary'
            }`}
          >
            Presets & Guides
          </button>
        </div>

        {activeTab === 'parameters' ? (
          <>
            {/* Potential Section */}
            <section className="mb-6">
          <label className="block text-sm font-medium uppercase tracking-wide text-text-secondary mb-3">
            Potential Type
          </label>
          
          <select
            value={config.potentialType}
            onChange={(e) => onConfigChange({ potentialType: e.target.value as PotentialType }, true)}
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
          
          {config.potentialType === 'custom-draw' && (
            <div className="mt-3 p-3 bg-surface-primary border border-border-default space-y-2">
              <p className="text-xs text-text-secondary font-medium">
                🎨 Draw directly on the simulation chart by clicking and dragging.
              </p>
              <button
                type="button"
                onClick={onClearDrawnPotential}
                className="w-full h-[36px] bg-surface-secondary border border-text-primary hover:bg-surface-tertiary text-text-primary text-xs font-bold uppercase tracking-wide rounded-none transition-fast flex items-center justify-center"
              >
                Clear Drawn Potential
              </button>
            </div>
          )}
          
          {/* Potential Parameters */}
          {(config.potentialType === 'barrier' || config.potentialType === 'well') && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  Height/Depth (V₀)
                </label>
                <input
                  type="number"
                  value={numValue(config.potentialV0)}
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
                  value={numValue(config.potentialX0)}
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
                  value={numValue(config.potentialWidth)}
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
                  value={numValue(config.potentialOmega)}
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
                  value={numValue(config.potentialX0)}
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
            onChange={(e) => onConfigChange({ wavefunctionType: e.target.value as WavefunctionType }, true)}
            className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-regular focus:outline-none focus:border-2 focus:border-border-focus transition-fast"
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
                  value={numValue(config.wavefunctionX0)}
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
                  value={numValue(config.wavefunctionSigma)}
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
                  value={numValue(config.wavefunctionK0)}
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
                  value={numValue(config.wavefunctionAmplitude)}
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
                  value={numValue(config.wavefunctionK0)}
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
                  value={numValue(config.wavefunctionQuantumNumber)}
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
                  value={numValue(config.wavefunctionWellWidth)}
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
        
        {/* Bound States Finder Section */}
        {config.potentialType !== 'free' && (
          <section className="mb-6 pt-6 border-t border-border-default">
            <label className="block text-sm font-medium uppercase tracking-wide text-text-secondary mb-3">
              Bound States Finder (ITP)
            </label>
            
            <p className="text-xs text-text-secondary leading-relaxed mb-4">
              Compute the energy eigenstates for the current potential landscape using Imaginary Time Propagation (ITP).
            </p>
            
            <button
              type="button"
              onClick={onComputeEigenstates}
              disabled={isRunning}
              className={`w-full h-[40px] text-xs font-bold uppercase tracking-wide rounded-none transition-fast flex items-center justify-center ${
                isRunning 
                  ? 'bg-surface-tertiary text-text-disabled cursor-not-allowed border border-border-default' 
                  : 'bg-surface-primary border border-text-primary text-text-primary hover:bg-surface-secondary'
              }`}
            >
              Calculate Bound States
            </button>
            
            {eigenstates && eigenstates.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                  Computed States:
                </p>
                <div className="border border-border-default bg-surface-primary divide-y divide-border-default font-mono text-xs">
                  {eigenstates.map((stateInfo, idx) => {
                    const isPreviewing = previewEigenstateIndex === idx;
                    return (
                      <div key={idx} className="p-2 flex items-center justify-between hover:bg-surface-secondary">
                        <div>
                          <span className="font-bold text-text-primary">
                            {idx === 0 ? 'Ground' : `${idx}* Exc`}
                          </span>
                          <span className="text-text-tertiary ml-2">
                            E = {stateInfo.energy.toFixed(3)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onPreviewEigenstate?.(isPreviewing ? null : idx)}
                            className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider border transition-fast ${
                              isPreviewing
                                ? 'bg-border-focus text-white border-border-focus'
                                : 'bg-surface-secondary hover:bg-surface-tertiary border-border-default text-text-secondary'
                            }`}
                          >
                            {isPreviewing ? 'Previewing' : 'Preview'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onLoadEigenstate?.(idx)}
                            className="px-2 py-1 text-[10px] uppercase font-bold tracking-wider bg-accent-primary hover:bg-accent-dark text-white border-none transition-fast"
                          >
                            Load
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
        
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
                    value={numValue(config.xMin)}
                    onChange={(e) => onConfigChange({ xMin: parseFloat(e.target.value) })}
                    placeholder="xMin"
                    className="w-1/2 h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                  />
                  <input
                    type="number"
                    value={numValue(config.xMax)}
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
                  value={numValue(config.dt)}
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
                  value={numValue(config.stepsPerFrame)}
                  onChange={(e) => onConfigChange({ stepsPerFrame: parseInt(e.target.value) })}
                  min="1"
                  max="10"
                  className="w-full h-[48px] px-4 bg-surface-primary border border-border-default rounded-none text-base font-mono focus:outline-none focus:border-2 focus:border-border-focus"
                />
              </div>

              <div className="pt-4 border-t border-border-default space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium uppercase tracking-wide text-text-secondary">
                    Absorber (ABC)
                  </span>
                  <input
                    type="checkbox"
                    checked={config.abcEnabled ?? false}
                    onChange={(e) => onConfigChange({ abcEnabled: e.target.checked })}
                    className="w-5 h-5 accent-accent-primary cursor-pointer border border-border-default rounded-none"
                  />
                </div>
                
                {config.abcEnabled && (
                  <>
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        Absorber Width: {(config.abcWidth ?? 2.0).toFixed(1)}
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="5.0"
                        step="0.1"
                        value={config.abcWidth ?? 2.0}
                        onChange={(e) => onConfigChange({ abcWidth: parseFloat(e.target.value) })}
                        className="w-full accent-text-primary h-6"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs text-text-secondary mb-1">
                        Absorption Strength: {(config.abcStrength ?? 0.5).toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0.05"
                        max="2.0"
                        step="0.05"
                        value={config.abcStrength ?? 0.5}
                        onChange={(e) => onConfigChange({ abcStrength: parseFloat(e.target.value) })}
                        className="w-full accent-text-primary h-6"
                      />
                    </div>
                  </>
                )}
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
              disabled={isRecording || isExportingZip}
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
                    disabled={isRecording || isExportingZip}
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
                    className={`no-spinners w-full h-[40px] px-2 bg-surface-primary border rounded-none text-sm font-mono focus:outline-none focus:border-2 focus:border-border-focus ${
                      frameRateError 
                        ? 'border-red-500 focus:border-red-500' 
                        : 'border-border-default'
                    }`}
                    disabled={isRecording || isExportingZip}
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
                    disabled={isRecording || isExportingZip}
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
                    disabled={isRecording || isExportingZip}
                  />
                </div>
              </div>
              
              <button
                onClick={() => onDownloadVideo(videoFormat, frameRate, quality, startTime, endTime)}
                className={`w-full h-[48px] text-sm font-bold uppercase tracking-wide rounded-sm transition-fast flex items-center justify-center gap-2 ${
                  isRecording || isExportingZip || frameRateError || frameRate < 1 || frameRate > 120
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-accent-primary hover:bg-accent-dark text-surface-primary'
                }`}
                disabled={isRecording || isExportingZip || endTime <= startTime || !!frameRateError || frameRate < 1 || frameRate > 120}
              >
                <Video size={16} />
                {isRecording 
                  ? `Recording... ${recordingProgress.toFixed(0)}%`
                  : 'Download Video'
                }
              </button>
              
              <button
                onClick={() => onDownloadFramesAsZip(frameRate, startTime, endTime)}
                className={`w-full h-[48px] text-sm font-bold uppercase tracking-wide rounded-sm transition-fast flex items-center justify-center gap-2 mt-2 ${
                  isExportingZip || isRecording || frameRateError || frameRate < 1 || frameRate > 120
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-surface-primary border-2 border-text-primary hover:bg-surface-tertiary text-text-primary'
                }`}
                disabled={isExportingZip || isRecording || endTime <= startTime || !!frameRateError || frameRate < 1 || frameRate > 120}
              >
                <FileArchive size={16} />
                {isExportingZip 
                  ? `Exporting... ${zipProgress.toFixed(0)}%`
                  : 'Export Frames as ZIP'
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
                  value={numValue(config.plotXMin)}
                  onChange={(e) => {
                    const newXMin = parseFloat(e.target.value);
                    if (isNaN(newXMin) || newXMin < config.plotXMax) {
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
                  value={numValue(config.plotXMax)}
                  onChange={(e) => {
                    const newXMax = parseFloat(e.target.value);
                    if (isNaN(newXMax) || newXMax > config.plotXMin) {
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
                  value={numValue(config.plotYMin)}
                  onChange={(e) => {
                    const newYMin = parseFloat(e.target.value);
                    if (isNaN(newYMin) || newYMin < config.plotYMax) {
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
                  value={numValue(config.plotYMax)}
                  onChange={(e) => {
                    const newYMax = parseFloat(e.target.value);
                    if (isNaN(newYMax) || newYMax > config.plotYMin) {
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
        <section className="pt-6 border-t border-border-default">
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="flex-1 h-[48px] bg-surface-primary border-2 border-text-primary hover:bg-surface-tertiary text-text-primary text-sm font-bold uppercase tracking-wide rounded-sm transition-fast flex items-center justify-center gap-2"
            >
              <Download size={16} />
              Save State
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
                Load State
              </div>
            </label>
          </div>
        </section>
          </>
        ) : (
          <div className="space-y-4 font-sans">
            <p className="text-xs text-text-tertiary mb-4 leading-relaxed font-regular">
              Select an interactive scenario below to load curated potential profiles and initial state configurations.
            </p>
            
            {/* Free Dispersion */}
            <div className="bg-surface-primary border border-border-default p-4 space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">
                1. Free Expansion (Dispersion)
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Demonstrates wavepacket spreading in free space ($V=0$). Without external forces, a localized wavepacket expands over time, illustrating the expansion of quantum uncertainty.
              </p>
              <button
                type="button"
                onClick={() => {
                  onConfigChange({
                    potentialType: 'free',
                    wavefunctionType: 'gaussian',
                    wavefunctionX0: 0,
                    wavefunctionSigma: 1,
                    wavefunctionK0: 0,
                    abcEnabled: false
                  }, true);
                }}
                className="mt-2 w-full h-[36px] bg-accent-primary hover:bg-accent-dark text-white text-xs font-bold uppercase tracking-wide rounded-none transition-fast flex items-center justify-center animate-in fade-in"
              >
                Load Preset & Reset
              </button>
            </div>

            {/* Quantum Tunneling */}
            <div className="bg-surface-primary border border-border-default p-4 space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">
                2. Quantum Tunneling
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                A wavepacket traveling with energy $E_k \approx 8.0$ meets a rectangular potential barrier of height $V_0 = 10.0$. Shows wave tunneling through classically forbidden regions.
              </p>
              <button
                type="button"
                onClick={() => {
                  onConfigChange({
                    potentialType: 'barrier',
                    potentialV0: 10,
                    potentialX0: 0,
                    potentialWidth: 1.5,
                    wavefunctionType: 'gaussian',
                    wavefunctionX0: -5,
                    wavefunctionSigma: 1,
                    wavefunctionK0: 4,
                    abcEnabled: true,
                    abcWidth: 2,
                    abcStrength: 0.5
                  }, true);
                }}
                className="mt-2 w-full h-[36px] bg-accent-primary hover:bg-accent-dark text-white text-xs font-bold uppercase tracking-wide rounded-none transition-fast flex items-center justify-center"
              >
                Load Preset & Reset
              </button>
            </div>

            {/* Coherent Harmonic State */}
            <div className="bg-surface-primary border border-border-default p-4 space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">
                3. Coherent Harmonic State
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                A Gaussian wavepacket is displaced inside a parabolic potential well ($V \propto x^2$). The packet oscillates back and forth coherently without spreading, mimicking a classical pendulum.
              </p>
              <button
                type="button"
                onClick={() => {
                  onConfigChange({
                    potentialType: 'harmonic',
                    potentialOmega: 1.0,
                    potentialX0: 0,
                    wavefunctionType: 'gaussian',
                    wavefunctionX0: -3,
                    wavefunctionSigma: 1,
                    wavefunctionK0: 0,
                    abcEnabled: false
                  }, true);
                }}
                className="mt-2 w-full h-[36px] bg-accent-primary hover:bg-accent-dark text-white text-xs font-bold uppercase tracking-wide rounded-none transition-fast flex items-center justify-center"
              >
                Load Preset & Reset
              </button>
            </div>

            {/* Double-Well Oscillation */}
            <div className="bg-surface-primary border border-border-default p-4 space-y-2">
              <h3 className="text-sm font-bold uppercase tracking-wide text-text-primary">
                4. Double-Well Oscillation
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                A wavefunction localized in the left well of a symmetric double-well potential ($V \propto (x^2 - 4)^2$) slowly tunnels to the right well and back, demonstrating coherent tunneling.
              </p>
              <button
                type="button"
                onClick={() => {
                  onConfigChange({
                    potentialType: 'custom-function',
                    customPotentialFunction: '0.05 * (x^2 - 4)^2',
                    wavefunctionType: 'gaussian',
                    wavefunctionX0: -2.0,
                    wavefunctionSigma: 0.7,
                    wavefunctionK0: 0,
                    abcEnabled: false
                  }, true);
                }}
                className="mt-2 w-full h-[36px] bg-accent-primary hover:bg-accent-dark text-white text-xs font-bold uppercase tracking-wide rounded-none transition-fast flex items-center justify-center"
              >
                Load Preset & Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
