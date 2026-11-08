import React, { useState, useRef, useEffect } from 'react';
import { Menu, User, Mail, Settings, Globe, Sliders, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const VIEW_TITLE_KEYS = {
  dashboard: 'nav.titles.dashboard',
  viewer: 'nav.titles.viewer',
  history: 'nav.titles.history',
  'care-recommendations': 'nav.titles.care_recommendations',
  nutrition: 'nav.titles.nutrition',
  medications: 'nav.titles.medications',
  routine: 'nav.titles.routine',
  appointments: 'nav.titles.appointments',
  specialists: 'nav.titles.specialists',
  notifications: 'nav.titles.notifications',
  educational: 'nav.titles.educational',
  research: 'nav.titles.research',
};

const VIEW_TITLES_FALLBACK = {
  dashboard: 'My Reports',
  viewer: 'Scan Brain MRI',
  history: 'My Reports',
  'care-recommendations': 'Care Guidance',
  nutrition: 'Diet & Routine',
  medications: 'Medicines',
  routine: 'Daily Routine',
  appointments: 'Appointments',
  specialists: 'Find Specialists',
  notifications: 'Email Reminders',
  educational: 'Help & Guides',
  research: 'System & Model Info',
};

export default function Navbar({
  health,
  onToggleMobileNav,
  activePatient,
  onOpenPatientSwitch,
  onOpenPreferences,
  userRole = 'researcher',
  activeView = 'dashboard',
  onNavigate,
  onOpenSettings,
}) {
  const { language, setLanguage, t } = useLanguage();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isAiReady = health?.aiService?.reachable && health?.aiService?.data?.modelLoaded;
  const isDbReady = health?.database?.connected;
  const isFullyOnline = isAiReady && isDbReady;

  const titleKey = VIEW_TITLE_KEYS[activeView];
  const currentTitle = titleKey ? t(titleKey) : (VIEW_TITLES_FALLBACK[activeView] || 'My Reports');


  // Close avatar dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="top-navbar" role="banner">
      {/* Left: Mobile Nav Toggle & Clear Screen Title (matching sidebar exactly) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
        {onToggleMobileNav && (
          <button
            onClick={onToggleMobileNav}
            className="mobile-nav-toggle"
            aria-label="Open navigation menu"
            type="button"
            style={{
              minWidth: '44px',
              minHeight: '44px',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h1
            style={{
              fontSize: '1.35rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {currentTitle}
          </h1>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            {t('nav.brand_subtitle')}
          </span>
        </div>
      </div>

      {/* Right: Language Pill, Patient Chip with Avatar Dropdown, and Tiny Status Dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {/* Language Selector (EN / TE / HI) with 150ms crossfade transition */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            background: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            padding: '0.2rem 0.35rem',
            height: '44px',
          }}
          role="group"
          aria-label="Language selection"
        >
          <Globe size={18} style={{ color: 'var(--text-muted)', marginLeft: '0.25rem' }} aria-hidden="true" />
          <button
            type="button"
            onClick={() => setLanguage('en')}
            style={{
              background: language === 'en' ? 'var(--bg-surface)' : 'transparent',
              color: language === 'en' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: language === 'en' ? '700' : '500',
              border: language === 'en' ? '1px solid var(--border)' : '1px solid transparent',
              borderRadius: 'var(--radius-xs)',
              padding: '0.3rem 0.55rem',
              fontSize: '0.88rem',
              cursor: 'pointer',
              minHeight: '34px',
              transition: 'opacity 150ms ease-out, background-color 150ms ease-out',
            }}
            aria-label="English language"
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('te')}
            style={{
              background: language === 'te' ? 'var(--bg-surface)' : 'transparent',
              color: language === 'te' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: language === 'te' ? '700' : '500',
              border: language === 'te' ? '1px solid var(--border)' : '1px solid transparent',
              borderRadius: 'var(--radius-xs)',
              padding: '0.3rem 0.55rem',
              fontSize: '0.88rem',
              cursor: 'pointer',
              minHeight: '34px',
              transition: 'opacity 150ms ease-out, background-color 150ms ease-out',
            }}
            aria-label="Telugu language"
          >
            తెలుగు
          </button>
          <button
            type="button"
            onClick={() => setLanguage('hi')}
            style={{
              background: language === 'hi' ? 'var(--bg-surface)' : 'transparent',
              color: language === 'hi' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: language === 'hi' ? '700' : '500',
              border: language === 'hi' ? '1px solid var(--border)' : '1px solid transparent',
              borderRadius: 'var(--radius-xs)',
              padding: '0.3rem 0.55rem',
              fontSize: '0.88rem',
              cursor: 'pointer',
              minHeight: '34px',
              transition: 'opacity 150ms ease-out, background-color 150ms ease-out',
            }}
            aria-label="Hindi language"
          >
            हिंदी
          </button>
        </div>

        {/* Patient Chip & Avatar Menu Dropdown (Replaces separate email + settings buttons) */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.35rem 0.75rem',
              background: 'var(--bg-surface-subtle)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              minHeight: '44px',
              cursor: 'pointer',
              color: 'var(--text-primary)',
            }}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            aria-label="Patient and settings menu"
          >
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                flexShrink: 0,
              }}
            >
              <User size={16} aria-hidden="true" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Active Patient
              </span>
              <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                {activePatient?.name || 'Patient'}
              </strong>
            </div>

            <ChevronDown size={15} style={{ color: 'var(--text-muted)', marginLeft: '0.2rem' }} aria-hidden="true" />
          </button>

          {/* Avatar Dropdown Menu */}
          {isMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                width: '230px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: 'var(--shadow-md)',
                zIndex: 60,
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
              role="menu"
            >
              <div style={{ padding: '0.4rem 0.65rem', borderBottom: '1px solid var(--border)', marginBottom: '0.25rem' }}>
                <p style={{ margin: 0, fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  {activePatient?.name || 'Patient'}
                </p>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {activePatient?.email || 'patient@neuroscan.local'}
                </p>
              </div>

              {onOpenPatientSwitch && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenPatientSwitch();
                  }}
                  className="sidebar-nav-btn"
                  style={{ minHeight: '38px', padding: '0.45rem 0.65rem', fontSize: '0.9rem' }}
                  role="menuitem"
                >
                  <User size={16} style={{ color: 'var(--primary)' }} />
                  <span>{t('nav.patient_menu.switch_patient')}</span>
                </button>
              )}

              {onOpenPreferences && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenPreferences();
                  }}
                  className="sidebar-nav-btn"
                  style={{ minHeight: '38px', padding: '0.45rem 0.65rem', fontSize: '0.9rem' }}
                  role="menuitem"
                >
                  <Sliders size={16} style={{ color: 'var(--primary)' }} />
                  <span>{t('nav.patient_menu.preferences')}</span>
                </button>
              )}

              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigate('notifications');
                  }}
                  className="sidebar-nav-btn"
                  style={{ minHeight: '38px', padding: '0.45rem 0.65rem', fontSize: '0.9rem' }}
                  role="menuitem"
                >
                  <Mail size={16} style={{ color: 'var(--primary)' }} />
                  <span>{t('nav.patient_menu.email_settings')}</span>
                </button>
              )}

              {onOpenSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="sidebar-nav-btn"
                  style={{ minHeight: '38px', padding: '0.45rem 0.65rem', fontSize: '0.9rem' }}
                  role="menuitem"
                >
                  <Settings size={16} style={{ color: 'var(--primary)' }} />
                  <span>{t('nav.patient_menu.system_settings')}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tiny System Status Dot with Tooltip (Replaces bulky "Ready" button) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
          }}
          title={isFullyOnline ? 'All systems online and ready' : 'Connecting to background services'}
          aria-label={isFullyOnline ? 'All systems ready' : 'Connecting'}
        >
          <span
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isFullyOnline ? 'var(--stage-1)' : 'var(--stage-3)',
              display: 'inline-block',
              transition: 'background-color 300ms ease-out',
            }}
          />
        </div>
      </div>
    </header>
  );
}
