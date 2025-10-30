/**
 * Drawing Canvas Component for Custom Potential
 * Allows users to draw potential V(x) with mouse/touch
 */

import { useEffect, useRef, useState } from 'react';
import { Eraser, Undo2, Check } from 'lucide-react';

interface DrawingCanvasProps {
  xMin: number;
  xMax: number;
  onApply: (points: { x: number; y: number }[]) => void;
}

export function DrawingCanvas({ xMin, xMax, onApply }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [history, setHistory] = useState<{ x: number; y: number }[][]>([]);
  
  const yMin = -10;
  const yMax = 10;
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background
    ctx.fillStyle = '#E5E5E5'; // color-surface-tertiary
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#DDDDDD'; // color-viz-grid
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * canvas.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let i = 0; i <= 8; i++) {
      const y = (i / 8) * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Draw axes
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    // X axis (at y=0)
    const zeroY = canvas.height * (1 - (0 - yMin) / (yMax - yMin));
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(canvas.width, zeroY);
    ctx.stroke();
    
    // Y axis (at left edge)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, canvas.height);
    ctx.stroke();
    
    // Draw axis labels
    ctx.fillStyle = '#666666';
    ctx.font = '12px "SF Mono", "Roboto Mono", monospace';
    ctx.textAlign = 'center';
    
    // X axis labels
    for (let i = 0; i <= 5; i++) {
      const xVal = xMin + (i / 5) * (xMax - xMin);
      const px = (i / 5) * canvas.width;
      ctx.fillText(xVal.toFixed(1), px, canvas.height - 5);
    }
    
    // Y axis labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const yVal = yMin + (i / 4) * (yMax - yMin);
      const py = canvas.height - (i / 4) * canvas.height;
      ctx.fillText(yVal.toFixed(1), canvas.width - 5, py + 4);
    }
    
    // Draw points
    if (points.length > 0) {
      ctx.strokeStyle = '#0057B7'; // color-accent-primary
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.beginPath();
      const firstPoint = points[0];
      const px = ((firstPoint.x - xMin) / (xMax - xMin)) * canvas.width;
      const py = canvas.height - ((firstPoint.y - yMin) / (yMax - yMin)) * canvas.height;
      ctx.moveTo(px, py);
      
      for (let i = 1; i < points.length; i++) {
        const point = points[i];
        const px = ((point.x - xMin) / (xMax - xMin)) * canvas.width;
        const py = canvas.height - ((point.y - yMin) / (yMax - yMin)) * canvas.height;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      
      // Draw points as circles
      ctx.fillStyle = '#0057B7';
      points.forEach(point => {
        const px = ((point.x - xMin) / (xMax - xMin)) * canvas.width;
        const py = canvas.height - ((point.y - yMin) / (yMax - yMin)) * canvas.height;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
    
    // Draw instruction text if no points
    if (points.length === 0) {
      ctx.fillStyle = '#666666';
      ctx.font = '14px "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click and drag to draw potential V(x)', canvas.width / 2, canvas.height / 2);
    }
  }, [points, xMin, xMax, yMin, yMax]);
  
  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to world coordinates
    const worldX = xMin + (x / canvas.width) * (xMax - xMin);
    const worldY = yMax - (y / canvas.height) * (yMax - yMin);
    
    return { x: worldX, y: worldY };
  };
  
  const getTouchPos = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // Convert to world coordinates
    const worldX = xMin + (x / canvas.width) * (xMax - xMin);
    const worldY = yMax - (y / canvas.height) * (yMax - yMin);
    
    return { x: worldX, y: worldY };
  };
  
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const pos = getMousePos(e);
    if (pos) {
      const newPoints = [pos];
      setHistory([...history, points]);
      setPoints(newPoints);
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const pos = getMousePos(e);
    if (pos) {
      setPoints([...points, pos]);
    }
  };
  
  const handleMouseUp = () => {
    setIsDrawing(false);
  };
  
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getTouchPos(e);
    if (pos) {
      const newPoints = [pos];
      setHistory([...history, points]);
      setPoints(newPoints);
    }
  };
  
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getTouchPos(e);
    if (pos) {
      setPoints([...points, pos]);
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(false);
  };
  
  const handleClear = () => {
    setHistory([...history, points]);
    setPoints([]);
  };
  
  const handleUndo = () => {
    if (history.length > 0) {
      const previousPoints = history[history.length - 1];
      setHistory(history.slice(0, -1));
      setPoints(previousPoints);
    }
  };
  
  const handleApply = () => {
    if (points.length > 0) {
      onApply(points);
    }
  };
  
  return (
    <div className="w-full bg-surface-tertiary border-b-2 border-text-primary">
      {/* Drawing Tools */}
      <div className="px-4 py-2 bg-surface-secondary border-b border-border-default flex gap-2">
        <button
          onClick={handleClear}
          className="h-[32px] px-3 bg-surface-primary border border-text-primary hover:bg-surface-tertiary text-text-primary text-xs font-bold uppercase tracking-wide rounded-sm transition-fast flex items-center gap-1"
        >
          <Eraser size={14} />
          Clear
        </button>
        
        <button
          onClick={handleUndo}
          disabled={history.length === 0}
          className="h-[32px] px-3 bg-surface-primary border border-text-primary hover:bg-surface-tertiary text-text-primary text-xs font-bold uppercase tracking-wide rounded-sm transition-fast disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Undo2 size={14} />
          Undo
        </button>
        
        <button
          onClick={handleApply}
          disabled={points.length === 0}
          className="h-[32px] px-3 bg-accent-primary hover:bg-accent-dark text-surface-primary text-xs font-bold uppercase tracking-wide rounded-sm transition-fast disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 ml-auto"
        >
          <Check size={14} />
          Apply
        </button>
      </div>
      
      {/* Drawing Canvas */}
      <div className="p-4">
        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          className="w-full border border-border-default cursor-crosshair"
          style={{ touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>
    </div>
  );
}
