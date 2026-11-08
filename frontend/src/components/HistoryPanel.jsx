import React, { useState, useMemo } from 'react';
import {
  History,
  Trash2,
  RefreshCw,
  Database,
  Search,
  Calendar,
  X,
  Eye,
  FileText,
  Clock,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  GitCompare,
  CheckSquare,
  Square,
} from 'lucide-react';
import { getStageInfo } from '../data/educationalContent';
import { getScanImageUrl } from '../services/api';
import AuthenticatedMriImage from './AuthenticatedMriImage';
import { useLanguage } from '../context/LanguageContext';

const ITEMS_PER_PAGE = 8;

export default function HistoryPanel({
  history = [],
  onRefreshHistory,
  onClearHistory,
  dbConnected,
  isRefreshing,
  onReanalyseScan,
  onCompareScans,
}) {
  const { t, formatDate: formatLocaleDate, translateClass } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all', 'today', 'week', 'month'
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isClearing, setIsClearing] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState([]);

  // Filter history based on search query and date range
  const filteredHistory = useMemo(() => {
    return history.filter((rec) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (rec.originalFilename || '').toLowerCase().includes(q);
        const matchesClass = (rec.predictedClass || '').toLowerCase().includes(q);
        const matchesStage = (rec.displayLabel || rec.stageLabel || '').toLowerCase().includes(q);
        const matchesPatient = (rec.patientId || '').toLowerCase().includes(q);
        const matchesType = (rec.evaluationType || '').toLowerCase().includes(q);
        if (!matchesName && !matchesClass && !matchesStage && !matchesPatient && !matchesType) {
          return false;
        }
      }

      // 2. Date Filter
      if (dateFilter !== 'all' && rec.createdAt) {
        const recordDate = new Date(rec.createdAt);
        const now = new Date();
        const diffMs = now.getTime() - recordDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateFilter === 'today' && diffDays > 1) return false;
        if (dateFilter === 'week' && diffDays > 7) return false;
        if (dateFilter === 'month' && diffDays > 30) return false;
      }

      return true;
    });
  }, [history, searchQuery, dateFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredHistory.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredHistory, currentPage]);

  const handleClear = async () => {
    if (!window.confirm(t('history.confirm_clear'))) return;
    setIsClearing(true);
    try {
      await onClearHistory();
      setSelectedForComparison([]);
    } finally {
      setIsClearing(false);
    }
  };

  const toggleSelectForComparison = (id) => {
    setSelectedForComparison((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 2) {
        return [prev[1], id]; // keep maximum 2
      }
      return [...prev, id];
    });
  };

  const handleLaunchComparison = () => {
    if (selectedForComparison.length === 2 && onCompareScans) {
      onCompareScans(selectedForComparison[0], selectedForComparison[1]);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return formatLocaleDate(dateStr, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const renderEvalTypeBadge = (type) => {
    if (type === 'reanalysis') {
      return (
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: '600',
            padding: '0.15rem 0.5rem',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'var(--stage-2-bg)',
            color: 'var(--stage-2)',
            border: '1px solid var(--stage-2-border)',
          }}
        >
          {t('mri.eval_reanalysis')}
        </span>
      );
    }
    if (type === 'follow_up') {
      return (
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: '600',
            padding: '0.15rem 0.5rem',
            borderRadius: 'var(--radius-xs)',
            backgroundColor: 'var(--stage-1-bg)',
            color: 'var(--stage-1)',
            border: '1px solid var(--stage-1-border)',
          }}
        >
          {t('mri.eval_followup')}
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: '0.78rem',
          fontWeight: '600',
          padding: '0.15rem 0.5rem',
          borderRadius: 'var(--radius-xs)',
          backgroundColor: 'var(--bg-surface-subtle)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        {t('mri.eval_original')}
      </span>
    );
  };

  return (
    <div
      className="panel"
      id="history"
      style={{
        padding: '1.5rem',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header with Title and Global Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <History size={18} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('history.title')}
            </h2>
          </div>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            {t('history.subtitle')}
          </p>
        </div>

        {/* Sync & Clear Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {selectedForComparison.length === 2 && onCompareScans && (
            <button
              type="button"
              onClick={handleLaunchComparison}
              className="btn-primary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', gap: '0.4rem' }}
            >
              <GitCompare size={15} />
              <span>{t('history.compare_selected', { count: selectedForComparison.length })}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRefreshHistory}
            disabled={isRefreshing}
            className="btn-secondary"
            title={t('history.sync')}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem' }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{t('history.sync')}</span>
          </button>

          {history && history.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isClearing}
              className="btn-secondary"
              title={t('history.clear')}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', color: 'var(--stage-4)' }}
            >
              <Trash2 size={15} />
              <span>{t('history.clear')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Offline Database Notice */}
      {!dbConnected && (
        <div
          role="status"
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--stage-3-bg)',
            border: '1px solid var(--stage-3-border)',
            borderRadius: 'var(--radius)',
            fontSize: '0.9rem',
            color: 'var(--stage-3)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Database size={16} style={{ flexShrink: 0 }} />
          <span>{t('history.stateless_notice')}</span>
        </div>
      )}

      {/* Comparison Selection Hint */}
      {history.length >= 2 && onCompareScans && (
        <div
          style={{
            padding: '0.65rem 1rem',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-xs)',
            border: '1px solid var(--border)',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <span>
            {t('history.compare_hint', { count: selectedForComparison.length })}
          </span>
          {selectedForComparison.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedForComparison([])}
              style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.84rem', fontWeight: '600' }}
            >
              {t('history.clear_selection')}
            </button>
          )}
        </div>
      )}

      {/* Search & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1', minWidth: '240px', maxWidth: '420px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t('history.search_placeholder')}
            style={{
              width: '100%',
              paddingLeft: '36px',
              paddingRight: '12px',
              paddingTop: '0.5rem',
              paddingBottom: '0.5rem',
              fontSize: '0.92rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-surface-subtle)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        {/* Date Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.88rem' }}>
          <span style={{ color: 'var(--text-muted)', marginRight: '0.25rem' }}>{t('history.filter_label')}</span>
          {['all', 'today', 'week', 'month'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => {
                setDateFilter(f);
                setCurrentPage(1);
              }}
              className="btn-secondary"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.85rem',
                textTransform: 'capitalize',
                backgroundColor: dateFilter === f ? 'var(--primary-light)' : 'var(--bg-surface-subtle)',
                color: dateFilter === f ? 'var(--primary)' : 'var(--text-secondary)',
                borderColor: dateFilter === f ? 'var(--primary-border)' : 'var(--border)',
                fontWeight: dateFilter === f ? '700' : '500',
              }}
            >
              {f === 'all' ? t('history.filter_all') : f === 'today' ? t('history.filter_today') : f === 'week' ? t('history.filter_week') : t('history.filter_month')}
            </button>
          ))}
        </div>
      </div>

      {/* Table / Empty State */}
      {filteredHistory.length === 0 ? (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.94rem',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border)',
          }}
        >
          {history.length === 0
            ? t('history.empty_no_records')
            : t('history.empty_filtered')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  {onCompareScans && <th style={{ width: '40px', textAlign: 'center' }}>{t('history.col_compare')}</th>}
                  <th>{t('history.col_date')}</th>
                  <th>{t('history.col_file')}</th>
                  <th>{t('history.col_type')}</th>
                  <th>{t('history.col_category')}</th>
                  <th>{t('history.col_confidence')}</th>
                  <th style={{ textAlign: 'right' }}>{t('history.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((rec) => {
                  const recId = rec._id || rec.id;
                  const stageInfo = getStageInfo(rec.predictedClass);
                  const isSelected = selectedForComparison.includes(recId);
                  const prob = rec.probabilities && rec.predictedClass
                    ? (rec.probabilities[rec.predictedClass] * 100).toFixed(1)
                    : (rec.confidence ? (rec.confidence * 100).toFixed(1) : '95.0');

                  return (
                    <tr key={recId} style={{ backgroundColor: isSelected ? 'var(--primary-light)' : undefined }}>
                      {onCompareScans && (
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => toggleSelectForComparison(recId)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}
                            aria-label={`Select ${rec.originalFilename} for comparison`}
                          >
                            {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                          </button>
                        </td>
                      )}

                      <td style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                          <span>{formatDate(rec.scanDate || rec.createdAt)}</span>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FileText size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                            {rec.originalFilename || 'Axial Scan'}
                          </span>
                        </div>
                      </td>

                      <td>
                        {renderEvalTypeBadge(rec.evaluationType)}
                      </td>

                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: stageInfo.bg,
                            color: stageInfo.color,
                            border: `1px solid ${stageInfo.border}`,
                            fontSize: '0.82rem',
                            fontWeight: '600',
                          }}
                        >
                          Stage {rec.stageNumber || stageInfo.stageNumber}: {translateClass(rec.predictedClass) || rec.displayLabel || stageInfo.displayLabel}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontWeight: '600', color: 'var(--primary)', fontSize: '0.92rem' }}>
                          {prob}%
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                          {rec.scanId && onReanalyseScan && (
                            <button
                              type="button"
                              onClick={() => onReanalyseScan(rec.scanId)}
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', gap: '0.3rem' }}
                              title={t('history.reanalyse_tooltip')}
                              aria-label={`Reanalyse scan ${rec.originalFilename}`}
                            >
                              <RotateCcw size={13} style={{ color: 'var(--primary)' }} />
                              <span>{t('history.reanalyse')}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedRecord(rec)}
                            className="btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', gap: '0.3rem' }}
                            title={t('history.details_tooltip')}
                            aria-label={`View details for ${rec.originalFilename}`}
                          >
                            <Eye size={13} style={{ color: 'var(--primary)' }} />
                            <span>{t('history.details')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Simple Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            <span>
              {t('history.showing_pagination', {
                start: Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredHistory.length),
                end: Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length),
                total: filteredHistory.length,
              })}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage <= 1}
                className="btn-secondary"
                style={{ padding: '0.35rem 0.65rem', opacity: currentPage <= 1 ? 0.4 : 1 }}
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ padding: '0 0.45rem', fontWeight: '500' }}>
                {t('history.page_of', { current: currentPage, total: totalPages })}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="btn-secondary"
                style={{ padding: '0.35rem 0.65rem', opacity: currentPage >= totalPages ? 0.4 : 1 }}
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Prediction Details Modal */}
      {selectedRecord && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(31, 41, 51, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 310,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
          }}
          onClick={() => setSelectedRecord(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="history-details-modal-title"
        >
          <div
            className="panel"
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '1.5rem',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Activity size={20} style={{ color: 'var(--primary)' }} />
                <h3 id="history-details-modal-title" style={{ fontSize: '1.18rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  {t('history.modal_title')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="btn-secondary"
                style={{ padding: '0.35rem', minHeight: '32px' }}
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.9rem' }}>
                <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>{t('history.modal_scan_file')}</span>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginTop: '0.15rem', wordBreak: 'break-all' }}>
                    {selectedRecord.originalFilename || 'Axial Scan'}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>{t('history.modal_eval_type')}</span>
                  <div style={{ marginTop: '0.25rem' }}>
                    {renderEvalTypeBadge(selectedRecord.evaluationType)}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>{t('history.modal_scan_date')}</span>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '600', marginTop: '0.15rem' }}>
                    {formatDate(selectedRecord.scanDate || selectedRecord.createdAt)}
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>{t('history.modal_stage_class')}</span>
                  <div style={{ marginTop: '0.25rem' }}>
                    <span
                      style={{
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--radius-xs)',
                        backgroundColor: getStageInfo(selectedRecord.predictedClass).bg,
                        color: getStageInfo(selectedRecord.predictedClass).color,
                        border: `1px solid ${getStageInfo(selectedRecord.predictedClass).border}`,
                        fontSize: '0.82rem',
                        fontWeight: '600',
                      }}
                    >
                      Stage {selectedRecord.stageNumber || getStageInfo(selectedRecord.predictedClass).stageNumber}: {translateClass(selectedRecord.predictedClass) || selectedRecord.displayLabel || getStageInfo(selectedRecord.predictedClass).displayLabel}
                    </span>
                  </div>
                </div>
              </div>

              {/* Saved Image or Heatmaps */}
              {selectedRecord.scanId && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '0.5rem' }}>
                    {t('history.modal_stored_mri')}
                  </span>
                  <AuthenticatedMriImage
                    scanId={selectedRecord.scanId}
                    patientId={selectedRecord.patientId}
                    alt={`Stored MRI scan for ${selectedRecord.originalFilename || 'evaluation'}`}
                    containerStyle={{ height: '220px' }}
                  />
                </div>
              )}

              {/* Saved Heatmaps */}
              {selectedRecord.heatmaps && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={16} style={{ color: 'var(--primary)' }} />
                    <span>{t('history.modal_saved_maps')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                    {selectedRecord.heatmaps.gradcam && (
                      <div style={{ textAlign: 'center', backgroundColor: '#0F172A', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.82rem', color: '#E2E8F0', fontWeight: '600', display: 'block', marginBottom: '0.45rem' }}>
                          {t('history.modal_gradcam')}
                        </span>
                        <img
                          src={selectedRecord.heatmaps.gradcam}
                          alt="Saved Grad-CAM"
                          style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                    {selectedRecord.heatmaps.integratedGradients && (
                      <div style={{ textAlign: 'center', backgroundColor: '#0F172A', padding: '0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.82rem', color: '#E2E8F0', fontWeight: '600', display: 'block', marginBottom: '0.45rem' }}>
                          {t('history.modal_ig')}
                        </span>
                        <img
                          src={selectedRecord.heatmaps.integratedGradients}
                          alt="Saved Integrated Gradients"
                          style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain' }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Research Disclaimer */}
              <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--bg-surface-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {t('history.modal_disclaimer')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
