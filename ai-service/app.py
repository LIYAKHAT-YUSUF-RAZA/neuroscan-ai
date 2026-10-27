"""
Flask AI Inference Service for Alzheimer's MRI Classification.
Provides /health, /predict, and /explain endpoints with strict validation.
Uses lazy model loading to ensure fast port binding and prevent worker boot timeouts.
"""

import os
import io
import sys
import gc
import threading
from flask import Flask, request, jsonify
from PIL import Image

# Import local modules
from model_loader import load_model
from inference import preprocess_image, predict
from explainability import explain_prediction

app = Flask(__name__)

# Basic CORS headers support
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


# Configuration
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB limit
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "webp", "tif", "tiff"}

# Global model state & thread lock for lazy loading
MODEL = None
MODEL_LOAD_ERROR = None
_model_lock = threading.Lock()


def get_or_load_model():
    """
    Thread-safe model retrieval with lazy initialization.
    Ensures Gunicorn binds to $PORT immediately without startup OOM or health-check timeouts.
    """
    global MODEL, MODEL_LOAD_ERROR
    if MODEL is not None:
        return MODEL

    with _model_lock:
        if MODEL is not None:
            return MODEL
        try:
            print("[AI Service] Initializing model checkpoint into memory...")
            MODEL = load_model()
            MODEL_LOAD_ERROR = None
            print("[AI Service] Model loaded successfully into memory.")
            return MODEL
        except MemoryError as mem_err:
            MODEL_LOAD_ERROR = f"MemoryError: Instance memory limit exceeded ({mem_err})"
            print(f"[AI Service] CRITICAL OOM: Insufficient RAM to load model weights: {mem_err}", file=sys.stderr)
            raise
        except Exception as e:
            MODEL_LOAD_ERROR = str(e)
            print(f"[AI Service] Error loading model: {e}", file=sys.stderr)
            raise


# Load model at startup by default (can be delayed with MODEL_LAZY_LOAD=1)
if os.getenv("MODEL_LAZY_LOAD", "0").lower() not in ("true", "1"):
    try:
        print("[AI Service] Eagerly initializing model checkpoint on startup...")
        get_or_load_model()
    except Exception as _e:
        print(f"[AI Service] Startup model loading error: {_e}", file=sys.stderr)


def validate_image_upload(request_obj):
    """
    Validates uploaded multipart file:
    - Checks field presence
    - Checks file extension
    - Decodes image bytes to confirm integrity
    Returns (image_bytes, None) on success, or (None, (error_dict, status_code)) on failure.
    """
    if "image" not in request_obj.files:
        return None, ({"error": "Missing 'image' file field in multipart request."}, 400)

    file = request_obj.files["image"]
    if not file or file.filename == "":
        return None, ({"error": "No file selected for upload."}, 400)

    filename = file.filename
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        return None, (
            {"error": f"Unsupported file extension '.{ext}'. Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}."},
            400,
        )

    try:
        image_bytes = file.read()
    except Exception:
        return None, ({"error": "Failed to read uploaded file data."}, 400)

    if len(image_bytes) == 0:
        return None, ({"error": "Uploaded file is empty."}, 400)

    if len(image_bytes) > MAX_CONTENT_LENGTH:
        return None, ({"error": "File size exceeds the 10 MB maximum limit."}, 400)

    # Validate image decoding
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img.verify()
    except Exception:
        return None, ({"error": "Corrupt or unreadable image file. Please upload a valid MRI scan."}, 400)

    return image_bytes, None


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint reporting service, port, and model readiness."""
    is_loaded = MODEL is not None

    payload = {
        "status": "healthy" if is_loaded else "standby",
        "service": "Alzheimer AI Inference Service",
        "modelLoaded": is_loaded,
        "device": "cpu",
    }
    if not is_loaded:
        if MODEL_LOAD_ERROR:
            payload["modelStatus"] = f"error: {MODEL_LOAD_ERROR}"
        else:
            payload["modelStatus"] = "standby (will initialize on first prediction request)"

    return jsonify(payload), 200


@app.route("/predict", methods=["POST", "OPTIONS"])
def predict_endpoint():
    """
    Predicts Alzheimer's MRI category from uploaded image.
    Optionally includes Grad-CAM and Integrated Gradients heatmaps if query param 'include_heatmaps=true'.
    """
    if request.method == "OPTIONS":
        return "", 204

    try:
        model = get_or_load_model()
    except Exception as e:
        return jsonify({"error": f"Model is not available: {e}"}), 503

    image_bytes, error_tuple = validate_image_upload(request)
    if error_tuple:
        error_resp, code = error_tuple
        return jsonify(error_resp), code

    try:
        tensor, resized_pil = preprocess_image(image_bytes)
        result = predict(model, tensor)

        # Include heatmaps if requested
        include_heatmaps = request.args.get("include_heatmaps", "false").lower() in ("true", "1")
        if include_heatmaps:
            heatmaps = explain_prediction(model, tensor, resized_pil)
            result["heatmaps"] = heatmaps

        # Run GC after request
        gc.collect()
        return jsonify(result), 200
    except MemoryError:
        print("[AI Service] OutOfMemory during prediction execution.", file=sys.stderr)
        return jsonify({"error": "Server ran out of memory during inference."}), 503
    except Exception as exc:
        print(f"[AI Service] Prediction error: {exc}", file=sys.stderr)
        return jsonify({"error": "An error occurred while processing the MRI image."}), 500


@app.route("/explain", methods=["POST", "OPTIONS"])
def explain_endpoint():
    """
    Generates Grad-CAM and Integrated Gradients attribution visualizations for an uploaded MRI scan.
    """
    if request.method == "OPTIONS":
        return "", 204

    try:
        model = get_or_load_model()
    except Exception as e:
        return jsonify({"error": f"Model is not available: {e}"}), 503

    image_bytes, error_tuple = validate_image_upload(request)
    if error_tuple:
        error_resp, code = error_tuple
        return jsonify(error_resp), code

    try:
        tensor, resized_pil = preprocess_image(image_bytes)

        # Optional target class override from form-data / args
        target_class = request.form.get("target_class", None)
        if target_class is not None:
            try:
                target_class = int(target_class)
            except ValueError:
                target_class = None

        heatmaps = explain_prediction(model, tensor, resized_pil, target_class=target_class)

        # Run GC after explanation computation
        gc.collect()
        return jsonify(heatmaps), 200
    except MemoryError:
        print("[AI Service] OutOfMemory during attribution generation.", file=sys.stderr)
        return jsonify({"error": "Server ran out of memory while calculating attribution heatmaps."}), 503
    except Exception as exc:
        print(f"[AI Service] Explain error: {exc}", file=sys.stderr)
        return jsonify({"error": "An error occurred while generating attribution heatmaps."}), 500


if __name__ == "__main__":
    host = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    port = int(os.getenv("PORT", os.getenv("AI_SERVICE_PORT", 5001)))
    debug = os.getenv("FLASK_DEBUG", "0") == "1"

    print(f"[AI Service] Starting Flask server on http://{host}:{port} (debug={debug})")
    app.run(host=host, port=port, debug=debug)
