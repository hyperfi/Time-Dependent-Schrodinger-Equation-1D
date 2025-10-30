/**
 * Quantum Visualization Canvas Component
 * Uses p5.js for real-time wavefunction plotting
 */

import { useEffect, useRef } from 'react';
import p5 from 'p5';
import { WavefunctionState } from '../lib/tdse-solver';

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
  plotYMax
}: VisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sketchRef = useRef<p5 | null>(null);
  
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
    plotYMax
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
      plotYMax
    };
  }, [x, potential, state, isRunning, energy, totalProbability, plotXMin, plotXMax, plotYMin, plotYMax]);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    const sketch = (p: p5) => {
      let canvas: p5.Renderer;
      
      p.setup = () => {
        const width = containerRef.current!.clientWidth;
        const height = containerRef.current!.clientHeight;
        canvas = p.createCanvas(width, height);
        canvas.parent(containerRef.current!);
        p.frameRate(60);
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
        const { x, potential, state, energy, totalProbability, plotXMin, plotXMax, plotYMin, plotYMax } = propsRef.current;
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
        
        // Draw potential (gray dashed line)
        p.stroke(102, 102, 102); // #666666
        p.strokeWeight(2);
        p.drawingContext.setLineDash([4, 4]);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < potential.length; i++) {
          p.vertex(mapX(x[i]), mapY(potential[i]));
        }
        p.endShape();
        p.drawingContext.setLineDash([]);
        
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
        
        // Draw legend
        drawLegend(p, plotX, plotY);
        
        // Draw status
        drawStatus(p, p.width - margin.right, plotY, state.time, energy, totalProbability);
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
        p.drawingContext.setLineDash([2, 2]);
        
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
        
        p.drawingContext.setLineDash([]);
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
          { color: [102, 102, 102], label: 'V(x)', solid: false }
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
            p.drawingContext.setLineDash([4, 4]);
            p.line(offsetX, y - 20, offsetX + 20, y - 20);
            p.drawingContext.setLineDash([]);
          }
          
          // Draw label
          p.noStroke();
          p.fill(0); // #000000
          p.text(item.label, offsetX + 25, y - 20);
          
          offsetX += 90;
        });
      }
      
      function drawStatus(
        p: p5,
        x: number,
        y: number,
        time: number,
        energy: number,
        prob: number
      ) {
        // Background
        p.fill(255, 255, 255, 242); // rgba(255, 255, 255, 0.95)
        p.stroke(204, 204, 204); // #CCCCCC
        p.strokeWeight(1);
        p.rect(x - 160, y - 30, 150, 80, 0);
        
        // Text
        p.noStroke();
        p.fill(0); // #000000
        p.textAlign(p.LEFT, p.TOP);
        p.textSize(12);
        p.textFont('SF Mono, Roboto Mono, Courier New, monospace');
        
        p.text(`t = ${time.toFixed(3)}`, x - 150, y - 20);
        p.text(`E = ${energy.toFixed(3)}`, x - 150, y);
        p.text(`∫|ψ|²dx = ${prob.toFixed(4)}`, x - 150, y + 20);
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
      style={{ minHeight: '400px' }}
    />
  );
}
