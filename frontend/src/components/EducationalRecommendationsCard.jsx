import React, { useState } from 'react';
import {
  HeartPulse,
  Brain,
  CalendarCheck,
  ShieldCheck,
  Users,
  Stethoscope,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getStageInfo } from '../data/educationalContent';
import { getStageRecommendations, getWhyThisRecommendation } from '../data/stageRecommendations';
import { useLanguage } from '../context/LanguageContext';

export default function EducationalRecommendationsCard({ prediction }) {
  const { t, translateClass } = useLanguage();
  const [isWhyExpanded, setIsWhyExpanded] = useState(true);

  const canonicalClass = prediction?.predictedClass || 'NonDemented';
  const baseStageInfo = getStageInfo(canonicalClass) || {};
  const stageNumber = prediction?.stageNumber || baseStageInfo.stageNumber || 1;
  const stageRecs = getStageRecommendations(stageNumber) || {};

  // Retrieve contextual explanation object with keys: { stageNumber, displayLabel, explanation, disclaimer }
  const whyData = getWhyThisRecommendation(stageNumber) || {};

  // Unified stageInfo safely exposing individual primitive properties
  const stageInfo = {
    ...baseStageInfo,
    stageNumber: whyData.stageNumber || stageNumber,
    displayLabel: whyData.displayLabel || baseStageInfo.displayLabel || 'Healthy / No Dementia Detected',
    explanation: whyData.explanation || '',
    disclaimer: whyData.disclaimer || '',
  };

  // Group recommendations into the 5 user-requested categories
  const categories = [
    {
      id: 'daily',
      title: t('wellness.cat_daily'),
      icon: CalendarCheck,
      color: 'var(--primary)',
      items: (stageRecs.dailyRoutine?.schedule || []).flatMap((phase) =>
        phase.tasks.slice(0, 2).map((tItem) => ({
          title: phase.title,
          text: tItem.text,
          meta: phase.phase,
        }))
      ).slice(0, 3),
    },
    {
      id: 'memory',
      title: t('wellness.cat_memory'),
      icon: Brain,
      color: 'var(--secondary)',
      items: (stageRecs.dailyRoutine?.cognitiveActivities || []).map((act) => ({
        title: act.title,
        text: act.desc,
        meta: act.cadence,
      })),
    },
    {
      id: 'personal',
      title: t('wellness.cat_personal'),
      icon: ShieldCheck,
      color: 'var(--success)',
      items: (stageRecs.dailyRoutine?.safety || []).concat(
        (stageRecs.priorityFocus || []).slice(0, 1).map((f) => ({ title: 'Health Priority', tip: f }))
      ).map((s) => ({
        title: s.title,
        text: s.tip,
        meta: 'Safety & Care',
      })),
    },
    {
      id: 'caregiver',
      title: t('wellness.cat_caregiver'),
      icon: Users,
      color: 'var(--stage-2)',
      items: [
        {
          title: `Caregiver Role: ${stageRecs.caregiverGuidance?.role || 'Support Partner'}`,
          text: stageRecs.caregiverGuidance?.focusAreas?.[0]?.desc || 'Foster positive social engagement, consistent schedules, and compassionate reassurance.',
          meta: 'Support Guidance',
        },
        {
          title: 'Respite & Wellbeing',
          text: 'Caregivers should maintain their own rest, emotional support networks, and shared family caregiving routines.',
          meta: 'Caregiver Health',
        },
      ],
    },
    {
      id: 'followup',
      title: t('wellness.cat_followup'),
      icon: Stethoscope,
      color: 'var(--stage-3)',
      items: [
        {
          title: 'Consultation Timeline',
          text: stageRecs.specialistGuidance?.consultationTiming || 'Schedule routine wellness checkups with your primary care physician.',
          meta: 'Evaluation',
        },
        {
          title: 'Clinical Discussion Points',
          text: stageRecs.specialistGuidance?.notes || 'Bring observations regarding sleep, memory changes, and daily living to clinical reviews.',
          meta: 'Doctor Review',
        },
      ],
    },
  ];

  return (
    <div
      className="panel"
      id="care-guidance"
      style={{
        padding: '1.5rem 1.75rem',
        background: 'var(--panel)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.35rem',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* 1. Header with Category Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <HeartPulse size={22} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
              {t('wellness.title')}
            </h2>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            {t('wellness.subtitle')}
          </p>
        </div>

        <span
          className="badge"
          style={{
            background: stageInfo.bg || 'var(--primary-light)',
            color: stageInfo.color || 'var(--primary)',
            border: `1px solid ${stageInfo.border || 'var(--primary-border)'}`,
            fontSize: '0.78rem',
            fontWeight: '700',
            padding: '0.35rem 0.75rem',
          }}
        >
          Stage {stageInfo.stageNumber}: {translateClass(canonicalClass) || stageInfo.displayLabel}
        </span>
      </div>

      {/* 2. "Why this recommendation?" Explanation */}
      <div
        style={{
          background: 'var(--bg-surface-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setIsWhyExpanded((prev) => !prev)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.92rem',
            fontWeight: '600',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Sparkles size={16} color="var(--primary)" />
            <span>{t('wellness.why_title')}</span>
          </div>
          {isWhyExpanded ? <ChevronUp size={16} color="var(--text-secondary)" /> : <ChevronDown size={16} color="var(--text-secondary)" />}
        </button>

        {isWhyExpanded && (
          <div
            style={{
              padding: '0 1.25rem 1.15rem 1.25rem',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.6',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              borderTop: '1px solid var(--border)',
              paddingTop: '0.85rem',
            }}
          >
            {stageInfo.explanation && (
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                {stageInfo.explanation}
              </p>
            )}
            {stageInfo.disclaimer && (
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {stageInfo.disclaimer}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 3. Five Organized Categories Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {categories.map((cat) => {
          const Icon = cat.icon;

          return (
            <div
              key={cat.id}
              style={{
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.95rem',
                background: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Category Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: cat.color,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <Icon size={17} />
                </div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  {cat.title}
                </h3>
              </div>

              {/* Items in Category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cat.items.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      padding: '0.85rem 1rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      {item.meta && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: '600',
                            color: 'var(--text-secondary)',
                            background: 'var(--bg-surface-subtle)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.meta}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.55' }}>
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Non-Diagnostic Medical Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.65rem',
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          background: 'var(--bg-surface-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          padding: '0.75rem 1rem',
          lineHeight: '1.5',
        }}
      >
        <AlertCircle size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>Research Prototype Notice:</strong> These care recommendations are educational lifestyle suggestions calibrated to dataset presentation categories. They do not constitute clinical diagnoses, medical prognoses, or prescriptions. Consult a licensed medical specialist for individualized diagnostic and treatment decisions.
        </span>
      </div>
    </div>
  );
}

