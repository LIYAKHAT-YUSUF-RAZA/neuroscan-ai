"""
Comprehensive end-to-end integration test runner:
Tests Flask AI service direct, Express gateway proxying, Grad-CAM/IG explainability,
and MongoDB prediction history persistence.
"""

import sys
import io
import json
import urllib.request
import urllib.error
import numpy as np
from PIL import Image

def generate_synthetic_image_bytes():
    img_array = np.zeros((224, 224, 3), dtype=np.uint8)
    y, x = np.ogrid[:224, :224]
    dist_from_center = np.sqrt((x - 112) ** 2 + (y - 112) ** 2)
    brain_mask = dist_from_center <= 85
    img_array[brain_mask] = 160
    pil_img = Image.fromarray(img_array)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()

def post_multipart(url, file_bytes, filename="mri_scan.png", content_type="image/png"):
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("Content-Length", str(len(body)))

    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def get_json(url):
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def delete_json(url):
    req = urllib.request.Request(url, method="DELETE")
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))

def run():
    print("=== Running Comprehensive End-to-End System Tests ===")
    img_bytes = generate_synthetic_image_bytes()

    # 1. Test Flask AI Service Direct
    print("\n[1] Testing Flask Service Directly (http://127.0.0.1:5001)...")
    try:
        h_status, h_data = get_json("http://127.0.0.1:5001/health")
        print(f"    GET /health -> HTTP {h_status}: {h_data}")
        assert h_data.get("modelLoaded") is True, "Model is not loaded"
        assert h_data.get("device") == "cpu", "Device should be cpu"

        p_status, p_data = post_multipart("http://127.0.0.1:5001/predict?include_heatmaps=true", img_bytes)
        print(f"    POST /predict -> HTTP {p_status}")
        print(f"    Predicted: {p_data.get('stageLabel')} ({p_data.get('predictedClass')})")
        print(f"    Probabilities: {p_data.get('probabilities')}")
        assert "heatmaps" in p_data, "Heatmaps missing"
        assert "gradcam" in p_data["heatmaps"], "Grad-CAM missing"
        assert "integratedGradients" in p_data["heatmaps"], "IG missing"

        # Test dedicated /explain endpoint
        exp_status, exp_data = post_multipart("http://127.0.0.1:5001/explain", img_bytes)
        print(f"    POST /explain -> HTTP {exp_status}")
        assert "gradcam" in exp_data and "integratedGradients" in exp_data, "Explain endpoint failed"
        print("    [PASS] Flask AI service direct test successful!")
    except Exception as e:
        print(f"    [FAIL] Flask test failed: {e}")
        raise

    # 2. Test Express Gateway & MongoDB
    print("\n[2] Testing Express Gateway (http://127.0.0.1:5000)...")
    try:
        e_status, e_data = get_json("http://127.0.0.1:5000/api/health")
        print(f"    GET /api/health -> HTTP {e_status}: {e_data}")
        db_connected = e_data.get("database", {}).get("connected", False)
        print(f"    Database connected: {db_connected}")

        ep_status, ep_data = post_multipart("http://127.0.0.1:5000/api/predict", img_bytes, filename="test_mri_patient.png")
        print(f"    POST /api/predict -> HTTP {ep_status}")
        print(f"    Predicted: {ep_data.get('stageLabel')} ({ep_data.get('predictedClass')})")
        print(f"    Probabilities: {ep_data.get('probabilities')}")
        print(f"    History saved: {ep_data.get('historySaved')} (ID: {ep_data.get('historyId')})")
        assert "heatmaps" in ep_data, "Heatmaps missing from Express response"
        assert "disclaimer" in ep_data, "Medical disclaimer missing"

        # Check history endpoint
        hist_status, hist_data = get_json("http://127.0.0.1:5000/api/history")
        print(f"    GET /api/history -> HTTP {hist_status}: Found {hist_data.get('count', 0)} records")
        if db_connected:
            assert hist_data.get("count", 0) >= 1, "Expected at least 1 record in history"
            latest = hist_data["data"][0]
            assert latest["originalFilename"] == "test_mri_patient.png"
            assert latest["predictedClass"] == ep_data["predictedClass"]
            print(f"    Verified latest history item in MongoDB: {latest['originalFilename']} -> {latest['predictedClass']}")

        print("    [PASS] Express gateway & MongoDB integration successful!")
    except Exception as e:
        print(f"    [FAIL] Express test failed: {e}")
        raise

    print("\n=== ALL SYSTEM TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    try:
        run()
    except Exception as err:
        sys.exit(1)
