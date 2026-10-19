# Quantum TDSE visual system

The implemented direction is **Measurement studio**: a light laboratory notebook made into a working instrument. The position plot is the main surface; setup, measurements, comparison, and transport support the experiment. Keep the simulator identity and the linked **Dr. Abhishek** credit in the workbench footer.

## Source of truth

Use `quantum-tdse-simulator/src/App.css`, `src/App.tsx`, `src/components/SetupPanel.tsx`, `src/components/WavePlot.tsx`, and `src/lib/plot-renderer.ts` for implementation details. Product scope lives in `PRODUCT.md`; intent lives in `quantum-tdse-simulator/.impeccable/direction.md`. The companion `.impeccable/design.json` records selected implemented values, including literal values that are not CSS variables.

## Color and data

| Role | Value | Application |
| --- | --- | --- |
| Ink | `#253c32` | Main text |
| Muted | `#637268` | Labels, explanatory text, axes |
| Accent | `#147568` | Actions, focus, selection, active tabs |
| Accent light | `#e6f1eb` | Active comparison |
| Rule | `#dfe7df` | Panel and section boundaries |
| Workspace | `#f2f5f2` | App background |
| Inspector / drawer | `#fcfdfb` | Secondary working surfaces |
| Canvas | `#ffffff` | Plots, inputs, measurement panel |
| Baseline curve A | `#168577` | Solid teal density and momentum |
| Variant curve B | `#ba6747` | Dashed coral comparison |
| Potential | `#b78336` | Separate right-axis potential |
| Real / imaginary | `#6275bc` / `#b85b78` | Component views |

Do not collapse the curve teal into the action accent: they are distinct implemented values. Numerical comparison values use `#147568` for A and `#a65335` for B. Keep branch names and dashed curves alongside color. Phase uses a cyclic hue key; the rolling position-time map uses teal intensity and labels its sample direction. Curves come from solver data, with explicit axes and a separate potential scale. Region probabilities describe the current distribution, not final scattering coefficients.

## Typography and surfaces

- Locally served variable Manrope (400–800), then Segoe UI / sans-serif. Body: 13px / 1.55. Workbench title: 27px, weight 750, tracking −0.9px; 30px on large screens and 23px on mobile. Dense labels and notes generally use 9–12px; some mobile annotations use 8px.
- Consolas / monospace for measurements, time, expressions, and secondary plot labels. Position rendering requests IBM Plex Mono with Consolas fallback; only Manrope is declared through `@font-face` in the app stylesheet. Georgia supplies equation and observable symbols.
- White, finely ruled surfaces with restrained rounding: plot 11px, observables 9px, transport 10px, buttons 7px, inputs 5–6px. `--radius: 12px` is declared, but components use their own literal radii.
- Layout spacing is contextual rather than a declared scale: 30px workbench side padding, 20px analysis gap, 23px inspector padding, 16px between plot panels. Shadows are subtle and reserved primarily for floating transport, selections, and overlays.
- Primary buttons are teal; export uses dark green `#283e32`. Active tabs have a fine teal rule; selected segmented controls use a white inset surface. Disabled controls use opacity 0.48 and a not-allowed cursor.

## Layout and responsive behavior

| Viewport | Implemented structure |
| --- | --- |
| Default desktop | 76px sticky header (`top: 0`, z-index 20); 270px setup column; remaining workbench capped at 1600px; plots plus 228px measurement rail. Setup sticks at 76px and scrolls internally. Position plot is 335px high; lower plot 151px. |
| At least 1500px | Setup 290px; measurement rail 245px; analysis gap 26px; workbench padding 38px 40px; plots 390px and 170px high. |
| At most 1200px | Setup 240px; measurement rail 199px; analysis gap 15px; workbench side padding 22px. |
| At most 1030px | Measurements move below plots in two columns; diagnostics span both. Position plot is 300px high. |
| At most 760px | 64px sticky header; navigation links hide; compact save/export remain. Setup becomes a fixed left sheet, `min(335px, 90vw)`, full viewport height with `top: 0`, scrim and close control. Workbench has 16px side padding; plots are 290px and 140px high. Measurements retain two columns; footer wraps. |

The body has a 320px minimum width. Transport is sticky at the bottom (12px desktop, 9px mobile), z-index 10. At 380–760px its reset/step controls are 40×44px and Play is at least 70×44px. Smaller widths use the compact controls. Header remains above transport; setup sheet uses z-index 45 and right-side dialogs 50. Dialogs are at most 490px wide and use full viewport height. Anchor scroll padding is 90px.

## Interaction conventions

Use visible labels, contextual scientific help, and numeric inputs alongside sliders. Potential drawing activates a crosshair and pointer capture; expression editing supplies an alternative way to define a potential. Canvas accessible names point users to numerical measurements. Keep the skip link, teal 2px focus-visible outlines with 3px offset, named icon actions, and keyboard shortcuts (Space, right arrow, Escape) that do not interrupt typing. Right-side dialogs trap focus and restore it when closed.

UI transitions are brief (160ms colors and scrim; 200ms drawer entry). Reduced-motion preference disables animations and transitions. Simulation evolution remains data-driven, not decorative motion.

## Evidence boundary

This document describes the final inspected source. Existing review images at `quantum-tdse-simulator/.impeccable/review/desktop.png` and `mobile-full.png` predate the latest sticky-header adjustment. Browser access was disabled in Work settings for the final pass, so those images do not verify current header scrolling or the final setup-sheet offset. No raster comp is the design authority, and this document makes no fresh live-scroll or numerical-certification claim.
