# Frontend Dashboard (React + Vite)

Interactive clinical research dashboard for uploading brain MRI scans, viewing Alzheimer's disease classification probabilities, exploring Grad-CAM / Integrated Gradients heatmaps, and learning about cognitive stage categories.

---

## Features
- **Modern UI:** Glassmorphism dashboard with responsive layout and Lucide medical iconography.
- **Visual XAI Attribution:** Side-by-side display of raw MRI, Grad-CAM, and Integrated Gradients heatmaps.
- **Educational Guide:** Comprehensive information covering Memory, Recognition, Behaviour, and Illustrative examples for all 4 categories.
- **Prediction History:** Live sync with backend database runs.
- **Prominent Medical Disclaimer:** Clear research-only warnings adhering to medical AI ethics.

---

## Setup & Running

1. **Install Dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Build Production Assets:**
   ```bash
   npm run build
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```
   The dashboard runs on `http://localhost:5173`.
