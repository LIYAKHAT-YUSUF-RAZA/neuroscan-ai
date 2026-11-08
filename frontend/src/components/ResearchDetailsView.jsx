import React from 'react';
import { Cpu, Eye, BarChart3, HelpCircle, FileCode, Shield } from 'lucide-react';
import ProbabilityChart from './ProbabilityChart';
import ModelMetricsCard from './ModelMetricsCard';
import ExplainabilityView from './ExplainabilityView';
import ModelDecisionExplanation from './ModelDecisionExplanation';
import { useLanguage } from '../context/LanguageContext';

export default function ResearchDetailsView({ prediction }) {
  const { t } = useLanguage();

  if (!prediction) {
    return (
      <div
        className="panel"
        style={{
          padding: '3rem 1.5rem',
          textAlign: 'center',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}
      >
        <Cpu size={36} style={{ color: 'var(--primary)', margin: '0 auto 0.75rem auto' }} />
        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
          {t('prediction.no_active_scan')}
        </h3>
        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', marginTop: '0.35rem', maxWidth: '480px', margin: '0.35rem auto 0 auto' }}>
          {t('prediction.no_active_scan_desc')}
        </p>
      </div>
    );
  }

  return (
    <div
      id="research-details"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
      }}
    >
      {/* Header Banner */}
      <div
        className="panel"
        style={{
          padding: '1.5rem 1.75rem',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '4px solid var(--primary)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Cpu size={20} style={{ color: 'var(--primary)' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {t('prediction.research_title')}
              </h2>
            </div>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
              {t('prediction.research_subtitle')}
            </p>
          </div>

          <span
            className="badge"
            style={{
              fontSize: '0.82rem',
              fontFamily: 'var(--font-mono)',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              border: '1px solid var(--primary-border)',
              padding: '0.35rem 0.65rem',
            }}
          >
            Checkpoint: 676fefe8...
          </span>
        </div>
      </div>

      {/* Grid: Probability Chart & Model Metrics Card */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
        }}
      >
        {/* Softmax Probability Distribution */}
        <ProbabilityChart
          probabilities={prediction.probabilities}
          predictedClass={prediction.predictedClass}
        />

        {/* Model Decision Metrics (Unnormalized Raw Logits & Margins) */}
        <ModelMetricsCard prediction={prediction} />
      </div>

      {/* Explainable AI Heatmaps */}
      {prediction.heatmaps && (
        <ExplainabilityView heatmaps={prediction.heatmaps} />
      )}

      {/* Model Decision Detailed Explanation */}
      <ModelDecisionExplanation prediction={prediction} />
    </div>
  );
}
