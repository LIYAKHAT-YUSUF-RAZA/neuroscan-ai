import React from 'react';
import { Cpu, TrendingUp, GitCommit, AlertTriangle } from 'lucide-react';
import { getStageInfo } from '../data/educationalContent';
import { useLanguage } from '../context/LanguageContext';

const ORDERED_CLASSES = [
  'MildDemented',
  'ModerateDemented',
  'NonDemented',
  'VeryMildDemented',
];

export default function ModelMetricsCard({ prediction }) {
  const { t, translateClass } = useLanguage();
  if (!prediction || !prediction.rawLogits || !prediction.probabilities) return null;

  const { rawLogits, probabilities, predictedClass } = prediction;

  // Pair classes with logits and probabilities
  const entries = ORDERED_CLASSES.map((name, i) => ({
    name,
    logit: rawLogits[i] ?? 0,
    prob: probabilities[name] ?? 0,
    percentage: ((probabilities[name] ?? 0) * 100).toFixed(1),
    stageInfo: getStageInfo(name),
  }));

  // Sort descending by probability to find winner and runner-up
  const sortedByProb = [...entries].sort((a, b) => b.prob - a.prob);
  const winner = sortedByProb[0];
  const runnerUp = sortedByProb[1];

  const probDiff = (winner && runnerUp)
    ? ((winner.prob - runnerUp.prob) * 100).toFixed(1)
    : '0.0';

  const logitDiff = (winner && runnerUp)
    ? (winner.logit - runnerUp.logit).toFixed(4)
    : '0.0000';

  // Find min and max logits for proportional bar rendering
  const minLogit = Math.min(...rawLogits, 0);
  const maxLogit = Math.max(...rawLogits, 1);
  const logitRange = maxLogit - minLogit || 1;

  return (
    <div
      className="panel"
      style={{
        padding: '1.15rem 1.25rem',
        background: 'var(--panel)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Cpu size={15} color="var(--primary)" />
          <span style={{ fontSize: '0.78rem', fontWeight: '700', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            {t('prediction.metrics.title')}
          </span>
        </div>

        {/* Verified Architecture Badge (Correction 4) */}
        <span
          className="badge-cyan"
          style={{ fontSize: '0.64rem', padding: '0.12rem 0.45rem', fontWeight: '600' }}
        >
          EfficientNet-B0 + Swin-Small
        </span>
      </div>

      {/* Decision Margins: Probability Gap vs Raw Logit Gap (Correction 4) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.65rem',
          padding: '0.65rem 0.75rem',
          background: 'var(--panel-secondary)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Probability Margin
          </span>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
            +{probDiff}%
          </div>
          <span style={{ fontSize: '0.64rem', color: 'var(--text-secondary)' }}>
            vs {translateClass(runnerUp.name) || runnerUp.stageInfo.displayLabel}
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Raw Logit Margin
          </span>
          <div style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--secondary)', fontFamily: 'var(--font-mono)' }}>
            +{logitDiff}
          </div>
          <span style={{ fontSize: '0.64rem', color: 'var(--text-secondary)' }}>
            Linear separation
          </span>
        </div>
      </div>

      {/* Unnormalized Raw Logits Bar Chart (Correction 4: clearly labeled as unnormalized model outputs) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
            Unnormalized Raw Logits (Pre-Softmax)
          </span>
          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Real Output Tensor
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {entries.map((item) => {
            const isWinner = item.name === predictedClass;
            const normalizedWidth = Math.max(((item.logit - minLogit) / logitRange) * 100, 4);

            return (
              <div key={item.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                  <span style={{ color: isWinner ? 'var(--primary-dark)' : 'var(--text-secondary)', fontWeight: isWinner ? '700' : '500' }}>
                    S{item.stageInfo.stageNumber} ({translateClass(item.name) || item.name})
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: isWinner ? 'var(--primary)' : 'var(--text-muted)', fontWeight: '600' }}>
                    {item.logit.toFixed(4)}
                  </span>
                </div>

                <div className="progress-bar-bg" style={{ height: '0.35rem' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${normalizedWidth}%`,
                      background: isWinner ? 'var(--primary)' : 'rgba(148, 163, 184, 0.25)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explicit disclaimer (Correction 4) */}
      <p style={{ fontSize: '0.64rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
        Unnormalized raw logits represent pre-softmax linear classification outputs, not biological biomarkers or clinical risk scores.
      </p>
    </div>
  );
}
