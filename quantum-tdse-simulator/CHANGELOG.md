# Changelog

All notable changes to the Quantum TDSE Simulator project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-10-30

### Added - Major Feature Release: Desmos-Style Parameter System

#### 🎮 Interactive Parameter Management
- **Desmos-style parameter sliders** for custom potential and wavefunction functions
- **Automatic parameter detection** from mathematical expressions
- **Smart parameter type recognition** with context-aware ranges
- **Real-time parameter updates** with instant visualization feedback
- **Dynamic parameter addition/removal** during simulation
- **Parameter range customization** (min/max/step controls)
- **Precise value input fields** for exact parameter values
- **Parameter count display** and management interface

#### 🛠️ Technical Implementation
- New `parameters.ts` library with comprehensive parameter management
- New `ParameterControls.tsx` component with interactive UI
- Parameter integration in `ControlPanel.tsx`
- Parameter support in `potentials.ts` and `wavefunctions.ts`
- Parameter substitution and validation system
- Safe mathematical expression evaluation with parameter support

#### 📚 Parameter Features
- **Parameter Extraction**: Automatic detection of single-letter and multi-character parameters
- **Parameter Substitution**: Safe replacement of parameters in expressions
- **Parameter Validation**: Real-time expression and parameter validation
- **Parameter Presets**: Common parameter types (amplitude, frequency, phase, etc.)
- **Parameter Suggestions**: Auto-generated parameter ranges based on context
- **Parameter Persistence**: Save/load parameters with simulation state

#### 🎨 UI Enhancements
- Custom-styled sliders with progress indicators
- Clean parameter management interface
- Add/remove parameter buttons with intuitive controls
- Range control inputs (min/max/step)
- Parameter value display with formatting
- Error feedback and validation messages
- Help text and usage examples

### Enhanced

#### Mathematical Expression Support
- **Hyperbolic functions**: `sinh`, `cosh`, `tanh`
- **Constants**: `pi`, `e`
- **Improved function parsing**: Better regex patterns with word boundaries
- **Parameter support**: Any custom parameter names (A, k, phi, sigma, etc.)

#### Custom Wavefunction System
- **Complex wavefunction expressions**: Separate real and imaginary parts
- **Parameter-based wavefunctions**: Full parameter support
- **Validation system**: Real-time error checking
- **Preset wavefunctions**: Gaussian, plane-wave, bound-state, custom-function

#### Custom Potential System
- **Parameter-based potentials**: Dynamic potential functions
- **Enhanced function library**: More mathematical functions supported
- **Validation system**: Expression syntax checking
- **Examples and help**: Built-in usage guidance

### Fixed
- **Expression parsing bugs**: Fixed `exp()` function not working (word boundary issue)
- **Import errors**: Removed duplicate imports in tdse-solver.ts
- **Type safety**: Improved TypeScript type definitions
- **Validation edge cases**: Better error handling

## [1.0.0] - 2025-10-29

### Initial Release

#### Core Features
- **TDSE Solver**: Split-operator FFT method for 1D quantum systems
- **Multiple Potentials**: Barrier, well, harmonic oscillator
- **Multiple Wavefunctions**: Gaussian, plane wave, bound state
- **Real-time Visualization**: Interactive plotting with Recharts
- **Video Export**: MP4 and WebM format support
- **Frame Capture**: High-quality PNG screenshots
- **State Management**: Save and load simulation configurations

#### Technical Stack
- React 18.3 with TypeScript
- Vite 6.0 build system
- Tailwind CSS styling
- FFT.js for Fast Fourier Transforms
- Recharts for visualization

#### User Interface
- Swiss Design-inspired interface
- Control panel with simulation settings
- Advanced settings panel
- Plot range customization
- Export options (video and frames)

#### Simulation Features
- Configurable grid size (256-2048 points)
- Adjustable spatial range
- Variable time step
- Steps per frame control
- Normalization preservation

#### Export Capabilities
- Video recording with frame rate control
- Quality settings (high/medium/low)
- Time range selection
- Current frame download
- Multiple video formats

## [Unreleased]

### Planned Features
- 2D quantum systems visualization
- Spin-1/2 particle simulation
- Time-dependent potentials
- Quantum measurement simulation
- Multi-particle systems
- WebGL acceleration for improved performance
- Mobile-optimized responsive interface
- Cloud simulation queue for long computations

### Under Consideration
- Density matrix formalism
- Open quantum systems
- Quantum state tomography
- Entanglement visualization
- Decoherence simulation
- Quantum gates and circuits

## Version History Summary

- **v2.0.0** (2025-10-30): Desmos-style parameter system with interactive sliders
- **v1.0.0** (2025-10-29): Initial release with core TDSE simulation features

---

## Notes

### Breaking Changes in v2.0.0
- `SimulationConfig` interface updated with new parameter fields
- Custom function inputs now support parameter-based expressions
- Configuration save/load format includes parameter data

### Migration Guide v1.x → v2.0
1. Existing custom functions without parameters continue to work
2. To use parameters, add them to function expressions (e.g., `A*sin(k*x)`)
3. Parameter controls appear automatically when parameters are detected
4. Saved configurations from v1.x are backward compatible

### Dependencies Updated in v2.0.0
- No external dependency changes
- New internal libraries: `parameters.ts`, `ParameterControls.tsx`

---

For detailed parameter system documentation, see [PARAMETER_GUIDE.md](./PARAMETER_GUIDE.md)