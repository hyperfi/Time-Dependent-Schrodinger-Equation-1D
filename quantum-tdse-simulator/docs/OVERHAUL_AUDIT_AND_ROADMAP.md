# From TDSE simulator to quantum experiment workbench

Audit date: 19 October 2026. Source baseline: `51b94d0`. Scope: audit and proposed roadmap only; no application implementation changes.

## Product direction

Make the tool a place to **ask a quantum question, build an experiment, compare outcomes, and explain the evidence**. The existing numerical solver and direct potential drawing are a useful foundation. A larger collection of controls would not, by itself, deliver this experience.

Working audience assumption: undergraduate students, educators, and technically curious users, with an advanced path for numerical exploration. Research-grade validation is a separate milestone, not a current claim.

The distinguishing workflow should be: **prepare → predict → evolve → measure → branch → explain**.

## What exists and should be preserved

- React/TypeScript/Vite application with a split-operator FFT solver and Float64Array state.
- Free, barrier, finite-well, harmonic, custom-expression, and drawn potentials.
- Gaussian, plane-wave, infinite-well-profile, and custom initial states.
- Parameter sliders, potential drawing, resizable desktop panel, mobile navigation, absorbing-edge controls.
- Imaginary-time eigenstate calculation and preview/load actions.
- Four guided scenarios, PNG capture, browser video recording, ZIP frames, and JSON save/load controls.

Several of these features need correction or stronger validation; they are not new-feature proposals.

## Evidence and limits

Inspected the live desktop interface at approximately 1084 × 790, the Parameters and Presets & Guides flows, and the custom-potential edit flow. Mobile behavior was inspected in source, not exercised on a device or emulated viewport. No formal accessibility or performance benchmark was performed.

Commands run from `quantum-tdse-simulator`:

```powershell
npm run build
npm run lint
node docs/audit/solver-probes.mjs
```

- Build passed. The main JavaScript asset was about 1.68 MB minified / 444 KB gzip; Vite warned about chunk size. This is a size measurement, not a measured load-time result.
- Lint failed: 17 errors and 2 warnings, including three CommonJS `require()` calls in browser event handlers.
- No project-owned test/spec files or test script were found in the inspected checkout.
- The deployment workflow uses `build:github` (Vite only), rather than the TypeScript-checking `build` command. It also installs with `--no-frozen-lockfile`.
- Selected numerical probes and their output are saved under [audit](audit/solver-probes.mjs) and [solver evidence](audit/solver-evidence.json). These probes do not establish long-time accuracy, eigenvector residual quality, or absorber convergence.

Positive numerical evidence: for a free Gaussian at t ≈ 1, mean position ≈ −0.99999999 and variance ≈ 1.24999998, versus −1 and 1.25 analytically. The first four harmonic energies were within about 10⁻⁶ of 0.5, 1.5, 2.5, 3.5 in the initial run. ITP uses unseeded randomness, so saved rerun values can differ.

## Fix before expanding

Priorities describe impact on the intended scientific workflow, not security severity.

