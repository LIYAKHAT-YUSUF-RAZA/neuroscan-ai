/**
 * Static educational information regarding dementia categories.
 * Note: These are generalized clinical educational descriptions and do NOT infer
 * or describe an individual patient's real symptoms or clinical condition from an image.
 */

export const STAGE_MAP = {
  NonDemented: {
    stageNumber: 1,
    displayLabel: 'Healthy / No Dementia Detected',
    stageLabel: 'Healthy / No Dementia Detected',
    alertLevel: 'info',
    color: '#15803D', // high-contrast dark green
    border: '#BBF7D0',
    bg: '#F0FDF4',
    canonicalClass: 'NonDemented',
  },
  VeryMildDemented: {
    stageNumber: 2,
    displayLabel: 'Early Stage',
    stageLabel: 'Early Stage',
    alertLevel: 'warning',
    color: '#0369A1', // high-contrast dark sky/blue
    border: '#BAE6FD',
    bg: '#F0F9FF',
    canonicalClass: 'VeryMildDemented',
  },
  MildDemented: {
    stageNumber: 3,
    displayLabel: 'Moderate Stage',
    stageLabel: 'Moderate Stage',
    alertLevel: 'caution',
    color: '#B45309', // high-contrast dark amber
    border: '#FDE68A',
    bg: '#FFFBEB',
    canonicalClass: 'MildDemented',
  },
  ModerateDemented: {
    stageNumber: 4,
    displayLabel: 'Critical Stage',
    stageLabel: 'Critical Stage',
    alertLevel: 'critical',
    color: '#B91C1C', // high-contrast dark red
    border: '#FECACA',
    bg: '#FEF2F2',
    canonicalClass: 'ModerateDemented',
  },
};

// Sequential presentation spectrum (Stage 1 -> Stage 4)
export const ORDERED_STAGES = [
  STAGE_MAP.NonDemented,
  STAGE_MAP.VeryMildDemented,
  STAGE_MAP.MildDemented,
  STAGE_MAP.ModerateDemented,
];

export const CLASS_COLORS = {
  NonDemented: '#15803D',
  VeryMildDemented: '#0369A1',
  MildDemented: '#B45309',
  ModerateDemented: '#B91C1C',
};


export function getStageInfo(canonicalClass) {
  return (
    STAGE_MAP[canonicalClass] || {
      stageNumber: 1,
      displayLabel: canonicalClass || 'Unknown Category',
      stageLabel: canonicalClass || 'Unspecified Stage',
      alertLevel: 'info',
      color: '#38bdf8',
      border: 'rgba(56, 189, 248, 0.35)',
      bg: 'rgba(56, 189, 248, 0.12)',
      canonicalClass: canonicalClass || 'Unknown',
    }
  );
}

export const EDUCATIONAL_DATA = {
  NonDemented: {
    stageNumber: 1,
    categoryName: 'Healthy / No Dementia Detected',
    canonicalClass: 'NonDemented',
    summary:
      "No dementia-class pattern was identified by this classifier. This does not rule out Alzheimer's disease or other neurological conditions.",
    memory:
      'Normal cognitive functioning with typical age-related changes. Minor retrieval pauses (e.g. searching for a specific name) are common and self-correcting.',
    familiarPeople:
      'Consistently recognizes immediate family members, friends, colleagues, and community acquaintances.',
    dailyBehaviour:
      'Fully autonomous in daily activities, professional responsibilities, complex financial management, and medication schedules.',
    example:
      'May occasionally misplace reading glasses or walk into a room and briefly forget why, but promptly recovers recall without disorientation.',
    clinicalNotice:
      'Important: "NonDemented" corresponds to the dataset control cohort. An AI classification of Healthy is neither medical proof of health nor an exclusion of subtle, non-structural, or early-stage cognitive conditions.',
    recommendations: [
      'Maintain a balanced and nutritious diet.',
      'Perform regular physical activity.',
      'Maintain a consistent sleep routine.',
      'Engage in brain-stimulating and social activities.',
    ],
  },

  VeryMildDemented: {
    stageNumber: 2,
    categoryName: 'Early Stage',
    canonicalClass: 'VeryMildDemented',
    summary:
      'Corresponds to the VeryMildDemented category in the training dataset. Clinical neuropsychological tracking may be appropriate if concerns exist.',
    memory:
      'Subtle short-term memory lapses, such as asking repetitive questions or forgetting recent conversations within a short timeframe.',
    familiarPeople:
      'Consistently identifies close family and longtime friends; may occasionally hesitate on names of newer acquaintances or distant relatives.',
    dailyBehaviour:
      'Capable of independent daily living, though complex planning, managing multi-step schedules, or detailed paperwork may show mild errors.',
    example:
      'Forgets the location of recently placed items or repeats stories within a short timeframe without realizing it.',
    clinicalNotice:
      'Very mild cognitive variations can stem from diverse reversible or neurological factors (sleep disruption, stress, thyroid imbalance, vitamin B12 deficiency). Formal neuropsychological evaluation is recommended.',
    recommendations: [
      'Practice simple memory exercises.',
      'Use calendars, reminders, and written notes.',
      'Follow a consistent daily routine.',
      'Consider a professional memory or neurological evaluation.',
    ],
  },

  MildDemented: {
    stageNumber: 3,
    categoryName: 'Moderate Stage',
    canonicalClass: 'MildDemented',
    summary:
      'Corresponds to the MildDemented category in the training dataset. Professional neurological assessment is recommended if symptoms or concerns are present.',
    memory:
      'Clear difficulty retaining recently learned information, appointment dates, or names of common objects and tools.',
    familiarPeople:
      'Recognizes immediate family members, though may occasionally confuse generational relationships (e.g., an adult child with a sibling).',
    dailyBehaviour:
      'May require reminders or structured checklists for bills, complex cooking, or navigating unfamiliar environments.',
    example:
      'Forgets recent conversations completely and struggles to follow multi-step recipes or route directions without getting disoriented.',
    clinicalNotice:
      'Mild dementia impairs instrumental activities of daily living and warrants comprehensive neurological examination and cognitive assessment.',
    recommendations: [
      'Get assistance with difficult daily activities when needed.',
      'Practice simple, guided activities.',
      'Encourage family or caregiver involvement.',
      'Maintain regular specialist follow-up.',
    ],
  },

  ModerateDemented: {
    stageNumber: 4,
    categoryName: 'Critical Stage',
    canonicalClass: 'ModerateDemented',
    summary:
      'Corresponds to the highest-severity category in the four-class training dataset. Prompt specialist assessment is advised. This prediction does not establish critical clinical pathology.',
    memory:
      'Substantial gaps in memory, difficulty recalling personal history (e.g., home address, past schools), and disorientation to time and date.',
    familiarPeople:
      'May frequently misidentify or struggle to recall names of close relatives, though emotional connection and recognition of familiarity often persist.',
    dailyBehaviour:
      'Requires regular assistance with daily personal care, including dressing properly for the weather, hygiene reminders, and meal setup.',
    example:
      'Wanders or becomes confused in familiar surroundings and requires compassionate full-time supervisory support.',
    clinicalNotice:
      'Moderate dementia significantly impacts daily living and safety, requiring multidisciplinary medical, psychiatric, and caregiver support.',
    recommendations: [
      'Provide assistance with personal care and daily activities when needed.',
      'Maintain a safe home environment and reduce fall risks.',
      'Encourage caregiver involvement and support.',
      'Obtain specialist-led individualized care planning.',
    ],
  },
};
