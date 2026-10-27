import React from 'react';
import { Activity, RefreshCw } from 'lucide-react';

export default function Navbar({ health, onRefreshHealth, isRefreshing }) {
  const isAiReady = health?.aiService?.reachable && health?.aiService?.data?.modelLoaded;
  const isDbReady = health?.database?.connected;

  return (
    <header
      className="panel"
      style={{
        marginBottom: '1.25rem',
        padding: '0.75rem 1.25rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        {/* Brand & Subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '2.1rem',
              height: '2.1rem',
              borderRadius: 'var(--radius-sm)',
              background: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            <Activity size={17} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: '700', letterSpacing: '-0.01em', color: '#ffffff' }}>
                NeuroScan AI
              </span>
              <span
                className="badge"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#94a3b8',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.68rem',
                  padding: '0.1rem 0.45rem',
                }}
              >
                Research v1.0
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.1rem 0 0 0' }}>
              Alzheimer’s Brain MRI Classification & Attribution (EfficientNet + Swin)
            </p>
          </div>
        </div>

        {/* Quiet, Professional Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          
          {/* AI Model Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              color: isAiReady ? '#cbd5e1' : '#f87171',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isAiReady ? '#10b981' : '#ef4444',
                display: 'inline-block',
              }}
            />
            <span>AI: {isAiReady ? 'Model Ready (CPU)' : 'Offline'}</span>
          </div>

          <span style={{ color: 'var(--border-subtle)', fontSize: '0.8rem' }}>|</span>

          {/* Database Status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.75rem',
              color: isDbReady ? '#cbd5e1' : '#fbbf24',
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isDbReady ? '#10b981' : '#d97706',
                display: 'inline-block',
              }}
            />
            <span>DB: {isDbReady ? 'MongoDB Connected' : 'Stateless'}</span>
          </div>

          {/* Restrained Check Status Button */}
          <button
            onClick={onRefreshHealth}
            disabled={isRefreshing}
            className="btn-secondary"
            title="Refresh service health"
            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', marginLeft: '0.25rem' }}
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Check Status</span>
          </button>
        </div>

      </div>
    </header>
  );
}
