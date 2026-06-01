/**
 * Main Application Component
 * Manages simulation state and coordinates components
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ControlPanel, SimulationConfig } from './components/ControlPanel';
import { QuantumVisualization } from './components/QuantumVisualization';
import { TDSESolver, WavefunctionState, createGaussianWavepacket, createPlaneWave, createBoundState, createCustomWavefunction } from './lib/tdse-solver';
import { generatePotential, validatePotentialFunction } from './lib/potentials';
import { validateWavefunctionFunctions } from './lib/wavefunctions';
import { Settings, X, Play, Pause, RotateCcw, AlertTriangle, Activity, Sliders, BookOpen } from 'lucide-react';
import JSZip from 'jszip';
import './App.css';

const DEFAULT_CONFIG: SimulationConfig = {
  potentialType: 'barrier',
  potentialV0: 5,
  potentialX0: 0,
  potentialWidth: 2,
  potentialOmega: 1,
  customPotentialFunction: '0.5*x^2',
  potentialParameters: {},
  wavefunctionType: 'gaussian',
  wavefunctionX0: -4,
  wavefunctionSigma: 1,
  wavefunctionK0: 3,
  wavefunctionAmplitude: 1,
  wavefunctionQuantumNumber: 1,
  wavefunctionWellWidth: 4,
  wavefunctionRealExpr: 'exp(-x^2/2)',
  wavefunctionImagExpr: '',
  wavefunctionParameters: {},
  gridSize: 512,
  xMin: -10,
  xMax: 10,
  dt: 0.005,
  stepsPerFrame: 2,
  plotXMin: -10,
  plotXMax: 10,
  plotYMin: -3,
  plotYMax: 3,
  abcEnabled: true,
  abcWidth: 2,
  abcStrength: 0.5
};

function App() {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
  
  const sanitizedConfig = useMemo(() => {
    const clean = { ...config };
    for (const k in clean) {
      const key = k as keyof SimulationConfig;
      if (typeof clean[key] === 'number' && isNaN(clean[key] as number)) {
        (clean as any)[key] = DEFAULT_CONFIG[key];
      }
    }
    return clean;
  }, [config]);

  const [isRunning, setIsRunning] = useState(false);
  const [solver, setSolver] = useState<TDSESolver | null>(null);
  const [state, setState] = useState<WavefunctionState | null>(null);
  const [energy, setEnergy] = useState(0);
  const [totalProbability, setTotalProbability] = useState(1);
  const [potential, setPotential] = useState<Float64Array>(new Float64Array(0));
  const [drawnPoints, setDrawnPoints] = useState<{ x: number; y: number }[]>([]);
  const [drawnPotentialVersion, setDrawnPotentialVersion] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [showBoundaryModal, setShowBoundaryModal] = useState(false);
  const [eigenstates, setEigenstates] = useState<{ energy: number; state: WavefunctionState }[]>([]);
  const [previewEigenstateIndex, setPreviewEigenstateIndex] = useState<number | null>(null);
  const [mobileTab, setMobileTab] = useState<'simulation' | 'parameters' | 'presets'>('simulation');
  
  // Panel resize and visibility state
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [panelWidth, setPanelWidth] = useState(360); // Default width
  const [isDragging, setIsDragging] = useState(false);
  
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingAnimationRef = useRef<number | null>(null);
  const zipExportAnimationRef = useRef<number | null>(null);
  const zipFramesRef = useRef<string[]>([]);
  
  const animationFrameRef = useRef<number | null>(null);
  const boundaryWarningShownRef = useRef(false);
  const stateRef = useRef<WavefunctionState | null>(null);
  const dividerRef = useRef<HTMLDivElement | null>(null);
  
  // Sync state to ref
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  
  // Clean up recording animation when recording stops
  useEffect(() => {
    if (!isRecording && recordingAnimationRef.current) {
      cancelAnimationFrame(recordingAnimationRef.current);
      recordingAnimationRef.current = null;
    }
  }, [isRecording]);
  
  // Clean up ZIP export animation when export stops
  useEffect(() => {
    if (!isExportingZip && zipExportAnimationRef.current) {
      cancelAnimationFrame(zipExportAnimationRef.current);
      zipExportAnimationRef.current = null;
      zipFramesRef.current = [];
    }
  }, [isExportingZip]);
  
  // Drag divider handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    
    // Calculate new width based on mouse position relative to the left edge
    const newWidth = Math.max(250, Math.min(600, e.clientX));
    setPanelWidth(newWidth);
  }, [isDragging]);
  
  const handleMouseUp = useCallback((e: MouseEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  // Add global mouse events when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.body.style.pointerEvents = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  // Panel toggle button
  const togglePanel = () => {
    setIsPanelVisible(!isPanelVisible);
  };
  
  // 1. Structural Initialization: Recreates solver & wavefunction
  useEffect(() => {
    try {
      // Validate custom wavefunction function if applicable
      if (sanitizedConfig.wavefunctionType === 'custom-function') {
        const validation = validateWavefunctionFunctions(
          sanitizedConfig.wavefunctionRealExpr,
          sanitizedConfig.wavefunctionImagExpr,
          sanitizedConfig.wavefunctionParameters || {}
        );
        if (!validation.valid) {
          console.error('Invalid wavefunction function:', validation.error);
          return;
        }
      }
      
      // Create solver
      const newSolver = new TDSESolver({
        gridSize: sanitizedConfig.gridSize,
        xMin: sanitizedConfig.xMin,
        xMax: sanitizedConfig.xMax,
        dt: sanitizedConfig.dt,
        hbar: 1,
        mass: 1,
        abcEnabled: sanitizedConfig.abcEnabled,
        abcWidth: sanitizedConfig.abcWidth,
        abcStrength: sanitizedConfig.abcStrength
      });
      
      // Generate current potential (using current configs & drawn points)
      const newPotential = generatePotential(newSolver.x, {
        type: sanitizedConfig.potentialType,
        v0: sanitizedConfig.potentialV0,
        x0: sanitizedConfig.potentialX0,
        width: sanitizedConfig.potentialWidth,
        omega: sanitizedConfig.potentialOmega,
        customFunction: sanitizedConfig.customPotentialFunction,
        customPoints: drawnPoints
      }, 1, sanitizedConfig.potentialParameters || {});
      
      newSolver.setPotential(newPotential);
      setPotential(new Float64Array(newPotential));
      
      // Create initial wavefunction
      let initialState: WavefunctionState;
      switch (sanitizedConfig.wavefunctionType) {
        case 'gaussian':
          initialState = createGaussianWavepacket(
            newSolver,
            sanitizedConfig.wavefunctionX0,
            sanitizedConfig.wavefunctionSigma,
            sanitizedConfig.wavefunctionK0
          );
          break;
        case 'plane-wave':
          initialState = createPlaneWave(
            newSolver,
            sanitizedConfig.wavefunctionAmplitude,
            sanitizedConfig.wavefunctionK0
          );
          break;
        case 'bound-state':
          initialState = createBoundState(
            newSolver,
            sanitizedConfig.wavefunctionQuantumNumber,
            sanitizedConfig.wavefunctionWellWidth
          );
          break;
        case 'custom-function':
          initialState = createCustomWavefunction(
            newSolver,
            sanitizedConfig.wavefunctionRealExpr,
            sanitizedConfig.wavefunctionImagExpr,
            sanitizedConfig.wavefunctionParameters || {}
          );
          break;
        default:
          initialState = createGaussianWavepacket(
            newSolver,
            sanitizedConfig.wavefunctionX0,
            sanitizedConfig.wavefunctionSigma,
            sanitizedConfig.wavefunctionK0
          );
      }
      
      setSolver(newSolver);
      const newState = {
        real: new Float64Array(initialState.real),
        imag: new Float64Array(initialState.imag),
        time: 0
      };
      setState(newState);
      setEnergy(newSolver.getEnergy(newState));
      setTotalProbability(newSolver.getTotalProbability(newState));
      setEigenstates([]);
      setPreviewEigenstateIndex(null);
      boundaryWarningShownRef.current = false;
    } catch (error) {
      console.error('Error in structural initialization:', error);
    }
  }, [
    sanitizedConfig.gridSize,
    sanitizedConfig.xMin,
    sanitizedConfig.xMax,
    sanitizedConfig.dt,
    sanitizedConfig.wavefunctionType,
    sanitizedConfig.wavefunctionX0,
    sanitizedConfig.wavefunctionSigma,
    sanitizedConfig.wavefunctionK0,
    sanitizedConfig.wavefunctionAmplitude,
    sanitizedConfig.wavefunctionQuantumNumber,
    sanitizedConfig.wavefunctionWellWidth,
    sanitizedConfig.wavefunctionRealExpr,
    sanitizedConfig.wavefunctionImagExpr,
    sanitizedConfig.wavefunctionParameters
  ]);

  // Synchronize potential dynamically if non-structural potential parameters change
  useEffect(() => {
    if (!solver) return;
    try {
      const newPotential = generatePotential(solver.x, {
        type: sanitizedConfig.potentialType,
        v0: sanitizedConfig.potentialV0,
        x0: sanitizedConfig.potentialX0,
        width: sanitizedConfig.potentialWidth,
        omega: sanitizedConfig.potentialOmega,
        customFunction: sanitizedConfig.customPotentialFunction,
        customPoints: drawnPoints
      }, 1, sanitizedConfig.potentialParameters || {});
      
      solver.setPotential(newPotential);
      setPotential(new Float64Array(newPotential));
      
      // Update ABC dynamically
      solver.setABC(sanitizedConfig.abcEnabled ?? false, sanitizedConfig.abcWidth ?? 2, sanitizedConfig.abcStrength ?? 0.5);
      
      // Clear eigenstates since the potential landscape has changed!
      setEigenstates([]);
      setPreviewEigenstateIndex(null);
      
      // Recalculate energy using the current running wavefunction state if available
      const currentState = stateRef.current;
      if (currentState) {
        setEnergy(solver.getEnergy(currentState));
      }
    } catch (error) {
      console.error('Error updating potential dynamically:', error);
    }
  }, [
    solver,
    sanitizedConfig.potentialType,
    sanitizedConfig.potentialV0,
    sanitizedConfig.potentialX0,
    sanitizedConfig.potentialWidth,
    sanitizedConfig.potentialOmega,
    sanitizedConfig.customPotentialFunction,
    sanitizedConfig.potentialParameters,
    drawnPoints,
    drawnPotentialVersion,
    sanitizedConfig.abcEnabled,
    sanitizedConfig.abcWidth,
    sanitizedConfig.abcStrength
  ]);
  
  // Animation loop
  const animate = useCallback(() => {
    const currentState = stateRef.current;
    if (!solver || !currentState) return;
    
    // Perform multiple steps per frame for smoother evolution
    for (let i = 0; i < sanitizedConfig.stepsPerFrame; i++) {
      solver.step(currentState);
    }
    
    // Force new object to trigger React update with COPIED arrays
    const newState = {
      real: new Float64Array(currentState.real),
      imag: new Float64Array(currentState.imag),
      time: currentState.time
    };
    setState(newState);
    
    // Update energy and probability
    const newEnergy = solver.getEnergy(currentState);
    const newProb = solver.getTotalProbability(currentState);
    setEnergy(newEnergy);
    setTotalProbability(newProb);
    
    // Check boundaries (skip if ABC is active)
    if (!sanitizedConfig.abcEnabled && !boundaryWarningShownRef.current && solver.checkBoundaries(currentState)) {
      boundaryWarningShownRef.current = true;
      setIsRunning(false);
      setShowBoundaryModal(true);
      return;
    }
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [solver, sanitizedConfig.stepsPerFrame, sanitizedConfig.abcEnabled]);
  
  // Start/stop animation
  useEffect(() => {
    if (isRunning) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRunning, animate]);
  
  const handleConfigChange = (newConfig: Partial<SimulationConfig>, shouldSwitchTab = false) => {
    // Auto-pause if running to allow config changes
    if (isRunning) {
      setIsRunning(false);
    }
    setConfig({ ...config, ...newConfig });
    if (shouldSwitchTab) {
      setMobileTab('simulation');
    }
  };
  
  const handlePlay = () => {
    setIsRunning(true);
  };
  
  const handlePause = () => {
    setIsRunning(false);
  };
  
  const handleReset = () => {
    // Stop animation if running
    setIsRunning(false);
    
    // Recreate initial state
    if (solver) {
      let initialState: WavefunctionState;
      
      switch (sanitizedConfig.wavefunctionType) {
        case 'gaussian':
          initialState = createGaussianWavepacket(
            solver,
            sanitizedConfig.wavefunctionX0,
            sanitizedConfig.wavefunctionSigma,
            sanitizedConfig.wavefunctionK0
          );
          break;
        case 'plane-wave':
          initialState = createPlaneWave(
            solver,
            sanitizedConfig.wavefunctionAmplitude,
            sanitizedConfig.wavefunctionK0
          );
          break;
        case 'bound-state':
          initialState = createBoundState(
            solver,
            sanitizedConfig.wavefunctionQuantumNumber,
            sanitizedConfig.wavefunctionWellWidth
          );
          break;
        case 'custom-function':
          initialState = createCustomWavefunction(
            solver,
            sanitizedConfig.wavefunctionRealExpr,
            sanitizedConfig.wavefunctionImagExpr,
            sanitizedConfig.wavefunctionParameters || {}
          );
          break;
        default:
          initialState = createGaussianWavepacket(
            solver,
            sanitizedConfig.wavefunctionX0,
            sanitizedConfig.wavefunctionSigma,
            sanitizedConfig.wavefunctionK0
          );
      }
      
      // Update state with new object
      setState({
        real: new Float64Array(initialState.real),
        imag: new Float64Array(initialState.imag),
        time: 0  // Explicitly reset time
      });
      setEnergy(solver.getEnergy(initialState));
      setTotalProbability(solver.getTotalProbability(initialState));
      boundaryWarningShownRef.current = false;
    }
  };
  
  const handleDrawPotential = (newPotential: Float64Array) => {
    if (!solver) return;
    
    // Update local state and solver immediately
    setPotential(new Float64Array(newPotential));
    solver.setPotential(newPotential);
    
    // Save points as coordinate pairs for configuration/exports
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < newPotential.length; i++) {
      points.push({ x: solver.x[i], y: newPotential[i] });
    }
    setDrawnPoints(points);
    
    // Re-calculate energy on the fly
    const currentState = stateRef.current;
    if (currentState) {
      setEnergy(solver.getEnergy(currentState));
    }
  };
  
  const handleApplyDrawing = (points: { x: number; y: number }[]) => {
    setDrawnPoints(points);
    setDrawnPotentialVersion(v => v + 1); // Increment version to trigger re-initialization
  };
  
  const handleClearDrawnPotential = () => {
    if (solver) {
      const zeroV = new Float64Array(solver.x.length);
      solver.setPotential(zeroV);
      setPotential(zeroV);
      setDrawnPoints([]);
      setDrawnPotentialVersion(v => v + 1);
      const currentState = stateRef.current;
      if (currentState) {
        setEnergy(solver.getEnergy(currentState));
      }
    }
  };
  
  const handleDismissModal = () => {
    setShowBoundaryModal(false);
  };

  const handleEnableAbcAndContinue = () => {
    setShowBoundaryModal(false);
    
    // Dynamically apply ABC directly to the solver
    if (solver) {
      solver.setABC(true, sanitizedConfig.abcWidth, sanitizedConfig.abcStrength);
    }
    
    // Update config and continue simulation
    setConfig(prev => ({ ...prev, abcEnabled: true }));
    setIsRunning(true);
  };
  
  const handleComputeEigenstates = () => {
    if (!solver) return;
    setIsRunning(false);
    
    // Stop any animation running
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    try {
      const states = solver.findEigenstates(4);
      setEigenstates(states);
      setPreviewEigenstateIndex(null);
    } catch (e) {
      console.error('Error computing eigenstates:', e);
      alert('Failed to compute bound states.');
    }
  };

  const handleLoadEigenstate = (index: number) => {
    if (!solver || index < 0 || index >= eigenstates.length) return;
    
    const targetState = eigenstates[index].state;
    const newState = {
      real: new Float64Array(targetState.real),
      imag: new Float64Array(targetState.imag),
      time: 0
    };
    setState(newState);
    setEnergy(solver.getEnergy(newState));
    setTotalProbability(solver.getTotalProbability(newState));
    boundaryWarningShownRef.current = false;
    setPreviewEigenstateIndex(null); // Clear preview since we loaded it
    setMobileTab('simulation'); // Redirect to simulation view on mobile
  };
  
  const handleSave = () => {
    const saveData = {
      config,
      state: state ? {
        real: Array.from(state.real),
        imag: Array.from(state.imag),
        time: state.time
      } : null,
      energy,
      totalProbability,
      // Include parameter information
      parameters: {
        potential: config.potentialParameters || {},
        wavefunction: config.wavefunctionParameters || {}
      }
    };
    
    const blob = new Blob([JSON.stringify(saveData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantum-simulation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const handleLoad = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (data.config) {
          setConfig(data.config);
        }
        
        // State will be recreated by useEffect when config changes
        // We don't restore state directly to ensure consistency
      } catch (error) {
        console.error('Error loading file:', error);
        alert('Failed to load configuration file');
      }
    };
    
    reader.readAsText(file);
  };
  
  const handleDownloadCurrentFrame = () => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      alert('No visualization canvas found');
      return;
    }
    
    const dataURL = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `tdse_simulation_t${Date.now()}.png`;
    a.click();
  };
  
  const handleDownloadVideo = async (format: string, frameRate: number, quality: string, startTime: number, endTime: number) => {
    if (isRecording) {
      alert('Video recording is already in progress');
      return;
    }
    
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      alert('No visualization canvas found');
      return;
    }
    
    if (endTime <= startTime) {
      alert('End time must be greater than start time');
      return;
    }
    
    if (!solver || !state) {
      alert('No simulation state found. Please start a simulation first.');
      return;
    }
    
    try {
      setIsRecording(true);
      setRecordingProgress(0);
      recordingChunksRef.current = [];
      
      // Store original state
      const wasRunning = isRunning;
      const originalStep = config.stepsPerFrame;
      
      // Stop normal animation
      setIsRunning(false);
      
      // Reset simulation to start time
      const initialState = createGaussianWavepacket(
        solver,
        config.wavefunctionX0,
        config.wavefunctionSigma,
        config.wavefunctionK0
      );
      
      const resetState = {
        real: new Float64Array(initialState.real),
        imag: new Float64Array(initialState.imag),
        time: 0
      };
      setState(resetState);
      
      // Calculate simulation steps to reach start time
      const stepsToStart = Math.floor(startTime / config.dt);
      for (let i = 0; i < stepsToStart; i++) {
        solver.step(resetState);
      }
      
      // Update state to start time
      const startState = {
        real: new Float64Array(resetState.real),
        imag: new Float64Array(resetState.imag),
        time: startTime
      };
      setState(startState);
      
      // Wait a moment for state update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get canvas stream with higher frame rate for smooth recording
      const stream = canvas.captureStream(60);
      
      // Create media recorder with appropriate mime type
      let mimeType = '';
      if (format === 'mp4' && MediaRecorder.isTypeSupported('video/mp4;codecs=h264')) {
        mimeType = 'video/mp4;codecs=h264';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      } else {
        mimeType = 'video/webm';
      }
      
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: quality === 'high' ? 8000000 : quality === 'medium' ? 4000000 : 2000000
      });
      
      videoRecorderRef.current = recorder;
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tdse_simulation_${format}_${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        
        // Clean up and resume
        setIsRecording(false);
        setRecordingProgress(0);
        handleConfigChange({ stepsPerFrame: originalStep });
        if (wasRunning) {
          setIsRunning(true);
        }
      };
      
      recorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        alert('Failed to record video. Please try again.');
        setIsRecording(false);
        setRecordingProgress(0);
        handleConfigChange({ stepsPerFrame: originalStep });
        if (wasRunning) {
          setIsRunning(true);
        }
      };
      
      // Start recording
      recorder.start();
      
      // Frame-by-frame recording with manual animation control
      const totalDuration = endTime - startTime;
      const totalFrames = Math.floor(totalDuration * frameRate);
      const timePerFrame = totalDuration / totalFrames;
      const simulationStepsPerFrame = Math.max(1, Math.floor(timePerFrame / config.dt));
      
      let currentFrame = 0;
      
      const recordFrame = () => {
        if (currentFrame >= totalFrames) {
          // Recording complete
          recorder.stop();
          return;
        }
        
        // Advance simulation by the required number of steps for this frame
        const currentState = stateRef.current;
        if (currentState) {
          for (let i = 0; i < simulationStepsPerFrame; i++) {
            solver.step(currentState);
          }
          
          // Force React update with new state
          const newState = {
            real: new Float64Array(currentState.real),
            imag: new Float64Array(currentState.imag),
            time: currentState.time
          };
          setState(newState);
          
          // Update energy and probability
          setEnergy(solver.getEnergy(currentState));
          setTotalProbability(solver.getTotalProbability(currentState));
        }
        
        // Update progress
        currentFrame++;
        setRecordingProgress((currentFrame / totalFrames) * 100);
        
        // Schedule next frame
        recordingAnimationRef.current = requestAnimationFrame(recordFrame);
      };
      
      // Start frame recording
      recordingAnimationRef.current = requestAnimationFrame(recordFrame);
      
      // Set maximum recording timeout
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, totalDuration * 1000 + 2000); // Add 2 seconds buffer
      
    } catch (error) {
      console.error('Error recording video:', error);
      alert('Failed to start video recording. Please try again.');
      setIsRecording(false);
      setRecordingProgress(0);
      handleConfigChange({ stepsPerFrame: config.stepsPerFrame });
      if (isRunning) {
        setIsRunning(true);
      }
    }
  };
  
  const handleDownloadFramesAsZip = async (frameRate: number, startTime: number, endTime: number) => {
    if (isExportingZip) {
      alert('Frame export is already in progress');
      return;
    }
    
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      alert('No visualization canvas found');
      return;
    }
    
    if (endTime <= startTime) {
      alert('End time must be greater than start time');
      return;
    }
    
    if (!solver || !state) {
      alert('No simulation state found. Please start a simulation first.');
      return;
    }
    
    try {
      setIsExportingZip(true);
      setZipProgress(0);
      zipFramesRef.current = [];
      
      // Store original state
      const wasRunning = isRunning;
      const originalStep = config.stepsPerFrame;
      
      // Stop normal animation
      setIsRunning(false);
      
      // Reset simulation to start time
      const initialState = createGaussianWavepacket(
        solver,
        config.wavefunctionX0,
        config.wavefunctionSigma,
        config.wavefunctionK0
      );
      
      const resetState = {
        real: new Float64Array(initialState.real),
        imag: new Float64Array(initialState.imag),
        time: 0
      };
      setState(resetState);
      
      // Calculate simulation steps to reach start time
      const stepsToStart = Math.floor(startTime / config.dt);
      for (let i = 0; i < stepsToStart; i++) {
        solver.step(resetState);
      }
      
      // Update state to start time
      const startState = {
        real: new Float64Array(resetState.real),
        imag: new Float64Array(resetState.imag),
        time: startTime
      };
      setState(startState);
      
      // Wait a moment for state update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Frame-by-frame capture with manual animation control
      const totalDuration = endTime - startTime;
      const totalFrames = Math.floor(totalDuration * frameRate);
      const timePerFrame = totalDuration / totalFrames;
      const simulationStepsPerFrame = Math.max(1, Math.floor(timePerFrame / config.dt));
      
      let currentFrame = 0;
      
      const captureFrame = () => {
        if (currentFrame >= totalFrames) {
          // All frames captured, now create ZIP
          createZipAndDownload(totalFrames, wasRunning, originalStep);
          return;
        }
        
        // Advance simulation by the required number of steps for this frame
        const currentState = stateRef.current;
        if (currentState) {
          for (let i = 0; i < simulationStepsPerFrame; i++) {
            solver.step(currentState);
          }
          
          // Force React update with new state
          const newState = {
            real: new Float64Array(currentState.real),
            imag: new Float64Array(currentState.imag),
            time: currentState.time
          };
          setState(newState);
          
          // Update energy and probability
          setEnergy(solver.getEnergy(currentState));
          setTotalProbability(solver.getTotalProbability(currentState));
        }
        
        // Wait for render, then capture the frame
        requestAnimationFrame(() => {
          const dataURL = canvas.toDataURL('image/png');
          zipFramesRef.current.push(dataURL);
          
          // Update progress
          currentFrame++;
          setZipProgress((currentFrame / totalFrames) * 100);
          
          // Schedule next frame
          zipExportAnimationRef.current = requestAnimationFrame(captureFrame);
        });
      };
      
      // Helper function to create and download ZIP
      const createZipAndDownload = async (totalFrames: number, wasRunning: boolean, originalStep: number) => {
        try {
          const zip = new JSZip();
          
          // Add each frame to the ZIP file
          for (let i = 0; i < zipFramesRef.current.length; i++) {
            const dataURL = zipFramesRef.current[i];
            const base64Data = dataURL.split(',')[1];
            const frameNumber = String(i + 1).padStart(5, '0');
            zip.file(`frame_${frameNumber}.png`, base64Data, { base64: true });
          }
          
          // Add a metadata file
          const metadata = {
            totalFrames: totalFrames,
            frameRate: frameRate,
            startTime: startTime,
            endTime: endTime,
            duration: endTime - startTime,
            exportDate: new Date().toISOString(),
            simulationConfig: {
              potentialType: config.potentialType,
              gridSize: config.gridSize,
              dt: config.dt
            }
          };
          zip.file('metadata.json', JSON.stringify(metadata, null, 2));
          
          // Generate ZIP file
          const blob = await zip.generateAsync({ type: 'blob' });
          
          // Download the ZIP file
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `tdse_frames_${Date.now()}.zip`;
          a.click();
          URL.revokeObjectURL(url);
          
          // Clean up
          setIsExportingZip(false);
          setZipProgress(0);
          zipFramesRef.current = [];
          handleConfigChange({ stepsPerFrame: originalStep });
          if (wasRunning) {
            setIsRunning(true);
          }
        } catch (error) {
          console.error('Error creating ZIP file:', error);
          alert('Failed to create ZIP file. Please try again.');
          setIsExportingZip(false);
          setZipProgress(0);
          zipFramesRef.current = [];
          handleConfigChange({ stepsPerFrame: originalStep });
          if (wasRunning) {
            setIsRunning(true);
          }
        }
      };
      
      // Start frame capture
      zipExportAnimationRef.current = requestAnimationFrame(captureFrame);
      
    } catch (error) {
      console.error('Error exporting frames:', error);
      alert('Failed to start frame export. Please try again.');
      setIsExportingZip(false);
      setZipProgress(0);
      zipFramesRef.current = [];
      handleConfigChange({ stepsPerFrame: config.stepsPerFrame });
      if (isRunning) {
        setIsRunning(true);
      }
    }
  };
  
  return (
    <div 
      className="w-screen h-screen flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-surface-primary"
      style={{ height: '100dvh' }}
    >
      {/* Mobile Top Header Bar */}
      <div className="md:hidden w-full h-12 bg-surface-primary border-b border-border-default px-4 flex items-center justify-between z-30 select-none flex-shrink-0 font-sans">
        <div className="flex items-center gap-2">
          <Activity className="text-accent-primary animate-pulse" size={16} />
          <span className="font-bold text-[10px] uppercase tracking-widest text-text-primary">
            1D Quantum Simulator
          </span>
        </div>
        <div className="text-[9px] uppercase tracking-wider text-text-tertiary font-mono">
          by{' '}
          <a
            href="https://www.dr-abhishek.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-primary hover:text-accent-dark hover:underline font-bold transition-fast"
          >
            Dr. Abhishek
          </a>
        </div>
      </div>

      {/* Control Panel (Desktop Sidebar) - Hidden on mobile */}
      {isPanelVisible && (
        <div 
          style={{ width: `${panelWidth}px` }}
          className="hidden md:block relative flex-shrink-0 h-full"
        >
          <ControlPanel
            config={config}
            isRunning={isRunning}
            onConfigChange={handleConfigChange}
            onPlay={handlePlay}
            onPause={handlePause}
            onReset={handleReset}
            onSave={handleSave}
            onLoad={handleLoad}
            onDownloadCurrentFrame={handleDownloadCurrentFrame}
            onDownloadVideo={handleDownloadVideo}
            onDownloadFramesAsZip={handleDownloadFramesAsZip}
            onClearDrawnPotential={handleClearDrawnPotential}
            isRecording={isRecording}
            recordingProgress={recordingProgress}
            isExportingZip={isExportingZip}
            zipProgress={zipProgress}
            eigenstates={eigenstates}
            previewEigenstateIndex={previewEigenstateIndex}
            onComputeEigenstates={handleComputeEigenstates}
            onPreviewEigenstate={setPreviewEigenstateIndex}
            onLoadEigenstate={handleLoadEigenstate}
          />
        </div>
      )}
      
      {/* Divider - Only show on desktop when panel is visible */}
      {isPanelVisible && (
        <div
          ref={dividerRef}
          onMouseDown={handleMouseDown}
          className={`hidden md:block w-1 bg-border-default hover:bg-border-focus flex-shrink-0 transition-colors duration-150 relative z-10 ${
            isDragging ? 'bg-border-focus w-1.5' : ''
          }`}
          style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }}
        >
          {/* Invisible handle for easier grabbing */}
          <div className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize hover:cursor-col-resize" />
        </div>
      )}
      
      {/* Panel Toggle Button (Desktop Only) */}
      <button
        onClick={togglePanel}
        className={`hidden md:flex fixed top-4 z-50 p-2 bg-surface-secondary border border-border-default hover:bg-surface-tertiary text-text-primary rounded-sm transition-all duration-150 shadow-lg`}
        title={isPanelVisible ? 'Hide Control Panel' : 'Show Control Panel'}
        style={{
          left: isPanelVisible ? `${panelWidth + 8}px` : '16px'
        }}
      >
        {isPanelVisible ? <X size={16} /> : <Settings size={16} />}
      </button>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative h-full">
        {/* Visualization Canvas Wrapper */}
        <div className={`relative w-full ${mobileTab === 'simulation' ? 'aspect-[4/3] border-b border-border-default md:aspect-none md:border-none md:flex-1' : 'hidden md:block md:flex-1'}`}>
          {solver && (
            <QuantumVisualization
              x={solver.x}
              potential={potential}
              state={state}
              isRunning={isRunning}
              energy={energy}
              totalProbability={totalProbability}
              plotXMin={sanitizedConfig.plotXMin}
              plotXMax={sanitizedConfig.plotXMax}
              plotYMin={sanitizedConfig.plotYMin}
              plotYMax={sanitizedConfig.plotYMax}
              potentialType={sanitizedConfig.potentialType}
              onDrawPotential={handleDrawPotential}
              previewState={previewEigenstateIndex !== null ? eigenstates[previewEigenstateIndex]?.state : null}
              previewEigenvalue={previewEigenstateIndex !== null ? eigenstates[previewEigenstateIndex]?.energy : null}
            />
          )}

          {/* Central Play Overlay - Desktop Only */}
          {!isRunning && state && state.time === 0 && (
            <div className="hidden md:flex absolute inset-0 flex items-center justify-center bg-black/5 z-20 pointer-events-none">
              <button
                onClick={handlePlay}
                className="w-24 h-24 bg-accent-primary hover:bg-accent-dark text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 pointer-events-auto"
                title="Start Simulation"
              >
                <Play size={36} className="ml-1.5 fill-white text-white" />
              </button>
            </div>
          )}

          {/* Floating Bottom Control Bar - Desktop Only */}
          {(isRunning || (state && state.time > 0)) && (
            <div className="hidden md:flex absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-surface-primary/85 backdrop-blur-md border-2 border-text-primary shadow-minimal p-3 px-6 rounded-none items-center gap-6 z-30 transition-all animate-in fade-in slide-in-from-bottom-4 duration-200">
              <button
                onClick={isRunning ? handlePause : handlePlay}
                className={`w-12 h-12 flex items-center justify-center rounded-none transition-fast text-white ${
                  isRunning ? 'bg-text-secondary hover:bg-text-primary' : 'bg-accent-primary hover:bg-accent-dark'
                }`}
                title={isRunning ? 'Pause' : 'Play'}
              >
                {isRunning ? <Pause size={18} className="fill-white text-white" /> : <Play size={18} className="fill-white text-white ml-0.5" />}
              </button>
              
              <button
                onClick={handleReset}
                className="w-10 h-10 border border-border-default bg-surface-primary hover:bg-surface-tertiary text-text-primary rounded-none flex items-center justify-center transition-fast"
                title="Reset Simulation"
              >
                <RotateCcw size={16} />
              </button>
              
              <div className="h-6 w-px bg-border-default" />
              
              {/* Stats Dashboard */}
              <div className="flex items-center gap-6 text-sm font-mono font-medium text-text-secondary">
                <div>
                  <span className="text-text-tertiary mr-1.5 uppercase text-[10px] tracking-wider font-sans font-bold">Time</span>
                  <span className="text-text-primary text-sm font-mono font-bold">t = {(state?.time ?? 0).toFixed(3)}</span>
                </div>
                
                <div>
                  <span className="text-text-tertiary mr-1.5 uppercase text-[10px] tracking-wider font-sans font-bold">Energy</span>
                  <span className="text-text-primary text-sm font-mono font-bold">E = {energy.toFixed(3)}</span>
                </div>
                
                <div>
                  <span className="text-text-tertiary mr-1.5 uppercase text-[10px] tracking-wider font-sans font-bold">Norm</span>
                  <span className={`text-sm font-mono font-bold ${totalProbability < 0.995 ? 'text-red-600 font-extrabold' : 'text-text-primary'}`}>
                    ∫|ψ|² = {totalProbability.toFixed(4)}
                  </span>
                </div>
  
                {config.abcEnabled && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-none text-[10px] font-sans font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    ABC Active
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Quick Dashboard - Only visible on mobile under the canvas */}
        <div className={`md:hidden flex-1 overflow-y-auto bg-surface-secondary p-4 space-y-4 font-sans select-none ${mobileTab === 'simulation' ? 'block' : 'hidden'}`}>
          {/* Quick Play & Reset Controls */}
          <div className="flex gap-3">
            <button
              onClick={isRunning ? handlePause : handlePlay}
              className={`flex-1 h-[48px] border-2 border-text-primary font-bold uppercase tracking-wider text-xs transition-fast flex items-center justify-center gap-2 text-white ${
                isRunning ? 'bg-text-secondary hover:bg-text-primary' : 'bg-accent-primary hover:bg-accent-dark'
              }`}
            >
              {isRunning ? <Pause size={16} className="fill-white text-white" /> : <Play size={16} className="fill-white text-white" />}
              {isRunning ? 'Pause Simulation' : 'Start Simulation'}
            </button>
            <button
              onClick={handleReset}
              className="w-[48px] h-[48px] border-2 border-text-primary bg-surface-primary hover:bg-surface-tertiary text-text-primary flex items-center justify-center transition-fast"
              title="Reset"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Stats Dashboard Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface-primary border border-border-default p-2.5 text-center flex flex-col justify-center min-h-[60px]">
              <span className="text-[9px] uppercase tracking-wider text-text-tertiary font-bold mb-1 block">Time</span>
              <span className="text-text-primary font-mono text-sm font-bold">t = {(state?.time ?? 0).toFixed(2)}</span>
            </div>
            
            <div className="bg-surface-primary border border-border-default p-2.5 text-center flex flex-col justify-center min-h-[60px]">
              <span className="text-[9px] uppercase tracking-wider text-text-tertiary font-bold mb-1 block">Energy</span>
              <span className="text-text-primary font-mono text-sm font-bold">E = {energy.toFixed(2)}</span>
            </div>
            
            <div className="bg-surface-primary border border-border-default p-2.5 text-center flex flex-col justify-center min-h-[60px]">
              <span className="text-[9px] uppercase tracking-wider text-text-tertiary font-bold mb-1 block">Norm</span>
              <span className={`font-mono text-xs font-bold block ${totalProbability < 0.995 ? 'text-red-600 font-extrabold' : 'text-text-primary'}`}>
                {(totalProbability ?? 0).toFixed(3)}
              </span>
            </div>
          </div>

          {/* Quick Parameters Sliders */}
          <div className="bg-surface-primary border border-border-default p-4 space-y-4">
            <h4 className="text-[10px] uppercase tracking-widest text-text-primary font-bold border-b border-border-default pb-2">
              Quick Adjustments
            </h4>
            
            {/* Wavepacket Momentum (k0) */}
            {(sanitizedConfig.wavefunctionType === 'gaussian' || sanitizedConfig.wavefunctionType === 'plane-wave') && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary font-medium">Wavepacket Momentum (k₀)</span>
                  <span className="text-text-primary font-mono font-bold">{sanitizedConfig.wavefunctionK0.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="0.5"
                  value={sanitizedConfig.wavefunctionK0}
                  onChange={(e) => handleConfigChange({ wavefunctionK0: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-surface-tertiary appearance-none cursor-pointer accent-accent-primary"
                />
              </div>
            )}

            {/* Barrier Height (V0) */}
            {(sanitizedConfig.potentialType === 'barrier' || sanitizedConfig.potentialType === 'well') && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary font-medium">
                    {sanitizedConfig.potentialType === 'barrier' ? 'Barrier Height (V₀)' : 'Well Depth (V₀)'}
                  </span>
                  <span className="text-text-primary font-mono font-bold">{sanitizedConfig.potentialV0.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="0.5"
                  value={sanitizedConfig.potentialV0}
                  onChange={(e) => handleConfigChange({ potentialV0: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-surface-tertiary appearance-none cursor-pointer accent-accent-primary"
                />
              </div>
            )}

            {/* Simulation Speed */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-text-secondary font-medium">Simulation Speed</span>
                <span className="text-text-primary font-mono font-bold">{sanitizedConfig.stepsPerFrame}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="25"
                step="1"
                value={sanitizedConfig.stepsPerFrame}
                onChange={(e) => handleConfigChange({ stepsPerFrame: parseInt(e.target.value) })}
                className="w-full h-2 bg-surface-tertiary appearance-none cursor-pointer accent-accent-primary"
              />
            </div>
          </div>
        </div>

        {/* Control Panel content for Mobile Tabs - Shown only when not on simulation tab */}
        <div className={`flex-1 overflow-y-auto bg-surface-secondary md:hidden ${mobileTab !== 'simulation' ? 'block' : 'hidden'}`}>
          <ControlPanel
            config={config}
            isRunning={isRunning}
            onConfigChange={handleConfigChange}
            onPlay={handlePlay}
            onPause={handlePause}
            onReset={handleReset}
            onSave={handleSave}
            onLoad={handleLoad}
            onDownloadCurrentFrame={handleDownloadCurrentFrame}
            onDownloadVideo={handleDownloadVideo}
            onDownloadFramesAsZip={handleDownloadFramesAsZip}
            onClearDrawnPotential={handleClearDrawnPotential}
            isRecording={isRecording}
            recordingProgress={recordingProgress}
            isExportingZip={isExportingZip}
            zipProgress={zipProgress}
            eigenstates={eigenstates}
            previewEigenstateIndex={previewEigenstateIndex}
            onComputeEigenstates={handleComputeEigenstates}
            onPreviewEigenstate={setPreviewEigenstateIndex}
            onLoadEigenstate={handleLoadEigenstate}
            activeTab={mobileTab === 'parameters' ? 'parameters' : 'presets'}
            onTabChange={(tab) => setMobileTab(tab === 'parameters' ? 'parameters' : 'presets')}
          />
        </div>
      </div>

      {/* Bottom Navigation Tab Bar - Mobile Only */}
      <div className="md:hidden w-full h-16 bg-surface-primary border-t border-border-default flex items-center justify-around z-30 select-none flex-shrink-0 font-sans">
        <button
          onClick={() => setMobileTab('simulation')}
          className={`flex-1 h-full flex flex-col items-center justify-center gap-1 transition-fast border-r border-border-default/30 last:border-none ${
            mobileTab === 'simulation' ? 'text-accent-primary font-bold bg-surface-secondary/50' : 'text-text-tertiary'
          }`}
        >
          <Activity size={18} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Simulation</span>
        </button>
        
        <button
          onClick={() => setMobileTab('parameters')}
          className={`flex-1 h-full flex flex-col items-center justify-center gap-1 transition-fast border-r border-border-default/30 last:border-none ${
            mobileTab === 'parameters' ? 'text-accent-primary font-bold bg-surface-secondary/50' : 'text-text-tertiary'
          }`}
        >
          <Sliders size={18} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Parameters</span>
        </button>
        
        <button
          onClick={() => setMobileTab('presets')}
          className={`flex-1 h-full flex flex-col items-center justify-center gap-1 transition-fast last:border-none ${
            mobileTab === 'presets' ? 'text-accent-primary font-bold bg-surface-secondary/50' : 'text-text-tertiary'
          }`}
        >
          <BookOpen size={18} />
          <span className="text-[9px] font-bold uppercase tracking-wider">Presets</span>
        </button>
      </div>

      {/* Elegant Swiss-Design Modal Overlay */}
      {showBoundaryModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50 animate-in fade-in duration-200">
          <div className="bg-surface-primary border-2 border-text-primary p-6 md:p-8 max-w-md w-full shadow-minimal rounded-none relative">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-viz-imaginary" size={24} />
              <h3 className="text-lg font-bold uppercase tracking-wider text-text-primary font-sans">
                Boundary Interference
              </h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed mb-4 font-sans">
              The wavepacket has reached the grid boundary. To prevent non-physical boundary reflections, the simulation has been paused.
            </p>
            <p className="text-sm text-text-tertiary leading-relaxed mb-6 font-sans">
              Would you like to enable <strong>Absorbing Boundary Conditions (ABC)</strong> to smoothly absorb the wavefunction amplitude at the boundary edges and continue?
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleEnableAbcAndContinue}
                className="flex-1 h-12 bg-accent-primary hover:bg-accent-dark text-white text-xs font-bold uppercase tracking-widest rounded-none transition-fast"
              >
                Enable ABC & Continue
              </button>
              <button
                onClick={handleDismissModal}
                className="h-12 px-6 border border-border-default hover:bg-surface-secondary text-text-secondary text-xs font-bold uppercase tracking-widest rounded-none transition-fast"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
