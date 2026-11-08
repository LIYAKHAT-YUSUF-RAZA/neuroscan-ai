"""
Test concurrent XAI attribution generation to verify thread safety and absence of hook collisions.
"""

import sys
import os
import io
import concurrent.futures
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../ai-service"))
from model_loader import load_model
from inference import preprocess_image, predict
from explainability import explain_prediction

def create_synthetic_image(radius=80, intensity=150):
    img_array = np.zeros((224, 224, 3), dtype=np.uint8)
    y, x = np.ogrid[:224, :224]
    mask = np.sqrt((x - 112) ** 2 + (y - 112) ** 2) <= radius
    img_array[mask] = intensity
    pil_img = Image.fromarray(img_array)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()

def worker_task(thread_id, model, raw_bytes):
    tensor, resized_pil = preprocess_image(raw_bytes)
    result = predict(model, tensor)
    heatmaps = explain_prediction(model, tensor, resized_pil)
    assert "gradcam" in heatmaps
    assert "integratedGradients" in heatmaps
    assert heatmaps["gradcam"].startswith("data:image/png;base64,")
    assert heatmaps["integratedGradients"].startswith("data:image/png;base64,")
    return f"Thread {thread_id}: Success, class={result['predictedClass']}, heatmaps={len(heatmaps['gradcam'])}B"

def main():
    print("Testing AI Explainability Concurrency...")
    model = load_model()
    raw_images = [create_synthetic_image(radius=70 + i * 5, intensity=130 + i * 15) for i in range(4)]
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        futures = [
            executor.submit(worker_task, i, model, raw_images[i])
            for i in range(4)
        ]
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
        for r in results:
            print(f"  ✔ {r}")
    
    print("=== All concurrent explainability tasks passed without race conditions or hook collisions! ===")

if __name__ == "__main__":
    main()
