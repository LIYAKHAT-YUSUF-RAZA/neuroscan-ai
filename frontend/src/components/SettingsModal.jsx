import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ShieldCheck, Cpu, Database, AlertCircle, FileCode, Mail } from 'lucide-react';
import EmailNotificationSettings from './EmailNotificationSettings';
import { useLanguage } from '../context/LanguageContext';

export default function SettingsModal({ isOpen, onClose, health, patientId = null, activePatient = null }) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('notifications');

  if (!isOpen) return null;

  const isAiReady = health?.aiService?.reachable && health?.aiService?.data?.modelLoaded;
  const isDbReady = health?.database?.connected;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(31, 41, 51, 0.45)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <motion.div
        className="panel"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: activeTab === 'notifications' ? '840px' : '580px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.4rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-lg)',
          transition: 'max-width 0.2s ease',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activeTab === 'notifications' ? (
              <Mail size={18} color="var(--primary)" />
            ) : (
              <Cpu size={18} color="var(--primary)" />
            )}
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {activeTab === 'notifications'
                ? t('settings.email_title')
                : t('settings.tab_research')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '0.25rem 0.5rem' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.4rem',
            background: 'var(--panel-secondary)',
            padding: '0.2rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            marginBottom: '1rem',
          }}
        >
          <button
            onClick={() => setActiveTab('notifications')}
            style={{
              padding: '0.35rem 0.85rem',
              background: activeTab === 'notifications' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'notifications' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.78rem',
              fontWeight: activeTab === 'notifications' ? '600' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Mail size={13} />
            <span>{t('settings.tab_notifications')}</span>
          </button>

          <button
            onClick={() => setActiveTab('system')}
            style={{
              padding: '0.35rem 0.85rem',
              background: activeTab === 'system' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'system' ? '#ffffff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.78rem',
              fontWeight: activeTab === 'system' ? '600' : '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease',
            }}
          >
            <Cpu size={13} />
            <span>{t('settings.tab_research')}</span>
          </button>
        </div>

        {/* Modal Body Container with Scroll */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.25rem' }}>
          {activeTab === 'notifications' && (
            <EmailNotificationSettings patientId={patientId} activePatient={activePatient} />
          )}

          {activeTab === 'system' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Identity & Subtitle */}
              <div style={{ padding: '0.85rem', background: 'var(--panel-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Application Identity
                </span>
                <p style={{ fontSize: '0.88rem', fontWeight: '600', color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                  NeuroScan AI — Research Prototype
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Alzheimer's MRI Classification & Explainable AI
                </p>
              </div>

              {/* Architecture & Checkpoint Integrity */}
              <div style={{ padding: '0.85rem', background: 'var(--panel-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Model Architecture & Checkpoint
                </span>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-primary)', margin: '0.2rem 0 0.4rem 0' }}>
                  Hybrid EfficientNet-B0 + Swin-Small Vision Transformer
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <FileCode size={12} color="var(--primary)" />
                  <span>SHA-256 Checkpoint:</span>
                </div>
                <code
                  style={{
                    display: 'block',
                    marginTop: '0.25rem',
                    padding: '0.4rem 0.6rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.68rem',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--primary)',
                    wordBreak: 'break-all',
                    border: '1px solid var(--border)',
                  }}
                >
                  676fefe87d63ab727fe9b3451e94d86b056082651bbe858ca52bb56ae8fcdf06
                </code>
              </div>

              {/* Services & Endpoints Status */}
              <div style={{ padding: '0.85rem', background: 'var(--panel-secondary)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Backend Microservices
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginTop: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.76rem' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isAiReady ? 'var(--success)' : 'var(--danger)',
                      }}
                    />
                    <span style={{ color: isAiReady ? 'var(--text-primary)' : 'var(--danger)' }}>
                      Flask AI: {isAiReady ? 'Ready (CPU)' : 'Offline'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.76rem' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isDbReady ? 'var(--success)' : 'var(--warning)',
                      }}
                    />
                    <span style={{ color: isDbReady ? 'var(--text-primary)' : 'var(--stage-3)' }}>
                      MongoDB: {isDbReady ? 'Connected' : 'Stateless'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Research Disclaimer */}
              <div
                style={{
                  padding: '0.75rem',
                  background: 'var(--stage-4-bg)',
                  border: '1px solid var(--stage-4-border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  gap: '0.5rem',
                }}
              >
                <AlertCircle size={15} color="var(--stage-4)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '0.72rem', color: 'var(--stage-4)', margin: 0, lineHeight: '1.45', fontWeight: '500' }}>
                  NeuroScan AI is strictly an experimental educational prototype and research instrument. It is not approved by medical regulatory authorities and must never be used for clinical diagnosis, patient management, or therapeutic decisions.
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
