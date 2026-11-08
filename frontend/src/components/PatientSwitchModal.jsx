import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Users,
  UserPlus,
  UserCheck,
  Shield,
  Mail,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  getPatients,
  registerPatient,
  seedDemoPatients,
} from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function PatientSwitchModal({
  isOpen,
  onClose,
  activePatient,
  onSelectPatient,
  userRole = 'researcher', // 'researcher' or 'patient'
}) {
  const { t, translateStage } = useLanguage();
  const [tab, setTab] = useState('list'); // 'list' | 'register'
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Registration form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTimezone, setRegTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  );
  const [regCaregiverEmail, setRegCaregiverEmail] = useState('');
  const [regCaregiverName, setRegCaregiverName] = useState('');

  const loadPatients = async () => {
    if (userRole !== 'researcher' && userRole !== 'clinician') return;
    setLoading(true);
    setError(null);
    try {
      const res = await getPatients(null, userRole);
      if (res.success) {
        setPatients(res.data);
      } else {
        setError(res.error || 'Failed to load patient records.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setSearchQuery('');
      if (userRole === 'researcher' || userRole === 'clinician') {
        loadPatients();
      }
    }
  }, [isOpen, userRole]);

  if (!isOpen) return null;

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) {
      setError('Please provide patient name and email address.');
      return;
    }

    setActionLoading(true);
    setError(null);
    try {
      const res = await registerPatient(
        {
          name: regName.trim(),
          email: regEmail.trim(),
          timezone: regTimezone,
          caregiverEmail: regCaregiverEmail.trim(),
          caregiverName: regCaregiverName.trim(),
        },
        userRole
      );

      if (res.success) {
        setSuccessMsg(`Patient ${res.data.patient.name} registered successfully.`);
        setRegName('');
        setRegEmail('');
        setRegCaregiverEmail('');
        setRegCaregiverName('');
        // Switch to the newly registered patient immediately with verified session token
        const registeredPatient = {
          ...res.data.patient,
          token: res.data.token,
        };
        onSelectPatient(registeredPatient);
        if (userRole === 'researcher' || userRole === 'clinician') {
          await loadPatients();
          setTab('list');
        } else {
          onClose();
        }
      } else {
        setError(res.error || 'Registration failed.');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeedDemo = async () => {
    if (actionLoading) return;
    setActionLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await seedDemoPatients(userRole);
      if (res.success) {
        const msg = res.message || `Demo seeding complete: ${res.createdCount ?? 4} created, ${res.existingCount ?? 0} already existed.`;
        setSuccessMsg(msg);
        await loadPatients();
        if (res.data && res.data.length > 0) {
          if (!activePatient || !res.data.some(p => p.patientId === activePatient.patientId)) {
            onSelectPatient(res.data[0]);
          }
        }
      } else {
        setError(res.error || 'Failed to seed demo patients.');
      }
    } catch (err) {
      setError(err.message || 'Failed to seed demo patients.');
    } finally {
      setActionLoading(false);
    }
  };

  const isResearcher = userRole === 'researcher' || userRole === 'clinician';

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
        zIndex: 105,
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
          maxWidth: '720px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.4rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {isResearcher ? t('modals.switch_patient_title') : 'My Registered Patient Profile'}
              </h3>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                {isResearcher
                  ? 'Switch active patient context or register new independent patient profiles.'
                  : 'Independent patient profile with scoped medical records and email preferences.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-secondary" style={{ padding: '0.3rem 0.5rem' }}>
            <X size={15} />
          </button>
        </div>

        {/* Messages */}
        {error && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              background: 'var(--stage-4-bg)',
              border: '1px solid var(--stage-4-border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--stage-4)',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div
            style={{
              padding: '0.65rem 0.85rem',
              background: 'var(--stage-1-bg)',
              border: '1px solid var(--stage-1-border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--stage-1)',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '0.75rem',
            }}
          >
            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tabs for Researchers */}
        {isResearcher && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)',
              paddingBottom: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--panel-secondary)', padding: '0.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <button
                onClick={() => setTab('list')}
                style={{
                  padding: '0.35rem 0.8rem',
                  background: tab === 'list' ? 'var(--primary)' : 'transparent',
                  color: tab === 'list' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.76rem',
                  fontWeight: tab === 'list' ? '600' : '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <Users size={13} />
                <span>{t('modals.registered_patients', { count: patients.length })}</span>
              </button>

              <button
                onClick={() => setTab('register')}
                style={{
                  padding: '0.35rem 0.8rem',
                  background: tab === 'register' ? 'var(--primary)' : 'transparent',
                  color: tab === 'register' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.76rem',
                  fontWeight: tab === 'register' ? '600' : '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.15s ease',
                }}
              >
                <UserPlus size={13} />
                <span>{t('modals.register_patient')}</span>
              </button>
            </div>

            {/* Seed Demo Button (Dev/Testing only) */}
            <button
              onClick={handleSeedDemo}
              disabled={actionLoading}
              className="btn-secondary"
              style={{
                fontSize: '0.72rem',
                padding: '0.35rem 0.65rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: 'var(--accent-purple)',
                background: 'var(--accent-purple-bg)',
                borderColor: 'var(--accent-purple-border)',
                cursor: actionLoading ? 'not-allowed' : 'pointer',
                opacity: actionLoading ? 0.7 : 1,
              }}
              title="Populate 4 demo patient profiles covering Stage 1 through Stage 4"
            >
              <Sparkles size={12} className={actionLoading ? 'spin' : ''} />
              <span>{actionLoading ? 'Seeding Demo Profiles...' : 'Seed Demo Profiles'}</span>
            </button>
          </div>
        )}

        {/* Content Area */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.25rem' }}>
          {/* TAB: REGISTER PATIENT */}
          {tab === 'register' && isResearcher && (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Eleanor Vance"
                    required
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Registered Email Address *
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="e.g. eleanor.vance@example.com"
                    required
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Patient Timezone
                  </label>
                  <input
                    type="text"
                    value={regTimezone}
                    onChange={(e) => setRegTimezone(e.target.value)}
                    placeholder="e.g. Asia/Kolkata"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Caregiver Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={regCaregiverName}
                    onChange={(e) => setRegCaregiverName(e.target.value)}
                    placeholder="e.g. David Vance"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Caregiver Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={regCaregiverEmail}
                  onChange={(e) => setRegCaregiverEmail(e.target.value)}
                  placeholder="e.g. david.vance@example.com"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setTab('list')}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 0.9rem', fontSize: '0.78rem' }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary"
                  style={{ padding: '0.5rem 1.1rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <UserPlus size={14} />
                  <span>{actionLoading ? 'Registering...' : t('modals.register_patient')}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB: PATIENT LIST (Researchers) */}
          {tab === 'list' && isResearcher && (
            <div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  <RefreshCw size={18} className="spin" style={{ marginBottom: '0.5rem' }} />
                  <div>Loading registered patient accounts...</div>
                </div>
              ) : patients.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  <p>No registered patient profiles found in the database.</p>
                  <button
                    onClick={handleSeedDemo}
                    disabled={actionLoading}
                    className="btn-primary"
                    style={{
                      marginTop: '0.75rem',
                      fontSize: '0.76rem',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      opacity: actionLoading ? 0.7 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Sparkles size={13} className={actionLoading ? 'spin' : ''} />
                    <span>{actionLoading ? 'Seeding Standard Demo Patients...' : 'Seed Standard Demo Patients (Stages 1-4)'}</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {/* Search Bar & Patient Count Indicator */}
                  <div style={{ marginBottom: '0.35rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('modals.search_patient')}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-xs)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      <span>Showing {patients.filter((p) => {
                        if (!searchQuery.trim()) return true;
                        const q = searchQuery.toLowerCase().trim();
                        return (
                          (p.name && p.name.toLowerCase().includes(q)) ||
                          (p.email && p.email.toLowerCase().includes(q)) ||
                          (p.patientId && p.patientId.toLowerCase().includes(q))
                        );
                      }).length} of {patients.length} registered patients</span>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.72rem', padding: 0 }}
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </div>

                  {patients
                    .filter((pat) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase().trim();
                      return (
                        (pat.name && pat.name.toLowerCase().includes(q)) ||
                        (pat.email && pat.email.toLowerCase().includes(q)) ||
                        (pat.patientId && pat.patientId.toLowerCase().includes(q))
                      );
                    })
                    .map((pat) => {
                    const isActive = activePatient?.patientId === pat.patientId;
                    const stageBadgeColors = {
                      1: { color: 'var(--stage-1)', bg: 'var(--stage-1-bg)', border: '1px solid var(--stage-1-border)' },
                      2: { color: 'var(--stage-2)', bg: 'var(--stage-2-bg)', border: '1px solid var(--stage-2-border)' },
                      3: { color: 'var(--stage-3)', bg: 'var(--stage-3-bg)', border: '1px solid var(--stage-3-border)' },
                      4: { color: 'var(--stage-4)', bg: 'var(--stage-4-bg)', border: '1px solid var(--stage-4-border)' },
                    };
                    const stageBadge = pat.predictedStage && stageBadgeColors[pat.predictedStage]
                      ? { label: translateStage(pat.predictedStage), ...stageBadgeColors[pat.predictedStage] }
                      : { label: 'No Prediction Saved Yet', color: 'var(--text-muted)', bg: 'var(--bg-surface-subtle)', border: '1px solid var(--border)' };

                    return (
                      <div
                        key={pat.patientId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.85rem 1rem',
                          background: isActive ? 'var(--primary-light)' : 'var(--panel-secondary)',
                          border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {pat.name}
                            </span>
                            {isActive && (
                              <span
                                style={{
                                  fontSize: '0.65rem',
                                  fontWeight: '700',
                                  background: 'var(--primary-light)',
                                  color: 'var(--primary)',
                                  border: '1px solid var(--primary-border)',
                                  padding: '0.15rem 0.45rem',
                                  borderRadius: '4px',
                                }}
                              >
                                {t('modals.active')}
                              </span>
                            )}
                            {pat.isDemo && (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  fontWeight: '600',
                                  background: 'var(--accent-purple-bg)',
                                  color: 'var(--accent-purple)',
                                  border: '1px solid var(--accent-purple-border)',
                                  padding: '0.15rem 0.4rem',
                                  borderRadius: '4px',
                                }}
                              >
                                DEMO
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.74rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Mail size={12} /> {pat.email}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <Clock size={12} /> {pat.timezone || 'Asia/Kolkata'}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Last Scan:</span>{' '}
                              {pat.lastPredictionDate
                                ? new Date(pat.lastPredictionDate).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })
                                : 'No Scans Yet'}
                            </span>
                          </div>

                          <div style={{ marginTop: '0.25rem' }}>
                            <span
                              style={{
                                fontSize: '0.68rem',
                                fontWeight: '600',
                                color: stageBadge.color,
                                background: stageBadge.bg,
                                border: stageBadge.border,
                                padding: '0.15rem 0.5rem',
                                borderRadius: '4px',
                                display: 'inline-block',
                              }}
                            >
                              {stageBadge.label}
                            </span>
                          </div>
                        </div>

                        <div>
                          <button
                            onClick={() => {
                              onSelectPatient(pat);
                              onClose();
                            }}
                            disabled={isActive}
                            className={isActive ? 'btn-secondary' : 'btn-primary'}
                            style={{
                              padding: '0.45rem 0.85rem',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                            }}
                          >
                            <UserCheck size={13} />
                            <span>{isActive ? t('modals.current_patient') : t('modals.btn_switch')}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW FOR ORDINARY PATIENTS (Requirement 3: Never expose list of other registered patients) */}
          {!isResearcher && activePatient && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div
                style={{
                  padding: '1rem',
                  background: 'var(--panel-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserCheck size={18} color="var(--primary)" />
                  <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {activePatient.name || 'Registered Patient'}
                  </span>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.4rem' }}>
                  <span>Patient ID:</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{activePatient.patientId}</span>

                  <span>Registered Email:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{activePatient.email || 'Not configured'}</span>

                  <span>Local Timezone:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{activePatient.timezone || 'Asia/Kolkata'}</span>

                  <span>Caregiver Email:</span>
                  <span style={{ color: 'var(--text-primary)' }}>{activePatient.caregiverEmail || 'None configured'}</span>

                  <span>Current Stage:</span>
                  <span style={{ color: 'var(--primary)', fontWeight: '600' }}>
                    {activePatient.predictedStage
                      ? `Stage ${activePatient.predictedStage}: ${activePatient.stageLabel || ''}`
                      : 'No MRI Prediction Saved Yet'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Note: Email notification preferences, categories, and delivery schedules can be customized in the Email Notifications section.
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
