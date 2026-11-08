import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  FileImage,
  X,
  Play,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle2,
  Clock,
  Sparkles,
  RotateCcw,
  GitCompare,
  ArrowDown,
  Plus,
  Calendar,
  FileText,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export default function MriViewer({
  selectedFile,
  setSelectedFile,
  previewUrl,
  setPreviewUrl,
  onPredict,
  isLoading,
  prediction,
  onClear,
  onOpenReanalyseModal,
  onReanalyseCurrent,
  onViewCurrentResults,
  onNavigateToComparison,
}) {
  const { t } = useLanguage();
  const [activeLayer, setActiveLayer] = useState('original'); // 'original', 'gradcam', 'ig'
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(15);

  const friendlyLoadingMessages = useMemo(() => [
    t('mri.loading_1'),
    t('mri.loading_2'),
    t('mri.loading_3'),
  ], [t]);

  // Follow-up scan metadata state
  const [isFollowUpMode, setIsFollowUpMode] = useState(false);
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [visitNotes, setVisitNotes] = useState('');
  const [showVisitFields, setShowVisitFields] = useState(false);

  const fileInputRef = useRef(null);
  const heatmaps = prediction?.heatmaps;

  // Cycle friendly loading messages and animate progress during analysis
  useEffect(() => {
    let msgInterval;
    let progressInterval;
    if (isLoading) {
      setLoadingMsgIndex(0);
      setAnalysisProgress(20);

      msgInterval = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % friendlyLoadingMessages.length);
      }, 2400);

      progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => (prev < 90 ? prev + 15 : prev));
      }, 800);
    } else {
      setAnalysisProgress(100);
    }
    return () => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
    };
  }, [isLoading, friendlyLoadingMessages.length]);

  const handleFile = (file) => {
    setErrorMsg(null);
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMsg(t('mri.error_unsupported'));
      return;
    }

    if (file.size > MAX_BYTES) {
      setErrorMsg(t('mri.error_too_large', { size: (file.size / (1024 * 1024)).toFixed(1) }));
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setActiveLayer('original');
  };

  const onDragOverHandler = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeaveHandler = () => {
    setIsDragOver(false);
  };

  const onDropHandler = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    setErrorMsg(null);
    setZoomLevel(1);
    setIsFollowUpMode(false);
    setShowVisitFields(false);
    setVisitNotes('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClear) onClear();
  };

  const handleStartFollowUp = () => {
    handleReset();
    setIsFollowUpMode(true);
    setShowVisitFields(true);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 150);
  };

  const handleTriggerAnalysis = () => {
    if (!selectedFile) return;
    const options = {
      evaluationType: isFollowUpMode ? 'follow_up' : 'original',
      visitDate: isFollowUpMode ? visitDate : undefined,
      visitNotes: isFollowUpMode ? visitNotes : undefined,
    };
    onPredict(selectedFile, options);
  };

  const scrollToResults = () => {
    const el = document.getElementById('prediction-results') || document.querySelector('.prediction-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Determine current active view image
  let currentMainImage = previewUrl;
  if (activeLayer === 'gradcam' && heatmaps?.gradcam) {
    currentMainImage = heatmaps.gradcam;
  } else if (activeLayer === 'ig' && heatmaps?.integratedGradients) {
    currentMainImage = heatmaps.integratedGradients;
  }

  const zoomIn = () => setZoomLevel((z) => Math.min(z + 0.25, 2.5));
  const zoomOut = () => setZoomLevel((z) => Math.max(z - 0.25, 0.75));
  const resetZoom = () => setZoomLevel(1);

  // Compute 3-step status
  const currentStep = prediction ? 3 : isLoading ? 2 : 1;

  return (
    <section className="panel" aria-label="MRI Scan Upload and Viewer" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* 3-Step Simple Progress Indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '1rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
        aria-label="Upload Progress Steps"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: currentStep >= 1 ? 'var(--primary)' : 'var(--bg-surface-subtle)',
              color: currentStep >= 1 ? 'var(--text-inverse)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '0.88rem',
              transition: 'background-color 300ms ease-out',
            }}
          >
            1
          </span>
          <span style={{ fontWeight: currentStep === 1 ? '700' : '500', color: currentStep >= 1 ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.95rem' }}>
            {isFollowUpMode ? 'Choose Follow-up Scan' : 'Choose Scan'}
          </span>
        </div>

        <div
          style={{
            flex: 1,
            height: '3px',
            backgroundColor: currentStep >= 2 ? 'var(--primary)' : 'var(--border)',
            minWidth: '24px',
            margin: '0 0.5rem',
            borderRadius: '2px',
            transition: 'background-color 400ms ease-out',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: currentStep >= 2 ? 'var(--primary)' : 'var(--bg-surface-subtle)',
              color: currentStep >= 2 ? 'var(--text-inverse)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '0.88rem',
              transition: 'background-color 300ms ease-out',
            }}
          >
            2
          </span>
          <span style={{ fontWeight: currentStep === 2 ? '700' : '500', color: currentStep >= 2 ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.95rem' }}>
            Analysing
          </span>
        </div>

        <div
          style={{
            flex: 1,
            height: '3px',
            backgroundColor: currentStep >= 3 ? 'var(--stage-1)' : 'var(--border)',
            minWidth: '24px',
            margin: '0 0.5rem',
            borderRadius: '2px',
            transition: 'background-color 400ms ease-out',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: currentStep >= 3 ? 'var(--stage-1)' : 'var(--bg-surface-subtle)',
              color: currentStep >= 3 ? 'var(--text-inverse)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '0.88rem',
              transition: 'background-color 300ms ease-out',
            }}
          >
            3
          </span>
          <span style={{ fontWeight: currentStep === 3 ? '700' : '500', color: currentStep >= 3 ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.95rem' }}>
            Result
          </span>
        </div>
      </div>

      {/* Hidden Native File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept={ALLOWED_TYPES.join(',')}
        style={{ display: 'none' }}
        aria-label="Upload Brain MRI Scan Image"
      />

      {/* Optional Follow-up Scan Notice & Visit Details Fields */}
      {isFollowUpMode && !prediction && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: 'var(--primary-light)',
            border: '1px solid var(--primary-border)',
            borderRadius: 'var(--radius)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} style={{ color: 'var(--primary)' }} />
              <strong style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                Follow-up MRI Scan Session
              </strong>
            </div>
            <button
              type="button"
              onClick={() => setIsFollowUpMode(false)}
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', minHeight: '30px' }}
            >
              Cancel Follow-up Mode
            </button>
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
            Uploading this scan as a subsequent clinical visit will link it to the patient&apos;s longitudinal timeline for side-by-side comparison.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="followup-visit-date" style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Visit Date
              </label>
              <input
                id="followup-visit-date"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label htmlFor="followup-visit-notes" style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Visit Notes / Physician Notes (Optional)
              </label>
              <input
                id="followup-visit-notes"
                type="text"
                placeholder="e.g. 6-month routine neurological check"
                value={visitNotes}
                onChange={(e) => setVisitNotes(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Scan Viewport Area */}
      <div
        className="mri-viewport"
        style={{
          minHeight: '360px',
          maxHeight: '440px',
          position: 'relative',
          padding: '1.5rem',
          backgroundColor: previewUrl ? '#0F172A' : 'var(--bg-surface)',
        }}
      >
        {/* Step 1: No scan loaded yet -> Dropzone with actions */}
        {!previewUrl ? (
          <div
            className={`dropzone ${isDragOver ? 'dropzone-dragover' : 'dropzone-idle'}`}
            onDragOver={onDragOverHandler}
            onDragLeave={onDragLeaveHandler}
            onDrop={onDropHandler}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            aria-label="Drag and drop brain MRI image here or press Enter to choose file"
            style={{ width: '100%', maxWidth: '480px' }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem auto',
                color: 'var(--primary)',
              }}
            >
              <UploadCloud size={28} aria-hidden="true" />
            </div>

            <h3 style={{ fontSize: '1.18rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              {isFollowUpMode ? t('mri.drop_followup_title') : t('mri.drop_title')}
            </h3>
            <p style={{ fontSize: '0.96rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {t('mri.drop_subtitle')}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <FileImage size={20} aria-hidden="true" />
                <span>{t('mri.choose_scan')}</span>
              </button>

              {onOpenReanalyseModal && !isFollowUpMode && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenReanalyseModal();
                  }}
                  aria-label={t('mri.reanalyse_previous')}
                >
                  <RotateCcw size={18} aria-hidden="true" />
                  <span>{t('mri.reanalyse_previous')}</span>
                </button>
              )}
            </div>
          </div>
        ) : isLoading ? (
          /* Step 2: Calming Analysis In-Progress Screen */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1.5rem',
              color: '#FFFFFF',
              textAlign: 'center',
              padding: '2rem',
              width: '100%',
              maxWidth: '420px',
            }}
            aria-live="polite"
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                border: '3px solid rgba(255, 255, 255, 0.2)',
                borderTopColor: 'var(--primary-border)',
                animation: 'spin 1.2s linear infinite',
              }}
            />

            <div style={{ minHeight: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <AnimatePresence mode="wait">
                <motion.h3
                  key={loadingMsgIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.25 }}
                  style={{ color: '#FFFFFF', fontSize: '1.25rem', marginBottom: '0.35rem', margin: 0 }}
                >
                  {friendlyLoadingMessages[loadingMsgIndex]}
                </motion.h3>
              </AnimatePresence>
              <p style={{ color: '#94A3B8', fontSize: '0.92rem', margin: '0.35rem 0 0 0' }}>
                {t('mri.loading_duration')}
              </p>
            </div>

            {/* Calm progress bar */}
            <div
              style={{
                width: '100%',
                height: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <motion.div
                style={{
                  height: '100%',
                  backgroundColor: 'var(--primary-border)',
                  borderRadius: '3px',
                }}
                animate={{ width: `${analysisProgress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>
        ) : (
          /* Step 3: Loaded Scan / Result Viewport */
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Layer Selection Pill when Heatmaps exist */}
            {heatmaps && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  zIndex: 20,
                  display: 'flex',
                  gap: '0.35rem',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  padding: '0.25rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                }}
                role="group"
                aria-label="Image view options"
              >
                <button
                  type="button"
                  onClick={() => setActiveLayer('original')}
                  style={{
                    background: activeLayer === 'original' ? 'var(--primary)' : 'transparent',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 'var(--radius-xs)',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.88rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 150ms ease-out',
                  }}
                >
                  {t('mri.layer_original')}
                </button>
                {heatmaps.gradcam && (
                  <button
                    type="button"
                    onClick={() => setActiveLayer('gradcam')}
                    style={{
                      background: activeLayer === 'gradcam' ? 'var(--primary)' : 'transparent',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 'var(--radius-xs)',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 150ms ease-out',
                    }}
                  >
                    {t('mri.layer_gradcam')}
                  </button>
                )}
                {heatmaps.integratedGradients && (
                  <button
                    type="button"
                    onClick={() => setActiveLayer('ig')}
                    style={{
                      background: activeLayer === 'ig' ? 'var(--primary)' : 'transparent',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 'var(--radius-xs)',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.88rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 150ms ease-out',
                    }}
                  >
                    {t('mri.layer_ig')}
                  </button>
                )}
              </div>
            )}

            {/* Zoom Controls */}
            <div
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                padding: '0.25rem 0.45rem',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <button
                type="button"
                onClick={zoomIn}
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', padding: '0.35rem', cursor: 'pointer' }}
                aria-label={t('mri.zoom_in')}
                title={t('mri.zoom_in')}
              >
                <ZoomIn size={16} />
              </button>
              <span style={{ color: '#E2E8F0', fontSize: '0.88rem', minWidth: '38px', textAlign: 'center' }}>
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={zoomOut}
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', padding: '0.35rem', cursor: 'pointer' }}
                aria-label={t('mri.zoom_out')}
                title={t('mri.zoom_out')}
              >
                <ZoomOut size={16} />
              </button>
              <button
                type="button"
                onClick={resetZoom}
                style={{ background: 'transparent', border: 'none', color: '#FFFFFF', padding: '0.35rem', cursor: 'pointer' }}
                aria-label={t('mri.reset_zoom')}
                title={t('mri.reset_zoom')}
              >
                <Maximize2 size={16} />
              </button>
            </div>

            {/* Active MRI Image */}
            <AnimatePresence mode="wait">
              <motion.img
                key={currentMainImage}
                src={currentMainImage}
                alt={activeLayer === 'original' ? 'Loaded brain MRI axial scan' : 'Brain scan with computer attention overlay'}
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0.6 }}
                transition={{ duration: 0.2 }}
                style={{
                  maxHeight: '340px',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-xs)',
                  transform: `scale(${zoomLevel})`,
                  transition: 'transform 150ms ease-out',
                }}
              />
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Error Message Alert */}
      {errorMsg && (
        <div
          role="alert"
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'var(--stage-4-bg)',
            border: '1px solid var(--stage-4-border)',
            borderRadius: 'var(--radius)',
            color: 'var(--stage-4)',
            fontSize: '0.92rem',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* File Action Controls (Prior to Analysis) */}
      {previewUrl && !prediction && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            borderTop: '1px solid var(--border)',
            paddingTop: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.96rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              {selectedFile?.name || 'mri_scan.png'}
            </span>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {t('mri.file_size', {
                size: selectedFile ? (selectedFile.size / 1024).toFixed(1) : 0,
                session: isFollowUpMode ? t('mri.session_followup') : t('mri.session_initial'),
              })}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleReset}
              disabled={isLoading}
              className="btn-secondary"
              aria-label={t('mri.choose_another')}
            >
              <X size={18} aria-hidden="true" />
              <span>{t('mri.choose_another')}</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerAnalysis}
              disabled={isLoading}
              className="btn-primary"
              aria-label={isFollowUpMode ? t('mri.analyse_followup') : t('mri.analyse_scan')}
              style={{ minWidth: '180px' }}
            >
              {isLoading ? (
                <>
                  <span
                    className="btn-spinner"
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTopColor: '#ffffff',
                      display: 'inline-block',
                    }}
                  />
                  <span>{t('mri.analysing')}</span>
                </>
              ) : (
                <>
                  <Play size={18} aria-hidden="true" />
                  <span>{isFollowUpMode ? t('mri.analyse_followup') : t('mri.analyse_scan')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 4 Clear Distinguishable Post-Analysis Actions (When Prediction is complete) */}
      {prediction && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            borderTop: '1px solid var(--border)',
            paddingTop: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} style={{ color: 'var(--primary)' }} />
              <strong style={{ fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                {t('mri.analysis_complete')}
              </strong>
            </div>

            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: '600',
                padding: '0.2rem 0.6rem',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--stage-1-bg)',
                color: 'var(--stage-1)',
                border: '1px solid var(--stage-1-border)',
              }}
            >
              {prediction.evaluationType === 'reanalysis'
                ? t('mri.eval_reanalysis')
                : prediction.evaluationType === 'follow_up'
                ? t('mri.eval_followup')
                : t('mri.eval_original')}
            </span>
          </div>

          {/* 4 Obvious Actions Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {/* Action 1: View Current Results */}
            <button
              type="button"
              onClick={onViewCurrentResults || scrollToResults}
              className="btn-primary"
              style={{ minHeight: '44px', justifyContent: 'center' }}
              aria-label={t('mri.action_view_results')}
            >
              <ArrowDown size={18} aria-hidden="true" />
              <span>{t('mri.action_view_results')}</span>
            </button>

            {/* Action 2: Reanalyse This Scan */}
            <button
              type="button"
              onClick={onReanalyseCurrent}
              disabled={isLoading}
              className="btn-secondary"
              style={{ minHeight: '44px', justifyContent: 'center' }}
              aria-label={t('mri.action_reanalyse')}
            >
              <RotateCcw size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
              <span>{t('mri.action_reanalyse')}</span>
            </button>

            {/* Action 3: Upload New Follow-up MRI */}
            <button
              type="button"
              onClick={handleStartFollowUp}
              disabled={isLoading}
              className="btn-secondary"
              style={{ minHeight: '44px', justifyContent: 'center' }}
              aria-label={t('mri.action_upload_followup')}
            >
              <Plus size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
              <span>{t('mri.action_upload_followup')}</span>
            </button>

            {/* Action 4: Compare with Previous Scans */}
            {onNavigateToComparison && (
              <button
                type="button"
                onClick={onNavigateToComparison}
                className="btn-secondary"
                style={{ minHeight: '44px', justifyContent: 'center' }}
                aria-label={t('mri.action_compare')}
              >
                <GitCompare size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                <span>{t('mri.action_compare')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
