import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  RotateCcw,
  Clock,
  FileImage,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { getPatientScans, reanalyseMriScan } from '../services/api';
import AuthenticatedMriImage from './AuthenticatedMriImage';
import { getStageInfo } from '../data/educationalContent';
import { useLanguage } from '../context/LanguageContext';

export default function ReanalyseModal({
  isOpen,
  onClose,
  patientId,
  userRole,
  onReanalyseSuccess,
}) {
  const { t, formatDate } = useLanguage();
  const [scans, setScans] = useState([]);
  const [isLoadingScans, setIsLoadingScans] = useState(false);
  const [reanalysingScanId, setReanalysingScanId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  useEffect(() => {
    if (isOpen && patientId) {
      loadScans();
    } else {
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, patientId]);

  const loadScans = async () => {
    setIsLoadingScans(true);
    setError(null);
    try {
      const res = await getPatientScans(patientId, userRole);
      if (res.success) {
        setScans(res.scans || []);
      } else {
        setError(res.error || 'Failed to load historical scans.');
      }
    } catch (err) {
      setError(err.message || 'Error fetching scans.');
    } finally {
      setIsLoadingScans(false);
    }
  };

  const handleReanalyse = async (scan) => {
    if (!scan || !scan.scanId) return;
    setReanalysingScanId(scan.scanId);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await reanalyseMriScan(scan.scanId, true, patientId, userRole);
      if (res.success && res.data) {
        setSuccessMsg(`Scan "${scan.originalFilename}" reanalysed successfully.`);
        if (onReanalyseSuccess) {
          onReanalyseSuccess(res.data, scan);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.error || 'Failed to reanalyse MRI scan.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred during reanalysis.');
    } finally {
      setReanalysingScanId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="modal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(31, 41, 51, 0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
        }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reanalyse-modal-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="panel"
          style={{
            width: '100%',
            maxWidth: '680px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface)',
            }}
          >
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
                <RotateCcw size={18} aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="reanalyse-modal-title"
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  {t('modals.reanalyse_title')}
                </h2>
                <p
                  style={{
                    fontSize: '0.88rem',
                    color: 'var(--text-secondary)',
                    margin: '0.15rem 0 0 0',
                  }}
                >
                  Select a stored scan from patient records to re-evaluate with current model pipeline.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div
              role="alert"
              style={{
                margin: '1rem 1.5rem 0 1.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--stage-4-bg)',
                border: '1px solid var(--stage-4-border)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--stage-4)',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              style={{
                margin: '1rem 1.5rem 0 1.5rem',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--stage-1-bg)',
                border: '1px solid var(--stage-1-border)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--stage-1)',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Body Content */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {isLoadingScans ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '3rem 1rem',
                  color: 'var(--text-secondary)',
                  gap: '0.75rem',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: '3px solid var(--border)',
                    borderTopColor: 'var(--primary)',
                    animation: 'spin 1s linear infinite',
                  }}
                />
                <span style={{ fontSize: '0.95rem' }}>Loading stored patient scans...</span>
              </div>
            ) : scans.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '3rem 1.5rem',
                  backgroundColor: 'var(--bg-surface-subtle)',
                  borderRadius: 'var(--radius)',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                <FileImage size={36} style={{ margin: '0 auto 0.75rem auto', color: 'var(--text-muted)' }} />
                <h3 style={{ fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  No stored scans found
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Upload a brain MRI scan first to enable subsequent reanalysis and comparisons.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {scans.map((scan) => {
                  const isProcessing = reanalysingScanId === scan.scanId;
                  const latestPred = scan.latestPredictionId;
                  const stageInfo = latestPred?.predictedClass
                    ? getStageInfo(latestPred.predictedClass)
                    : null;

                  return (
                    <div
                      key={scan.scanId}
                      style={{
                        padding: '1rem 1.25rem',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Left: Thumbnail & Meta */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '220px' }}>
                        <AuthenticatedMriImage
                          scanId={scan.scanId}
                          patientId={patientId}
                          userRole={userRole}
                          alt={scan.originalFilename}
                          containerStyle={{
                            width: '54px',
                            height: '54px',
                            borderRadius: 'var(--radius-xs)',
                            border: '1px solid var(--border)',
                            flexShrink: 0,
                          }}
                          imageStyle={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span
                            style={{
                              fontSize: '0.98rem',
                              fontWeight: '600',
                              color: 'var(--text-primary)',
                              wordBreak: 'break-all',
                            }}
                          >
                            {scan.originalFilename}
                          </span>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.65rem',
                              fontSize: '0.84rem',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={12} />
                              {formatDate(scan.scanDate || scan.createdAt)}
                            </span>
                            <span>•</span>
                            <span>{(scan.fileSize / 1024).toFixed(0)} KB</span>
                            <span>•</span>
                            <span>{scan.analysisCount || 1} analysis run{scan.analysisCount !== 1 ? 's' : ''}</span>
                          </div>

                          {stageInfo && (
                            <div style={{ marginTop: '0.25rem' }}>
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  fontWeight: '600',
                                  padding: '0.15rem 0.55rem',
                                  borderRadius: 'var(--radius-xs)',
                                  backgroundColor: stageInfo.bg,
                                  color: stageInfo.color,
                                  border: `1px solid ${stageInfo.border}`,
                                }}
                              >
                                Stage {stageInfo.stageNumber}: {stageInfo.displayLabel}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Action */}
                      <button
                        type="button"
                        onClick={() => handleReanalyse(scan)}
                        disabled={isProcessing || Boolean(reanalysingScanId)}
                        className="btn-primary"
                        style={{
                          minHeight: '40px',
                          padding: '0.5rem 1rem',
                          fontSize: '0.9rem',
                          gap: '0.45rem',
                          alignSelf: 'center',
                        }}
                        aria-label={`Reanalyse scan ${scan.originalFilename}`}
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw size={15} className="animate-spin" />
                            <span>Reanalysing...</span>
                          </>
                        ) : (
                          <>
                            <RotateCcw size={15} />
                            <span>Reanalyse Scan</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Notice */}
          <div
            style={{
              padding: '0.85rem 1.5rem',
              borderTop: '1px solid var(--border)',
              backgroundColor: 'var(--bg-surface)',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            Reanalysis re-evaluates the original stored image buffer using the active hybrid classification pipeline without modifying the baseline scan.
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
