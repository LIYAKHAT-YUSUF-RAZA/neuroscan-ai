import React, { useState, useEffect } from 'react';
import { BarChart3 } from 'lucide-react';
import { getStageInfo } from '../data/educationalContent';
import { useLanguage } from '../context/LanguageContext';

// Canonical class ordering (MUST NOT BE CHANGED OR RE-ORDERED)
const ORDERED_CLASSES = [
  'MildDemented',
  'ModerateDemented',
  'NonDemented',
  'VeryMildDemented',
];

// Smooth count-up component for animated percentage
function AnimatedPercent({ target, duration = 600 }) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let start = null;
    let animId;
    const targetNum = Number(target) || 0;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(eased * targetNum);
      if (progress < 1) {
        animId = requestAnimationFrame(step);
      }
    };
    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [target, duration]);

  return <span>{val.toFixed(1)}%</span>;
}

export default function ProbabilityChart({ probabilities, predictedClass }) {
  const { t, translateClass } = useLanguage();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger smooth 600ms entrance animation
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, [probabilities]);

  if (!probabilities) return null;

  return (
    <div
      className="panel"
      role="region"
      aria-label={t('prediction.chart.title')}
      style={{
        padding: '1.35rem 1.5rem',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            {t('prediction.chart.title')}
          </h3>
        </div>
        <span
          style={{
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            backgroundColor: 'var(--bg-surface-subtle)',
            padding: '0.2rem 0.55rem',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--border)',
          }}
        >
          {t('prediction.chart.normalized_score')}
        </span>
      </div>

      {/* 4 Probability Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {ORDERED_CLASSES.map((className) => {
          const rawVal = probabilities ? probabilities[className] : 0;
          const prob = typeof rawVal === 'number' && Number.isFinite(rawVal) ? rawVal : 0;
          const percentage = (prob * 100).toFixed(1);
          const isWinner = className === predictedClass;
          const stageInfo = getStageInfo(className) || {};
          const stageClassNumber = stageInfo.stageNumber || 1;
          const stageColorVar = `var(--stage-${stageClassNumber})`;

          return (
            <div
              key={className}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
                padding: isWinner ? '0.65rem 0.75rem' : '0.4rem 0.5rem',
                borderRadius: 'var(--radius)',
                backgroundColor: isWinner ? 'var(--primary-light)' : 'transparent',
                border: isWinner ? '1px solid var(--primary-border)' : '1px solid transparent',
                transition: 'background-color 200ms ease-out, border-color 200ms ease-out',
              }}
            >
              {/* Row Label & Percentage */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: '700',
                      color: stageColorVar,
                      backgroundColor: `var(--stage-${stageClassNumber}-bg)`,
                      border: `1px solid ` + `var(--stage-${stageClassNumber}-border)`,
                      padding: '0.15rem 0.45rem',
                      borderRadius: 'var(--radius-xs)',
                    }}
                  >
                    {t('prediction.chart.stage_label', { number: stageInfo.stageNumber })}
                  </span>

                  <span style={{ fontWeight: isWinner ? '700' : '500', color: 'var(--text-primary)', fontSize: '0.94rem' }}>
                    {translateClass(className) || stageInfo.displayLabel}
                  </span>

                  {isWinner && (
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: '700',
                        color: 'var(--primary)',
                        backgroundColor: 'var(--bg-surface)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid var(--primary-border)',
                      }}
                    >
                      {t('prediction.chart.highest_match')}
                    </span>
                  )}
                </div>

                <span
                  style={{
                    fontWeight: isWinner ? '800' : '600',
                    color: isWinner ? 'var(--primary)' : 'var(--text-secondary)',
                    fontSize: '0.95rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {mounted ? <AnimatedPercent target={percentage} /> : `${percentage}%`}
                </span>
              </div>

              {/* Smooth 600ms Ease-Out Progress Bar */}
              <div
                className="progress-bar-bg"
                style={{
                  height: '0.65rem',
                  backgroundColor: 'var(--border-subtle)',
                }}
              >
                <div
                  className="progress-bar-fill"
                  style={{
                    width: mounted ? `${Math.max(Number(percentage), 2)}%` : '0%',
                    backgroundColor: isWinner ? 'var(--primary)' : 'var(--border-medium)',
                    transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
