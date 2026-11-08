import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CheckCircle2, ChevronDown, AlertCircle, Cpu } from 'lucide-react';
import { getStageInfo } from '../data/educationalContent';
import { useLanguage } from '../context/LanguageContext';

const STAGE_PLAIN_DETAILS = {
  NonDemented: {
    plainTitle: 'Healthy — No Signs of Dementia',
    oneLineMeaning: 'Brain tissue volume appears normal for age, with no significant pattern of memory-related shrinkage.',
    nextSteps: [
      'Keep up your regular yearly health and wellness check-ups.',
      'Stay physically active and eat wholesome, balanced meals.',
      'Enjoy regular social activities, reading, and memory games.',
    ],
  },
  VeryMildDemented: {
    plainTitle: 'Early Stage Memory Changes',
    oneLineMeaning: 'Subtle changes are visible that may relate to mild memory lapses, often manageable with daily routines.',
    nextSteps: [
      'Schedule a friendly consultation with your doctor or neurologist.',
      'Use simple daily reminders, like a medicine pill box and wall calendar.',
      'Focus on gentle daily walks and a relaxing sleep routine.',
    ],
  },
  MildDemented: {
    plainTitle: 'Moderate Stage Changes',
    oneLineMeaning: 'Noticeable changes that can affect daily planning and memory, where structured family support is helpful.',
    nextSteps: [
      'Work with a specialist physician to create a personalized care plan.',
      'Keep walkways and living areas clear and well-lit for safety at home.',
      'Connect with caregiver support groups and local family resources.',
    ],
  },
  ModerateDemented: {
    plainTitle: 'Advanced Stage Care Needed',
    oneLineMeaning: 'Significant memory changes where comprehensive daily assistance and caregiver guidance are essential.',
    nextSteps: [
      'Coordinate closely with your healthcare team for day-to-day comfort.',
      'Ensure a calm, familiar, and supportive home environment.',
      'Reach out for caregiver respite support to maintain caregiver well-being.',
    ],
  },
};

export default function PredictionCard({ prediction }) {
  const { t, translateClass } = useLanguage();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  if (!prediction) return null;

  const isOod = Boolean(
    prediction.isOOD ||
    prediction.outOfDistribution ||
    prediction.status === 'ood_rejected' ||
    prediction.predictedClass === 'Out-of-Distribution'
  );

  if (isOod) {
    return (
      <section
        className="panel"
        style={{
          padding: '1.5rem',
          borderLeft: '4px solid var(--stage-4)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
        aria-label="Scan Notice"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <AlertCircle size={22} style={{ color: 'var(--stage-4)' }} aria-hidden="true" />
          <h2 style={{ fontSize: '1.25rem', color: 'var(--stage-4)', margin: 0 }}>
            {t('prediction.ood_title')}
          </h2>
        </div>

        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: '1.55', margin: 0 }}>
          {prediction.message ||
            prediction.oodReason ||
            t('prediction.ood_default_desc')}
        </p>
      </section>
    );
  }

  const {
    predictedClass,
    probabilities,
    stageNumber,
    displayLabel,
  } = prediction;

  const stageInfo = getStageInfo(predictedClass) || {};
  const plainData = STAGE_PLAIN_DETAILS[predictedClass] || STAGE_PLAIN_DETAILS.NonDemented;

  const rawProb = probabilities && Number.isFinite(probabilities[predictedClass]) ? probabilities[predictedClass] : 0;
  const topProb = Number.isFinite(rawProb) ? rawProb : 0;
  const topPercentage = (topProb * 100).toFixed(0);

  // Accessible severity badge background & color
  const stageClassNumber = stageNumber || stageInfo.stageNumber || 1;
  const stageColorVar = `var(--stage-${stageClassNumber})`;
  const stageBgVar = `var(--stage-${stageClassNumber}-bg)`;
  const stageBorderVar = `var(--stage-${stageClassNumber}-border)`;

  return (
    <section
      className="panel"
      aria-label="MRI Scan Results"
      style={{
        padding: '1.5rem 1.75rem',
        borderLeft: `5px solid ${stageColorVar}`,
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Stage Badge (pops in scale 0.9 -> 1) & Plain Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <motion.span
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.85rem',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: stageBgVar,
              color: stageColorVar,
              border: `1px solid ${stageBorderVar}`,
              fontSize: '0.88rem',
              fontWeight: '700',
            }}
          >
            {t('prediction.stage_badge', { number: stageClassNumber })}
          </motion.span>

          <span style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
            {t('prediction.match_percentage', { percent: topPercentage })}
          </span>
        </div>

        <h2
          style={{
            fontSize: '1.65rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginTop: '0.25rem',
            lineHeight: 1.25,
          }}
        >
          {t(`prediction.stages.${predictedClass}.title`, {}, plainData.plainTitle)}
        </h2>

        <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: '1.55', margin: 0 }}>
          {t(`prediction.stages.${predictedClass}.meaning`, {}, plainData.oneLineMeaning)}
        </p>
      </div>

      {/* Actionable "What to Do Next" Checklist */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface-subtle)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          padding: '1.25rem',
        }}
      >
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          <span>{t('prediction.next_steps_heading')}</span>
        </h3>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {(Array.isArray(t(`prediction.stages.${predictedClass}.steps`))
            ? t(`prediction.stages.${predictedClass}.steps`)
            : plainData.nextSteps
          ).map((step, idx) => (
            <li
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                fontSize: '0.98rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              <span
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  flexShrink: 0,
                  marginTop: '2px',
                }}
              >
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Collapsible Technical Details Accordion with smooth height animation & chevron rotate */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setShowTechnicalDetails((prev) => !prev)}
          className="btn-secondary"
          style={{
            width: '100%',
            justifyContent: 'space-between',
            minHeight: '44px',
            padding: '0.6rem 0.85rem',
          }}
          aria-expanded={showTechnicalDetails}
          aria-controls="technical-details-section"
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.92rem' }}>
            <Cpu size={18} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
            <span>{showTechnicalDetails ? t('prediction.hide_tech_details') : t('prediction.show_tech_details')}</span>
          </span>
          <motion.div
            animate={{ rotate: showTechnicalDetails ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <ChevronDown size={18} aria-hidden="true" />
          </motion.div>
        </button>

        <AnimatePresence>
          {showTechnicalDetails && (
            <motion.div
              id="technical-details-section"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem',
                fontSize: '0.88rem',
              }}
            >
              <div style={{ paddingTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                <div style={{ padding: '0.65rem 0.75rem', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('prediction.canonical_class_label')}</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{predictedClass} ({translateClass(predictedClass)})</strong>
                </div>

                <div style={{ padding: '0.65rem 0.75rem', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('prediction.calc_prob_label')}</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{(topProb * 100).toFixed(2)}%</strong>
                </div>

                <div style={{ padding: '0.65rem 0.75rem', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('prediction.model_arch_label')}</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{t('prediction.arch_value')}</strong>
                </div>

                <div style={{ padding: '0.65rem 0.75rem', backgroundColor: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block' }}>{t('prediction.attribution_channels_label')}</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{t('prediction.attribution_value')}</strong>
                </div>
              </div>

              {/* Clean Empty Slot for Future Calibration & Uncertainty UI (Requirement 2) */}
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: 'var(--radius)',
                  border: '1px dashed var(--border-medium)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.88rem',
                  textAlign: 'center',
                }}
              >
                {t('prediction.calibration_note')}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
