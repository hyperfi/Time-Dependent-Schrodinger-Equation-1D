/**
 * Quantum Visualization Canvas Component
 * Uses p5.js for real-time wavefunction plotting
 */

import { useEffect, useRef } from 'react';
import p5 from 'p5';
import { WavefunctionState } from '../lib/tdse-solver';

const POTENTIAL_VISUAL_SCALE = 0.2;

interface VisualizationProps {
  x: Float64Array;
  potential: Float64Array;
  state: WavefunctionState | null;
  isRunning: boolean;
  energy: number;
  totalProbability: number;
  plotXMin: number;
  plotXMax: number;
  plotYMin: number;
  plotYMax: number;
  potentialType: string;
  onDrawPotential?: (newPotential: Float64Array) => void;
  previewState?: WavefunctionState | null;
  previewEigenvalue?: number | null;
}

export function QuantumVisualization({
  x,
  potential,
  state,
  isRunning,
  energy,
  totalProbability,
  plotXMin,
  plotXMax,
  plotYMin,
  plotYMax,
  potentialType,
  onDrawPotential,
  previewState = null,
  previewEigenvalue = null
}: VisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<p5 | null>(null);
  const localPotentialRef = useRef<Float64Array | null>(null);
  const isDrawingRef = useRef(false);

  // Synchronize local potential ref when potential prop changes
  useEffect(() => {
    if (!isDrawingRef.current) {
      localPotentialRef.current = new Float64Array(potential);
    }
  }, [potential]);
  
  // Use refs to hold current prop values for p5 sketch access
  const propsRef = useRef({
    x,
    potential,
    state,
    isRunning,
    energy,
    totalProbability,
    plotXMin,
    plotXMax,
    plotYMin,
    plotYMax,
    potentialType,
    onDrawPotential,
    previewState,
    previewEigenvalue
  });
  
  // Update refs when props change
  useEffect(() => {
    propsRef.current = {
      x,
      potential,
      state,
      isRunning,
      energy,
      totalProbability,
      plotXMin,
      plotXMax,
      plotYMin,
      plotYMax,
      potentialType,
      onDrawPotential,
      previewState,
      previewEigenvalue
    };
  }, [x, potential, state, isRunning, energy, totalProbability, plotXMin, plotXMax, plotYMin, plotYMax, potentialType, onDrawPotential, previewState, previewEigenvalue]);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const sketch = (p: p5) => {
      let canvas: p5.Renderer;
      
      let isDrawing = false;
      let lastX = 0;
      let lastY = 0;
      let currX = 0;
      let currY = 0;

      const isPotentialAllZero = (V: Float64Array) => {
        for (let i = 0; i < V.length; i++) {
          if (V[i] !== 0) return false;
        }
        return true;
      };

      const startDraw = (xVal: number, yVal: number) => {
        const { potentialType } = propsRef.current;
        if (potentialType !== 'custom-draw') return false;
        
        const margin = {
          left: 60,
          right: 40,
          top: 60,
          bottom: 60
        };
        const plotWidth = p.width - margin.left - margin.right;
        const plotHeight = p.height - margin.top - margin.bottom;
        const plotX = margin.left;
        const plotY = margin.top;
        
        if (xVal >= plotX && xVal <= plotX + plotWidth && yVal >= plotY && yVal <= plotY + plotHeight) {
          isDrawing = true;
          isDrawingRef.current = true;
          lastX = xVal;
          lastY = yVal;
          currX = xVal;
          currY = yVal;
          performDrawingUpdate(xVal, yVal, xVal, yVal);
          return true;
        }
        return false;
      };

      const updateDraw = (xVal: number, yVal: number) => {
        if (!isDrawing) return;
        lastX = currX;
        lastY = currY;
        currX = xVal;
        currY = yVal;
        performDrawingUpdate(lastX, lastY, currX, currY);
      };

      const endDraw = () => {
        isDrawing = false;
        isDrawingRef.current = false;
      };

      const performDrawingUpdate = (x1: number, y1: number, x2: number, y2: number) => {
        const { x, potentialType, onDrawPotential, plotXMin, plotXMax, plotYMin, plotYMax } = propsRef.current;
        if (potentialType !== 'custom-draw' || x.length === 0 || !onDrawPotential) return;
        
        if (!localPotentialRef.current) {
          localPotentialRef.current = new Float64Array(x.length);
        }
        const newPotential = localPotentialRef.current;
        
        const margin = {
          left: 60,
          right: 40,
          top: 60,
          bottom: 60
        };
        
        const plotWidth = p.width - margin.left - margin.right;
        const plotHeight = p.height - margin.top - margin.bottom;
        const plotX = margin.left;
        const plotY = margin.top;
        
        const inPlot = (px: number) => px >= plotX && px <= plotX + plotWidth;
        if (!inPlot(x2) && !inPlot(x1)) return;
        
        // Convert screen coordinates (px, py) to simulation world coordinates
        const toWorld = (px: number, py: number) => {
          const normX = (px - plotX) / plotWidth;
          const worldX = plotXMin + normX * (plotXMax - plotXMin);
          
          const clampedY = Math.max(plotY, Math.min(plotY + plotHeight, py));
          const normY = (plotY + plotHeight - clampedY) / plotHeight;
          const worldY = plotYMin + normY * (plotYMax - plotYMin);
          return { x: worldX, y: worldY };
        };

        const w1 = toWorld(x1, y1);
        const w2 = toWorld(x2, y2);
        
        const xStart = Math.min(w1.x, w2.x);
        const xEnd = Math.max(w1.x, w2.x);
        
        let updatedCount = 0;
        const denom = w2.x - w1.x;
        
        for (let i = 0; i < x.length; i++) {
          if (x[i] >= xStart && x[i] <= xEnd) {
            const t = Math.abs(denom) > 1e-12 ? (x[i] - w1.x) / denom : 0.5;
            const worldY = w1.y + t * (w2.y - w1.y);
            newPotential[i] = worldY / POTENTIAL_VISUAL_SCALE;
            updatedCount++;
          }
        }
        
        // Fallback for near-vertical strokes or single clicks/taps
        if (updatedCount === 0) {
          let closestIdx = 0;
          let minDiff = Infinity;
          for (let i = 0; i < x.length; i++) {
            const diff = Math.abs(x[i] - w2.x);
            if (diff < minDiff) {
              minDiff = diff;
              closestIdx = i;
            }
          }
          newPotential[closestIdx] = w2.y / POTENTIAL_VISUAL_SCALE;
        }
        
        onDrawPotential(new Float64Array(newPotential));
      };

      p.setup = () => {
        const width = containerRef.current!.clientWidth;
        const height = containerRef.current!.clientHeight;
        canvas = p.createCanvas(width, height);
        canvas.parent(containerRef.current!);
        p.frameRate(60);
        
        canvas.mousePressed(() => {
          startDraw(p.mouseX, p.mouseY);
        });
      };
      
      p.mouseReleased = () => {
        endDraw();
      };

      p.mouseDragged = () => {
        if (isDrawing) {
          updateDraw(p.mouseX, p.mouseY);
        }
      };

      (p as any).touchStarted = (event?: any) => {
        if (p.touches && p.touches.length > 0) {
          const touch = p.touches[0] as any;
          const inside = startDraw(touch.x, touch.y);
          if (inside && event && event.cancelable) {
            event.preventDefault();
            return false;
          }
        }
      };

      (p as any).touchMoved = (event?: any) => {
        if (isDrawing && p.touches && p.touches.length > 0) {
          const touch = p.touches[0] as any;
          updateDraw(touch.x, touch.y);
          if (event && event.cancelable) {
            event.preventDefault();
            return false;
          }
        }
      };

      (p as any).touchEnded = () => {
        endDraw();
      };
      
      p.windowResized = () => {
        if (containerRef.current) {
          p.resizeCanvas(
            containerRef.current.clientWidth,
            containerRef.current.clientHeight
          );
        }
      };

      p.draw = () => {
        // Get current prop values from ref
        const { x, potential, state, plotXMin, plotXMax, plotYMin, plotYMax, potentialType } = propsRef.current;

        // Clear background
        p.background(255); // #FFFFFF
        
        if (!state || x.length === 0) {
          drawPlaceholder(p);
          return;
        }
        
        // Calculate plot area (leaving margins for axes and labels)
        const margin = {
          left: 60,
          right: 40,
          top: 60,
          bottom: 60
        };
        
        const plotWidth = p.width - margin.left - margin.right;
        const plotHeight = p.height - margin.top - margin.bottom;
        const plotX = margin.left;
        const plotY = margin.top;
        
        // Use fixed plot ranges from props
        const xMin = plotXMin;
        const xMax = plotXMax;
        const yMin = plotYMin;
        const yMax = plotYMax;
        
        // Calculate probability density
        const prob = new Float64Array(x.length);
        for (let i = 0; i < x.length; i++) {
          prob[i] = state.real[i] * state.real[i] + state.imag[i] * state.imag[i];
        }
        
        // Map functions
        const mapX = (xVal: number) => 
          plotX + ((xVal - xMin) / (xMax - xMin)) * plotWidth;
        const mapY = (yVal: number) => 
          plotY + plotHeight - ((yVal - yMin) / (yMax - yMin)) * plotHeight;
        
        // Draw grid
        drawGrid(p, plotX, plotY, plotWidth, plotHeight, xMin, xMax, yMin, yMax, mapX, mapY);
        
        // Draw axes
        drawAxes(p, plotX, plotY, plotWidth, plotHeight, xMin, xMax, yMin, yMax, mapX, mapY);
        
        const activePotential = (potentialType === 'custom-draw' && localPotentialRef.current)
          ? localPotentialRef.current
          : potential;

        // Draw visual instruction overlay if custom-draw is empty
        if (potentialType === 'custom-draw' && isPotentialAllZero(activePotential)) {
          p.fill(120, 120, 120, 150);
          p.noStroke();
          p.textAlign(p.CENTER, p.CENTER);
          p.textSize(14);
          p.text('Click & drag directly here to draw potential V(x)', plotX + plotWidth / 2, plotY + plotHeight / 2);
        }

        // Draw potential (gray dashed line)
        p.stroke(102, 102, 102); // #666666
        p.strokeWeight(2);
        (p.drawingContext as any).setLineDash([4, 4]);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < activePotential.length; i++) {
          p.vertex(mapX(x[i]), mapY(activePotential[i] * POTENTIAL_VISUAL_SCALE));
        }
        p.endShape();
        (p.drawingContext as any).setLineDash([]);
        
        // Draw probability density (green filled area)
        p.fill(0, 170, 68, 100); // #00AA44 with transparency
        p.stroke(0, 170, 68); // #00AA44
        p.strokeWeight(1);
        p.beginShape();
        p.vertex(mapX(x[0]), mapY(0));
        for (let i = 0; i < prob.length; i++) {
          p.vertex(mapX(x[i]), mapY(prob[i]));
        }
        p.vertex(mapX(x[x.length - 1]), mapY(0));
        p.endShape(p.CLOSE);
        
        // Draw real part (blue line)
        p.stroke(0, 102, 204); // #0066CC
        p.strokeWeight(2);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < state.real.length; i++) {
          p.vertex(mapX(x[i]), mapY(state.real[i]));
        }
        p.endShape();
        
        // Draw imaginary part (red line)
        p.stroke(204, 0, 0); // #CC0000
        p.strokeWeight(2);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < state.imag.length; i++) {
          p.vertex(mapX(x[i]), mapY(state.imag[i]));
        }
        p.endShape();
        
        // Draw preview eigenstate if available
        const { previewState, previewEigenvalue } = propsRef.current;
        if (previewState && x.length > 0) {
          // 1. Draw horizontal energy level line (orange solid)
          if (previewEigenvalue !== null && previewEigenvalue !== undefined) {
            p.stroke(255, 140, 0, 180); // Orange with transparency
            p.strokeWeight(1);
            (p.drawingContext as any).setLineDash([6, 3]);
            const yLevel = mapY(previewEigenvalue * POTENTIAL_VISUAL_SCALE);
            p.line(plotX, yLevel, plotX + plotWidth, yLevel);
            (p.drawingContext as any).setLineDash([]);
            
            // Label the energy level
            p.fill(255, 140, 0);
            p.noStroke();
            p.textAlign(p.RIGHT, p.BOTTOM);
            p.textSize(10);
            p.textFont('SF Mono, Roboto Mono, Courier New, monospace');
            p.text(`E = ${previewEigenvalue.toFixed(3)}`, plotX + plotWidth - 5, yLevel - 2);
          }
          
          // 2. Draw probability density of preview state (orange outline)
          const previewProb = new Float64Array(x.length);
          for (let i = 0; i < x.length; i++) {
            previewProb[i] = previewState.real[i] * previewState.real[i] + previewState.imag[i] * previewState.imag[i];
          }
          
          p.stroke(255, 140, 0); // Solid orange
          p.strokeWeight(2);
          p.noFill();
          p.beginShape();
          for (let i = 0; i < previewProb.length; i++) {
            p.vertex(mapX(x[i]), mapY(previewProb[i]));
          }
          p.endShape();
          
          // Draw label at top center of plot
          p.fill(255, 140, 0);
          p.noStroke();
          p.textAlign(p.CENTER, p.TOP);
          p.textSize(11);
          p.textFont('Helvetica Neue, Helvetica, Arial, sans-serif');
          p.text("PREVIEWING BOUND STATE", plotX + plotWidth / 2, plotY + 12);
        }
        
        // Draw legend
        drawLegend(p, plotX, plotY);
      };
      
      function drawGrid(
        p: p5,
        x: number,
        y: number,
        w: number,
        h: number,
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number,
        mapX: (x: number) => number,
        mapY: (y: number) => number
      ) {
        p.stroke(221, 221, 221); // #DDDDDD
        p.strokeWeight(1);
        (p.drawingContext as any).setLineDash([2, 2]);
        
        // Vertical grid lines
        const xStep = (xMax - xMin) / 10;
        for (let i = 0; i <= 10; i++) {
          const xVal = xMin + i * xStep;
          const px = mapX(xVal);
          p.line(px, y, px, y + h);
        }
        
        // Horizontal grid lines
        const yStep = (yMax - yMin) / 8;
        for (let i = 0; i <= 8; i++) {
          const yVal = yMin + i * yStep;
          const py = mapY(yVal);
          p.line(x, py, x + w, py);
        }
        
        (p.drawingContext as any).setLineDash([]);
      }
      
      function drawAxes(
        p: p5,
        x: number,
        y: number,
        w: number,
        h: number,
        xMin: number,
        xMax: number,
        yMin: number,
        yMax: number,
        mapX: (x: number) => number,
        mapY: (y: number) => number
      ) {
        p.stroke(0); // #000000
        p.strokeWeight(1);
        
        // X axis
        p.line(x, y + h, x + w, y + h);
        
        // Y axis
        p.line(x, y, x, y + h);
        
        // X axis labels
        p.fill(102, 102, 102); // #666666
        p.noStroke();
        p.textAlign(p.CENTER, p.TOP);
        p.textSize(12);
        p.textFont('SF Mono, Roboto Mono, Courier New, monospace');
        
        const xStep = (xMax - xMin) / 5;
        for (let i = 0; i <= 5; i++) {
          const xVal = xMin + i * xStep;
          const px = mapX(xVal);
          p.text(xVal.toFixed(1), px, y + h + 8);
        }
        
        // X axis title
        p.textSize(14);
        p.fill(51, 51, 51); // #333333
        p.text('Position (x)', x + w / 2, y + h + 32);
        
        // Y axis labels
        p.textAlign(p.RIGHT, p.CENTER);
        p.textSize(12);
        p.fill(102, 102, 102); // #666666
        
        const yStep = (yMax - yMin) / 4;
        for (let i = 0; i <= 4; i++) {
          const yVal = yMin + i * yStep;
          const py = mapY(yVal);
          p.text(yVal.toFixed(2), x - 8, py);
        }
        
        // Y axis title (rotated)
        p.push();
        p.translate(x - 45, y + h / 2);
        p.rotate(-p.HALF_PI);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(14);
        p.fill(51, 51, 51); // #333333
        p.text('Amplitude / Potential', 0, 0);
        p.pop();
      }
      
      function drawLegend(p: p5, x: number, y: number) {
        const items = [
          { color: [0, 102, 204], label: 'ψ_real', solid: true },
          { color: [204, 0, 0], label: 'ψ_imag', solid: true },
          { color: [0, 170, 68], label: '|ψ|²', solid: true },
          { color: [102, 102, 102], label: 'V(x) (×0.2)', solid: false }
        ];
        
        p.textAlign(p.LEFT, p.CENTER);
        p.textSize(12);
        p.textFont('Helvetica Neue, Helvetica, Arial, sans-serif');
        
        let offsetX = x;
        items.forEach((item) => {
          // Draw line sample
          if (item.solid) {
            p.stroke(item.color[0], item.color[1], item.color[2]);
            p.strokeWeight(2);
            p.line(offsetX, y - 20, offsetX + 20, y - 20);
          } else {
            p.stroke(item.color[0], item.color[1], item.color[2]);
            p.strokeWeight(2);
            (p.drawingContext as any).setLineDash([4, 4]);
            p.line(offsetX, y - 20, offsetX + 20, y - 20);
            (p.drawingContext as any).setLineDash([]);
          }
          
          // Draw label
          p.noStroke();
          p.fill(0); // #000000
          p.text(item.label, offsetX + 25, y - 20);
          
          offsetX += 90;
        });
      }
      
      
      
      function drawPlaceholder(p: p5) {
        p.fill(102, 102, 102); // #666666
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(16);
        p.textFont('Helvetica Neue, Helvetica, Arial, sans-serif');
        p.text('Initialize simulation to begin', p.width / 2, p.height / 2);
      }
    };
    
    sketchRef.current = new p5(sketch);
    
    return () => {
      sketchRef.current?.remove();
      sketchRef.current = null;
    };
  }, []); // Empty deps - setup once
  
  // Update on data changes doesn't require recreating p5 instance
  // p5 draw loop will automatically pick up new state via props closure
  
  return (
    <div 
      ref={containerRef} 
      className="w-full h-full bg-surface-primary"
      style={{ minHeight: '400px', touchAction: 'none' }}
    />
  );
}
