# Quantum TDSE Simulator

An interactive, web-based quantum mechanics simulator that solves the Time-Dependent Schrödinger Equation (TDSE) using the split-operator Fast Fourier Transform (FFT) method. Features Desmos-style parameter controls for real-time exploration of quantum wave dynamics.
## 🚀 Tech Stack
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff)](https://vitejs.dev/)


## ✨ Features

### Core Simulation
- **Real-time TDSE Solver** - Accurate quantum wave evolution using split-operator FFT method
- **Multiple Potential Types** - Barrier, well, harmonic oscillator, and custom functions
- **Flexible Wavefunctions** - Gaussian, plane wave, bound state, and custom mathematical expressions
- **Interactive Visualization** - Real-time plotting of wavefunction and potential energy
- **High Performance** - Optimized numerical methods for smooth animation

### 🎮 Desmos-Style Parameter System
- **Interactive Sliders** - Adjust parameters with real-time visual feedback
- **Automatic Detection** - System auto-detects parameters from mathematical expressions
- **Smart Suggestions** - Context-aware parameter ranges and types
- **Precise Control** - Fine-tune with input fields or sliders
- **Dynamic Management** - Add/remove parameters on the fly
- **Range Customization** - Adjust min/max/step values for each parameter

### Advanced Capabilities
- **Video Export** - Record simulations as MP4 or WebM videos
- **Frame Capture** - Download high-quality PNG snapshots
- **State Management** - Save and load simulation configurations
- **Plot Customization** - Adjustable plot ranges and visualization settings
- **Batch Processing** - Multiple time steps per frame for faster evolution



### Local Development

#### Prerequisites
- Node.js 18+ and npm/pnpm
- Modern web browser with WebGL support

#### Installation

```bash
# Clone the repository
git clone <repository-url>
cd quantum-tdse-simulator

# Install dependencies
pnpm install
# or
npm install

# Start development server
pnpm dev
# or
npm run dev

# Build for production
pnpm build
# or
npm run build
```

The application will be available at `http://localhost:5173`

## 📖 User Guide

### Basic Workflow

1. **Select Potential Type**
   - Choose from preset potentials (barrier, well, harmonic)
   - Or create custom potential functions with parameters

2. **Configure Initial Wavefunction**
   - Select Gaussian, plane wave, bound state, or custom
   - Adjust parameters like position, width, and momentum

3. **Add Parameters (Optional)**
   - Enter functions with parameters: `A*sin(k*x+phi)`
   - System auto-detects parameters and creates sliders
   - Adjust sliders to see real-time changes

4. **Run Simulation**
   - Click Play to start time evolution
   - Pause/Reset as needed
   - Export frames or videos

### Using Parameters

#### Example: Harmonic Oscillator with Variable Strength

```
Potential Function: 0.5*k*(x-x0)^2

Parameters:
- k: Spring constant (0.1 to 5.0)
- x0: Center position (-10 to 10)
```

Adjust the `k` slider to change oscillator frequency. Adjust `x0` to shift the potential center.

#### Example: Gaussian Wave Packet

```
Real Part: A*exp(-(x-x0)^2/(2*sigma^2))*cos(k*x)
Imag Part: A*exp(-(x-x0)^2/(2*sigma^2))*sin(k*x)

Parameters:
- A: Amplitude (0.1 to 2)
- x0: Center (-10 to 10)
- sigma: Width (0.1 to 5)
- k: Wave number (-10 to 10)
```

### Mathematical Functions Supported

- **Arithmetic**: `+`, `-`, `*`, `/`, `^`
- **Trigonometric**: `sin`, `cos`, `tan`
- **Hyperbolic**: `sinh`, `cosh`, `tanh`
- **Exponential**: `exp`, `sqrt`, `abs`
- **Logarithmic**: `log`, `ln`
- **Constants**: `pi`, `e`
- **Variables**: `x` (position), `t` (time)
- **Parameters**: Any custom named parameter (A, k, phi, etc.)

## 🔬 Physics Background

### Time-Dependent Schrödinger Equation

The simulator solves the 1D TDSE:

```
iℏ ∂ψ/∂t = Ĥψ = (T̂ + V̂)ψ
```

Where:
- `ψ(x,t)` is the quantum wavefunction
- `ℏ` is the reduced Planck constant
- `Ĥ` is the Hamiltonian operator
- `T̂ = -ℏ²/(2m) ∂²/∂x²` is the kinetic energy operator
- `V̂ = V(x)` is the potential energy operator

### Split-Operator Method

The evolution operator is split using the Trotter formula:

```
e^(-iĤΔt/ℏ) ≈ e^(-iV̂Δt/2ℏ) · e^(-iT̂Δt/ℏ) · e^(-iV̂Δt/2ℏ)
```

This allows efficient FFT-based computation:
1. Apply half potential step in position space
2. FFT to momentum space
3. Apply full kinetic step in momentum space
4. Inverse FFT back to position space
5. Apply second half potential step

### Numerical Accuracy

- Grid size: 256-2048 points (power of 2 for FFT)
- Time step: Typically 0.01-0.1 (adjustable)
- Spatial range: Configurable (-20 to 20 default)
- Normalization: Preserved at each step

## 🛠️ Technical Architecture

### Technology Stack

- **Frontend Framework**: React 18.3 with TypeScript
- **Build Tool**: Vite 6.0
- **Styling**: Tailwind CSS with custom design system
- **FFT Library**: fft.js for high-performance transforms
- **Plotting**: Recharts for visualization
- **Video Export**: Custom canvas-based video recorder
- **State Management**: React hooks and context

### Project Structure

```
quantum-tdse-simulator/
├── src/
│   ├── components/
│   │   ├── ControlPanel.tsx       # Main control interface
│   │   ├── ParameterControls.tsx  # Desmos-style parameter sliders
│   │   ├── PlotCanvas.tsx         # Visualization component
│   │   └── VideoRecorder.tsx      # Video export functionality
│   ├── lib/
│   │   ├── tdse-solver.ts         # Core TDSE numerical solver
│   │   ├── potentials.ts          # Potential function library
│   │   ├── wavefunctions.ts       # Wavefunction initialization
│   │   ├── parameters.ts          # Parameter management system
│   │   └── video-recording.ts     # Video recording utilities
│   ├── App.tsx                    # Main application component
│   └── main.tsx                   # Application entry point
├── public/                        # Static assets
├── docs/                          # Documentation
└── package.json                   # Project dependencies
```

### Key Components

#### TDSESolver
Core numerical solver implementing the split-operator FFT method.

```typescript
class TDSESolver {
  constructor(params: SimulationParameters);
  setPotential(potential: Float64Array): void;
  step(state: WavefunctionState): void;
  // ... additional methods
}
```

#### Parameter System
Desmos-style parameter management with automatic detection and validation.

```typescript
interface Parameter {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  description?: string;
}

// Auto-detect parameters from expressions
extractParameterNames(expression: string): string[];

// Substitute parameters into expressions
substituteParameters(expression: string, parameters: ParameterSet): string;
```

## 🎨 Design System

The application follows Swiss Design principles:

- **Color Palette**: Monochromatic with blue accent (#3B82F6)
- **Typography**: Inter font family, geometric precision
- **Layout**: Grid-based, 8px baseline, generous whitespace
- **Controls**: Minimal, functional, high contrast
- **Animation**: Fast transitions (150ms), smooth interactions

## 📊 Performance Optimization

- **FFT Caching**: Pre-computed FFT transforms for efficiency
- **Typed Arrays**: Float64Array for numerical data
- **Batch Processing**: Multiple time steps per render frame
- **Debounced Updates**: Optimized UI re-renders
- **Web Workers**: Background computation (future enhancement)

## 🔧 Advanced Configuration

### Simulation Parameters

```typescript
interface SimulationConfig {
  // Grid settings
  gridSize: 256 | 512 | 1024 | 2048;
  xMin: number;
  xMax: number;
  
  // Time evolution
  dt: number;           // Time step
  stepsPerFrame: number; // Computation steps per animation frame
  
  // Potential and wavefunction
  potentialType: PotentialType;
  wavefunctionType: WavefunctionType;
  
  // Custom parameters
  potentialParameters: ParameterSet;
  wavefunctionParameters: ParameterSet;
}
```

### Export Options

- **Frame Format**: PNG (high quality, lossless)
- **Video Format**: MP4 (H.264) or WebM (VP9)
- **Frame Rate**: 15-60 fps (configurable)
- **Quality**: High/Medium/Low
- **Time Range**: Specify start and end times

## 🧪 Example Use Cases

### 1. Quantum Tunneling Through Barrier

```
Potential: barrier
Height: 5.0
Width: 2.0
Position: 0.0

Wavefunction: gaussian
Position: -5.0
Width: 1.0
Momentum: 3.0
```

Observe the wavefunction partially tunnel through the potential barrier.

### 2. Harmonic Oscillator Eigenstates

```
Potential: harmonic
Omega: 1.0
Center: 0.0

Wavefunction: bound-state
Quantum Number: n = 1, 2, 3...
Well Width: 10.0
```

Visualize energy eigenstates of the quantum harmonic oscillator.

### 3. Wave Packet Dispersion

```
Potential: free (V₀ = 0)

Wavefunction: gaussian
Position: 0.0
Width: 1.0
Momentum: 0.0
```

Watch a free Gaussian wave packet spread due to dispersion.

### 4. Custom Parametric Potential

```
Potential: custom-function
Function: A*sin(k*x+phi)

Parameters:
- A = 2.0 (amplitude)
- k = 1.0 (frequency)
- phi = 0.0 (phase)

Wavefunction: gaussian (k₀ = 5.0)
```

Explore wave dynamics in periodic potentials with adjustable parameters.

## 🎓 Educational Applications

- **Undergraduate Quantum Mechanics** - Visual demonstrations of core concepts
- **Graduate Research** - Quick prototyping of 1D quantum systems
- **Physics Outreach** - Interactive exhibits and presentations
- **Self-Study** - Hands-on exploration of quantum phenomena

## 🤝 Contributing

Contributions are welcome! Areas for enhancement:

- Additional preset potential types
- More wavefunction initialization options
- 2D/3D visualization modes
- Multi-particle systems
- Quantum measurement simulation
- Enhanced video export options
- Performance optimizations

## 📝 License

This project is open source. Please check the LICENSE file for details.

## 🙏 Acknowledgments

- **FFT.js** - High-performance FFT implementation
- **Recharts** - Visualization library
- **React** - UI framework
- **Tailwind CSS** - Styling framework

## 📚 References

### Quantum Mechanics
- Griffiths, D.J. "Introduction to Quantum Mechanics" (3rd Edition)
- Shankar, R. "Principles of Quantum Mechanics" (2nd Edition)
- Cohen-Tannoudji, C. "Quantum Mechanics" (Volumes 1-2)

### Numerical Methods
- Press, W.H. et al. "Numerical Recipes" (3rd Edition)
- Tao, T. "An Introduction to Measure Theory"
- Feit, M.D. et al. "Solution of the Schrödinger equation by a spectral method" (1982)

### Split-Operator Method
- Feit, M.D., Fleck, J.A., Steiger, A. "Solution of the Schrödinger equation by a spectral method", J. Comput. Phys. 47, 412-433 (1982)
- Kosloff, R. "Time-dependent quantum-mechanical methods for molecular dynamics", J. Phys. Chem. 92, 2087-2100 (1988)

## 🐛 Known Issues

- Video export may be slow for long simulations (use lower frame rates)
- Very narrow Gaussian packets may show numerical artifacts (increase grid size)
- Browser memory limits may affect very large grid sizes (>2048 points)

## 🔮 Roadmap

- [ ] 2D quantum systems
- [ ] Spin-1/2 particles
- [ ] Time-dependent potentials
- [ ] Measurement simulation
- [ ] Multi-particle entanglement
- [ ] WebGL acceleration
- [ ] Mobile-optimized interface
- [ ] Cloud simulation queue

## 📧 Contact & Support

For questions, bug reports, or feature requests:
- Open an issue on GitHub

## 🌟 Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Built with ❤️ for physics education and quantum exploration**

*Explore the quantum world, one parameter at a time.*