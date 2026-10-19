# Quantum TDSE Simulator
<!-- impeccable:product-schema 1 -->

## Platform
web

## Product Purpose
An interactive 1D quantum experiment workbench. Prepare a wavefunction, evolve it, inspect measurements, and compare a checkpoint branch under a changed potential.

## Users
Working audience from the accepted roadmap: physics learners, educators, and technically curious users. No research-grade validation claim.

## Capabilities and Constraints
Retain the React/TypeScript/Vite stack, split-operator FFT evolution, authored potentials, custom states, drawing, eigenmode exploration, and local export. The user approved implementing the first release in docs/OVERHAUL_AUDIT_AND_ROADMAP.md and requested a visually polished interface. Dimensionless units with mass and hbar equal to one. Explicit periodic or absorbing boundaries. Local browser execution; no cloud service needed.

## Brand Commitments
Preserve the simulator name and Dr. Abhishek author attribution.

## Product Principles
- Scientific meaning is visible beside measurements.
- A comparison starts from the identical checkpoint and advances to the same time.
- Save/load preserves actual state and potential.
- Direct interaction has a keyboard/numeric equivalent.
- No unsupported hardware, performance, or validation claims.

## Evidence on Hand
quantum-tdse-simulator/docs/OVERHAUL_AUDIT_AND_ROADMAP.md and docs/audit contain the baseline audit and selected numerical probes.
