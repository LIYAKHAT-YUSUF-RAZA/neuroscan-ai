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
    "NonDemented": "Healthy / No Dementia Detected",
    "VeryMildDemented": "Early Stage",
    "MildDemented": "Moderate Stage",
    "ModerateDemented": "Critical Stage",
}

STAGE_NUMBERS = {
    "NonDemented": 1,
    "VeryMildDemented": 2,
    "MildDemented": 3,
    "ModerateDemented": 4,
}

ALERT_LEVELS = {
    "NonDemented": "info",
    "VeryMildDemented": "warning",
    "MildDemented": "caution",
    "ModerateDemented": "critical",
}

STAGE_RECOMMENDATIONS = {
    "NonDemented": [
        "Maintain a balanced and nutritious diet.",
        "Perform regular physical activity.",
        "Maintain a consistent sleep routine.",
        "Engage in brain-stimulating and social activities."
    ],
    "VeryMildDemented": [
        "Practice simple memory exercises.",
        "Use calendars, reminders, and written notes.",
        "Follow a consistent daily routine.",
        "Consider a professional memory or neurological evaluation."
    ],
    "MildDemented": [
        "Get assistance with difficult daily activities when needed.",
        "Practice simple, guided activities.",
        "Encourage family or caregiver involvement.",
        "Maintain regular specialist follow-up."
    ],
    "ModerateDemented": [
        "Provide assistance with personal care and daily activities when needed.",
        "Maintain a safe home environment and reduce fall risks.",
        "Encourage caregiver involvement and support.",
        "Obtain specialist-led individualized care planning."
    ],
}

# Educational category guidance (general informational content, not patient-specific diagnosis)
EDUCATIONAL_EXPLANATIONS = {
    "NonDemented": {
        "summary": "No dementia-class pattern was identified by this classifier. This does not rule out Alzheimer's disease or other neurological conditions.",
        "memory": "Typical age-related recall variations without significant progressive memory impairment.",
        "familiarPeopleRecognition": "Consistently recognizes family, friends, and familiar faces.",
        "dailyBehaviour": "Maintains independence in personal finances, medication management, and daily routines.",
        "example": "May occasionally misplace keys or forget a name briefly, but recalls it later without confusion.",
        "clinicalNote": "The NonDemented category represents the dataset control cohort, not medical proof of absolute cognitive health.",
    },
    "VeryMildDemented": {
        "summary": "Corresponds to the VeryMildDemented category in the training dataset. Clinical neuropsychological tracking may be appropriate if concerns exist.",
        "memory": "Subtle short-term memory lapses, such as asking repetitive questions or forgetting recent events.",
        "familiarPeopleRecognition": "Retains intact recognition of close relatives and friends; may occasionally hesitate with newer acquaintances.",
        "dailyBehaviour": "Capable of independent daily living, though complex tasks like tax filing or detailed scheduling may show mild errors.",
        "example": "Forgets the location of recently placed items or repeats stories within a short timeframe.",
        "clinicalNote": "Very mild signs require comprehensive clinical neuropsychological testing and longitudinal tracking.",
    },
    "MildDemented": {
        "summary": "Corresponds to the MildDemented category in the training dataset. Professional neurological assessment is recommended if symptoms or concerns are present.",
        "memory": "Clear difficulty retaining recently learned information, appointment dates, or names of common objects.",
        "familiarPeopleRecognition": "Recognizes immediate family members, though may occasionally confuse relationships or extended relatives.",
        "dailyBehaviour": "May require reminders or structured checklists for bills, complex cooking, or navigating unfamiliar environments.",
        "example": "Forgets recent conversations completely and struggles to follow multi-step recipes or route directions.",
        "clinicalNote": "Mild dementia impairs instrumental activities of daily living and warrants professional neurological care.",
    },
    "ModerateDemented": {
        "summary": "Corresponds to the highest-severity category in the four-class training dataset. Prompt specialist assessment is advised. This prediction does not establish critical clinical pathology.",
        "memory": "Substantial gaps in memory, difficulty recalling personal history (e.g., home address, past schools), and disorientation to time.",
        "familiarPeopleRecognition": "May frequently misidentify or struggle to recall names of close relatives, though still recognizes emotional familiarity.",
        "dailyBehaviour": "Requires regular assistance with daily personal care, including dressing properly for weather and meal preparation.",
        "example": "Wanders or becomes confused in familiar surroundings and requires compassionate full-time supervisory support.",
        "clinicalNote": "Moderate dementia significantly impacts safety and daily living, requiring multidisciplinary healthcare support.",
    },
}

DISCLAIMER_TEXT = (
    "NeuroScan AI is an experimental research prototype. Its predictions represent classifications "
    "learned from a specific MRI training dataset and are not clinical diagnoses or validated disease stages. "
    "Model probabilities do not represent the probability that a patient has Alzheimer's disease. "
    "Grad-CAM and Integrated Gradients show computational model attribution, not confirmed clinical abnormalities. "
    "Consult a qualified healthcare professional for medical evaluation."
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
    stage_number = STAGE_NUMBERS[predicted_class]
    alert_level = ALERT_LEVELS[predicted_class]
    recommendations = STAGE_RECOMMENDATIONS.get(predicted_class, [])
    educational_explanation = EDUCATIONAL_EXPLANATIONS.get(predicted_class, {}).get("summary", "")

    # Map probabilities strictly in the canonical order
    prob_dict = {
        name: float(round(probabilities[i], 6))
        for i, name in enumerate(CLASS_NAMES)
    }

    return {
        "predictedClass": predicted_class,
        "predictedIndex": pred_idx,
        "stageLabel": stage_label,
        "stageNumber": stage_number,
        "displayLabel": stage_label,
        "alertLevel": alert_level,
        "probabilities": prob_dict,
        "rawLogits": [float(round(v, 4)) for v in logits.squeeze(0).cpu().tolist()],
        "explanations": EDUCATIONAL_EXPLANATIONS.get(predicted_class, {}),
        "educationalExplanation": educational_explanation,
        "recommendations": recommendations,
        "disclaimer": DISCLAIMER_TEXT,
    }
