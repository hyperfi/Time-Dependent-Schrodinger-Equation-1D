# Quick Start Guide

Get started with the Quantum TDSE Simulator in 5 minutes!


## 💻 Run Locally

```bash
# Install and run
pnpm install && pnpm dev

# Or with npm
npm install && npm run dev
```

Open `http://localhost:5173` in your browser.

## 🎮 First Simulation

### 1. Choose a Preset

**Try Quantum Tunneling:**
- Potential Type: **Barrier**
- Height: `5.0`
- Width: `2.0`
- Position: `0.0`

**Initial Wavefunction:**
- Type: **Gaussian**
- Position: `-5.0`
- Width: `1.0`
- Momentum: `3.0`

Click **Play** ▶️ and watch the wave tunnel through the barrier!

### 2. Try Parameters

**Switch to Custom Potential:**
- Potential Type: **Custom Function**
- Function: `A*sin(k*x+phi)`

**Parameter sliders appear automatically!**
- Adjust `A` (amplitude): See potential height change
- Adjust `k` (frequency): Change potential period
- Adjust `phi` (phase): Shift potential position

**Real-time visualization updates as you move sliders!**

### 3. Experiment

**Try these parameter functions:**

```
# Harmonic oscillator with adjustable strength
0.5*k*(x-x0)^2

# Gaussian well with variable depth
-A*exp(-(x-x0)^2/(2*sigma^2))

# Periodic potential
A*sin(k*x) + B*cos(2*k*x)

# Double well
V0*((x-a)^2-b^2)^2
```

## 🎨 Custom Wavefunctions

**Switch Wavefunction Type to:** Custom Function

**Real Part:** `A*exp(-(x-x0)^2/(2*sigma^2))*cos(k*x)`

**Imaginary Part:** `A*exp(-(x-x0)^2/(2*sigma^2))*sin(k*x)`

**Adjust parameters:**
- `A`: Wave amplitude
- `x0`: Center position
- `sigma`: Width
- `k`: Wave number

## 📹 Export Your Simulation

### Capture Current Frame
Click **Download Current Frame** for a PNG snapshot.

### Record Video
1. Set format: **MP4** or **WebM**
2. Frame rate: **30 fps** (recommended)
3. Quality: **High**
4. Time range: Start `0`, End `5`
5. Click **Download Video**

Wait for recording to complete and video downloads automatically!

## 🎯 Quick Tips

### Parameters
- **Add Parameter:** Click `+` button
- **Remove Parameter:** Click `×` next to parameter
- **Precise Value:** Use input field below slider
- **Custom Range:** Adjust Min/Max/Step values

### Simulation
- **Faster Evolution:** Increase "Steps Per Frame"
- **Better Quality:** Increase "Grid Size" 
- **Zoom In:** Adjust Plot Range (X Min/Max, Y Min/Max)

### Performance
- Lower grid size for slower computers
- Reduce steps per frame for smoother animation
- Use smaller spatial range for faster computation

## 📚 Learn More

- **Full README:** [README.md](../README.md)
- **Parameter Guide:** [docs/PARAMETER_GUIDE.md](docs/PARAMETER_GUIDE.md)
- **Changelog:** [CHANGELOG.md](../CHANGELOG.md)
- **Contributing:** [CONTRIBUTING.md](../CONTRIBUTING.md)

## 🧪 Example Experiments

### Experiment 1: Wave Packet Dispersion
```
Potential: Free (V₀ = 0)
Wavefunction: Gaussian (x₀ = 0, σ = 1, k₀ = 0)
```
Watch the packet spread over time!

### Experiment 2: Harmonic Oscillator
```
Potential: Harmonic (ω = 1.0)
Wavefunction: Gaussian (x₀ = -3, σ = 1, k₀ = 0)
```
See oscillations in the potential well!

### Experiment 3: Adjustable Barrier
```
Potential: Custom Function
Function: V0*(1 + tanh((x-x0)/w))
Parameters: V0 = 5, x0 = 0, w = 1

Wavefunction: Gaussian (x₀ = -5, σ = 1, k₀ = 3)
```
Adjust V0 to control tunneling probability!

### Experiment 4: Periodic Potential
```
Potential: Custom Function
Function: A*sin(k*x)
Parameters: A = 2, k = 1

Wavefunction: Plane Wave (k₀ = 2)
```
Explore Bloch waves in periodic structures!

## ⌨️ Keyboard Shortcuts

- **Space:** Play/Pause
- **R:** Reset simulation
- **S:** Save configuration
- **L:** Load configuration (after uploading file)

## 🆘 Troubleshooting

### Simulation runs slowly
- Reduce grid size (256 or 512)
- Decrease steps per frame
- Lower spatial range

### Parameter sliders not appearing
- Make sure you've entered a function with parameters
- Parameters must be letters (A, k, phi, etc.)
- Not reserved words (x, t, sin, cos, etc.)

### Function shows error
- Check syntax: use `*` for multiplication
- Use `^` for exponentiation, not `**`
- Add all parameters using the `+` button

### Video export stuck
- Try lower frame rate (15-24 fps)
- Reduce simulation time range
- Use lower quality setting
- Try different browser (Chrome recommended)

## 🎉 You're Ready!

Start exploring quantum mechanics with interactive parameters!

**Next Steps:**
1. Try all the example experiments above
2. Create your own custom potentials
3. Experiment with different wavefunctions
4. Export videos of interesting phenomena
5. Share your discoveries!

---

**Need help?** Check the full documentation or open an issue on GitHub.

**Have fun exploring the quantum world!** 🌟