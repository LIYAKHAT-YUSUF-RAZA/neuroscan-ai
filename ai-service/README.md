# AI Inference Service (Python + Flask + PyTorch)

Microservice responsible for loading the trained `AlzheimerNetHybrid` PyTorch checkpoint, performing 224×224 image preprocessing, computing softmax class probabilities, and generating Grad-CAM & Integrated Gradients attribution heatmaps.

---

## Architecture & Model
- **Hybrid Architecture:** EfficientNet-B0 (`conv_head`, 1280 features) + Swin-Small (768 features) concatenated into a 4-class linear head.
- **Weights Checkpoint:** `ai-service/models/best_hybrid_model.pth` (203 MB).
- **Target Layer for Grad-CAM:** `model.efficientnet.conv_head` (producing `(1, 1280, 7, 7)` activation maps).
- **Integrated Gradients:** 15-step linear interpolation path from an all-black baseline.

---

## Setup & Running

1. **Activate Virtual Environment:**
   ```bash
   cd ai-service
   source .venv/bin/activate
   ```

2. **Verify Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run Smoke Test (Synthetic Image):**
   ```bash
   python smoke_test.py
   ```

4. **Start Service:**
   ```bash
   python app.py
   ```
   The service listens on `http://127.0.0.1:5001`.

---

## API Endpoints

- `GET /health`: Service health and model load state.
- `POST /predict`: Upload image as multipart `image` field. Returns prediction, class probabilities, educational guidance, and disclaimer.
- `POST /explain`: Generates Grad-CAM and Integrated Gradients heatmaps encoded as base64 data URLs.
