# Desmos-Style Parameter System Guide
## Quantum TDSE Simulator with Interactive Parameters

Your quantum simulator now includes a powerful Desmos-style parameter system that allows you to create dynamic custom functions with interactive sliders!

---

## 🚀 How to Use Parameter Sliders

### 1. **Create Parameter-Based Functions**

In both the **Custom Potential** and **Custom Wavefunction** sections:

#### For Potential Functions:
```
A*sin(k*x+phi)
A*exp(-x^2/sigma^2)
V0*exp(-(x-x0)^2/(2*sigma^2))
A*cos(omega*x) + B*sin(omega*x)
```

#### For Wavefunction Functions:
```
Real Part: A*exp(-(x-x0)^2/(2*sigma^2))*cos(k*x)
Imag Part: A*exp(-(x-x0)^2/(2*sigma^2))*sin(k*x)
```

### 2. **Automatic Parameter Detection**

The system automatically detects parameters from your functions:
- Single letters like `A`, `k`, `phi`, `sigma`, `V0`, etc.
- Multi-character names like `amplitude`, `frequency`, `phase`, etc.

### 3. **Interactive Parameter Controls**

Once you enter a function with parameters, you'll see:

#### **Parameter Sliders Section:**
- **Add Parameter Button (+):** Add custom parameters
- **Individual Parameter Controls:**
  - Interactive slider with real-time value updates
  - Precise value input field
  - Range controls (min/max/step)
  - Remove parameter button (×)

#### **Parameter Features:**
- **Real-time Updates:** Adjust sliders to see immediate changes
- **Smart Ranges:** Automatic suggested ranges based on parameter type
- **Custom Ranges:** Adjust min/max/step for fine control
- **Visual Feedback:** Custom-styled sliders with progress indicators
- **Value Display:** Current parameter value shown clearly

### 4. **Parameter Types and Presets**

The system recognizes common parameter patterns:

#### **Amplitude Parameters (A, amplitude):**
- Range: -5 to 5
- Default: 1
- Step: 0.1

#### **Frequency Parameters (k, freq):**
- Range: -10 to 10
- Default: 1
- Step: 0.1

#### **Phase Parameters (phi, phase):**
- Range: -2π to 2π
- Default: 0
- Step: 0.1

#### **Sigma/Width Parameters (sigma, σ):**
- Range: 0.1 to 10
- Default: 1
- Step: 0.1

#### **Center/Offset Parameters (x0, offset):**
- Range: -10 to 10
- Default: 0
- Step: 0.1

---

## 🎯 Example Workflows

### **Example 1: Harmonic Oscillator with Variable Parameters**

1. **Set Potential Type:** "Custom Function"
2. **Enter Function:** `0.5*k*(x-x0)^2`
3. **Parameters Automatically Detected:**
   - `k`: Spring constant (frequency)
   - `x0`: Center position
4. **Adjust Parameters:**
   - Use slider to change `k` from 0.1 to 5
   - Use slider to move `x0` from -5 to 5
5. **Watch Real-time Changes:** The potential well shape updates instantly!

### **Example 2: Gaussian Wave Packet**

1. **Set Wavefunction Type:** "Custom Function"
2. **Real Part:** `A*exp(-(x-x0)^2/(2*sigma^2))*cos(k*x)`
3. **Imaginary Part:** `A*exp(-(x-x0)^2/(2*sigma^2))*sin(k*x)`
4. **Parameters:** 
   - `A`: Amplitude (0.1 to 2)
   - `x0`: Center position (-10 to 10)
   - `sigma`: Width (0.1 to 5)
   - `k`: Wave number (-10 to 10)

### **Example 3: Double Well Potential**

1. **Custom Potential:** `V0*(x^2 - a^2)^2`
2. **Parameters:**
   - `V0`: Well depth
   - `a`: Well separation
3. **Experiment:** Adjust `V0` to see barrier height changes

---

## 🎨 Advanced Features

### **Manual Parameter Management**

