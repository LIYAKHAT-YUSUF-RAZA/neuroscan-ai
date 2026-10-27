"""
Smoke test for AI inference microservice:
Tests model loading, preprocessing with synthetic image, prediction, and heatmaps.
"""

import sys
import io
import torch
import numpy as np
from PIL import Image

from model_loader import load_model
from inference import preprocess_image, predict, CLASS_NAMES
from explainability import explain_prediction


def run_smoke_test():
    print("=== Starting AI Service Smoke Test ===")

    # 1. Load model
    print("[1/4] Loading model checkpoint...")
    model = load_model()
    print("      Model loaded successfully into memory.")

    # 2. Create synthetic test MRI-like image (224x224 RGB circle on dark background)
    print("[2/4] Generating synthetic test MRI image in memory...")
    img_array = np.zeros((224, 224, 3), dtype=np.uint8)
    y, x = np.ogrid[:224, :224]
    dist_from_center = np.sqrt((x - 112) ** 2 + (y - 112) ** 2)
    brain_mask = dist_from_center <= 85
    img_array[brain_mask] = 160  # Simulated brain matter intensity
    test_pil = Image.fromarray(img_array)

    buf = io.BytesIO()
    test_pil.save(buf, format="PNG")
    raw_bytes = buf.getvalue()

    # 3. Preprocessing & Prediction
    print("[3/4] Running preprocessing and forward pass...")
    tensor, resized_pil = preprocess_image(raw_bytes)
    assert tensor.shape == (1, 3, 224, 224), f"Expected shape (1, 3, 224, 224), got {tensor.shape}"

    result = predict(model, tensor)
    print(f"      Predicted Class : {result['predictedClass']}")
    print(f"      Stage Label     : {result['stageLabel']}")
    print(f"      Probabilities   : {result['probabilities']}")
    print(f"      Logits          : {result['rawLogits']}")

    # Assert probability properties
    assert len(result["probabilities"]) == 4, "Must have exactly 4 class probabilities"
    for cname in CLASS_NAMES:
        assert cname in result["probabilities"], f"Missing class {cname} in probabilities"
    total_prob = sum(result["probabilities"].values())
    assert 0.99 <= total_prob <= 1.01, f"Probabilities must sum to ~1.0, got {total_prob}"

    # Assert explanations & disclaimer
    assert "memory" in result["explanations"], "Explanations must include memory"
    assert "disclaimer" in result, "Result must contain disclaimer"

    # 4. Explainability (Grad-CAM & Integrated Gradients)
    print("[4/4] Generating Grad-CAM and Integrated Gradients...")
    heatmaps = explain_prediction(model, tensor, resized_pil)
    assert "gradcam" in heatmaps, "Missing Grad-CAM heatmap"
    assert "integratedGradients" in heatmaps, "Missing Integrated Gradients heatmap"
    assert heatmaps["gradcam"].startswith("data:image/png;base64,"), "Invalid Grad-CAM data URL format"
    assert heatmaps["integratedGradients"].startswith("data:image/png;base64,"), "Invalid IG data URL format"
    print("      Attribution heatmaps generated and verified successfully.")

    print("=== AI Service Smoke Test PASSED! ===")


if __name__ == "__main__":
    try:
        run_smoke_test()
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
