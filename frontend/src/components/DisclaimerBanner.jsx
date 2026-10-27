import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function DisclaimerBanner() {
  return (
    <div
      className="disclaimer-box"
      style={{
        marginTop: '1.25rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
      }}
    >
      <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px', color: '#f43f5e' }} />
      <div style={{ fontSize: '0.8rem', lineHeight: '1.5', color: '#e2e8f0' }}>
        <p style={{ fontWeight: '600', color: '#fda4af', marginBottom: '0.2rem' }}>
          Research Prototype & Regulatory Notice
        </p>
        <p>
          This web application is strictly an experimental educational prototype and research tool. It is{' '}
          <strong>not</strong> a medical device, clinical decision-support system, or medical diagnostic instrument.
          Model predictions, probabilities, and heatmap visualizations represent internal computational feature attributions
          produced by a machine learning model and must <strong>never</strong> be used to diagnose disease, determine prognosis,
          or guide clinical treatment.
        </p>
        <p style={{ marginTop: '0.3rem', color: '#94a3b8', fontSize: '0.75rem' }}>
          The <em>"NonDemented"</em> category denotes the baseline control group in the research dataset, not medical proof of health.
          The model cannot evaluate a patient's actual memory, behavior, or symptoms. All cognitive symptoms require comprehensive evaluation
          by qualified healthcare professionals.
        </p>
      </div>
    </div>
  );
}
