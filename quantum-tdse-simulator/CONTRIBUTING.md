# Contributing to Quantum TDSE Simulator

Thank you for your interest in contributing to the Quantum TDSE Simulator! This document provides guidelines and instructions for contributing to the project.

## 🤝 How to Contribute

### Reporting Bugs

If you find a bug, please open an issue with:
- **Clear title**: Brief description of the bug
- **Steps to reproduce**: Detailed steps to recreate the issue
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**: Browser, OS, screen size
- **Screenshots**: If applicable

### Suggesting Features

Feature requests are welcome! Please include:
- **Use case**: Why this feature is needed
- **Proposed solution**: How it might work
- **Alternatives**: Other approaches considered
- **Additional context**: Examples, mockups, or references

### Submitting Pull Requests

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes** following the code style guidelines
4. **Test thoroughly** on multiple browsers
5. **Commit with clear messages**: Follow conventional commits format
6. **Push to your fork**: `git push origin feature/your-feature-name`
7. **Open a pull request** with a detailed description

## 📋 Development Setup

### Prerequisites
- Node.js 18+ and pnpm (recommended) or npm
- Git
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Code editor (VS Code recommended)

### Getting Started

```bash
# Clone your fork
git clone https://github.com/your-username/quantum-tdse-simulator.git
cd quantum-tdse-simulator

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run in another terminal for type checking
pnpm type-check

# Build for production
pnpm build
```

### Project Structure

```
quantum-tdse-simulator/
├── src/
│   ├── components/          # React components
│   │   ├── ControlPanel.tsx
│   │   ├── ParameterControls.tsx
│   │   ├── PlotCanvas.tsx
│   │   └── VideoRecorder.tsx
│   ├── lib/                 # Core libraries
│   │   ├── tdse-solver.ts   # TDSE numerical solver
│   │   ├── potentials.ts    # Potential functions
│   │   ├── wavefunctions.ts # Wavefunction library
│   │   ├── parameters.ts    # Parameter system
│   │   └── video-recording.ts
│   ├── App.tsx              # Main app component
│   └── main.tsx             # Entry point
├── docs/                    # Documentation
├── public/                  # Static assets
└── tests/                   # Test files (future)
```

## 💻 Code Style Guidelines

### TypeScript/React

```typescript
// Use explicit types
interface ComponentProps {
  value: number;
  onChange: (value: number) => void;
}

// Use functional components with TypeScript
export function MyComponent({ value, onChange }: ComponentProps) {
  // Component logic
  return <div>{value}</div>;
}

// Use descriptive variable names
const wavefunctionAmplitude = 1.0; // Good
const wA = 1.0; // Avoid

// Use const for immutable values
const PI = Math.PI;

// Document complex functions
/**
 * Applies the split-operator step to evolve the wavefunction
 * @param state - Current wavefunction state
 * @param dt - Time step
 */
function evolveState(state: WavefunctionState, dt: number) {
  // Implementation
}
```

### CSS/Tailwind

```tsx
// Use Tailwind utility classes
<div className="w-full h-[48px] px-4 bg-surface-primary border border-border-default">
  Content
</div>

// Follow the design system
// - Colors: surface-primary, surface-secondary, text-primary, accent-primary
// - Spacing: Use 8px baseline (2, 4, 6, 8 units)
// - Typography: Inter font family
```

### Numerical Code

```typescript
// Use typed arrays for performance
const real = new Float64Array(gridSize);
const imag = new Float64Array(gridSize);

// Prefer pre-computed values
const expFactor = Math.exp(-dt / (2 * hbar));

// Comment numerical algorithms
// Apply kinetic energy operator in momentum space
// K = ℏ²k²/(2m)
for (let i = 0; i < N; i++) {
  const kineticEnergy = (hbar * this.k[i] ** 2) / (2 * mass);
  // ... implementation
}
```

## 🧪 Testing Guidelines

### Manual Testing Checklist

Before submitting a PR, test the following:

#### Basic Functionality
- [ ] All preset potentials work correctly
- [ ] All preset wavefunctions initialize properly
- [ ] Play/Pause/Reset buttons function
- [ ] Parameter sliders update in real-time
- [ ] Custom functions parse and evaluate correctly

