# NeuroScan AI — Explainable Alzheimer’s Disease MRI Classification Platform

NeuroScan AI is a full-stack, research-grade medical imaging AI platform integrating a deep learning hybrid architecture (EfficientNet-B0 + Swin-Small Transformer) to classify 2D brain MRI axial slices into four cognitive stages, provide dual visual explainability through Grad-CAM and Integrated Gradients, and support comprehensive longitudinal patient care management.

> [!CAUTION]
> **Research and Educational Prototype Disclaimer:**
> NeuroScan AI is strictly an investigational software artifact developed for scientific research and educational demonstration purposes. It is **not** an FDA-cleared or CE-marked medical device, and it is **not** a clinical diagnostic tool or autonomous decision-support system. Model predictions, probability scores, and attribution heatmaps are computational estimates only, not clinical diagnoses. This system cannot infer a patient's actual cognitive state, memory capacity, or daily functional abilities. Any medical evaluation or diagnostic decision must be performed by licensed healthcare professionals and qualified neuroradiologists.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Main Features](#main-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Directory Structure](#project-directory-structure)
- [Model Setup (Checkpoints Not Included)](#model-setup-checkpoints-not-included)
- [Dataset Setup (Medical Datasets Not Included)](#dataset-setup-medical-datasets-not-included)
- [Configuration via Environment Variables](#configuration-via-environment-variables)
- [Installation & Startup Guide](#installation--startup-guide)
  - [Prerequisites](#prerequisites)
  - [1. AI Service Setup](#1-ai-service-setup)
  - [2. Backend API Gateway Setup](#2-backend-api-gateway-setup)
  - [3. Frontend Dashboard Setup](#3-frontend-dashboard-setup)
  - [4. Docker Compose Deployment](#4-docker-compose-deployment)
- [API Overview](#api-overview)
- [Research Limitations](#research-limitations)
- [License](#license)

---

## Project Overview

Alzheimer's disease is a progressive neurodegenerative disorder characterized by cortical atrophy and ventricular enlargement. Modern computer vision systems frequently achieve high nominal accuracy on public benchmarks, but risk silent failure when deployed across heterogeneous hospital environments.

NeuroScan AI addresses this reliability gap by pairing a hybrid convolutional-transformer backbone with:
1. **Explainable AI (XAI):** High-resolution visual attributions generated via Grad-CAM (targeting EfficientNet-B0 feature representations) and 50-step Integrated Gradients.
2. **Reliability & Uncertainty Estimation:** Probability calibration via post-hoc temperature scaling, introspective error detection, and out-of-distribution (OOD) screening.
3. **Clinical Management Workflow:** Full-stack electronic patient health record management, appointment scheduling, medication tracking with dosage reminders, caregiver support modules, and multi-language support (English, Hindi, Telugu).

---

## Main Features

- **Four-Class Cognitive Staging:** Classifies axial brain MRI scans into:
  - `0`: **MildDemented** (Mild Dementia Category)
  - `1`: **ModerateDemented** (Moderate Dementia Category)
  - `2`: **NonDemented** (Cognitively Normal / Control Cohort)
  - `3`: **VeryMildDemented** (Very Mild / Early-Stage Cognitive Impairment)
- **Dual Explainability Suite:**
  - **Grad-CAM:** Generates activation heatmaps from `model.efficientnet.conv_head` (1,280 channels) highlighting macroscopic focal cortical regions.
  - **Integrated Gradients:** Computes axiomatic pixel-level path attributions against a neutral baseline.
  - Interactive opacity controls, colormap blending, and side-by-side comparative inspection.
- **Patient Management & Longitudinal Tracking:**
  - Multi-patient switching and patient profile management.
  - Longitudinal MRI timeline comparison tracking progression over sequential scans.
  - Re-analysis modal allowing updated inferences with custom clinical parameters.
- **Caregiver & Routine Support:**
  - Daily routine planner, hydration, and exercise reminders.
  - Medication scheduler with dosage tracking and adherence logging.
  - Clinician-reviewed nutritional recommendations and specialist finder directory.
- **Multilingual Support:** Fully internationalized dashboard supporting English (`en`), Hindi (`hi`), and Telugu (`te`).

---

## System Architecture

NeuroScan AI employs a decoupled three-tier microservice architecture:

```
[ Frontend: React 18 + Vite + Tailwind CSS ]
       │
       ▼ (REST API / Multipart Form-Data via Axios)
[ Backend Gateway: Node.js 20 + Express.js + Multer ]
       │
       ├───► [ Database: MongoDB (Optional Persistence) ]
       │
       ▼ (Internal Stream / Authenticated HTTP Request)
[ AI Service: Python 3.10+ + Flask + PyTorch CPU/GPU ]
       ├── Architecture: AlzheimerNetHybrid
       │     ├── EfficientNet-B0 (1,280 features)
       │     └── Swin-Small Transformer (768 features)
       │     └── Joint Embedding (2,048-dim) ──► Linear(2048, 4)
       └── Explainability Engine: Grad-CAM & Integrated Gradients
```

---

## Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons, Canvas / HTML5 |
| **Backend** | Node.js 20, Express.js, Mongoose, Multer, Helmet, CORS |
| **AI Inference** | Python 3.10+, PyTorch, Torchvision, TIMM, Flask, Gunicorn, SciPy, Pillow, NumPy |
| **Database** | MongoDB (Community Edition or MongoDB Atlas) |
| **Containerization** | Docker, Docker Compose, Nginx |

---

## Project Directory Structure

```
neuroscan-ai/
├── ai-service/                # Python PyTorch inference microservice
│   ├── app.py                 # Flask HTTP API server (/health, /predict, /explain)
│   ├── model_loader.py        # AlzheimerNetHybrid model definition & loading
│   ├── inference.py           # Preprocessing & classification pipeline
│   ├── explainability.py      # Grad-CAM and Integrated Gradients implementations
│   ├── download_model.py      # Automated model downloader & SHA-256 verifier
│   ├── smoke_test.py          # Service verification smoke test
│   ├── requirements.txt       # Python package dependencies
│   ├── Dockerfile             # Production container definition
│   └── .dockerignore          # Docker build exclusions
├── backend/                   # Node.js + Express API Gateway
│   ├── src/
│   │   ├── config/            # Environment & MongoDB database configuration
│   │   ├── controllers/       # Health, auth, patient, scan, job, care controllers
│   │   ├── middlewares/       # Authentication, upload, error handler middlewares
│   │   ├── models/            # Mongoose schemas (Patient, MriScan, Medication, etc.)
│   │   ├── routes/            # Express REST API routes (/api/*)
│   │   ├── services/          # AI proxy service, email & storage adapters
│   │   └── server.js          # Express server entry point
│   ├── test/                  # Automated integration & unit test suite
│   ├── package.json           # Node.js dependencies and scripts
│   ├── Dockerfile             # Production container definition
│   └── .dockerignore          # Docker build exclusions
├── frontend/                  # React + Vite Client Application
│   ├── src/
│   │   ├── components/        # UI components (Viewer, Timeline, Care, Metrics)
│   │   ├── context/           # React context providers (LanguageContext)
│   │   ├── data/              # Educational and guidance clinical metadata
│   │   ├── locales/           # Localization strings (en, hi, te)
│   │   ├── services/          # Frontend HTTP client
│   │   ├── App.jsx            # Main dashboard application component
│   │   ├── main.jsx           # React DOM root entry point
│   │   └── index.css          # Design system and Tailwind stylesheets
│   ├── package.json           # Frontend dependencies and scripts
│   ├── vite.config.js         # Vite bundler configuration
│   ├── nginx.conf             # Production Nginx reverse-proxy configuration
│   ├── Dockerfile             # Multi-stage production container definition
│   └── .dockerignore          # Docker build exclusions
├── docker-compose.yml         # Multi-container orchestration definition
├── render.yaml                # Cloud deployment blueprint
├── test_e2e.py                # Full-stack integration test runner
├── .gitignore                 # Comprehensive repository exclusion rules
└── README.md                  # Master project documentation
```

---

## Model Setup (Checkpoints Not Included)

> [!IMPORTANT]
> **Checkpoints are excluded from Git:**
> Trained deep learning model weights (`.pth`, `.pt`, `.onnx`, etc.) exceed GitHub file size limits and are intentionally excluded from version control via `.gitignore`. The trained model checkpoint is **not** bundled in this repository.

To set up the pretrained `AlzheimerNetHybrid` model checkpoint:
1. Obtain the trained checkpoint file: `best_hybrid_model.pth`.
2. Verify its integrity against the expected SHA-256 checksum:
   - **Filename:** `best_hybrid_model.pth`
   - **Expected File Size:** `211,853,875 bytes` (~202.04 MB)
   - **Expected SHA-256:** `676fefe87d63ab727fe9b3451e94d86b056082651bbe858ca52bb56ae8fcdf06`
3. Place the verified checkpoint in the `ai-service/models/` directory:
   ```bash
   mkdir -p ai-service/models
   mv best_hybrid_model.pth ai-service/models/best_hybrid_model.pth
   ```
4. Verify the model file locally:
   ```bash
   sha256sum ai-service/models/best_hybrid_model.pth
   ```
   Alternatively, set the `MODEL_DOWNLOAD_URL` environment variable to stream and automatically verify the checkpoint on startup using `ai-service/download_model.py`.

---

## Dataset Setup (Medical Datasets Not Included)

> [!IMPORTANT]
> **Medical Imaging Datasets are excluded from Git:**
> In compliance with medical data privacy guidelines and repository size policies, patient imaging data, MRI DICOM/NIfTI volumes, and raw image collections are strictly excluded from version control.

- **Primary Benchmark:** Research experiments were trained on the public Kaggle Augmented Alzheimer MRI Dataset (`uraninjo/augmented-alzheimer-mri-dataset`).
- **Input Specifications:** The model accepts standard 2D axial T1-weighted brain MRI slices in standard image formats (`JPEG`, `PNG`).
- **Image Preprocessing:** Images are resized to $224 \times 224$ pixels, converted to RGB, and normalized using ImageNet channel statistics ($\mu = [0.485, 0.456, 0.406]$, $\sigma = [0.229, 0.224, 0.225]$).

---

## Configuration via Environment Variables

All services are configured through environment variables. **Never commit actual `.env` files.** Set the variables in your local environment, shell, or container runner:

### 1. AI Service Configuration
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5001` | Port on which the AI microservice listens |
| `AI_SERVICE_HOST` | `127.0.0.1` | Host address binding (`0.0.0.0` for containers) |
| `MODEL_CHECKPOINT_PATH` | `models/best_hybrid_model.pth` | Path to weights file relative to `ai-service/` |
| `MODEL_EXPECTED_SHA256` | `676fefe8...` | Expected SHA-256 checksum for verification |
| `MODEL_DOWNLOAD_URL` | *(Optional)* | Direct URL to download weights on startup if missing |
| `AI_SERVICE_SECRET` | *(Optional)* | Pre-shared secret token for internal API authentication |

### 2. Backend Gateway Configuration
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port on which the Express gateway listens |
| `HOST` | `0.0.0.0` | Network binding interface |
| `NODE_ENV` | `development` | Runtime environment (`development` / `production`) |
| `FLASK_AI_URL` | `http://127.0.0.1:5001` | URL of the upstream AI inference service |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed CORS origins (comma-separated for multiples) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/alzheimer_db` | MongoDB connection URI (operates in stateless mode if omitted) |
| `AI_SERVICE_SECRET` | *(Optional)* | Pre-shared secret matching the AI service |

### 3. Frontend Configuration
| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Base URL of the backend API gateway |

---

## Installation & Startup Guide

### Prerequisites
- **Node.js:** v18.0.0+ (v20 LTS recommended)
- **Python:** v3.10+ (v3.11 recommended)
- **MongoDB:** v6.0+ (Optional, for persistent scan and patient history)
- **Docker & Docker Compose:** Optional, for containerized execution

---

### 1. AI Service Setup

```bash
# Navigate to AI service directory
cd ai-service

# Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install required dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Verify the model checkpoint exists (see Model Setup section)
ls -la models/best_hybrid_model.pth

# Run smoke test
python smoke_test.py

# Start the Flask microservice
python app.py
```
*Health Check:* `curl http://127.0.0.1:5001/health`

---

### 2. Backend API Gateway Setup

```bash
# In a new terminal, navigate to backend directory
cd backend

# Install Node.js dependencies
npm install

# Run automated tests
npm test

# Start the backend gateway in development mode
npm run dev
```
*Health Check:* `curl http://localhost:5000/api/health`

---

### 3. Frontend Dashboard Setup

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install frontend dependencies
npm install

# Build production bundle check
npm run build

# Start Vite development server
npm run dev
```
*Access Application:* Open `http://localhost:5173` in your web browser.

---

### 4. Docker Compose Deployment

To build and run all services simultaneously in isolated containers:

```bash
# Build and start all containers in background
docker compose up -d --build

# Inspect running containers
docker compose ps

# View service logs
docker compose logs -f
```

- **Frontend Application:** `http://localhost:80`
- **Backend API Gateway:** `http://localhost:5000/api/health`
- **AI Inference Service:** `http://localhost:5001/health`

---

## API Overview

### AI Service Endpoints (`:5001`)
- `GET /health` — Service health, device info (`cpu`/`cuda`), and model load status.
- `POST /predict` — Accepts multipart form-data image file (`image`); returns predicted class, canonical class index, confidence, raw logits, and softmax probabilities.
- `POST /explain` — Accepts multipart form-data image file (`image`); returns base64 Data URLs for Grad-CAM and Integrated Gradients overlays.

### Backend Gateway Endpoints (`:5000/api`)
- `GET /api/health` — System health, database connection state, and upstream AI microservice connectivity.
- `POST /api/predict` — Proxies upload to AI service, persists scan record to MongoDB (if connected), and returns inference results.
- `POST /api/explain` — Generates attribution maps with caching and metadata logging.
- `GET /api/history` — Retrieves historical scan records, progression data, and diagnostic timeline.
- `GET /api/patients` — Lists registered patient profiles and longitudinal tracking records.
- `POST /api/patients` — Registers new patient profiles and medical preferences.

---

## Research Limitations

1. **Slice-Level vs. Subject-Level Splitting:** Public Kaggle Alzheimer's 2D slice collections lack subject/patient identifiers. Random partitioning on 2D slices creates an inherent risk of cross-slice correlation between train and test sets.
2. **2D Axial Formulation:** The model processes isolated 2D axial slices, discarding volumetric out-of-plane anatomical context.
3. **Exploratory Cohort Boundaries:** External generalization testing has been conducted on exploratory pilot samples. Prospective clinical trials across diverse scanner vendors (GE, Siemens, Philips) and pulse sequences are required prior to any clinical translation.
4. **Computational Saliency Constraints:** Heatmaps provide gradient-based feature attribution and should never be interpreted as anatomical lesion segmentations.

---

## License

This project is licensed under the Apache License 2.0. See the LICENSE file for details.