#### **Adding Custom Parameters:**
1. Click the **+** button in the Parameters section
2. Enter parameter name (e.g., "frequency")
3. Set initial value
4. System automatically detects appropriate range

#### **Parameter Range Control:**
- **Min/Max:** Adjust slider boundaries
- **Step:** Control precision (smaller = more precise)
- **Precise Input:** Direct numerical input for exact values

#### **Parameter Removal:**
- Click **×** button next to any parameter
- Confirms removal (parameters cannot be recovered)

### **Smart Parameter Suggestions**

The system provides intelligent suggestions based on:
- **Function context** (harmonic → frequency, gaussian → width)
- **Parameter name patterns** (amp → amplitude, k → wave number)
- **Mathematical conventions** (φ → phase, σ → standard deviation)

### **Real-time Validation**

- **Syntax Checking:** Validates mathematical expressions
- **Parameter Validation:** Ensures all parameters are defined
- **Range Validation:** Prevents out-of-bounds values
- **Error Messages:** Clear feedback for invalid inputs

---

## 🔧 Technical Implementation

### **Expression Parsing**
```typescript
// Automatic parameter extraction
extractParameterNames("A*sin(k*x+phi)")
// Returns: ["A", "k", "phi"]

// Safe parameter substitution
substituteParameters("A*sin(k*x+phi)", { A: 2, k: 1, phi: 0 })
// Returns: "(2)*sin((1)*x+(0))"
```

### **Interactive Controls**
- **Slider Styling:** Custom CSS with progress indicators
- **Real-time Updates:** Immediate function re-evaluation
- **Responsive Design:** Works on desktop and mobile
- **Accessibility:** Keyboard navigation and screen reader support

### **Parameter Persistence**
- **State Management:** Parameters saved with configuration
- **Export/Import:** Full parameter sets included in saved files
- **Reset Functionality:** Parameters reset with simulation reset

---

## 🎓 Educational Benefits

### **Interactive Learning**
- **Visual Feedback:** See parameter effects immediately
- **Parameter Exploration:** Easy experimentation with different values
- **Concept Understanding:** Direct manipulation of mathematical parameters

### **Research Applications**
- **Parameter Studies:** Systematic parameter variation
- **Sensitivity Analysis:** Observe system behavior changes
- **Optimization:** Fine-tune parameters for desired outcomes

### **Presentation Tools**
- **Live Demonstrations:** Real-time parameter adjustment during presentations
- **Interactive Examples:** Engaging parameter exploration for students
- **Visual Impact:** Immediate visual feedback enhances understanding

---

## 🚨 Tips for Best Results

### **Parameter Naming**
- Use descriptive names: `amplitude`, `frequency`, `phase`
- Single letters work too: `A`, `k`, `φ`
- Avoid reserved keywords: `x`, `t`, `pi`, `e`

### **Range Selection**
- Start with auto-generated ranges
- Adjust based on your specific needs
- Use smaller steps for precision work

### **Function Examples**
```
# Simple sine wave with parameters
A*sin(k*x + phi)

# Gaussian envelope
A*exp(-(x-x0)^2/(2*sigma^2))

# Harmonic oscillator
0.5*k*(x-x0)^2

# Complex potential
V0*exp(-abs(x-x0)/sigma)

# Coupled oscillations
A*cos(omega1*t) + B*sin(omega2*t)
```

---

## 🔄 Quick Start Checklist

- [ ] ✅ Navigate to custom function section
- [ ] ✅ Enter function with parameters (e.g., "A*sin(k*x+phi)")
- [ ] ✅ Parameter controls automatically appear
- [ ] ✅ Use sliders to adjust parameter values
- [ ] ✅ Watch real-time visualization updates
- [ ] ✅ Add/remove parameters as needed
- [ ] ✅ Fine-tune ranges and precision
- [ ] ✅ Save configuration for future use

---

**🎉 Enjoy exploring quantum mechanics with interactive parameters!** 

The Desmos-style parameter system makes complex mathematical relationships intuitive and accessible. Experiment freely and discover how different parameters affect quantum wave evolution!