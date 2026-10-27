import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { getStageInfo, EDUCATIONAL_DATA } from '../data/educationalContent';

export default function PredictionCard({ prediction }) {
  if (!prediction) return null;

  const { predictedClass, probabilities } = prediction;
  const stageInfo = getStageInfo(predictedClass);
  const color = stageInfo.color;
  const topProb = probabilities ? probabilities[predictedClass] : 0;
  const topPercentage = (topProb * 100).toFixed(1);
  const meta = EDUCATIONAL_DATA[predictedClass];

  return (
    <div
      className="panel"
      style={{
        padding: '1.35rem 1.45rem',
        borderLeft: `3px solid ${color}`,
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* Top Header Row: Category on left, Probability Box on right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ flex: '1 1 240px' }}>
          <span className="section-label">
            Model Classification Result
          </span>
          <h2
            style={{
              fontSize: '1.45rem',
              fontWeight: '700',
              color: '#ffffff',
              margin: '0.2rem 0 0.5rem 0',
              lineHeight: '1.3',
            }}
          >
            {stageInfo.displayLabel}
          </h2>

          {/* Canonical class badge + Stage badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span
              className="badge"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid var(--border-subtle)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.72rem',
              }}
            >
              Class: {predictedClass}
            </span>

            <span
              className="badge"
              style={{
                background: stageInfo.bg,
                color: stageInfo.color,
                border: `1px solid ${stageInfo.border}`,
                fontSize: '0.72rem',
                fontWeight: '600',
              }}
            >
              Stage: {stageInfo.stageLabel}
            </span>
          </div>
        </div>

        {/* Quiet, Well-Proportioned Probability Box */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-surface-muted)',
            padding: '0.65rem 1.15rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            minWidth: '120px',
          }}
        >
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Confidence
          </span>
          <span
            style={{
              fontSize: '1.75rem',
              fontWeight: '700',
              color,
              fontFamily: 'var(--font-mono)',
              lineHeight: '1.2',
              marginTop: '0.1rem',
            }}
          >
            {topPercentage}%
          </span>
          <span style={{ fontSize: '0.66rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
            score: {topProb.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Explanatory Context: Fully visible, natural height, no clipping */}
      {meta?.summary && (
        <div
          style={{
            padding: '0.75rem 0.95rem',
            background: 'var(--bg-surface-muted)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <p style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.5', margin: 0 }}>
            {meta.summary}
          </p>
        </div>
      )}

      {/* Subdued Attribution Footnote */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.72rem',
          color: '#d97706',
        }}
      >
        <AlertTriangle size={12} style={{ flexShrink: 0 }} />
        <span>Research attribution only — model classification does not constitute a diagnostic determination.</span>
      </div>
    </div>
  );
}