| Priority | Finding and evidence | Required correction |
|---|---|---|
| P1 | Complex syntax is mathematically wrong: `exp(i*x)` at x=1 returns `{real: 2.71828…, imag: 0}`. Both parser implementations replace `i` with 1. | Either support genuine complex expressions with explicit semantics, or accept separate real-valued components and reject `i`. Never silently reinterpret it. |
| P1 | The documented `exp(-x^2/2)` fails validation because direct replacement of `^` with `**` produces invalid JavaScript precedence. | One compiled expression grammar, shared by validation and evaluation, with tested precedence and domain errors. |
| P1 | Live custom-potential editing reports “Function validation failed” for valid `x^2`. The handler uses browser-side `require()`. | Use module imports, shared evaluation, and actionable errors beside the field; keep the last valid experiment while editing. |
| P1 | `Save State` includes ψ and time, but `handleLoad` restores only config. Drawn potential points/arrays are absent from the saved payload. | Versioned experiment schema; distinguish a recipe from a resumable checkpoint; restore ψ, time, actual potential, and future event schedule. Validate imported shapes and finite values. |
| P1 | Video and ZIP exporters always initialize a Gaussian, even when the user selected a plane wave, custom state, or loaded eigenstate. | Export from the same experiment/checkpoint as the visible simulation. Use an isolated export runner and restore interactive state. |
| P1 | “Coherent Harmonic State” uses σ=1 for m=ℏ=ω=1. Its spatial variance changes from 1 to ≈0.25 near a quarter period. | Use σ=√(ℏ/(2mω))≈0.7071 for the coherent preset, or rename it as a displaced squeezed Gaussian and explain the breathing. |
| P1 | The finder returns four states for free space, with no bound-state classification or residual/convergence report. | Label finite-domain eigenmodes honestly. Report residuals, orthogonality, convergence status, boundary localization, and bound/continuum interpretation where applicable. Never promise four physical bound states for arbitrary potentials. |
| P1 | `getEnergy` returns ⟨ψ|H|ψ⟩ without dividing by surviving norm. With absorbing edges enabled by default, it is not the conditional mean energy of the remaining packet. | Display survival probability N and conditional energy ⟨ψ|H|ψ⟩/N separately; define behavior as N→0. Do not treat absorber loss as numerical error. |
| P2 | Single-letter names `A` and `k` are advertised, but manual parameter-name validation rejects them. | Reconcile parsing, automatic discovery, manual entry, reserved names, and saved parameter state. |
| P2 | Nonabsorbing evolution forcibly normalizes every step, concealing raw norm drift. | Normalize initial states; expose raw conservation diagnostics. Any corrective normalization must be explicit and logged. |
| P2 | Export step counts are floored, while the requested start time is assigned directly. Animation frames drive recording progress independently of capture FPS. | Schedule by target simulation timestamps and verify frame count, duration, and actual media type. Browser codec behavior remains untested in this audit. |

Source anchors: `src/lib/wavefunctions.ts:44–89`, `src/lib/tdse-solver.ts:267, 355, 429–493, 650–690`, `src/lib/parameters.ts:99–101`, `src/components/ControlPanel.tsx:310, 514, 553, 1145–1160`, `src/App.tsx:560–607, 660, 755–758, 851`.

Other numerical requirements: expose dimensionless units (m=ℏ=1 currently hardcoded), distinguish periodic FFT boundaries from absorbing layers, validate grid/domain/dt inputs, and warn about momentum approaching Nyquist and significant edge probability. A box-shaped initial profile is not automatically an eigenstate of the selected potential.

## Interface overhaul

The live first viewport gives the sidebar a large title and widely spaced fields, while the graph combines real amplitude, imaginary amplitude, probability density, and rescaled energy. Initial transport is partly below the inspected viewport. Presets show raw `$…$` mathematical markup. Most physical measurements are missing, so the user must infer outcomes from curves.

Proposed workbench:

```text
Experiment name / scenario         Compare    Save    Export
──────────────────────────────────────────────────────────
Setup inspector       Position / phase plot      Observables
Potential             Momentum plot              N, <x>, <p>
Initial state         Optional energy levels     Δx, Δp, E
Events                Detectors / annotations    Run health
──────────────────────────────────────────────────────────
Play · Pause · Step · Reset   time / playback rate / timeline
```

- Keep transport and time visible from the first frame, including at t=0.
- Group inspector controls into Potential, Initial state, Events, and Numerics. Export belongs in a focused export panel.
- Make probability density the initial view; offer real/imaginary and magnitude/phase as deliberate views. Use aligned plots or explicit independent axes for energy rather than an implicit ×0.2 conversion.
- Let users drag packet position and adjust width/momentum directly, with equivalent keyboard and numeric controls.
- Separate edits that reset preparation from potential changes applied as quenches to the current state. Label the resulting event and invalidate obsolete eigenstate caches.
- Mobile: one main plot, reachable transport, and a setup sheet; avoid shrinking a three-column workbench. Provide numeric/table alternatives to canvas interaction and associated labels for fields.
- Use restrained scientific typography, stable plot colors, line styles as well as color, proper math rendering, clear units, and compact spacing. Preserve author credit without consuming the working area.

