import React, { useState } from 'react';
import { Eye, Layers, Compass, Info } from 'lucide-react';

export default function ExplainabilityView({ heatmaps }) {
  const [activeTab, setActiveTab] = useState('both'); // 'both', 'gradcam', 'ig'

  if (!heatmaps) return null;

  const { gradcam, integratedGradients } = heatmaps;

  return (
    <div
      className="panel"
      style={{
        padding: '1.25rem 1.45rem',
        marginTop: '1.15rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header: Title, Subtitle, and View Mode Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Eye size={17} color="#38bdf8" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: '600', color: '#f8fafc', margin: 0 }}>
              Explainable AI (XAI) Attribution Heatmaps
            </h3>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.15rem 0 0 0' }}>
            Attribution maps showing pixel and feature regions influencing the hybrid network's prediction.
          </p>
        </div>

        {/* View Mode Controls */}
        <div
          style={{
            display: 'flex',
            gap: '0.25rem',
            background: 'var(--bg-surface-muted)',
            padding: '0.2rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <button
            onClick={() => setActiveTab('both')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: '500',
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'both' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'both' ? '#ffffff' : '#94a3b8',
              transition: 'background 0.15s ease',
            }}
          >
            Side-by-Side
          </button>
          <button
            onClick={() => setActiveTab('gradcam')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: '500',
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'gradcam' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'gradcam' ? '#ffffff' : '#94a3b8',
              transition: 'background 0.15s ease',
            }}
          >
            Grad-CAM
          </button>
          <button
            onClick={() => setActiveTab('ig')}
            style={{
              padding: '0.25rem 0.65rem',
              fontSize: '0.74rem',
              fontWeight: '500',
              borderRadius: 'var(--radius-xs)',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'ig' ? 'var(--accent-primary)' : 'transparent',
              color: activeTab === 'ig' ? '#ffffff' : '#94a3b8',
              transition: 'background 0.15s ease',
            }}
          >
            Integrated Gradients
          </button>
        </div>
      </div>

      {/* Heatmaps Display Grid */}
      <div
        className={activeTab === 'both' ? 'heatmaps-grid' : ''}
        style={{
          maxWidth: activeTab === 'both' ? '100%' : '480px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Grad-CAM Panel */}
        {(activeTab === 'both' || activeTab === 'gradcam') && (
          <div className="heatmap-card">
            <div
              style={{
                padding: '0.6rem 0.85rem',
                background: 'var(--bg-surface-muted)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Layers size={14} color="#38bdf8" />
                <span style={{ fontWeight: '600', fontSize: '0.82rem', color: '#f1f5f9' }}>Grad-CAM Activation Map</span>
              </div>
              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.08)', color: '#38bdf8', fontSize: '0.66rem', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                conv_head (EffNet)
              </span>
            </div>

            <div style={{ padding: '0.65rem', background: '#000000', textAlign: 'center' }}>
              <img
                src={gradcam}
                alt="Grad-CAM Brain MRI Overlay"
                style={{ maxHeight: '290px', margin: '0 auto', borderRadius: 'var(--radius-xs)' }}
              />
            </div>

            <div style={{ padding: '0.6rem 0.85rem', background: 'var(--bg-surface-muted)', fontSize: '0.74rem', color: '#94a3b8', borderTop: '1px solid var(--border-subtle)' }}>
              Gradient-weighted class activation mapping targeting the final convolutional head of EfficientNet-B0. Warm hues show maximal activation.
            </div>
          </div>
        )}

        {/* Integrated Gradients Panel */}
        {(activeTab === 'both' || activeTab === 'ig') && (
          <div className="heatmap-card">
            <div
              style={{
                padding: '0.6rem 0.85rem',
                background: 'var(--bg-surface-muted)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Compass size={14} color="#818cf8" />
                <span style={{ fontWeight: '600', fontSize: '0.82rem', color: '#f1f5f9' }}>Integrated Gradients Map</span>
              </div>
              <span className="badge" style={{ background: 'rgba(129, 140, 248, 0.08)', color: '#a5b4fc', fontSize: '0.66rem', border: '1px solid rgba(129, 140, 248, 0.2)' }}>
                Axiomatic (15 Steps)
              </span>
            </div>

            <div style={{ padding: '0.65rem', background: '#000000', textAlign: 'center' }}>
              <img
                src={integratedGradients}
                alt="Integrated Gradients Brain MRI Overlay"
                style={{ maxHeight: '290px', margin: '0 auto', borderRadius: 'var(--radius-xs)' }}
              />
            </div>

            <div style={{ padding: '0.6rem 0.85rem', background: 'var(--bg-surface-muted)', fontSize: '0.74rem', color: '#94a3b8', borderTop: '1px solid var(--border-subtle)' }}>
              Path integral of input gradients accumulated across 15 interpolation steps from a zero baseline. Indicates input sensitivity.
            </div>
          </div>
        )}
      </div>

      {/* Attribution Note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          background: 'var(--bg-surface-muted)',
          padding: '0.65rem 0.85rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.74rem',
          color: '#94a3b8',
        }}
      >
        <Info size={14} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          <strong>Methodological Note:</strong> Visual attribution overlays reflect neural network internal feature weight activations. They do not identify confirmed clinical pathology or validated medical lesions.
        </span>
      </div>
    </div>
  );
}
