# Alzheimer’s MRI Classification Web Application (MERN + PyTorch)

A full-stack clinical research application integrating a Kaggle-trained PyTorch hybrid deep learning model (`AlzheimerNetHybrid`) to classify brain MRI scans into four cognitive categories, explain predictions through Grad-CAM and Integrated Gradients, and provide structured educational context.

> [!CAUTION]
> **Research Prototype Disclaimer:**
> This software is strictly an educational and research prototype. It is **not** a medical diagnostic tool, clinical decision support system, or medical device. Model outputs and heatmap visualizations are computational attributions only, not clinically calibrated probabilities or anatomical diagnoses. The application cannot infer a person's actual memory, cognition, or daily behaviour from an MRI image. Any medical concerns must be assessed by qualified healthcare professionals.

---

## Architecture

```
[ Frontend: React + Vite (Static Site CDN) ]
       │
       ▼ (HTTPS multipart/form-data)
[ Backend: Node.js + Express + Multer Gateway (Web Service) ]
       │
       ▼ (HTTPS stream /predict, /explain)
[ AI Service: Python + Flask + PyTorch + Gunicorn (Web Service) ]
  ├── AlzheimerNetHybrid (EfficientNet-B0 + Swin-Small)
  ├── Explainability Engine (Grad-CAM & Integrated Gradients)
  └── Checkpoint: models/best_hybrid_model.pth (203 MB)
       │
       ▼ (Optional Run Metadata Persistence)
[ Database: MongoDB Atlas / Local MongoDB ]
```

---

## Model Specifications & Class Mapping

- **Input Dimensions:** 224 × 224 (RGB) normalized with ImageNet mean (`[0.485, 0.456, 0.406]`) and std (`[0.229, 0.224, 0.225]`).
- **Feature Extractor 1:** EfficientNet-B0 (`conv_head`, 1280 features).
- **Feature Extractor 2:** Swin-Small (`swin_small_patch4_window7_224`, 768 features).
- **Concatenated Representation:** 2048 dimensions &rarr; Dropout (0.5) &rarr; Linear (2048 &rarr; 4).
- **Canonical Class Indices (Preserved):**
  - `0`: `MildDemented` &rarr; Mild Dementia Category
  - `1`: `ModerateDemented` &rarr; Moderate Dementia Category
  - `2`: `NonDemented` &rarr; Healthy / Non-Demented Category (Dataset Control Cohort)
  - `3`: `VeryMildDemented` &rarr; Very Mild / Possible Early-Stage Category
- **Trained Model Checkpoint Verification:**
  - File: `best_hybrid_model.pth`
  - Size: `211,853,875 bytes` (~202.04 MB)
  - SHA-256: `676fefe87d63ab727fe9b3451e94d86b056082651bbe858ca52bb56ae8fcdf06`

---

## Deploying to Render (Blueprint Guide)

The repository includes a ready-to-use Render Blueprint (`render.yaml`) that configures all three services on Render's Free tier:
1. **`neuroscan-ai-service`**: Python 3.12 Web Service running Gunicorn WSGI.
2. **`neuroscan-backend`**: Node.js 20 Web Service running the Express API Gateway.
3. **`neuroscan-frontend`**: High-performance Static Site serving the React/Vite dashboard.

### Step 1: Host the 203 MB Model Checkpoint
GitHub enforces a 100 MB hard limit on file pushes, and `.pth` weight files are strictly ignored by `.gitignore`. You must upload `best_hybrid_model.pth` to an accessible cloud storage service and obtain a direct download URL:

- **Option A — GitHub Release (Recommended & Free):**
  1. On your GitHub repository page, navigate to **Releases** &rarr; **Draft a new release**.
  2. Create a tag (e.g. `v1.0.0`).
  3. Attach `ai-service/models/best_hybrid_model.pth` as a release binary asset.
  4. Publish the release and copy the direct asset download link (`https://github.com/<owner>/<repo>/releases/download/v1.0.0/best_hybrid_model.pth`).