## Feature roadmap: ranked proposals

Effort is relative engineering scope, not a calendar promise: S = contained enhancement; M = several coordinated modules; L = substantial solver/workflow work. None of these features has been implemented by this audit.

| Rank | Feature | Concrete interaction and payoff | Scope / dependency |
|---|---|---|---|
| 1 | **Experiment branches** | Pause before collision, duplicate the exact checkpoint, change barrier width in one branch, and play synchronized results. Plot Δdensity and observable differences. Makes “what changed?” answerable. | M–L; checkpoint restoration and explicit event semantics. |
| 2 | **Probability detectors** | Place left/right regions, inspect their probability over time, and add virtual flux probes. Show unresolved probability and absorber loss alongside reflection/transmission estimates. Turns tunneling into an experiment. | M; probability current, region integrals, separated outgoing packets, boundary validation. |
| 3 | **State composer** | Combine verified eigenstates with magnitude/phase controls. Watch relative phase create beating while showing populations and omitted spectral weight. | M; reliable eigenstates, overlap calculations, normalized coefficients. |
| 4 | **Quantum event timeline** | Schedule a barrier pulse, move a trap, or suddenly change well depth. Compare a quench with a slow ramp and inspect state overlaps. | L; V(x,t), time-centered propagation, events aligned to solver times. |
| 5 | **Space–time recorder** | Build an x–t density map while evolving; click a row to revisit that checkpoint. Reveals splitting, revivals, and repeated reflections across time. | M; bounded history and checkpoint/replay. |
| 6 | **Measurement ensemble lab** | Prepare identical copies, perform finite-resolution position measurements, and accumulate a histogram against the Born prediction. Keep “sample only” separate from state-changing measurement. | L; seeded sampling and explicitly defined measurement operators. |
| 7 | **Parameter sweep atlas** | Sweep packet momentum and barrier width; produce a transmission heatmap. Click a cell to replay its experiment with the same numerical settings. | L; workers, cancellable jobs, reproducible detector protocol. |
| 8 | **Quantum/classical comparison** | Show a Newtonian trajectory beside ⟨x⟩ and Δx. Use a harmonic trap for agreement and an anharmonic trap for divergence. Explain limits of comparing a point trajectory with a spread state. | M; moments, matched initial conditions, classical integrator. |
| 9 | **Guided investigation cards** | Ask “Will narrowing the packet change transmission?” Collect a prediction, run a controlled comparison, then explain using momentum spread. Export the completed experiment notebook. | M; authored exercises using real measured outputs, no generated unsupported explanations. |
| 10 | **Numerical confidence panel** | Show raw norm drift, edge weight, momentum cutoff occupancy, eigenstate residuals, and dt/grid refinement comparisons. Make numerical limits inspectable. | M; diagnostics and benchmark cases. Required foundation, not an optional final polish. |

### Three signature experiments

**Quantum echo bench.** Evolve a packet, apply a phase-conjugation operation, and compare return fidelity with and without a small potential perturbation. Explain the assumptions: real scalar Hamiltonian and a specified reversible protocol. Absorption breaks recovery. This is a simulation of reversibility sensitivity, not a quantum-hardware claim.

**Design a quantum beam splitter.** Let users choose a target outgoing split and adjust a bounded barrier parameterization. Later, offer an optimizer that searches for a target split for one specified input packet. Report residual error, bounds, and sensitivity; validate the result on a finer grid. This is a constrained design exercise, not a universal optimal device.

**Turn noise into a question.** Add seeded static disorder to a 1D landscape; compare spreading and participation measures across disorder realizations. Teach the difference between a single finite-time pattern and evidence of localization. Requires domain/time/refinement checks before making localization claims.

## Engineering plan

Keep React/TypeScript and the current FFT approach initially. A framework rewrite would not resolve the identified scientific and workflow problems.

Separate five responsibilities:

