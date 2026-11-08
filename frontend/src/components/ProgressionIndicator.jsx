import React from 'react';
import { ORDERED_STAGES, getStageInfo } from '../data/educationalContent';
import { Layers, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function ProgressionIndicator({ predictedClass }) {
  const { t, translateClass } = useLanguage();
  const currentStageInfo = getStageInfo(predictedClass) || {};
  const activeStageNumber = currentStageInfo.stageNumber || 1;

  return (
    <div
      className="panel"
      role="region"
      aria-label="Four Brain Health Stages Reference"
      style={{
        padding: '1.25rem 1.35rem',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          <h3 style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            {t('prediction.progression.title')}
          </h3>
        </div>

        <span
          style={{
            fontSize: '0.82rem',
            fontWeight: '600',
            color: 'var(--text-muted)',
          }}
        >
          4 Research Categories
        </span>
      </div>

      {/* 4 Stage Reference Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.65rem',
        }}
      >
        {ORDERED_STAGES.map((stage) => {
          const isActive = stage.stageNumber === activeStageNumber;
          const stageColorVar = `var(--stage-${stage.stageNumber})`;
          const stageBgVar = `var(--stage-${stage.stageNumber}-bg)`;
          const stageBorderVar = `var(--stage-${stage.stageNumber}-border)`;

          return (
            <div
              key={stage.stageNumber}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                backgroundColor: isActive ? stageBgVar : 'var(--bg-surface-subtle)',
                border: isActive ? `2px solid ${stageColorVar}` : '1px solid var(--border)',
                transition: 'all 150ms ease-out',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: '700',
                      color: isActive ? stageColorVar : 'var(--text-muted)',
                    }}
                  >
                    Stage {stage.stageNumber}
                  </span>
                  {isActive && <CheckCircle2 size={16} style={{ color: stageColorVar }} aria-hidden="true" />}
                </div>

                <div
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: isActive ? '700' : '600',
                    color: 'var(--text-primary)',
                    lineHeight: '1.3',
                  }}
                >
                  {translateClass(stage.canonicalClass) || stage.displayLabel}
                </div>
              </div>

              <div
                style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {stage.canonicalClass}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
        {t('prediction.explanation.disclaimer')}
      </p>
    </div>
  );
}
