import React, { useState } from 'react';
import { HelpCircle, Cpu, BarChart3, Eye, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { getStageInfo } from '../data/educationalContent';
import { useLanguage } from '../context/LanguageContext';

export default function ModelDecisionExplanation({ prediction }) {
  const { t, translateClass } = useLanguage();
  const [expanded, setExpanded] = useState(true);

  if (!prediction || !prediction.probabilities) return null;

  const { predictedClass, probabilities } = prediction;
  const currentStageInfo = getStageInfo(predictedClass);

  // Sort probabilities descending to find winner, runner-up, and remaining
  const sortedEntries = Object.entries(probabilities)
    .map(([cname, prob]) => ({
      cname,
      prob,
      percentage: (prob * 100).toFixed(1),
      stageInfo: getStageInfo(cname),
      label: translateClass(cname) || getStageInfo(cname).displayLabel,
    }))
    .sort((a, b) => b.prob - a.prob);

  const winner = sortedEntries[0];
  const runnerUp = sortedEntries[1];
  const remaining = sortedEntries.slice(1);

  // Format comparative summary text
  const comparativeText = `The model assigned ${winner.percentage}% model-assigned probability to ${winner.label} (Stage ${winner.stageInfo.stageNumber}). The remaining probability mass was distributed across ${remaining
    .map((item) => `${item.label} (${item.percentage}%)`)
    .join(', ')}.`;

  return (
    <div
      className="panel"
      id="decision-rationale"
      style={{
        padding: '1.25rem 1.45rem',
        background: 'var(--panel)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        borderLeft: `3px solid ${currentStageInfo.color}`,
      }}
    >
      {/* Header with Expand/Collapse toggle */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <HelpCircle size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('prediction.explanation.title')}
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
            {t('prediction.explanation.subtitle')}
          </p>
        </div>

        <button
          className="btn-secondary"
          style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>{expanded ? (t('common.less') || 'Collapse') : (t('common.details') || 'Expand')}</span>
        </button>
      </div>

      {/* Expandable 3-Section Grid */}
      {expanded && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Section 1: Classification Mechanics */}
          <div
            style={{
              background: 'var(--bg-surface-subtle)',
              padding: '1.1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Cpu size={16} color="var(--primary)" />
              <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                1. Classification Mechanics
              </h4>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.55', margin: 0 }}>
              The hybrid neural network combines convolutional feature extraction (<strong>EfficientNet-B0</strong>) with hierarchical vision transformer attention (<strong>Swin-Small</strong>):
            </p>

            <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.55', margin: '0.2rem 0 0 0', paddingLeft: '1.1rem' }}>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Logit Computation:</strong> The network produces four raw linear outputs corresponding to dataset categories.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Softmax Normalization:</strong> The exponential softmax function scales these values to sum strictly to 100%.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Argmax Decision Rule:</strong> The classifier selects the category index with the maximal predicted probability.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Presentation Mapping:</strong> Category <code>{predictedClass}</code> is mapped to <strong>Stage {currentStageInfo.stageNumber} — {currentStageInfo.displayLabel}</strong>.
              </li>
            </ul>
          </div>

          {/* Section 2: Comparative Probability Summary */}
          <div
            style={{
              background: 'var(--bg-surface-subtle)',
              padding: '1.1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <BarChart3 size={16} color="var(--primary)" />
              <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                2. Comparative Probability Summary
              </h4>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.55', margin: 0 }}>
              {comparativeText}
            </p>

            {runnerUp && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  fontSize: '0.78rem',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ color: 'var(--text-muted)' }}>Runner-up Category:</div>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  Stage {runnerUp.stageInfo.stageNumber} ({runnerUp.stageInfo.displayLabel}) — {runnerUp.percentage}%
                </div>
                <div style={{ color: 'var(--primary)', marginTop: '0.2rem', fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                  Decision margin: +{(winner.prob * 100 - runnerUp.prob * 100).toFixed(1)}%
                </div>
              </div>
            )}

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.45' }}>
              A high model probability reflects model internal certainty across the four dataset categories, not a clinical probability that the patient has Alzheimer's disease.
            </p>
          </div>

          {/* Section 3: Visual Attribution Context */}
          <div
            style={{
              background: 'var(--bg-surface-subtle)',
              padding: '1.1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Eye size={16} color="var(--primary)" />
              <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                3. Visual Attribution Context
              </h4>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.55', margin: 0 }}>
              Feature attribution heatmaps explain the computational focus of the network:
            </p>

            <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.55', margin: '0.2rem 0 0 0', paddingLeft: '1.1rem' }}>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Grad-CAM:</strong> Highlights coarse regional activations within the final convolutional layer of EfficientNet.
              </li>
              <li>
                <strong style={{ color: 'var(--text-primary)' }}>Integrated Gradients:</strong> Computes path-integrated gradients to pinpoint pixel-level sensitivity relative to a black baseline.
              </li>
            </ul>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.45rem',
                padding: '0.6rem 0.75rem',
                background: 'var(--stage-4-bg)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--stage-4-border)',
                fontSize: '0.76rem',
                color: 'var(--stage-4)',
                lineHeight: '1.45',
              }}
            >

              <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                Attribution heatmaps do not delineate verified pathological brain lesions or biological tissue boundaries.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