1. **Experiment model:** versioned config, dimensionless convention, preparation recipe, actual potential data, events, seed, and metadata.
2. **Numerical runner:** owns mutable state and preallocated FFT buffers; has deterministic advance-to-time and cancellation. Move costly evolution/eigenstate work into a Web Worker after profiling.
3. **Diagnostics:** moments, current, energy semantics, convergence checks, region/flux measurements, and residuals under one consistent discretization.
4. **Renderer/history:** reads snapshots at a bounded display rate; uses checkpoint/replay instead of unlimited full-state storage. Renders on demand when paused; fixes container resizing with an observer.
5. **Persistence/export:** uses the same experiment and runner as the interactive view; never maintains a separate Gaussian-only initialization path.

One compiled expression representation must serve validation and execution. The existing dependency list already includes mathjs; evaluate a restricted import or a deliberately smaller AST evaluator. Allow only approved mathematical nodes/functions and bound expression complexity. Follow the [mathjs security guidance](https://mathjs.org/docs/expressions/security.html); a parser library alone is not a complete sandbox.

History has a real cost: at N=1024, two Float64 arrays use 16 KiB per checkpoint before metadata. At 60 full checkpoints/s for one minute, that is about 56.25 MiB per branch. Store lower-rate display history plus sparse exact checkpoints and deterministic replay.

V(x,t) requires a numerical change, not merely exposing `t` in a text field: evaluate the potential at the temporal midpoint for a smooth-drive second-order split, and split steps exactly at discontinuous scheduled events. Validate order using dt refinement before shipping claims of driven dynamics.

## Staged delivery and acceptance gates

| Stage | Deliverable | Acceptance evidence |
|---|---|---|
| A: trustworthy baseline | Correct expressions, parameters, preset physics, state restoration, exporter initialization, eigenstate labeling, energy/norm semantics. Add source-level checks to CI. | All documented examples execute as specified; checkpoint round trip preserves ψ/time/drawn V; non-Gaussian exports match interactive preparation; analytic free/harmonic tests and eigen-residual/Gram tests pass at predefined tolerances. |
| B: usable workbench | Persistent transport, compact setup inspector, probability/phase views, momentum panel, observables, numeric alternatives and mobile layout. | Desktop/mobile rendered checks; keyboard flow and accessible field names; observable values match the benchmark harness; no clipped primary actions. |
| C: distinctive first release | Checkpoint branching, detector regions, space–time map, reproducible experiment bundles. | Branches begin at identical ψ/time; comparisons stop at the same simulation time; region probabilities plus absorbed loss close the budget; replay matches checkpoints within a predefined tolerance. |
| D: deeper exploration | State composer, timed potentials, measurement ensembles, then sweeps and bounded inverse design. | Residual-qualified eigenbasis; driven-system dt convergence; statistically checked seeded measurement cases; cancellable sweeps reproduce individually replayed cells. |

Set numerical tolerances against analytic references and refinement studies before implementation acceptance. Keep rejected cases as evidence. Do not use forced normalization as proof of conservation or energy constancy as a universal test for driven/absorbing systems.

Recommended first major release: **A + B + a narrow C**. Its demonstration should show one packet, two checkpoint branches, one changed barrier, visible detector probabilities, and a saved experiment that replays the comparison. This is a coherent product milestone with a testable outcome.

## Scope to defer

Defer 2D/3D, spinors, two-particle entanglement, cloud queues, collaboration accounts, and GPU acceleration until the 1D workflow is validated and measured performance requires expansion. Those directions introduce different physics, state representations, or infrastructure. Wigner/phase-space views are a valuable later option once momentum normalization and history are reliable.

## External reference check

Falstad's own [1D simulator directions](https://falstad.com/qm1d/directions.html) already describe momentum views, state phasors, uncertainty displays, and measurements. These are useful capabilities, but should not be marketed as unique inventions. The proposed distinction is the integrated experiment workflow: exact checkpoint branches, explicit numerical evidence, detectors, and replayable results. This is a product hypothesis, not a claim of market-wide novelty.

The [PhET tunneling page](https://phet.colorado.edu/en/simulations/quantum-tunneling) was located, but its retrieved text did not expose enough behavior for a detailed feature comparison. No exhaustive competitor review or user study was performed.
