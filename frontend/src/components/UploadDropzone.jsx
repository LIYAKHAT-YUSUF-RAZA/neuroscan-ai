import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, X, AlertCircle, Play, Sparkles } from 'lucide-react';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export default function UploadDropzone({ onPredict, isLoading, onClear, selectedFile, setSelectedFile }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    setErrorMsg(null);
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMsg(`Unsupported format (${file.type || 'unknown'}). Supported: JPEG, PNG, WEBP, BMP, TIFF.`);
      return;
    }

    if (file.size > MAX_BYTES) {
      setErrorMsg(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 10 MB limit.`);
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClear) onClear();
  };

  return (
    <div
      className="panel"
      style={{
        padding: '1.25rem 1.35rem',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header: Title and Clear Scan Action */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
          minHeight: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UploadCloud size={17} color="#38bdf8" />
          <h2 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#f8fafc', margin: 0 }}>
            Brain MRI Scan Upload
          </h2>
        </div>

        {selectedFile && (
          <button
            onClick={handleReset}
            disabled={isLoading}
            className="btn-secondary"
            style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem', color: '#f87171' }}
          >
            <X size={12} />
            <span>Clear Scan</span>
          </button>
        )}
      </div>

      {/* Upload Drop Area or Centered Preview */}
      {!previewUrl ? (
        <div
          className={`dropzone ${isDragOver ? 'active' : ''}`}
          onDragOver={onDragOverHandler}
          onDragLeave={onDragLeaveHandler}
          onDrop={onDropHandler}
          onClick={() => fileInputRef.current?.click()}
          style={{ minHeight: '310px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '3.2rem',
                height: '3.2rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(14, 116, 144, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(56, 189, 248, 0.2)',
              }}
            >
              <ImageIcon size={22} color="#38bdf8" />
            </div>
            <div>
              <p style={{ fontWeight: '600', fontSize: '0.9rem', color: '#f1f5f9' }}>
                Select an MRI scan or drag & drop here
              </p>
              <p style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '0.25rem' }}>
                Axial, coronal, or sagittal T1/T2 series (PNG, JPG, up to 10 MB)
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Focused Image Preview with Precise Frame */
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.85rem',
            width: '100%',
            paddingTop: '0.25rem',
          }}
        >
          {/* Neutral precise border frame */}
          <div
            style={{
              width: '100%',
              maxWidth: '300px',
              aspectRatio: '1/1',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              border: '1px solid var(--border-medium)',
              background: '#040711',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={previewUrl}
              alt="Brain MRI Preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          {/* Quiet Metadata below preview */}
          <div style={{ textAlign: 'center', maxWidth: '300px', width: '100%' }}>
            <p
              style={{
                fontWeight: '600',
                fontSize: '0.82rem',
                color: '#e2e8f0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedFile?.name}
            </p>
            <p style={{ color: '#64748b', fontSize: '0.74rem', marginTop: '0.15rem' }}>
              {(selectedFile?.size / 1024).toFixed(1)} KB • {selectedFile?.type || 'image'}
            </p>
          </div>

          {/* Wide Classify Action Button */}
          <button
            onClick={() => onPredict(selectedFile)}
            disabled={isLoading}
            className="btn-primary"
            style={{ width: '100%', maxWidth: '300px', marginTop: '0.25rem' }}
          >
            {isLoading ? (
              <>
                <Sparkles size={15} className="animate-spin" />
                <span>Computing Inference & XAI...</span>
              </>
            ) : (
              <>
                <Play size={15} fill="#ffffff" />
                <span>Classify & Generate Heatmaps</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Validation Error Notice */}
      {errorMsg && (
        <div
          style={{
            marginTop: '0.85rem',
            padding: '0.65rem 0.85rem',
            background: 'rgba(225, 29, 72, 0.08)',
            border: '1px solid rgba(225, 29, 72, 0.25)',
            borderRadius: 'var(--radius-sm)',
            color: '#fda4af',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