#### Parameter System
- [ ] Parameters auto-detect from expressions
- [ ] Slider ranges are appropriate
- [ ] Add/remove parameter buttons work
- [ ] Parameter validation provides clear errors
- [ ] Parameters persist on save/load

#### Export Features
- [ ] Current frame download works
- [ ] Video recording completes successfully
- [ ] Video playback is smooth
- [ ] Different formats (MP4, WebM) work

#### Cross-Browser
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if on macOS)
- [ ] Edge

#### Responsive Design
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### Future: Automated Testing

We plan to add:
- Unit tests for numerical algorithms
- Integration tests for components
- E2E tests for user workflows
- Performance benchmarks

## 🎨 Design Guidelines

### Swiss Design Principles

- **Minimalism**: Clean, functional interface
- **Typography**: Inter font, clear hierarchy
- **Grid**: 8px baseline, aligned elements
- **Color**: Monochromatic with blue accent
- **Whitespace**: Generous spacing, uncluttered

### Accessibility

- Use semantic HTML elements
- Provide ARIA labels where needed
- Ensure keyboard navigation works
- Maintain sufficient color contrast (WCAG AA)
- Test with screen readers

## 📚 Documentation

### Code Comments

```typescript
// Good: Explain WHY, not WHAT
// Use FFT for O(N log N) instead of O(N²) convolution
const fft = new FFT(gridSize);

// Bad: Redundant
// Create a new FFT instance
const fft = new FFT(gridSize);
```

### JSDoc for Public APIs

```typescript
/**
 * Creates a Gaussian wave packet
 * @param solver - TDSE solver instance
 * @param x0 - Center position
 * @param sigma - Spatial width
 * @param k0 - Initial momentum
 * @returns Initial wavefunction state
 */
export function createGaussianWavepacket(
  solver: TDSESolver,
  x0: number,
  sigma: number,
  k0: number
): WavefunctionState {
  // Implementation
}
```

### Markdown Documentation

- Use clear headings and structure
- Include code examples
- Add screenshots for UI features
- Link to related documentation

## 🚀 Feature Development Workflow

### 1. Plan
- Discuss feature in an issue first
- Consider impact on existing features
- Design API if adding new functions

### 2. Implement
- Create feature branch
- Write code following style guidelines
- Add comments and documentation
- Test thoroughly

### 3. Review
- Self-review your code
- Check for edge cases
- Ensure backward compatibility
- Update documentation

### 4. Submit
- Create pull request
- Fill out PR template
- Respond to review feedback
- Update based on suggestions

## 🔍 Areas for Contribution

### High Priority
- [ ] Automated test suite
- [ ] Performance optimization (WebGL, Web Workers)
- [ ] Mobile responsive improvements
- [ ] Accessibility enhancements

### Medium Priority
- [ ] Additional potential presets (double-well, periodic, etc.)
- [ ] More wavefunction initialization options
- [ ] Advanced plotting options (phase space, energy spectrum)
- [ ] Improved video export (better compression, more formats)

### Advanced Features
- [ ] 2D quantum systems
- [ ] Time-dependent potentials
- [ ] Multi-particle simulation
- [ ] Quantum measurement
- [ ] Entanglement visualization

### Documentation
- [ ] Video tutorials
- [ ] Interactive examples
- [ ] Physics background explanations
- [ ] API documentation
- [ ] Contribution examples

## 🐛 Bug Fix Workflow

1. **Reproduce** the bug reliably
2. **Identify** the root cause
3. **Fix** with minimal changes
4. **Test** the fix thoroughly
5. **Verify** no regressions
6. **Document** the fix in CHANGELOG

## 📝 Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

<optional body>

<optional footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

### Examples

```
feat(parameters): add Desmos-style parameter sliders

Implemented interactive parameter controls with automatic
detection from mathematical expressions.

Closes #123
```

```
fix(parser): resolve exp() function parsing issue

Fixed word boundary regex to prevent matching 'exp' within
other function names like 'expression'.

Fixes #456
```

## 🎯 Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Tested on Chrome
- [ ] Tested on Firefox
- [ ] Tested on Safari
- [ ] Tested on mobile

## Screenshots
(if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
- [ ] Tests pass
```

## 🤔 Questions?

- Open a discussion on GitHub
- Check existing issues and PRs
- Review the documentation

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing to making quantum mechanics more accessible through interactive visualization!** 🌟