"""
Inference pipeline, preprocessing, and category metadata for Alzheimer's MRI Classification.
Preserves exact class order and evaluation parameters.
"""

import io
import torch
from torchvision import transforms
from PIL import Image

# Preserved exact class index mapping
CLASS_NAMES = [
    "MildDemented",
    "ModerateDemented",
    "NonDemented",
    "VeryMildDemented",
]

STAGE_LABELS = {
    "MildDemented": "Mild Dementia Category",
    "ModerateDemented": "Moderate Dementia Category",
    "NonDemented": "Healthy / Non-Demented Category",
    "VeryMildDemented": "Very Mild / Possible Early-Stage Category",
}

# Educational category guidance (general informational content, not patient-specific diagnosis)
EDUCATIONAL_EXPLANATIONS = {
    "NonDemented": {
        "memory": "Typical age-related recall variations without significant progressive memory impairment.",
        "familiarPeopleRecognition": "Consistently recognizes family, friends, and familiar faces.",
        "dailyBehaviour": "Maintains independence in personal finances, medication management, and daily routines.",
        "example": "May occasionally misplace keys or forget a name briefly, but recalls it later without confusion.",
        "clinicalNote": "The NonDemented category represents the dataset control cohort, not medical proof of absolute cognitive health.",
    },
    "VeryMildDemented": {
        "memory": "Subtle short-term memory lapses, such as asking repetitive questions or forgetting recent events.",
        "familiarPeopleRecognition": "Retains intact recognition of close relatives and friends; may occasionally hesitate with newer acquaintances.",
        "dailyBehaviour": "Capable of independent daily living, though complex tasks like tax filing or detailed scheduling may show mild errors.",
        "example": "Forgets the location of recently placed items or repeats stories within a short timeframe.",
        "clinicalNote": "Very mild signs require comprehensive clinical neuropsychological testing and longitudinal tracking.",
    },
    "MildDemented": {
        "memory": "Clear difficulty retaining recently learned information, appointment dates, or names of common objects.",
        "familiarPeopleRecognition": "Recognizes immediate family members, though may occasionally confuse relationships or extended relatives.",
        "dailyBehaviour": "May require reminders or structured checklists for bills, complex cooking, or navigating unfamiliar environments.",
        "example": "Forgets recent conversations completely and struggles to follow multi-step recipes or route directions.",
        "clinicalNote": "Mild dementia impairs instrumental activities of daily living and warrants professional neurological care.",
    },
    "ModerateDemented": {
        "memory": "Substantial gaps in memory, difficulty recalling personal history (e.g., home address, past schools), and disorientation to time.",
        "familiarPeopleRecognition": "May frequently misidentify or struggle to recall names of close relatives, though still recognizes emotional familiarity.",
        "dailyBehaviour": "Requires regular assistance with daily personal care, including dressing properly for weather and meal preparation.",
        "example": "Wanders or becomes confused in familiar surroundings and requires compassionate full-time supervisory support.",
        "clinicalNote": "Moderate dementia significantly impacts safety and daily living, requiring multidisciplinary healthcare support.",
    },
}

DISCLAIMER_TEXT = (
    "Research prototype only; not a medical diagnostic tool. Predictions and visualizations "
    "are experimental computational attributions and must never be interpreted as a clinical diagnosis, "
    "prognosis, or treatment decision. The NonDemented class is a dataset control category, not medical "
    "proof of health. MRI interpretations require qualified medical professional evaluation."
)

# Standard inference preprocessing transforms
INFERENCE_TRANSFORMS = transforms.Compose([
    transforms.Resize((224, 224), interpolation=transforms.InterpolationMode.BILINEAR),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


def preprocess_image(image_input):
    """
    Decodes and preprocesses an image for AlzheimerNetHybrid inference.
    Accepts bytes, file-like object, or PIL Image.
    Returns:
        tensor: torch.Tensor of shape (1, 3, 224, 224)
        pil_image: PIL Image resized to (224, 224) RGB (for heatmap overlays)
    """
    if isinstance(image_input, bytes):
        pil_image = Image.open(io.BytesIO(image_input))
    elif hasattr(image_input, "read"):
        pil_image = Image.open(image_input)
    elif isinstance(image_input, Image.Image):
        pil_image = image_input
    else:
        raise ValueError(f"Unsupported image input type: {type(image_input)}")

    # Ensure RGB conversion
    rgb_image = pil_image.convert("RGB")

    # Keep a resized PIL copy for visualization overlays
    resized_pil = rgb_image.resize((224, 224), Image.Resampling.BILINEAR)

    # Tensor representation
    tensor = INFERENCE_TRANSFORMS(rgb_image).unsqueeze(0)  # Shape: (1, 3, 224, 224)
    return tensor, resized_pil


def predict(model, image_tensor, device="cpu"):
    """
    Executes model inference in evaluation mode without gradients.
    Returns structured prediction dictionary with softmax probabilities.
    """
    model.eval()
    device = torch.device(device)
    tensor = image_tensor.to(device)

    with torch.inference_mode():
        logits = model(tensor)
        probabilities = torch.softmax(logits, dim=1).squeeze(0).cpu().tolist()

    pred_idx = int(torch.argmax(logits, dim=1).item())
    predicted_class = CLASS_NAMES[pred_idx]
    stage_label = STAGE_LABELS[predicted_class]

    # Map probabilities strictly in the canonical order
    prob_dict = {
        name: float(round(probabilities[i], 6))
        for i, name in enumerate(CLASS_NAMES)
    }

    return {
        "predictedClass": predicted_class,
        "predictedIndex": pred_idx,
        "stageLabel": stage_label,
        "probabilities": prob_dict,
        "rawLogits": [float(round(v, 4)) for v in logits.squeeze(0).cpu().tolist()],
        "explanations": EDUCATIONAL_EXPLANATIONS.get(predicted_class, {}),
        "disclaimer": DISCLAIMER_TEXT,
    }
