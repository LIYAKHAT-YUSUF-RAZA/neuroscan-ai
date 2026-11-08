import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  FileText,
  Pill,
  Calendar,
  Utensils,
  BookOpen,
  MoreHorizontal,
  Settings,
  Mail,
  Stethoscope,
  Activity,
  Heart,
  X,
  History,
  ShieldCheck,
  GitCompare,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function Sidebar({
  activeView,
  onNavigate,
  onOpenSettings,
  isMobileOpen = false,
  onCloseMobile,
}) {
  const { t } = useLanguage();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // 6 Primary Plain-Language Navigation Destinations for Desktop
  const primaryNavItems = useMemo(() => [
    {
      id: 'viewer',
      label: t('nav.viewer'),
      icon: Brain,
      description: t('nav.viewer_desc'),
    },
    {
      id: 'dashboard',
      label: t('nav.dashboard'),
      icon: FileText,
      description: t('nav.dashboard_desc'),
      relatedViews: ['dashboard', 'history', 'care-recommendations', 'comparison'],
    },
    {
      id: 'medications',
      label: t('nav.medications'),
      icon: Pill,
      description: t('nav.medications_desc'),
      relatedViews: ['medications'],
    },
    {
      id: 'appointments',
      label: t('nav.appointments'),
      icon: Calendar,
      description: t('nav.appointments_desc'),
      relatedViews: ['appointments', 'specialists'],
    },
    {
      id: 'nutrition',
      label: t('nav.nutrition'),
      icon: Utensils,
      description: t('nav.nutrition_desc'),
      relatedViews: ['nutrition', 'routine'],
    },
    {
      id: 'educational',
      label: t('nav.educational'),
      icon: BookOpen,
      description: t('nav.educational_desc'),
      relatedViews: ['educational', 'research', 'notifications'],
    },
  ], [t]);

  const handleItemClick = (viewId) => {
    onNavigate(viewId);
    if (onCloseMobile) onCloseMobile();
    setIsMoreMenuOpen(false);
  };

  const isItemActive = (item) => {
    if (activeView === item.id) return true;
    if (item.relatedViews && item.relatedViews.includes(activeView)) return true;
    return false;
  };

  return (
    <>
      {/* Desktop Sidebar (Permanent, 250px) */}
      <aside className="app-sidebar" aria-label="Primary Application Navigation">
        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius)',
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <Brain size={22} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.15 }}>
                NeuroScan AI
              </div>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                {t('nav.brand_subtitle')}
              </span>
            </div>
          </div>
        </div>

        {/* 6 Primary Items Navigation with Sliding Active Highlight */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '1rem 0', flex: 1, position: 'relative' }}>
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.id)}
                className={`sidebar-nav-btn ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                style={{
                  minHeight: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius)',
                  position: 'relative',
                  background: active ? 'var(--primary-light)' : 'transparent',
                  border: active ? '1px solid var(--primary-border)' : '1px solid transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {active && (
                  <motion.div
                    layoutId="sidebar-active-indicator"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '15%',
                      bottom: '15%',
                      width: '3px',
                      borderRadius: '0 4px 4px 0',
                      backgroundColor: 'var(--primary)',
                    }}
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <Icon
                  size={22}
                  className="sidebar-icon"
                  style={{
                    color: active ? 'var(--primary)' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                  aria-hidden="true"
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                  <span style={{ fontSize: '0.98rem', fontWeight: active ? '700' : '600', color: active ? 'var(--primary)' : 'var(--text-primary)' }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                    {item.description}
                  </span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Bottom Section: Quick Sub-Navigation / Settings */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="sidebar-nav-btn"
              style={{ minHeight: '44px' }}
              aria-label="Open System Settings and Model Diagnostics"
            >
              <Settings size={20} className="sidebar-icon" style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
              <span style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{t('nav.settings')}</span>
            </button>
          )}

          <div
            style={{
              padding: '0.6rem 0.75rem',
              background: 'var(--bg-surface-subtle)',
              borderRadius: 'var(--radius)',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
            }}
          >
            {t('nav.brand_prototype')}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (< 768px): 4 Main Tabs + "More" Tab */}
      <nav className="mobile-bottom-bar" aria-label="Mobile Navigation">
        <button
          type="button"
          onClick={() => handleItemClick('viewer')}
          className={`mobile-tab-btn ${activeView === 'viewer' ? 'active' : ''}`}
          aria-label={t('nav.viewer')}
        >
          <Brain size={22} aria-hidden="true" />
          <span>{t('nav.mobile_scan')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleItemClick('dashboard')}
          className={`mobile-tab-btn ${activeView === 'dashboard' || activeView === 'history' ? 'active' : ''}`}
          aria-label={t('nav.dashboard')}
        >
          <FileText size={22} aria-hidden="true" />
          <span>{t('nav.mobile_reports')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleItemClick('medications')}
          className={`mobile-tab-btn ${activeView === 'medications' ? 'active' : ''}`}
          aria-label={t('nav.medications')}
        >
          <Pill size={22} aria-hidden="true" />
          <span>{t('nav.mobile_meds')}</span>
        </button>

        <button
          type="button"
          onClick={() => handleItemClick('appointments')}
          className={`mobile-tab-btn ${activeView === 'appointments' || activeView === 'specialists' ? 'active' : ''}`}
          aria-label={t('nav.appointments')}
        >
          <Calendar size={22} aria-hidden="true" />
          <span>{t('nav.mobile_visits')}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMoreMenuOpen(true)}
          className={`mobile-tab-btn ${isMoreMenuOpen ? 'active' : ''}`}
          aria-label={t('nav.more_options_title')}
        >
          <MoreHorizontal size={22} aria-hidden="true" />
          <span>{t('nav.mobile_more')}</span>
        </button>
      </nav>

      {/* Accessible Mobile "More" Drawer Modal */}
      <AnimatePresence>
        {isMoreMenuOpen && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Additional Navigation Options"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(31, 41, 51, 0.45)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
            onClick={() => setIsMoreMenuOpen(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{
                width: '100%',
                maxWidth: '480px',
                backgroundColor: 'var(--bg-surface)',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                padding: '1.25rem 1.25rem 2rem 1.25rem',
                boxShadow: 'var(--shadow-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                  {t('nav.more_options_title')}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '0.4rem',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => handleItemClick('nutrition')}
                  className="btn-secondary"
                  style={{ minHeight: '48px', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                >
                  <Utensils size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  <span>{t('nav.titles.nutrition')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleItemClick('routine')}
                  className="btn-secondary"
                  style={{ minHeight: '48px', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                >
                  <Activity size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  <span>{t('nav.titles.routine')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleItemClick('specialists')}
                  className="btn-secondary"
                  style={{ minHeight: '48px', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                >
                  <Stethoscope size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  <span>{t('nav.titles.specialists')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleItemClick('history')}
                  className="btn-secondary"
                  style={{ minHeight: '48px', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                >
                  <History size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  <span>{t('nav.titles.history')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleItemClick('comparison')}
                  className="btn-secondary"
                  style={{ minHeight: '48px', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                >
                  <GitCompare size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  <span>{t('nav.titles.comparison')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleItemClick('educational')}
                  className="btn-secondary"
                  style={{ minHeight: '48px', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                >
                  <BookOpen size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  <span>{t('nav.titles.educational')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleItemClick('notifications')}
                  className="btn-secondary"
                  style={{ minHeight: '48px', justifyContent: 'flex-start', padding: '0.65rem 0.85rem' }}
                >
                  <Mail size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  <span>{t('nav.titles.notifications')}</span>
                </button>
              </div>

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="btn-secondary"
                  style={{ minHeight: '48px', marginTop: '0.5rem', justifyContent: 'center' }}
                >
                  <Settings size={18} aria-hidden="true" />
                  <span>{t('nav.patient_menu.system_settings')}</span>
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
