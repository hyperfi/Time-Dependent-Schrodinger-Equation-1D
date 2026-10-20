# Implementation and verification

Completed locally on 19 October 2026. No deployment, commit, or pull request was requested or performed.

## Delivered

The simulator is now a light scientific workbench with locally hosted Manrope typography, position/probability/phase/component views, separate potential scaling, momentum density, a rolling density map, persistent playback, and a mobile setup sheet. The navigation bar is sticky at the top; the desktop inspector accounts for its height. Dr. Abhishek's linked credit is retained in the footer and attribution is included in sequence exports.

A/B comparison copies the current state exactly. At the fork, either branch's potential can change; both then advance by identical time steps. Reset restores the fork. Region probabilities and absorbed loss use the original norm as their reference and are explicitly distinguished from final reflection/transmission coefficients.

State, potential, reset checkpoint, fork, and branch data round-trip through versioned JSON. Legacy files restore their saved state where possible and clearly lack an original reset checkpoint; legacy drawn-potential files without potential data are rejected. Potential edits after evolution create a fresh reset checkpoint at the edit time.

Custom functions share one bounded mathematical grammar with actual complex arithmetic, mathematical exponent precedence, named-parameter validation, and finite-grid evaluation. Static V(x) fields reject t. Failed expressions preserve the last valid experiment.

Eigenmodes calculate in a cancellable worker with deterministic trial perturbations, residuals, and convergence flags. Modes are labeled as finite-domain eigenmodes; unconverged modes cannot be loaded. Coherent harmonic preparation uses sigma = sqrt(1/2).

Exports use isolated copies of the current actual state. They do not reinitialize a Gaussian. ZIP files include exact solver timestamps and a starting-checkpoint manifest. Video chooses a browser-supported codec and uses the matching extension; browser recording is not claimed to guarantee exact wall-clock frame pacing.

## Automated checks

- `npm test`: **18 checks passed**. Covers complex expressions and precedence; single-letter/reserved parameter names; bounded grammar; finite real potentials; free Gaussian motion/spreading; raw norm without forced renormalization; conditional energy; momentum normalization/moments; fractional target times; absorber/region budget; independent synchronized branching; save/load including drawn potential and origins; invalid imports; isolated non-Gaussian export; coherent-state width; harmonic energy/residual/orthogonality; barrier time refinement; credit/sticky source assertions; high-momentum viewport framing.
- `npm run lint`: passed with no errors or warnings.
- `GITHUB_PAGES=true npm run build:github`: TypeScript and Vite production build passed. Main JS about **236 KB minified / 75 KB gzip**; JSZip is a separate lazy chunk, eigenmodes a dedicated worker. Bundle reduction is a size result, not a measured device speedup.
- Production source-identifier instrumentation is disabled. CI uses pnpm 9 with a frozen lockfile and runs tests/lint before building.

## Numerical refinement discovery

The first workbench render exposed energy drift during a sharp barrier collision at the old dt = 0.005. With absorbing layers disabled, a selected t = 3 check gave relative energy drift about 0.0879. Refining dt to 0.0025 reduced it to about 4.1e-6, and dt = 0.001 to about 8.1e-7. The default is now **0.001**. The regression checks default versus half-dt right-region probability within 1e-5 and static energy drift below 1e-4. Nonabsorbing energy drift is also included in live diagnostic warnings.

This is a selected regression case, not universal validation. Sharp discontinuities, absorber settings, large momenta, deep potentials, and long-time runs still require appropriate refinement/domain checks.

## Live browser checks completed

Before browser access became disabled:

- Created a branch at the same exact state/time, changed B's barrier width, stepped both, and confirmed separate curves/measurements.
- Ran to about t = 3.16; read different outgoing region probabilities for A/B.
- Applied `A*sin(k*x+phi)` with generated single-letter parameter controls; no former browser `require()` error.
- Calculated four harmonic eigenmodes in the worker: energies rounded to 0.5, 1.5, 2.5, 3.5; residuals below 1e-3. Loaded the first excited mode.
- Saved that state at t = 0.005, exported six PNG frames at 24 fps, and checked the ZIP manifest's real/imaginary starting arrays exactly equaled the saved eigenstate. Timestamps were 0.005 + i/24.
- Exported and probed a real WebM: VP9, 1280x720, six decoded frames, approximately 0.232 seconds for a requested 0.25-second sequence. This illustrates the documented browser timing limitation.
- Opened the saved JSON through the browser file chooser and restored t = 0.005.
- Captured desktop and mobile layouts. At 390 CSS pixels the document and body had no horizontal overflow.

Artifacts are under `.impeccable/review/` in the app, including exported files. `desktop.png`, `user-1274.png`, and `mobile-full.png` are valid preceding renders. An invalid viewport thumbnail was excluded from review. These captures precede the final sticky-header and dt refinements.

## Final review and verification boundary

An independent reviewer identified two material issues: momentum limits based on stale k0 could hide a valid custom state; and the mobile setup sheet lacked modal keyboard behavior. Both were corrected. The new high-momentum regression checks a packet near p = 20 is visible. The sheet now supplies dialog semantics, focus transfer/trapping, Escape dismissal, scroll locking, and focus return. The reviewer scored both fixes resolved **at source level**.

The mechanical design detector ran once and found a width-animation warning; that animation was removed. Design tokens and responsive conventions are recorded in root `DESIGN.md` and `.impeccable/design.json`.

Local browser access was disabled in Work settings during the final pass. Consequently the final sticky-navbar scroll behavior, final focus lifecycle, and latest numerical render could not be recaptured or exercised live. Static checks and source review support the implementation; the older screenshots do not prove those later behaviors. Physical-device accessibility and performance were not tested.

## Still roadmap work

State composition, timed potentials, flux-based asymptotic transmission/reflection, measurement ensembles, parameter sweeps, full checkpoint rewind, inverse design, higher dimensions, and GPU acceleration are not included in this first release.
