"""
Model architecture and checkpoint loader for Alzheimer's MRI Classification.
Preserves the exact hybrid architecture: EfficientNet-B0 + Swin-Small.
Includes memory optimizations (eager garbage collection, explicit dereferencing).
"""

import os
import gc
import sys
import torch
import torch.nn as nn
from timm import create_model

NUM_CLASSES = 4


class AlzheimerNetHybrid(nn.Module):
    """
    Hybrid feature extractor model combining EfficientNet-B0 and Swin-Small.
    Concatenates 1280 EfficientNet features and 768 Swin features -> Linear(2048, 4).
    """

    def __init__(self, num_classes=NUM_CLASSES):
        super(AlzheimerNetHybrid, self).__init__()

        # Feature extractor 1: EfficientNet-B0 (num_classes=0 returns feature vector of dim 1280)
        self.efficientnet = create_model(
            "efficientnet_b0",
            pretrained=False,
            num_classes=0,
        )
        effnet_features = self.efficientnet.num_features  # 1280

        # Feature extractor 2: Swin-Small (num_classes=0 returns feature vector of dim 768)
        self.swin = create_model(
            "swin_small_patch4_window7_224",
            pretrained=False,
            num_classes=0,
        )
        swin_features = self.swin.num_features  # 768

        self.dropout = nn.Dropout(0.5)
        self.fc = nn.Linear(
            effnet_features + swin_features,
            num_classes,
        )

    def forward(self, x):
        eff_features = self.efficientnet(x)
        swin_features = self.swin(x)
        combined = torch.cat((eff_features, swin_features), dim=1)
        return self.fc(self.dropout(combined))


def load_model(checkpoint_path=None, device="cpu"):
    """
    Safely loads trained checkpoint into AlzheimerNetHybrid architecture.

    Supports raw state dictionary and wrapped checkpoint formats (state_dict, model_state_dict).
    Validates parameter compatibility strictly and raises actionable errors on mismatch.
    Applies explicit memory cleanup to prevent memory spikes.
    """
    if checkpoint_path is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        env_path = os.getenv("MODEL_CHECKPOINT_PATH", "models/best_hybrid_model.pth")
        checkpoint_path = (
            env_path
            if os.path.isabs(env_path)
            else os.path.normpath(os.path.join(base_dir, env_path))
        )

    if not os.path.isfile(checkpoint_path):
        raise FileNotFoundError(
            f"Model checkpoint not found at '{checkpoint_path}'. "
            "Please ensure 'best_hybrid_model.pth' is placed in 'ai-service/models/'."
        )

    device = torch.device(device)
    num_threads = int(os.getenv("TORCH_NUM_THREADS", "2"))
    torch.set_num_threads(num_threads)
    print(f"[ModelLoader] Loading checkpoint from: {checkpoint_path} onto {device} (threads={num_threads})")

    # Run GC before allocation
    gc.collect()

    # Safe deserialization
    try:
        loaded = torch.load(checkpoint_path, map_location=device, weights_only=True)
    except Exception as e:
        print(f"[ModelLoader] Notice: weights_only=True failed ({e}), falling back to weights_only=False")
        loaded = torch.load(checkpoint_path, map_location=device, weights_only=False)

    # Extract state_dict if wrapped
    if isinstance(loaded, dict):
        if "state_dict" in loaded:
            state_dict = loaded["state_dict"]
        elif "model_state_dict" in loaded:
            state_dict = loaded["model_state_dict"]
        elif "model" in loaded and isinstance(loaded["model"], dict):
            state_dict = loaded["model"]
        else:
            state_dict = loaded
    else:
        raise ValueError(
            f"Unexpected checkpoint format: expected state_dict mapping, received {type(loaded)}"
        )

    # Clean known prefixes (e.g., DataParallel 'module.' or TorchDynamo '_orig_mod.')
    cleaned_state_dict = {}
    for key, value in state_dict.items():
        new_key = key
        if new_key.startswith("module."):
            new_key = new_key[len("module."):]
        if new_key.startswith("_orig_mod."):
            new_key = new_key[len("_orig_mod."):]
        cleaned_state_dict[new_key] = value

    # Release loaded and state_dict references
    del loaded
    del state_dict

    model = AlzheimerNetHybrid(num_classes=NUM_CLASSES)

    try:
        load_result = model.load_state_dict(cleaned_state_dict, strict=True)
        print(f"[ModelLoader] Checkpoint loaded successfully: {load_result}")
    except RuntimeError as err:
        raise RuntimeError(
            f"Checkpoint architecture mismatch while loading into AlzheimerNetHybrid: {err}\n"
            "Verify that the checkpoint matches the EfficientNet-B0 + Swin-Small hybrid architecture."
        ) from err
    finally:
        # Eagerly purge the dictionary of raw tensor references
        del cleaned_state_dict
        gc.collect()

    model.to(device)
    model.eval()

    # Final cleanup
    gc.collect()
    return model
