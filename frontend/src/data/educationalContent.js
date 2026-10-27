/**
 * Static educational information regarding dementia categories.
 * Note: These are generalized clinical educational descriptions and do NOT infer
 * or describe an individual patient's real symptoms or clinical condition from an image.
 */

export const STAGE_MAP = {
  NonDemented: {
    displayLabel: 'Healthy / Non-Demented Category',
    stageLabel: 'Healthy (Non-Demented)',
    color: '#10b981', // emerald / green
    border: 'rgba(16, 185, 129, 0.35)',
    bg: 'rgba(16, 185, 129, 0.12)',
  },
  VeryMildDemented: {
    displayLabel: 'Very Mild / Possible Early-Stage Category',
    stageLabel: 'Early Stage (Very Mild)',
    color: '#818cf8', // blue / violet
    border: 'rgba(129, 140, 248, 0.35)',
    bg: 'rgba(129, 140, 248, 0.12)',
  },
  MildDemented: {
    displayLabel: 'Mild Dementia Category',
    stageLabel: 'Mild Stage',
    color: '#f59e0b', // amber / orange
    border: 'rgba(245, 158, 11, 0.35)',
    bg: 'rgba(245, 158, 11, 0.12)',
  },
  ModerateDemented: {
    displayLabel: 'Moderate Dementia Category',
    stageLabel: 'Moderate Stage',
    color: '#ef4444', // red / rose
    border: 'rgba(239, 68, 68, 0.35)',
    bg: 'rgba(239, 68, 68, 0.12)',
  },
};

export const CLASS_COLORS = {
  NonDemented: '#10b981', // emerald
  VeryMildDemented: '#818cf8', // blue/violet
  MildDemented: '#f59e0b', // amber
  ModerateDemented: '#ef4444', // red/rose
};

export function getStageInfo(canonicalClass) {
  return (
    STAGE_MAP[canonicalClass] || {
      displayLabel: canonicalClass || 'Unknown',
      stageLabel: 'Unspecified Stage',
      color: '#38bdf8',
      border: 'rgba(56, 189, 248, 0.35)',
      bg: 'rgba(56, 189, 248, 0.12)',
    }
  );
}

export const EDUCATIONAL_DATA = {
  NonDemented: {
    categoryName: 'Healthy / Non-Demented Category',
    stageLabel: 'Healthy (Non-Demented)',
    summary:
      'Brain structural features consistent with the non-demented baseline control group from the research dataset.',
    memory:
      'Normal cognitive functioning with typical age-related changes. Minor retrieval pauses (e.g. searching for a specific name) are common and self-correcting.',
    familiarPeople:
      'Full recognition of immediate family members, friends, colleagues, and community acquaintances.',
    dailyBehaviour:
      'Fully autonomous in daily activities, professional responsibilities, complex financial management, and medication schedules.',
    example:
      'May occasionally misplace reading glasses or walk into a room and briefly forget why, but promptly recovers recall without disorientation.',
    clinicalNotice:
      'Important: "Non-Demented" corresponds to the dataset control cohort. An AI classification of Non-Demented is neither proof of medical health nor an exclusion of subtle or non-structural cognitive conditions.',
  },

  VeryMildDemented: {
    categoryName: 'Very Mild / Possible Early-Stage Category',
    stageLabel: 'Early Stage (Very Mild)',
    summary:
      'Visual features exhibiting subtle structural variations often investigated in early-stage cognitive research cohorts.',
    memory:
      'Mild but noticeable short-term memory lapses, such as repeatedly asking the same question or misplacing objects in unusual spots.',
    familiarPeople:
      'Consistently identifies close family and longtime friends; may occasionally hesitate on names of new acquaintances or distant relatives.',
    dailyBehaviour:
      'Largely independent in basic self-care, though complex planning, managing multi-step schedules, or travel to unfamiliar places may require compensatory notes or mild assistance.',
    example:
      'Forgets details of a conversation that occurred earlier in the week, requiring reminders or relying increasingly on calendar prompts.',
    clinicalNotice:
      'Very mild cognitive alterations can stem from various reversible or neurological factors (sleep, stress, metabolic, or neurodegenerative). Formal neuropsychological evaluation is indispensable.',
  },

  MildDemented: {
    categoryName: 'Mild Dementia Category',
    stageLabel: 'Mild Stage',
    summary:
      'Features characteristic of moderate cortical and hippocampal volume changes seen in mild dementia research scans.',
    memory:
      'Significant retention difficulty for recent events, newly learned instructions, or the date and day of the week.',
    familiarPeople:
      'Recognizes close family members, but may struggle with exact relationship roles or confuse generational relationships (e.g., adult child with a sibling).',
    dailyBehaviour:
      'Noticeable difficulty with instrumental daily living tasks (paying bills, preparing multi-ingredient meals, managing medications correctly). Benefits from structured routines and supervision.',
    example:
      'Frequently loses track of recent conversations and may struggle to navigate unfamiliar driving routes without getting disoriented.',
    clinicalNotice:
      'Mild dementia impacts daily independence and safety. A comprehensive neurological evaluation including cognitive tests and metabolic panels is recommended.',
  },

  ModerateDemented: {
    categoryName: 'Moderate Dementia Category',
    stageLabel: 'Moderate Stage',
    summary:
      'Features consistent with extensive ventricular enlargement and temporal-parietal structural atrophy typical of moderate dementia cohorts.',
    memory:
      'Severe memory impairment extending to personal biography (e.g., home address, past telephone numbers, schooling) and disorientation to current season and year.',
    familiarPeople:
      'May have difficulty naming close family members or spouses, though emotional connection and recognition of familiarity often persist.',
    dailyBehaviour:
      'Requires daily assistance with core activities of daily living (selecting appropriate clothing, meal setup, hygiene reminders, medication administration).',
    example:
      'May wander or become anxious and disoriented even within the home environment, requiring continuous supportive care and protective oversight.',
    clinicalNotice:
      'Moderate dementia requires multidisciplinary medical, psychiatric, and caregiver support to preserve quality of life and safety.',
  },
};
