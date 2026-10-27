import React, { useState } from 'react';
import { History, Trash2, RefreshCw, Database, Clock, FileText } from 'lucide-react';
import { getStageInfo } from '../data/educationalContent';

export default function HistoryPanel({ history, onRefreshHistory, onClearHistory, dbConnected, isRefreshing }) {
  const [isClearing, setIsClearing] = useState(false);

  const handleClear = async () => {
    if (!window.confirm('Clear all recorded prediction history from database?')) return;
    setIsClearing(true);
    try {
      await onClearHistory();
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div
      className="panel"
      style={{
        padding: '1.25rem 1.45rem',
        marginTop: '1.15rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
      }}
    >
      {/* Header with Title and Actions */}
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
            <History size={16} color="#38bdf8" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: '600', color: '#f8fafc', margin: 0 }}>
              Recent Prediction Runs
            </h3>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.15rem 0 0 0' }}>
            Persistent inference audit records stored in MongoDB.
          </p>
        </div>

        {/* Sync & Clear Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={onRefreshHistory}
            disabled={isRefreshing}
            className="btn-secondary"
            title="Sync history from database"
            style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          {history && history.length > 0 && (
            <button
              onClick={handleClear}
              disabled={isClearing}
              className="btn-secondary"
              title="Clear all records"
              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', color: '#f87171' }}
            >
              <Trash2 size={12} />
              <span>Clear Runs</span>
            </button>
          )}
        </div>
      </div>

      {/* Offline Database Notice */}
      {!dbConnected && (
        <div
          style={{
            padding: '0.65rem 0.85rem',
            background: 'rgba(217, 119, 6, 0.08)',
            border: '1px solid rgba(217, 119, 6, 0.25)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.76rem',
            color: '#fbbf24',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <Database size={14} style={{ flexShrink: 0 }} />
          <span>Database running in stateless mode. Inference operates normally; history persistence is inactive.</span>
        </div>
      )}

      {/* Professional Data Table / Empty State */}
      {(!history || history.length === 0) ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
          <FileText size={24} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4 }} />
          <p style={{ fontSize: '0.84rem', color: '#94a3b8' }}>No inference history recorded yet.</p>
          <p style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '0.15rem' }}>
            Run a brain MRI classification above to log results to the database table.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Filename</th>
                <th>Classification</th>
                <th>Stage (Interpretation)</th>
                <th>Top Probability</th>
                <th>XAI Generated</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, idx) => {
                const stageInfo = getStageInfo(item.predictedClass);
                const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Just now';
                const topP = item.probabilities ? (item.probabilities[item.predictedClass] * 100).toFixed(1) : '-';

                return (
                  <tr key={item._id || item.id || idx}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={11} color="#64748b" />
                        <span>{dateStr}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: '500', color: '#e2e8f0', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.originalFilename}
                    </td>
                    
                    {/* Canonical class badge */}
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: '#e2e8f0',
                          border: '1px solid var(--border-subtle)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.7rem',
                        }}
                      >
                        {item.predictedClass}
                      </span>
                    </td>

                    {/* Stage (Interpretation) badge */}
                    <td>
                      <span
                        className="badge"
                        style={{
                          background: stageInfo.bg,
                          color: stageInfo.color,
                          border: `1px solid ${stageInfo.border}`,
                          fontSize: '0.7rem',
                          fontWeight: '600',
                        }}
                      >
                        {stageInfo.stageLabel}
                      </span>
                    </td>

                    {/* Top Probability */}
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: stageInfo.color }}>
                      {topP}%
                    </td>

                    {/* XAI Generated */}
                    <td style={{ color: item.hasHeatmaps ? '#34d399' : 'var(--text-muted)' }}>
                      {item.hasHeatmaps ? 'Yes (Grad-CAM & IG)' : 'Standard'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
