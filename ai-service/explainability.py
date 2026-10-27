"""
Explainability engine for AlzheimerNetHybrid using Grad-CAM and Integrated Gradients.
Provides attribution heatmaps overlaid on the original MRI scan.
Optimized for streaming gradient accumulation and eager memory freeing.
"""

import io
import gc
import base64
import torch
import torch.nn.functional as F
import numpy as np
from PIL import Image


def _get_jet_palette():
    """
    Generates a 256-color Jet colormap lookup table using NumPy (no OpenCV/Matplotlib needed).
    """
    x = np.linspace(0.0, 1.0, 256)
    r = np.clip(1.5 - np.abs(4.0 * x - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - np.abs(4.0 * x - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - np.abs(4.0 * x - 1.0), 0.0, 1.0)
    return (np.stack([r, g, b], axis=1) * 255).astype(np.uint8)


JET_PALETTE = _get_jet_palette()


def overlay_heatmap(pil_image, heatmap_2d, alpha=0.45):
    """
    Overlays a normalized 2D heatmap (0.0 - 1.0) on a 224x224 PIL Image.
    Returns:
        overlay_pil: PIL.Image
        data_url: str (data:image/png;base64,...)
    """
    orig_np = np.array(pil_image.convert("RGB"), dtype=np.uint8)

    # Normalize heatmap strictly between 0 and 255
    norm_map = np.clip(heatmap_2d, 0.0, 1.0)
    indices = (norm_map * 255).astype(np.uint8)
    color_map = JET_PALETTE[indices]

    # Weighted blend: (1 - alpha) * orig + alpha * colormap
    blended = np.clip(
        (1.0 - alpha) * orig_np.astype(np.float32) + alpha * color_map.astype(np.float32),
        0,
        255,
    ).astype(np.uint8)

    overlay_img = Image.fromarray(blended)

    # Convert to base64 Data URL
    buf = io.BytesIO()
    overlay_img.save(buf, format="PNG")
    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
    data_url = f"data:image/png;base64,{b64_str}"

    return overlay_img, data_url


def generate_gradcam(model, image_tensor, target_class=None, device="cpu"):
    """
    Generates Grad-CAM attribution map targeting EfficientNet-B0 conv_head.
    Restores model state and clears hooks safely.
    """
    device = torch.device(device)
    tensor = image_tensor.clone().to(device).requires_grad_(True)
    model.eval()

    target_layer = model.efficientnet.conv_head

    activations = []
    gradients = []

    def forward_hook(module, inp, outp):
        activations.append(outp)

    def backward_hook(module, grad_in, grad_out):
        gradients.append(grad_out[0])

    f_handle = target_layer.register_forward_hook(forward_hook)
    b_handle = target_layer.register_full_backward_hook(backward_hook)

    try:
        model.zero_grad(set_to_none=True)
        logits = model(tensor)

        if target_class is None:
            target_class = int(logits.argmax(dim=1).item())

        score = logits[0, target_class]
        score.backward()

        act = activations[0].detach()  # Shape: (1, 1280, 7, 7)
        grad = gradients[0].detach()   # Shape: (1, 1280, 7, 7)

        # Global average pooling of gradients
        weights = grad.mean(dim=(2, 3), keepdim=True)
        cam = (weights * act).sum(dim=1, keepdim=True)
        cam = F.relu(cam)
        cam = F.interpolate(cam, size=(224, 224), mode="bilinear", align_corners=False)
        cam_np = cam.squeeze().cpu().numpy()

        cam_min, cam_max = cam_np.min(), cam_np.max()
        cam_norm = (cam_np - cam_min) / (cam_max - cam_min + 1e-8)

        del act, grad, weights, cam, tensor, logits
        return cam_norm
    finally:
        f_handle.remove()
        b_handle.remove()
        model.zero_grad(set_to_none=True)
        gc.collect()


def generate_integrated_gradients(model, image_tensor, target_class=None, steps=15, device="cpu"):
    """
    Generates Integrated Gradients attribution with in-place streaming accumulation
    to avoid memory spikes across interpolation steps.
    """
    device = torch.device(device)
    model.eval()

    input_tensor = image_tensor.clone().to(device)
    baseline = torch.zeros_like(input_tensor)

    if target_class is None:
        with torch.inference_mode():
            logits = model(input_tensor)
            target_class = int(logits.argmax(dim=1).item())

    delta = (input_tensor - baseline).detach()
    accum_grad = torch.zeros_like(input_tensor)

    # Accumulate gradients step by step without storing intermediate graphs
    for step in range(1, steps + 1):
        step_tensor = (baseline + (float(step) / steps) * delta).detach().requires_grad_(True)
        model.zero_grad(set_to_none=True)
        out = model(step_tensor)
        out[0, target_class].backward()
        if step_tensor.grad is not None:
            accum_grad += step_tensor.grad.detach()
        model.zero_grad(set_to_none=True)
        del step_tensor
        del out

    avg_grads = accum_grad / float(steps)
    attr = (delta * avg_grads).abs().sum(dim=1).squeeze().cpu().numpy()

    del accum_grad, avg_grads, delta, input_tensor, baseline
    gc.collect()

    attr_min, attr_max = attr.min(), attr.max()
    ig_norm = (attr - attr_min) / (attr_max - attr_min + 1e-8)
    return ig_norm


def explain_prediction(model, image_tensor, pil_image, target_class=None, device="cpu"):
    """
    Computes both Grad-CAM and Integrated Gradients, returning overlay data URLs.
    Performs explicit cleanup to prevent memory accumulation.
    """
    gradcam_map = generate_gradcam(model, image_tensor, target_class=target_class, device=device)
    ig_map = generate_integrated_gradients(
        model, image_tensor, target_class=target_class, steps=15, device=device
    )

    _, gradcam_data_url = overlay_heatmap(pil_image, gradcam_map, alpha=0.45)
    _, ig_data_url = overlay_heatmap(pil_image, ig_map, alpha=0.40)

    # Free numpy attribution arrays
    del gradcam_map, ig_map
    gc.collect()

    return {
        "gradcam": gradcam_data_url,
        "integratedGradients": ig_data_url,
        "description": "Model attribution heatmaps highlighting visual regions influential to the model's prediction.",
    }
