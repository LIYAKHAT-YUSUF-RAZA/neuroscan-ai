import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Sparkles, ShieldCheck } from 'lucide-react';
import { getWhyThisRecommendation, getStageRecommendations } from '../data/stageRecommendations';
import { useLanguage } from '../context/LanguageContext';

export default function WhyRecommendationCallout({
  stageNumber = 1,
  moduleType = 'general',
  compact = false,
}) {
  const { t, translateStage } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const recData = getWhyThisRecommendation(stageNumber, moduleType);
  const stage = getStageRecommendations(stageNumber);

  return (
    <div
      style={{
        background: 'var(--primary-light)',
        border: '1px solid var(--primary-border)',
        borderRadius: 'var(--radius-sm)',
        padding: compact ? '0.6rem 0.85rem' : '0.85rem 1.15rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <Sparkles size={15} color="var(--primary)" />
          <span style={{ fontSize: '0.84rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            {t('wellness.why_title')}
          </span>
          <span
            className="badge"
            style={{
              background: 'var(--bg-surface)',
              color: stage.badgeColor || 'var(--primary)',
              border: '1px solid var(--border)',
              fontSize: '0.72rem',
              fontWeight: '600',
              padding: '0.15rem 0.5rem',
            }}
          >
            Stage {stage.stageNumber}: {translateStage(stage.stageNumber) || stage.displayLabel}
          </span>
        </div>

        <button
          type="button"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
            fontSize: '0.75rem',
            fontWeight: '600',
          }}
          aria-label={isExpanded ? 'Collapse explanation' : 'Expand explanation'}
        >
          <span>{isExpanded ? (t('common.less') || 'Less') : (t('common.details') || 'Details')}</span>
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
        {recData.explanation}
      </p>

      {isExpanded && (
        <div
          style={{
            paddingTop: '0.5rem',
            marginTop: '0.25rem',
            borderTop: '1px solid var(--primary-border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.45rem',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            lineHeight: '1.45',
          }}
        >
          <ShieldCheck size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{recData.disclaimer}</span>
        </div>
      )}
    </div>

  );
}