- **Option B — Hugging Face Model Hub (Free):**
  1. Create a model repository on [huggingface.co](https://huggingface.co).
  2. Upload `best_hybrid_model.pth`.
  3. Direct download URL format: `https://huggingface.co/<username>/<repo>/resolve/main/best_hybrid_model.pth`.
- **Option C — AWS S3 / Cloudflare R2 / Google Cloud Storage:**
  - Upload the file and configure public read access or a persistent presigned URL.

> [!NOTE]
> During the Render build phase of `neuroscan-ai-service`, `download_model.py` checks if the checkpoint exists. If missing, it streams it from `MODEL_DOWNLOAD_URL`, validates the expected SHA-256 hash (`676fefe8...`), and safely places it at `models/best_hybrid_model.pth`.

---

### Step 2: Set Up MongoDB Atlas (Free Cloud Database)
MongoDB is optional (the application runs in stateless mode if offline), but required for persistent run history:

1. Sign up or log in at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a free shared cluster (**M0 Free**).
3. Under **Security** &rarr; **Database Access**, create a user with a strong password.
4. Under **Security** &rarr; **Network Access**, add IP address `0.0.0.0/0` (Allow Access from Anywhere).
   *Reason: Render Free web services use dynamic outbound IP addresses.*
5. Under **Deployment** &rarr; **Database**, click **Connect** &rarr; **Drivers** &rarr; **Node.js** and copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/alzheimer_db?retryWrites=true&w=majority
   ```

---

### Step 3: Deploy via Render Blueprint

1. Push your repository to GitHub or GitLab.
2. In the [Render Dashboard](https://dashboard.render.com), click **New +** &rarr; **Blueprint**.
3. Select your repository. Render will automatically detect and parse `render.yaml`.
4. Render will prompt you for the un-synced configuration variables:
   - **`MODEL_DOWNLOAD_URL`** (for `neuroscan-ai-service`): Paste the direct download link from Step 1.
   - **`MONGODB_URI`** (for `neuroscan-backend`): Paste your MongoDB Atlas URI from Step 2.
5. Click **Apply**. Render will orchestrate the deployment of all three services.

---

### Render Environment Variables Reference

#### 1. AI Service (`neuroscan-ai-service`)
| Variable | Value / Default | Description |
| :--- | :--- | :--- |
| `PORT` | *(Assigned by Render)* | Render dynamically binds the listening port |
| `AI_SERVICE_HOST` | `0.0.0.0` | Production network interface binding |
| `MODEL_CHECKPOINT_PATH` | `models/best_hybrid_model.pth` | Checkpoint location relative to `ai-service/` |
| `MODEL_DOWNLOAD_URL` | *(User Provided)* | Direct URL to fetch checkpoint during build |
| `MODEL_EXPECTED_SHA256` | `676fefe8...` | Checkpoint checksum verification |
| `MODEL_EXPECTED_SIZE_BYTES` | `211853875` | Expected checkpoint file size |

#### 2. Express Backend (`neuroscan-backend`)
| Variable | Value / Default | Description |
| :--- | :--- | :--- |
| `PORT` | *(Assigned by Render)* | Render dynamically binds the listening port |
| `HOST` | `0.0.0.0` | Gateway network interface binding |
| `NODE_ENV` | `production` | Production mode flag |
| `FLASK_AI_URL` | `https://neuroscan-ai-service.onrender.com` | Public HTTPS URL of the AI web service |
| `CLIENT_ORIGIN` | `https://neuroscan-frontend.onrender.com,http://localhost:5173` | Allowed CORS origins (comma-separated) |
| `MONGODB_URI` | *(User Provided)* | MongoDB Atlas connection string |

#### 3. React Frontend (`neuroscan-frontend`)
| Variable | Value / Default | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://neuroscan-backend.onrender.com/api` | Baked into bundle at build time for API calls |

---

### Render Troubleshooting & Notes

- **Free Tier Cold Starts:** Render Free web services spin down after 15 minutes of inactivity. When a new scan is submitted after inactivity, the first request may take 30–50 seconds while the containers boot and the PyTorch model loads into memory.
- **Memory Consumption:** PyTorch with EfficientNet and Swin-Small uses ~350 MB RAM. `render.yaml` configures Gunicorn with `--workers 1 --threads 2 --timeout 120` to prevent worker duplication that would exceed the 512 MB free tier memory limit.
- **CORS Errors:** If your frontend URL differs from the default `https://neuroscan-frontend.onrender.com` (e.g. customized subdomain), update `CLIENT_ORIGIN` in the `neuroscan-backend` settings in the Render Dashboard.
- **Database Graceful Degradation:** If `MONGODB_URI` is omitted or invalid, the backend will log a warning and continue operating in stateless mode. Inference and explainability continue to work without disruption.

---

## Quick Start Guide (Local Development)

### 0. MongoDB Database (Optional — Persistent History)
```bash
mkdir -p ~/.local/share/alzheimer_db
mongod --dbpath ~/.local/share/alzheimer_db --port 27017 --fork --logpath ~/.local/share/alzheimer_db/mongod.log
```
*(To stop later: `mongod --dbpath ~/.local/share/alzheimer_db --shutdown`)*

### 1. AI Inference Microservice (Terminal 1)
```bash
cd ai-service
source .venv/bin/activate
python app.py
```
*Health Check:* `http://127.0.0.1:5001/health`

### 2. Express Backend Gateway (Terminal 2)
```bash
cd backend
npm run dev
```
*Health Check:* `http://localhost:5000/api/health`

### 3. React Frontend Dashboard (Terminal 3)
```bash
cd frontend
npm run dev
```
*Dashboard Access:* `http://localhost:5173`

---

## Running Verification Tests

- **Model Downloader Existing-File Check:**
  ```bash
  python3 ai-service/download_model.py
  ```
- **AI Service Smoke Test (Synthetic Image + Model Checkpoint):**
  ```bash
  ai-service/.venv/bin/python ai-service/smoke_test.py
  ```
- **Backend API & Health Smoke Test:**
  ```bash
  cd backend && npm test
  ```
- **Frontend Production Build Test:**
  ```bash
  cd frontend && npm run build
  ```
- **Full End-to-End Test (Flask + Express Integration):**
  ```bash
  ai-service/.venv/bin/python test_e2e.py
  ```

---

## Directory Structure

```
Alzheimer_ai-assistant/
├── render.yaml                # Render Blueprint infrastructure specification
├── ai-service/                # Python inference microservice
│   ├── .venv/                 # Virtual environment (gitignored)
│   ├── models/
│   │   ├── best_hybrid_model.pth # Trained weights (203 MB, gitignored)
│   │   └── .gitkeep
│   ├── download_model.py      # Checkpoint streamer & SHA-256 validator
│   ├── app.py                 # Flask server (/health, /predict, /explain)
│   ├── model_loader.py        # AlzheimerNetHybrid & safe checkpoint loading
│   ├── inference.py           # Preprocessing & classification pipeline
│   ├── explainability.py      # Grad-CAM & Integrated Gradients engine
│   ├── smoke_test.py          # Synthetic MRI inference test
│   ├── requirements.txt       # Frozen PyTorch CPU & Gunicorn dependencies
│   └── README.md
├── backend/                   # Node.js + Express gateway
│   ├── src/
│   │   ├── config/            # Environment & MongoDB configuration
│   │   ├── controllers/       # Health, predict, history controllers
│   │   ├── middlewares/       # Multer memory storage & centralized errors
│   │   ├── models/            # Mongoose Prediction schema
│   │   ├── routes/            # Express router (/api/*)
│   │   ├── services/          # HTTP streaming to Flask
│   │   └── server.js          # Server entry point
│   ├── test/                  # Backend smoke tests
│   ├── package.json
│   └── README.md
├── frontend/                  # React + Vite dashboard
│   ├── src/
│   │   ├── components/        # UI components (Upload, Charts, XAI, Guides)
│   │   ├── data/              # Static clinical educational metadata
│   │   ├── services/          # API client
│   │   ├── App.jsx            # Master dashboard view
│   │   └── index.css          # Modern glassmorphism design
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
├── test_e2e.py                # Full-stack integration test runner
├── .gitignore                 # Security rules ignoring weights, envs, caches
└── README.md
```
