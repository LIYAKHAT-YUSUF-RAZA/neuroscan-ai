import React from 'react';
import {
  HeartHandshake,
  MessageCircle,
  Home,
  AlertOctagon,
  BookOpen,
  LifeBuoy,
  PhoneCall,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import WhyRecommendationCallout from './WhyRecommendationCallout';
import { getStageRecommendations } from '../data/stageRecommendations';
import { RED_FLAG_SYMPTOMS } from '../data/lifestyleContent';
import { useLanguage } from '../context/LanguageContext';

export default function CaregiverSupport({ prediction, preferences }) {
  const { t, translateStage } = useLanguage();
  const stageNumber = prediction?.stageNumber || 1;
  const stageRecs = getStageRecommendations(stageNumber);
  const careGuidance = stageRecs.caregiverGuidance;

  const communicationTips = [
    {
      title: 'Keep Sentences Simple & Direct',
      detail: 'Ask one question at a time and allow extra seconds for cognitive processing without interrupting or rushing.',
    },
    {
      title: 'Maintain Warm, Reassuring Eye Contact',
      detail: 'Position yourself at eye level and use a calm, gentle tone. Non-verbal emotional cues provide vital orientation.',
    },
    {
      title: 'Validate Feelings, Avoid Direct Confrontation',
      detail: 'If a memory is inaccurate, acknowledge the underlying emotion rather than arguing or repeatedly fact-correcting.',
    },
    {
      title: 'Incorporate Visual & Sensory Prompts',
      detail: 'Point toward objects or gently guide actions rather than relying solely on lengthy verbal directions.',
    },
  ];

  const homeSafetyTips = [
    {
      title: 'Clear Environmental Wayfinding',
      detail: 'Place simple text or picture labels on key doors (Bathroom, Bedroom, Kitchen) and frequently used closets.',
    },
    {
      title: 'Simplify Daily Choices',
      detail: 'Keep countertops clutter-free. Offer choices between two options (e.g. two shirts or two fruits) rather than an open-ended selection.',
    },
    {
      title: 'Secure Household Hazards',
      detail: 'Safeguard cleaning agents, sharp cutlery, and power tools. Consider stove safety shutoff knobs or covers.',
    },
    {
      title: 'Emergency Contact Index Card',
      detail: 'Keep an updated card near the main phone listing the patient’s physician, hospital emergency desk, and primary caregiver phone.',
    },
  ];

  return (
    <div
      className="panel"
      id="caregiver-support"
      style={{
        padding: '1.5rem',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--primary-light)',
              border: '1px solid var(--primary-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <HeartHandshake size={18} aria-hidden="true" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            {t('wellness.caregiver_sub_title')}
          </h2>
          <span
            className="badge"
            style={{
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              border: '1px solid var(--primary-border)',
              fontSize: '0.8rem',
              fontWeight: '600',
            }}
          >
            Stage {stageRecs.stageNumber}: {translateStage(stageRecs.stageNumber) || stageRecs.displayLabel}
          </span>
        </div>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
          {t('wellness.caregiver_sub_desc')}
        </p>
      </div>

      {/* "Why this recommendation?" Callout */}
      <WhyRecommendationCallout stageNumber={stageRecs.stageNumber} moduleType="caregiver" />

      {/* Stage-Specific Caregiver Role & Principles */}
      <div
        style={{
          padding: '1.15rem 1.25rem',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderLeft: `4px solid ${stageRecs.badgeColor || 'var(--primary)'}`,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} style={{ color: 'var(--primary)' }} />
            <strong style={{ fontSize: '0.96rem', color: 'var(--text-primary)' }}>
              {careGuidance.title}
            </strong>
          </div>
          <span
            className="badge"
            style={{
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              border: '1px solid var(--primary-border)',
              fontSize: '0.78rem',
              fontWeight: '600',
            }}
          >
            Role: {careGuidance.role}
          </span>
        </div>

        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          {careGuidance.principles.map((p, idx) => (
            <li key={idx} style={{ marginTop: '0.25rem' }}>
              {p}
            </li>
          ))}
        </ul>
      </div>

      {/* Grid: Communication & Home Safety */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
        
        {/* Communication Strategies */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageCircle size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Compassionate Communication Techniques
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {communicationTips.map((tip, idx) => (
              <div key={idx} style={{ fontSize: '0.88rem', lineHeight: '1.45' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{tip.title}: </strong>
                <span style={{ color: 'var(--text-secondary)' }}>{tip.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Safe Home Environment */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Home size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Safe Home Environmental Adaptations
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {homeSafetyTips.map((tip, idx) => (
              <div key={idx} style={{ fontSize: '0.88rem', lineHeight: '1.45' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{tip.title}: </strong>
                <span style={{ color: 'var(--text-secondary)' }}>{tip.detail}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Caregiver Respite & ARDSI Helpline Callout */}
      <div
        style={{
          padding: '1.15rem 1.25rem',
          backgroundColor: 'var(--primary-light)',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <LifeBuoy size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <h3 style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Alzheimer&apos;s & Related Disorders Society of India (ARDSI)
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              National dementia caregiver support network, local chapters, and family counseling.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <a
            href="tel:+919846198471"
            className="btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', gap: '0.4rem' }}
          >
            <PhoneCall size={14} style={{ color: 'var(--primary)' }} />
            <span>+91-98461-98471</span>
          </a>
          <a
            href="https://ardsi.org"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', gap: '0.35rem' }}
          >
            <span>Visit ARDSI</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Red-Flag Symptoms Warning */}
      <div
        role="alert"
        style={{
          padding: '1.15rem 1.25rem',
          backgroundColor: 'var(--stage-4-bg)',
          border: '1px solid var(--stage-4-border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertOctagon size={18} style={{ color: 'var(--stage-4)' }} />
          <h3 style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--stage-4)', margin: 0 }}>
            Acute Red-Flag Symptoms Requiring Immediate Emergency Medical Evaluation
          </h3>
        </div>

        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.88rem', color: 'var(--stage-4)', lineHeight: '1.5' }}>
          {RED_FLAG_SYMPTOMS.map((symptom, idx) => (
            <li key={idx} style={{ marginTop: '0.25rem' }}>
              {symptom}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
