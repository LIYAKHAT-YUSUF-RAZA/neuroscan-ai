import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileImage, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchScanImageBlob } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

/**
 * AuthenticatedMriImage
 * Loads and renders an authenticated MRI scan image binary via Blob & URL.createObjectURL.
 * Handles loading, error, retry, and unavailable states, revoking object URLs upon change or unmount.
 */
export default function AuthenticatedMriImage({
  scanId,
  patientId,
  userRole,
  alt = 'Brain MRI scan image',
  evalLabel = 'Evaluation',
  containerStyle = {},
  imageStyle = {},
}) {
  const { t } = useLanguage();
  const [objectUrl, setObjectUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryNonce, setRetryNonce] = useState(0);

  // Keep a reference to the active object URL so we can revoke it immediately
  const activeUrlRef = useRef(null);

  const revokeCurrentUrl = useCallback(() => {
    if (activeUrlRef.current) {
      try {
        URL.revokeObjectURL(activeUrlRef.current);
      } catch {
        // Ignore revocation errors
      }
      activeUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Clear previous state and revoke previous object URL
    revokeCurrentUrl();
    setObjectUrl(null);
    setError(null);

    // If no scanId is associated with this evaluation, stop here (shows unavailable placeholder)
    if (!scanId) {
      setIsLoading(false);
      return;
    }

    let isCurrent = true;
    const controller = new AbortController();
    setIsLoading(true);

    fetchScanImageBlob(scanId, patientId, userRole, { signal: controller.signal })
      .then((blob) => {
        if (!isCurrent) return;
        const newUrl = URL.createObjectURL(blob);
        activeUrlRef.current = newUrl;
        setObjectUrl(newUrl);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isCurrent || err.name === 'AbortError') return;
        setError(err.message || t('common.scan_failed'));
        setIsLoading(false);
      });

    return () => {
      isCurrent = false;
      controller.abort();
      revokeCurrentUrl();
    };
  }, [scanId, patientId, userRole, retryNonce, revokeCurrentUrl, t]);

  const isThumbnail =
    (containerStyle.height && parseInt(containerStyle.height) <= 90) ||
    (containerStyle.width && parseInt(containerStyle.width) <= 90);

  const baseContainerStyle = {
    height: '240px',
    backgroundColor: '#0F172A',
    borderRadius: 'var(--radius)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    padding: isThumbnail ? '0' : '1rem',
    color: '#94A3B8',
    ...containerStyle,
  };

  // State 1: Scan file not associated / missing scanId
  if (!scanId) {
    if (isThumbnail) {
      return (
        <div style={baseContainerStyle} role="status" aria-label={`MRI file unavailable for ${evalLabel}`}>
          <FileImage size={22} style={{ color: '#475569' }} aria-hidden="true" />
        </div>
      );
    }
    return (
      <div style={baseContainerStyle} role="status" aria-label={`MRI file unavailable for ${evalLabel}`}>
        <FileImage size={40} style={{ color: '#475569', marginBottom: '0.45rem' }} aria-hidden="true" />
        <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#CBD5E1' }}>
          {t('common.mri_unavailable')}
        </span>
        <span
          style={{
            fontSize: '0.78rem',
            color: '#64748B',
            textAlign: 'center',
            maxWidth: '240px',
            marginTop: '0.25rem',
            lineHeight: 1.4,
          }}
        >
          {t('common.mri_unavailable_desc')}
        </span>
      </div>
    );
  }

  // State 2: Loading binary
  if (isLoading) {
    if (isThumbnail) {
      return (
        <div style={baseContainerStyle} role="status" aria-label={`Loading MRI scan for ${evalLabel}`}>
          <div
            style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: '2px solid rgba(255, 255, 255, 0.15)',
              borderTopColor: 'var(--primary)',
              animation: 'spin 1s linear infinite',
            }}
            aria-hidden="true"
          />
        </div>
      );
    }
    return (
      <div style={baseContainerStyle} role="status" aria-label={`Loading MRI scan for ${evalLabel}`}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '3px solid rgba(255, 255, 255, 0.15)',
            borderTopColor: 'var(--primary)',
            animation: 'spin 1s linear infinite',
            marginBottom: '0.75rem',
          }}
          aria-hidden="true"
        />
        <span style={{ fontSize: '0.85rem', color: '#E2E8F0', fontWeight: '500' }}>
          {t('common.image_loading')}
        </span>
      </div>
    );
  }

  // State 3: Error with Retry button
  if (error || !objectUrl) {
    if (isThumbnail) {
      return (
        <div style={baseContainerStyle} role="alert" title={error || t('common.scan_unavailable')} aria-label={`Failed to load MRI scan for ${evalLabel}`}>
          <AlertCircle size={20} style={{ color: '#F87171' }} aria-hidden="true" />
        </div>
      );
    }
    return (
      <div style={baseContainerStyle} role="alert" aria-label={`Failed to load MRI scan for ${evalLabel}`}>
        <AlertCircle size={32} style={{ color: '#F87171', marginBottom: '0.45rem' }} aria-hidden="true" />
        <span style={{ fontSize: '0.88rem', fontWeight: '600', color: '#FECACA' }}>
          {t('common.scan_unavailable')}
        </span>
        <span
          style={{
            fontSize: '0.76rem',
            color: '#94A3B8',
            textAlign: 'center',
            maxWidth: '250px',
            marginTop: '0.2rem',
            marginBottom: '0.75rem',
            lineHeight: 1.4,
          }}
        >
          {error || t('common.scan_failed')}
        </span>
        <button
          type="button"
          onClick={() => setRetryNonce((n) => n + 1)}
          className="btn-secondary"
          style={{
            padding: '0.35rem 0.75rem',
            fontSize: '0.8rem',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: '#FFFFFF',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'var(--radius-xs)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
          aria-label={`Retry loading MRI image for ${evalLabel}`}
        >
          <RefreshCw size={13} />
          <span>{t('common.retry')}</span>
        </button>
      </div>
    );
  }

  // State 4: Successfully loaded image
  return (
    <div style={baseContainerStyle}>
      <img
        src={objectUrl}
        alt={alt}
        style={{
          maxHeight: '100%',
          maxWidth: '100%',
          objectFit: 'contain',
          borderRadius: 'var(--radius-xs)',
          ...imageStyle,
        }}
      />
    </div>
  );
}
