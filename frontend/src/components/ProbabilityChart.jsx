import React from 'react';
import { BarChart2 } from 'lucide-react';
import { getStageInfo } from '../data/educationalContent';

// Canonical class ordering (MUST NOT BE CHANGED OR SORTED ALPHABETICALLY)
const ORDERED_CLASSES = [
  'MildDemented',
  'ModerateDemented',
  'NonDemented',
  'VeryMildDemented',
];

export default function ProbabilityChart({ probabilities, predictedClass }) {
  if (!probabilities) return null;

  return (
    <div
      className="panel"
      style={{
        padding: '1.25rem 1.45rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.95rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <BarChart2 size={16} color="#38bdf8" />
          <h3 style={{ fontSize: '0.92rem', fontWeight: '600', color: '#f8fafc', margin: 0 }}>
            Category Probability Distribution
          </h3>
        </div>
        <span
          className="badge"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.68rem',
          }}
        >
          Softmax Normalized
        </span>
      </div>

      {/* 4 Probability Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {ORDERED_CLASSES.map((className, index) => {
          const prob = probabilities[className] || 0;
          const percentage = (prob * 100).toFixed(2);
          const isWinner = className === predictedClass;
          const stageInfo = getStageInfo(className);
          const barColor = isWinner ? stageInfo.color : 'rgba(148, 163, 184, 0.35)';

          return (
            <div key={className} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              
              {/* Row: Index, Category, Stage, (Winner Tag), Numbers */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    #{index}
                  </span>
                  <span style={{ fontWeight: isWinner ? '600' : '400', color: isWinner ? '#ffffff' : '#cbd5e1' }}>
                    {stageInfo.displayLabel}
                  </span>

                  {/* Stage Badge */}
                  <span
                    className="badge"
                    style={{
                      background: stageInfo.bg,
                      color: stageInfo.color,
                      border: `1px solid ${stageInfo.border}`,
                      fontSize: '0.67rem',
                      padding: '0.1rem 0.45rem',
                      fontWeight: '600',
                    }}
                  >
                    {stageInfo.stageLabel}
                  </span>

                  {/* Winning class tag */}
                  {isWinner && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: '700',
                        color: stageInfo.color,
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: `1px solid ${stageInfo.border}`,
                        padding: '0.08rem 0.4rem',
                        borderRadius: 'var(--radius-xs)',
                      }}
                    >
                      Top Prediction
                    </span>
                  )}
                </div>

                {/* Numeric scores */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                    ({prob.toFixed(4)})
                  </span>
                  <span
                    style={{
                      fontWeight: '700',
                      fontFamily: 'var(--font-mono)',
                      color: isWinner ? stageInfo.color : '#e2e8f0',
                      fontSize: '0.88rem',
                    }}
                  >
                    {percentage}%
                  </span>
                </div>
              </div>

              {/* Crisp Progress Bar */}
              <div className="progress-bar-bg">
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${Math.max(Number(percentage), 0.6)}%`,
                    background: barColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanatory Footnote */}
      <p style={{ fontSize: '0.73rem', color: '#64748b', lineHeight: '1.45', margin: 0, paddingTop: '0.25rem' }}>
        * Class mapping fixed to trained model indices (0: Mild, 1: Moderate, 2: NonDemented, 3: VeryMild).
        Output values represent softmax probabilities across dataset classes, not clinically calibrated risk scores.
      </p>
    </div>
  );
}
