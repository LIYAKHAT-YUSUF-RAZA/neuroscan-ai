"""
Independent AI Service Concurrency & Hardening Benchmark:
Evaluates concurrent requests at concurrency levels 1, 2, 4, 8.
Measures latency (avg, p50, p95, p99), memory RSS, hook cleanup, and lock release safety.
"""

import sys
import os
import io
import time
import resource
import statistics
import concurrent.futures
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from model_loader import load_model
from inference import preprocess_image, predict
from explainability import explain_prediction, _xai_lock, generate_gradcam

def get_memory_mb():
    # ru_maxrss is in kilobytes on Linux
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024.0

def create_synthetic_image_bytes(radius=85, intensity=160):
    img_array = np.zeros((224, 224, 3), dtype=np.uint8)
    y, x = np.ogrid[:224, :224]
    mask = np.sqrt((x - 112) ** 2 + (y - 112) ** 2) <= radius
    img_array[mask] = intensity
    pil_img = Image.fromarray(img_array)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()

def run_single_inference(model, image_bytes):
    t0 = time.perf_counter()
    tensor, resized_pil = preprocess_image(image_bytes)
    result = predict(model, tensor)
    heatmaps = explain_prediction(model, tensor, resized_pil)
    t1 = time.perf_counter()
    duration = t1 - t0
    return {
        "duration": duration,
        "predictedClass": result["predictedClass"],
        "stageNumber": result["stageNumber"],
        "probabilities": result["probabilities"],
        "hasGradCam": "gradcam" in heatmaps,
        "hasIG": "integratedGradients" in heatmaps,
    }

def run_concurrency_level(model, image_bytes, concurrency):
    print(f"\n--- Testing Concurrency Level: {concurrency} workers ---")
    start_mem = get_memory_mb()
    t_start = time.perf_counter()

    latencies = []
    classes = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = [
            executor.submit(run_single_inference, model, image_bytes)
            for _ in range(concurrency)
        ]
        for f in concurrent.futures.as_completed(futures):
            res = f.result()
            latencies.append(res["duration"])
            classes.append(res["predictedClass"])

    total_wall_time = time.perf_counter() - t_start
    end_mem = get_memory_mb()

    latencies_sorted = sorted(latencies)
    avg_lat = statistics.mean(latencies)
    p50 = statistics.median(latencies)
    p95 = latencies_sorted[int(len(latencies_sorted) * 0.95)] if len(latencies_sorted) >= 20 else max(latencies)
    p99 = latencies_sorted[int(len(latencies_sorted) * 0.99)] if len(latencies_sorted) >= 100 else max(latencies)

    # Check prediction consistency: all returned predictions must be identical
    consistent = len(set(classes)) == 1

    print(f"  Wall time        : {total_wall_time:.3f} s")
  
    print(f"  Throughput       : {concurrency / total_wall_time:.2f} req/s")
    print(f"  Latencies (s)    : Avg={avg_lat:.3f}, p50={p50:.3f}, p95={p95:.3f}, p99={p99:.3f}")
    print(f"  Memory (RSS)     : {end_mem:.1f} MB (delta: +{end_mem - start_mem:.1f} MB)")
    print(f"  Class consistency: {'CONSISTENT (' + classes[0] + ')' if consistent else 'INCONSISTENT'}")

    return {
        "concurrency": concurrency,
        "wall_time": total_wall_time,
        "rps": concurrency / total_wall_time,
        "avg": avg_lat,
        "p50": p50,
        "p95": p95,
        "p99": p99,
        "mem_mb": end_mem,
        "consistent": consistent,
    }

def test_lock_release_on_exception(model):
    print("\n--- Testing Lock Release & Hook Cleanup on Exception ---")
    # Assert lock is currently released
    assert not _xai_lock.locked(), "Lock is unexpectedly held before test!"

    # Simulate an error by passing a corrupt tensor
    corrupt_tensor = "not_a_tensor"
    threw_expected = False
    try:
        generate_gradcam(model, corrupt_tensor)
    except Exception as e:
        threw_expected = True

    assert threw_expected, "Expected an exception with corrupt tensor"
    assert not _xai_lock.locked(), "CRITICAL: Lock was NOT released after exception!"

    # Verify hooks on target conv_head layer were cleaned up
    conv_head = model.efficientnet.conv_head
    forward_hooks_count = len(conv_head._forward_hooks)
    backward_hooks_count = len(conv_head._backward_hooks)
    assert forward_hooks_count == 0, f"Leaked forward hooks: {forward_hooks_count}"
    assert backward_hooks_count == 0, f"Leaked backward hooks: {backward_hooks_count}"
    print("  ✔ Mutex lock released cleanly in finally block.")
    print("  ✔ PyTorch forward and backward hooks cleaned up completely (0 remaining).")

    # Run normal inference immediately after to confirm recovery
    img_bytes = create_synthetic_image_bytes()
    rec_res = run_single_inference(model, img_bytes)
    assert rec_res["predictedClass"] == "NonDemented"
    print("  ✔ Model recovered immediately and produced valid subsequent prediction.")

def main():
    print("==================================================================")
    print("NeuroScan AI — AI Service Concurrency & Hardening Benchmark")
    print("==================================================================")

    model = load_model()
    image_bytes = create_synthetic_image_bytes()

    results = []
    for c in [1, 2, 4, 8]:
        res = run_concurrency_level(model, image_bytes, c)
        results.append(res)

    test_lock_release_on_exception(model)

    print("\n=== AI SERVICE BENCHMARK SUMMARY ===")
    print(f"{'Concurrency':<12} | {'Throughput (RPS)':<18} | {'Avg (s)':<10} | {'p50 (s)':<10} | {'p95 (s)':<10} | {'p99 (s)':<10} | {'Memory (MB)':<12}")
    print("-" * 88)
    for r in results:
        print(f"{r['concurrency']:<12} | {r['rps']:<18.2f} | {r['avg']:<10.3f} | {r['p50']:<10.3f} | {r['p95']:<10.3f} | {r['p99']:<10.3f} | {r['mem_mb']:<12.1f}")
    print("==================================================================")

if __name__ == "__main__":
    main()
