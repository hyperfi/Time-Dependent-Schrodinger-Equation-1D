# Quantum TDSE Simulator

An interactive 1D quantum experiment workbench, created by [Dr. Abhishek](https://www.dr-abhishek.com/). Prepare a wavefunction, evolve it with a split-operator FFT solver, and compare outcomes from an identical checkpoint.

## Workbench

- Position probability, real/imaginary, and phase views with a separate potential-energy axis.
- Momentum density and a rolling position–time density map.
- Mean position, momentum, energy, uncertainties, surviving probability, and numerical diagnostics.
- Synchronized A/B branches: fork the current state, change a potential at the fork, then evolve both to the same time.
- Adjustable left/center/right probability regions and absorbed loss. These are instantaneous probabilities, not asymptotic scattering coefficients.
- Free, barrier, finite-well, harmonic, custom-expression, and drawn potentials.
- Gaussian, periodic plane-wave, square-well-profile, and complex-expression initial states.
- Compiled bounded math grammar, parameter sliders, and proper complex arithmetic. For example `exp(-(x+6)^2/4)*exp(3*i*x)`; leave the separate imaginary field empty for a complete complex expression.
- Worker-based finite-domain eigenmodes with residual and convergence indicators. Not every computed mode is a bound state on the infinite line.
- Versioned JSON checkpoints preserve wavefunctions, time, actual potential arrays, reset points, and branches.
- PNG plot, measurement CSV, isolated browser video export, and PNG-frame ZIP with exact simulation timestamps.
- Responsive setup sheet, persistent playback, keyboard shortcuts, and sticky navigation. Dr. Abhishek's linked author credit remains in the footer.

## Run locally

Use Node.js 20+ and npm, or pnpm 9.

```powershell
cd quantum-tdse-simulator
npm ci
npm run dev
```

Open the local URL printed by Vite. Validation:

```powershell
npm test
npm run lint
npm run build
```

The test runner resolves esbuild through the existing Vite dependency. No new runtime library was added for the overhaul. `build:github` includes TypeScript checking; GitHub Pages CI runs physics/workflow checks and lint before building.

## Experiment workflow

1. Pick a scenario under Experiments or use the setup inspector.
2. Prepare the state. State and grid changes reset time to zero.
3. Play, pause, or step. Space toggles playback and right arrow steps when focus is outside form controls.
4. Compare copies the exact current wavefunction to B. Edit a potential before evolving, then inspect both branches. Reset returns to the fork; End comparison retains A.
5. Save the complete experiment or export numerical evidence.

Outside comparison, changing a potential preserves the current wavefunction and creates a new reset checkpoint at that time. It is a sudden Hamiltonian change, not a replay of the new potential from t=0. Editing drawn potential follows the same rule.

## Numerical meaning and limits

- Dimensionless units: hbar = mass = 1. Static scalar potentials only; scheduled/time-dependent potentials are future work.
- Grid: 256–2048 points. Default domain: −16 to 16. Default time step: 0.001, reduced after a sharp-barrier refinement check.
- FFT boundaries are periodic. Optional absorbing layers remove outgoing probability without renormalization; their reflection and accuracy depend on the chosen settings.
- Initial states are normalized. Real-time evolution exposes raw norm drift. Imaginary-time iteration normalizes as part of its algorithm.
- Energy and moments are conditional on surviving norm. They become unavailable when too little probability remains. Absorption and potential changes need not conserve the conditional mean energy.
- Residual-qualified eigenmodes describe the finite periodic grid. Square-well initial profiles are not automatically eigenstates of the selected potential.
- Numerical checks cover selected analytic and workflow cases. They do not establish universal convergence, long-time accuracy, research-grade validation, or device performance.
- ZIP frames sample exact solver timestamps. Browser-recorded video has codec-dependent wall-clock pacing; use the frame ZIP for reproducible frame data.
- History is a bounded visual record, not a rewindable full-state timeline. Guided events, state composition, measurement ensembles, sweep atlases, and higher-dimensional systems remain roadmap work.

## Implementation

React 18 / TypeScript / Vite. Native Canvas 2D plots. FFT.js for propagation, a dedicated worker for eigenmodes, lazy-loaded JSZip for frame archives, self-hosted Manrope (SIL OFL), and existing Lucide icons. Legacy UI files remain in source but are not mounted in the new workbench.

See [the baseline audit and roadmap](quantum-tdse-simulator/docs/OVERHAUL_AUDIT_AND_ROADMAP.md) and [implementation validation](quantum-tdse-simulator/docs/IMPLEMENTATION_VALIDATION.md).
