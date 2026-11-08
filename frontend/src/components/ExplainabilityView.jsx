import React, { useState, useEffect } from 'react';
import { Eye, Layers, Compass, Info, Maximize2, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function ExplainabilityView({ heatmaps }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('both'); // 'both', 'gradcam', 'ig'
  const [enlargedModal, setEnlargedModal] = useState(null);
  const [modalZoom, setModalZoom] = useState(1);

  // Close lightbox modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setEnlargedModal(null);
        setModalZoom(1);
      }
    };
    if (enlargedModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enlargedModal]);

  if (!heatmaps) return null;

  const { gradcam, integratedGradients } = heatmaps;

  const openModal = (data) => {
    setModalZoom(1);
    setEnlargedModal(data);
  };

  const closeModal = () => {
    setEnlargedModal(null);
    setModalZoom(1);
  };

  return (
    <section
      className="panel"
      id="explainable-ai"
      aria-label="Brain Attention Visualizations"
      style={{
        padding: '1.5rem 1.75rem',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* 1. Header with Plain Explanation */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Eye size={20} style={{ color: 'var(--primary)' }} aria-hidden="true" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('prediction.explanation.title')}
            </h2>
          </div>
          <p style={{ fontSize: '0.94rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            {t('prediction.explanation.subtitle')}
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.25rem',
            backgroundColor: 'var(--bg-surface-subtle)',
            padding: '0.25rem',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}
          role="group"
          aria-label="Select visualization mode"
        >
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'both' ? '700' : '500',
              borderRadius: 'var(--radius-xs)',
              border: activeTab === 'both' ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'both' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'both' ? 'var(--primary)' : 'var(--text-secondary)',
              transition: 'all 150ms ease-out',
            }}
          >
            Side-by-Side
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gradcam')}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'gradcam' ? '700' : '500',
              borderRadius: 'var(--radius-xs)',
              border: activeTab === 'gradcam' ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'gradcam' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'gradcam' ? 'var(--primary)' : 'var(--text-secondary)',
              transition: 'all 150ms ease-out',
            }}
          >
            Brain Attention
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ig')}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.85rem',
              fontWeight: activeTab === 'ig' ? '700' : '500',
              borderRadius: 'var(--radius-xs)',
              border: activeTab === 'ig' ? '1px solid var(--border)' : 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'ig' ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === 'ig' ? 'var(--primary)' : 'var(--text-secondary)',
              transition: 'all 150ms ease-out',
            }}
          >
            Detailed Regions
          </button>
        </div>
      </div>

      {/* 2. Visual Heatmaps Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: activeTab === 'both' ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr',
          gap: '1.25rem',
          width: '100%',
        }}
      >
        {/* Panel 1: Grad-CAM Brain Attention */}
        {(activeTab === 'both' || activeTab === 'gradcam') && (
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-surface-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Brain Attention Map
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.78rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--primary)',
                  fontWeight: '600',
                  border: '1px solid var(--primary-border)',
                }}
              >
                Grad-CAM
              </span>
            </div>

            <div
              onClick={() =>
                openModal({
                  title: 'Brain Attention Map (Grad-CAM)',
                  image: gradcam,
                  description:
                    'Highlights the broad anatomical zones of the brain image that most strongly directed the model to its evaluation.',
                })
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  openModal({
                    title: 'Brain Attention Map (Grad-CAM)',
                    image: gradcam,
                    description:
                      'Highlights the broad anatomical zones of the brain image that most strongly directed the model to its evaluation.',
                  });
                }
              }}
              style={{
                padding: '1.25rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#0F172A',
                cursor: 'pointer',
                position: 'relative',
                minHeight: '280px',
              }}
              aria-label="Click to enlarge Brain Attention Map"
            >
              <img
                src={gradcam}
                alt="Brain attention heatmap overlay showing highlighted regions"
                style={{
                  maxHeight: '260px',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-xs)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.8rem',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Maximize2 size={14} aria-hidden="true" />
                <span>Enlarge</span>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', backgroundColor: 'var(--bg-surface)' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                Shows the larger brain zones (such as ventricles and hippocampus regions) that received the most focus.
              </p>
            </div>
          </div>
        )}

        {/* Panel 2: Detailed Region Map (Integrated Gradients) */}
        {(activeTab === 'both' || activeTab === 'ig') && (
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '0.75rem 1rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-surface-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Compass size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Detailed Region Map
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.78rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radius-xs)',
                  backgroundColor: 'var(--stage-2-bg)',
                  color: 'var(--stage-2)',
                  fontWeight: '600',
                  border: '1px solid var(--stage-2-border)',
                }}
              >
                Integrated Gradients
              </span>
            </div>

            <div
              onClick={() =>
                openModal({
                  title: 'Detailed Region Map (Integrated Gradients)',
                  image: integratedGradients,
                  description:
                    'Pinpoints fine-grained tissue edges and pixel boundaries that contributed to the model evaluation.',
                })
              }
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  openModal({
                    title: 'Detailed Region Map (Integrated Gradients)',
                    image: integratedGradients,
                    description:
                      'Pinpoints fine-grained tissue edges and pixel boundaries that contributed to the model evaluation.',
                  });
                }
              }}
              style={{
                padding: '1.25rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#0F172A',
                cursor: 'pointer',
                position: 'relative',
                minHeight: '280px',
              }}
              aria-label="Click to enlarge Detailed Region Map"
            >
              <img
                src={integratedGradients}
                alt="Detailed region pixel gradient attribution map"
                style={{
                  maxHeight: '260px',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-xs)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.8rem',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <Maximize2 size={14} aria-hidden="true" />
                <span>Enlarge</span>
              </div>
            </div>

            <div style={{ padding: '0.85rem 1rem', backgroundColor: 'var(--bg-surface)' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                Examines fine-grained edges and tissue contrasts to check for subtle structural variations.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Plain Language Explanatory Note */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.65rem',
          padding: '0.85rem 1.15rem',
          backgroundColor: 'var(--bg-surface-subtle)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: '0.88rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.5',
        }}
      >
        <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
        <span>
          <strong>How to read these maps:</strong> Brightly colored areas show what caught the computer model's attention during analysis. They help researchers understand the algorithm's focus and are not a substitute for clinical radiological reporting.
        </span>
      </div>

      {/* 4. Accessible Enlarge Modal Lightbox */}
      {enlargedModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={enlargedModal.title}
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(31, 41, 51, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              maxWidth: '680px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '0.85rem 1.25rem',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-surface-subtle)',
              }}
            >
              <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {enlargedModal.title}
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalZoom((z) => Math.min(z + 0.25, 2.5))}
                  className="btn-secondary"
                  style={{ minHeight: '34px', padding: '0.2rem 0.5rem' }}
                  aria-label="Zoom in"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalZoom((z) => Math.max(z - 0.25, 0.75))}
                  className="btn-secondary"
                  style={{ minHeight: '34px', padding: '0.2rem 0.5rem' }}
                  aria-label="Zoom out"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setModalZoom(1)}
                  className="btn-secondary"
                  style={{ minHeight: '34px', padding: '0.2rem 0.5rem' }}
                  aria-label="Reset zoom"
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary"
                  style={{ minHeight: '34px', padding: '0.2rem 0.5rem', color: 'var(--stage-4)' }}
                  aria-label="Close enlarged view"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Image Viewport */}
            <div
              style={{
                padding: '1.5rem',
                backgroundColor: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '360px',
                maxHeight: '480px',
                overflow: 'hidden',
              }}
            >
              <img
                src={enlargedModal.image}
                alt={enlargedModal.title}
                style={{
                  maxHeight: '440px',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  transform: `scale(${modalZoom})`,
                  transition: 'transform 150ms ease-out',
                }}
              />
            </div>

            <div style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--bg-surface)' }}>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                {enlargedModal.description}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
