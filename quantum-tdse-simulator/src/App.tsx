/**
 * Main Application Component
 * Manages simulation state and coordinates components
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ControlPanel, SimulationConfig } from './components/ControlPanel';
import { QuantumVisualization } from './components/QuantumVisualization';
import { DrawingCanvas } from './components/DrawingCanvas';
import { TDSESolver, WavefunctionState, createGaussianWavepacket, createPlaneWave, createBoundState, createCustomWavefunction } from './lib/tdse-solver';
import { generatePotential, validatePotentialFunction } from './lib/potentials';
import { validateWavefunctionFunctions } from './lib/wavefunctions';
import { Settings, X } from 'lucide-react';
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
  plotYMax: 3
};

function App() {
  const [config, setConfig] = useState<SimulationConfig>(DEFAULT_CONFIG);
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
  
  // Initialize solver when config changes
  useEffect(() => {
    try {
      // Validate custom potential function if applicable
      if (config.potentialType === 'custom-function') {
        const validation = validatePotentialFunction(config.customPotentialFunction, config.potentialParameters || {});
        if (!validation.valid) {
          console.error('Invalid potential function:', validation.error);
          return;
        }
      }
      
      // Validate custom wavefunction function if applicable
      if (config.wavefunctionType === 'custom-function') {
        const validation = validateWavefunctionFunctions(config.wavefunctionRealExpr, config.wavefunctionImagExpr, config.wavefunctionParameters || {});
        if (!validation.valid) {
          console.error('Invalid wavefunction function:', validation.error);
          return;
        }
      }
      
      // Create solver
      const newSolver = new TDSESolver({
        gridSize: config.gridSize,
        xMin: config.xMin,
        xMax: config.xMax,
        dt: config.dt,
        hbar: 1,
        mass: 1
      });
      
      // Generate potential
      const newPotential = generatePotential(newSolver.x, {
        type: config.potentialType,
        v0: config.potentialV0,
        x0: config.potentialX0,
        width: config.potentialWidth,
        omega: config.potentialOmega,
        customFunction: config.customPotentialFunction,
        customPoints: drawnPoints
      }, 1, config.potentialParameters || {});
      
      newSolver.setPotential(newPotential);
      // Create immutable copy of potential for visualization
      setPotential(new Float64Array(newPotential));
      
      // Create initial wavefunction based on type
      let initialState: WavefunctionState;
      
      switch (config.wavefunctionType) {
        case 'gaussian':
          initialState = createGaussianWavepacket(
            newSolver,
            config.wavefunctionX0,
            config.wavefunctionSigma,
            config.wavefunctionK0
          );
          break;
          
        case 'plane-wave':
          initialState = createPlaneWave(
            newSolver,
            config.wavefunctionAmplitude,
            config.wavefunctionK0
          );
          break;
          
        case 'bound-state':
          initialState = createBoundState(
            newSolver,
            config.wavefunctionQuantumNumber,
            config.wavefunctionWellWidth
          );
          break;
          
        case 'custom-function':
          initialState = createCustomWavefunction(
            newSolver,
            config.wavefunctionRealExpr,
            config.wavefunctionImagExpr,
            config.wavefunctionParameters || {}
          );
          break;
          
        default:
          // Fallback to Gaussian
          initialState = createGaussianWavepacket(
            newSolver,
            config.wavefunctionX0,
            config.wavefunctionSigma,
            config.wavefunctionK0
          );
      }
      
      setSolver(newSolver);
      // Create initial state with copied arrays
      const newState = {
        real: new Float64Array(initialState.real),
        imag: new Float64Array(initialState.imag),
        time: 0
      };
      setState(newState);
      
      // Calculate initial energy and probability
      setEnergy(newSolver.getEnergy(initialState));
      setTotalProbability(newSolver.getTotalProbability(initialState));
      
      boundaryWarningShownRef.current = false;
    } catch (error) {
      console.error('Error initializing simulation:', error);
    }
  }, [
    config.potentialType,
    config.potentialV0,
    config.potentialX0,
    config.potentialWidth,
    config.potentialOmega,
    config.customPotentialFunction,
    config.potentialParameters,
    config.wavefunctionType,
    config.wavefunctionX0,
    config.wavefunctionSigma,
    config.wavefunctionK0,
    config.wavefunctionAmplitude,
    config.wavefunctionQuantumNumber,
    config.wavefunctionWellWidth,
    config.wavefunctionRealExpr,
    config.wavefunctionImagExpr,
    config.wavefunctionParameters,
    config.gridSize,
    config.xMin,
    config.xMax,
    config.dt,
    drawnPotentialVersion
  ]);
  
  // Animation loop
  const animate = useCallback(() => {
    const currentState = stateRef.current;
    if (!solver || !currentState) return;
    
    // Perform multiple steps per frame for smoother evolution
    for (let i = 0; i < config.stepsPerFrame; i++) {
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
    
    // Check boundaries
    if (!boundaryWarningShownRef.current && solver.checkBoundaries(currentState)) {
      boundaryWarningShownRef.current = true;
      setIsRunning(false);
      alert('Wavepacket reached boundary! Simulation paused to prevent artifacts.');
      return;
    }
    
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [solver, config.stepsPerFrame]);
  
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
  
  const handleConfigChange = (newConfig: Partial<SimulationConfig>) => {
    // Auto-pause if running to allow config changes
    if (isRunning) {
      setIsRunning(false);
    }
    setConfig({ ...config, ...newConfig });
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
      const initialState = createGaussianWavepacket(
        solver,
        config.wavefunctionX0,
        config.wavefunctionSigma,
        config.wavefunctionK0
      );
      
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
  
  const handleApplyDrawing = (points: { x: number; y: number }[]) => {
    setDrawnPoints(points);
    setDrawnPotentialVersion(v => v + 1); // Increment version to trigger re-initialization
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
    <div className="w-screen h-screen flex flex-col md:flex-row overflow-hidden bg-surface-primary">
      {/* Control Panel - Conditionally Rendered */}
      {isPanelVisible && (
        <div 
          style={{ width: `${panelWidth}px` }}
          className="relative flex-shrink-0"
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
            isRecording={isRecording}
            recordingProgress={recordingProgress}
            isExportingZip={isExportingZip}
            zipProgress={zipProgress}
          />
        </div>
      )}
      
      {/* Divider - Only show when panel is visible */}
      {isPanelVisible && (
        <div
          ref={dividerRef}
          onMouseDown={handleMouseDown}
          className={`w-1 bg-border-default hover:bg-border-focus flex-shrink-0 transition-colors duration-150 relative z-10 ${
            isDragging ? 'bg-border-focus w-1.5' : ''
          }`}
          style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }}
        >
          {/* Invisible handle for easier grabbing */}
          <div className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize hover:cursor-col-resize" />
        </div>
      )}
      
      {/* Panel Toggle Button */}
      <button
        onClick={togglePanel}
        className={`fixed top-4 left-4 z-50 p-2 bg-surface-secondary border border-border-default hover:bg-surface-tertiary text-text-primary rounded-sm transition-all duration-150 shadow-lg`}
        title={isPanelVisible ? 'Hide Control Panel' : 'Show Control Panel'}
        style={{
          left: isPanelVisible ? `${panelWidth + 8}px` : '16px'
        }}
      >
        {isPanelVisible ? <X size={16} /> : <Settings size={16} />}
      </button>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Drawing Canvas (conditionally shown) */}
        {config.potentialType === 'custom-draw' && (
          <DrawingCanvas
            xMin={config.xMin}
            xMax={config.xMax}
            onApply={handleApplyDrawing}
          />
        )}
        
        {/* Visualization Canvas */}
        <div className={`flex-1 relative ${config.potentialType === 'custom-draw' ? 'h-[60%]' : 'h-full'}`}>
          {solver && (
            <QuantumVisualization
              x={solver.x}
              potential={potential}
              state={state}
              isRunning={isRunning}
              energy={energy}
              totalProbability={totalProbability}
              plotXMin={config.plotXMin}
              plotXMax={config.plotXMax}
              plotYMin={config.plotYMin}
              plotYMax={config.plotYMax}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
