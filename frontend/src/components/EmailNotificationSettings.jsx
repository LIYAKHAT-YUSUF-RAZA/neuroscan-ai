import React, { useState, useEffect } from 'react';
import {
  Mail,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Send,
  Save,
  Check,
  X,
  User,
  HeartHandshake,
  Utensils,
  Pill,
  Calendar,
  Activity,
  Info,
  Server,
  RefreshCw,
  Bell,
  BellOff,
  BookOpen,
} from 'lucide-react';
import {
  getNotificationSettings,
  updateNotificationSettings,
  sendTestNotification,
  getNotificationHistory,
} from '../services/api';
import { useLanguage } from '../context/LanguageContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EDUCATIONAL_TOPIC_PREVIEWS = {
  1: [
    { title: 'Brain-Healthy Nutrition & Dietary Habits', desc: 'Emphasize colorful whole foods, leafy greens, antioxidant berries, omega-3s, and daily hydration.' },
    { title: 'Cardiovascular Fitness & Physical Activity', desc: 'Promote cerebral blood flow and neurotrophic factors with 30 mins of moderate daily exercise.' },
    { title: 'Restful Sleep & Cognitive Restoration', desc: 'Support glymphatic brain clearance and memory consolidation with consistent sleep schedules.' },
    { title: 'Lifelong Learning & Cognitive Reserve', desc: 'Engage in novel cognitive challenges, reading, and enriching social connections.' },
  ],
  2: [
    { title: 'Effective Memory Strategies & External Aids', desc: 'Use centralized planners, labeled zones, checklists, and automated reminders.' },
    { title: 'Creating Predictable, Comfortable Daily Routines', desc: 'Establish consistent daily rhythms to reduce anxiety and reserve mental energy.' },
    { title: 'Meaningful Cognitive Engagement & Stimulation', desc: 'Enjoy relaxed hobbies, pleasant reminiscence, and low-stress creative pastimes.' },
    { title: 'Reassurance, Proactive Planning & Clinical Care', desc: 'Partner with doctors early for structured support, guidance, and peace of mind.' },
  ],
  3: [
    { title: 'Simplifying Everyday Tasks with Supportive Guidance', desc: 'Break complex activities into gentle, manageable steps to sustain confidence.' },
    { title: 'Safe & Comfortable Home Environments', desc: 'Eliminate tripping hazards, ensure bright lighting, and arrange essential items clearly.' },
    { title: 'Gentle Activities & Emotional Connection', desc: 'Share familiar music, soothing walks, and validating emotional warmth.' },
    { title: 'Care Team Coordination & Specialist Check-ins', desc: 'Keep shared logs of routines and maintain regular appointments with neurologists.' },
  ],
  4: [
    { title: 'Comprehensive Home Safety & Fall Prevention', desc: 'Install nightlights, stable seating, and clear pathways to maximize living comfort.' },
    { title: 'Sensory Comfort, Calming Routines & Reassurance', desc: 'Maintain soft ambient lighting, familiar melodies, and calm, predictable daily rhythms.' },
    { title: 'Caregiver Wellbeing, Self-Care & Support Systems', desc: 'Prevent burnout through respite care, caregiver support groups, and shared teamwork.' },
    { title: 'Collaborative Multidisciplinary Care Coordination', desc: 'Work closely with primary doctors, palliative specialists, and supportive therapists.' },
  ],
};

export default function EmailNotificationSettings({ patientId = null, activePatient = null }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // Patient Identity & Stage Profile state
  const [patientName, setPatientName] = useState('');
  const [hasEligiblePrediction, setHasEligiblePrediction] = useState(false);
  const [predictedStage, setPredictedStage] = useState(null);
  const [predictedClass, setPredictedClass] = useState(null);
  const [stageLabel, setStageLabel] = useState(null);

  // Core settings state
  const [allNotificationsEnabled, setAllNotificationsEnabled] = useState(false);
  const [patientConsent, setPatientConsent] = useState(false);
  const [patientEmail, setPatientEmail] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  );

  // Caregiver state
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [caregiverEnabled, setCaregiverEnabled] = useState(false);
  const [caregiverConsent, setCaregiverConsent] = useState(false);
  const [caregiverSettings, setCaregiverSettings] = useState({
    medications: false,
    appointments: false,
    routine: false,
    weeklyEducational: false,
  });

  // Categories state
  const [categories, setCategories] = useState({
    medications: { enabled: true, missedDoseAlert: true },
    nutrition: {
      enabled: true,
      breakfast: true,
      breakfastTime: '08:30 AM',
      lunch: true,
      lunchTime: '01:00 PM',
      snack: false,
      snackTime: '05:00 PM',
      dinner: true,
      dinnerTime: '08:00 PM',
      hydration: false,
    },
    routine: {
      enabled: true,
      morningRoutine: true,
      morningTime: '09:00 AM',
      cognitiveExercises: true,
      cognitiveTime: '11:00 AM',
      physicalActivity: true,
      physicalTime: '04:30 PM',
      sleepRoutine: true,
      sleepTime: '09:30 PM',
    },
    appointments: {
      enabled: true,
      oneDayBefore: true,
      twoHoursBefore: true,
    },
    weeklyEducational: {
      enabled: false,
      weekday: 'Sunday',
      time: '09:00 AM',
      topicIndex: 0,
    },
  });

  // System & history state
  const [isSmtpConfigured, setIsSmtpConfigured] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [testSending, setTestSending] = useState(false);

  // Load current settings
  const loadSettings = async (isCancelledRef = { current: false }) => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    const res = await getNotificationSettings(patientId);
    if (isCancelledRef.current) return;
    setLoading(false);

    if (res.success && res.data) {
      const d = res.data;
      setPatientName(d.patientName || activePatient?.name || '');
      setHasEligiblePrediction(Boolean(d.hasEligiblePrediction || activePatient?.predictedStage));
      setPredictedStage(d.predictedStage !== undefined ? d.predictedStage : (activePatient?.predictedStage || null));
      setPredictedClass(d.predictedClass || activePatient?.predictedClass || null);
      setStageLabel(d.stageLabel || activePatient?.stageLabel || null);

      setAllNotificationsEnabled(Boolean(d.allNotificationsEnabled));
      setPatientConsent(Boolean(d.patientConsent));
      setPatientEmail(d.patientEmail || activePatient?.email || '');
      if (d.timezone || activePatient?.timezone) setTimezone(d.timezone || activePatient.timezone);
      if (d.categories) setCategories((prev) => ({ ...prev, ...d.categories }));
      setCaregiverEmail(d.caregiverEmail || activePatient?.caregiverEmail || '');
      setCaregiverEnabled(Boolean(d.caregiverEnabled));
      setCaregiverConsent(Boolean(d.caregiverConsent));
      if (d.caregiverSettings) setCaregiverSettings((prev) => ({ ...prev, ...d.caregiverSettings }));
      setIsSmtpConfigured(Boolean(d.isSmtpConfigured));
    } else if (res.error) {
      setErrorMessage(res.error);
    }
  };

  const loadHistory = async (isCancelledRef = { current: false }) => {
    if (!patientId) {
      setHistoryLogs([]);
      return;
    }
    const res = await getNotificationHistory(patientId);
    if (isCancelledRef.current) return;
    if (res.success) {
      setHistoryLogs(res.data || []);
    }
  };

  useEffect(() => {
    const isCancelledRef = { current: false };
    setHistoryLogs([]);
    setStatusMessage(null);
    setErrorMessage(null);
    loadSettings(isCancelledRef);
    loadHistory(isCancelledRef);
    return () => {
      isCancelledRef.current = true;
    };
  }, [patientId]);

  // Validation helpers
  const isPatientEmailValid = !patientEmail || EMAIL_REGEX.test(patientEmail.trim());
  const isCaregiverEmailValid = !caregiverEmail || EMAIL_REGEX.test(caregiverEmail.trim());

  // Save all notification preferences in one step
  const handleSavePreferences = async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    // Validate email format
    const cleanPatientEmail = patientEmail.trim();
    if (cleanPatientEmail && !EMAIL_REGEX.test(cleanPatientEmail)) {
      setErrorMessage('Please enter a valid patient email address.');
      return;
    }

    const cleanCaregiverEmail = caregiverEmail.trim();
    if (cleanCaregiverEmail && !EMAIL_REGEX.test(cleanCaregiverEmail)) {
      setErrorMessage('Please enter a valid caregiver email address.');
      return;
    }

    // Explicit consent validation if notifications are enabled
    if (allNotificationsEnabled) {
      if (!cleanPatientEmail) {
        setErrorMessage('A valid patient email address is required before enabling notifications.');
        return;
      }
      if (!patientConsent) {
        setErrorMessage('Please check the explicit consent box to enable notifications.');
        return;
      }
    }

    // Caregiver authorization validation
    if (caregiverEnabled) {
      if (!cleanCaregiverEmail) {
        setErrorMessage('Please enter a valid caregiver email address to activate caregiver alerts.');
        return;
      }
      if (!caregiverConsent) {
        setErrorMessage('Please confirm patient authorization to activate caregiver alerts.');
        return;
      }
    }

    setSaving(true);
    const payload = {
      patientEmail: cleanPatientEmail,
      patientName: patientName.trim(),
      allNotificationsEnabled,
      patientConsent,
      caregiverEmail: cleanCaregiverEmail,
      caregiverEnabled,
      caregiverConsent,
      caregiverSettings,
      categories,
      timezone,
    };

    const res = await updateNotificationSettings(payload, patientId);
    setSaving(false);

    if (res.success) {
      setStatusMessage('Notification preferences saved successfully.');
      loadSettings();
      loadHistory();
      setTimeout(() => setStatusMessage(null), 4000);
    } else {
      setErrorMessage(res.error || 'Failed to save notification preferences.');
    }
  };

  // Send test email
  const handleSendTest = async (target = 'patient') => {
    setErrorMessage(null);
    setStatusMessage(null);

    const isCaregiver = target === 'caregiver';
    if (!patientConsent) {
      setErrorMessage('Explicit patient consent is required before sending test notifications.');
      return;
    }

    if (isCaregiver) {
      if (!caregiverEmail || !caregiverConsent || !caregiverEnabled) {
        setErrorMessage('Caregiver notifications must be authorized and enabled before sending a caregiver test email.');
        return;
      }
    } else {
      if (!patientEmail || !EMAIL_REGEX.test(patientEmail.trim())) {
        setErrorMessage('Please save a valid patient email address first.');
        return;
      }
    }

    setTestSending(true);
    const res = await sendTestNotification(target, patientId);
    setTestSending(false);

    if (res.success) {
      setStatusMessage(res.message);
      loadHistory();
      setTimeout(() => setStatusMessage(null), 6000);
    } else {
      setErrorMessage(res.error || 'Failed to send test email.');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
        <span>Loading notification settings...</span>
      </div>
    );
  }

  // Derive simple status label
  const getStatusBadge = () => {
    if (!isSmtpConfigured) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: '600',
            background: 'var(--stage-3-bg)',
            color: 'var(--stage-3)',
            border: '1px solid var(--stage-3-border)',
          }}
        >
          <AlertTriangle size={12} />
          {t('settings.email_unconfigured')}
        </span>
      );
    }
    if (allNotificationsEnabled) {
      return (
        <span
          className="badge"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.74rem',
            fontWeight: '600',
            background: 'var(--stage-1-bg)',
            color: 'var(--stage-1)',
            border: '1px solid var(--stage-1-border)',
          }}
        >
          <CheckCircle2 size={13} />
          {t('settings.email_enabled')}
        </span>
      );
    }
    return (
      <span
        className="badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.25rem 0.65rem',
          borderRadius: 'var(--radius-xs)',
          fontSize: '0.74rem',
          fontWeight: '600',
          background: 'var(--bg-surface-subtle)',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border)',
        }}
      >
        <BellOff size={13} />
        {t('settings.email_disabled')}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header and Status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Mail size={20} color="var(--primary)" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('settings.email_title')}
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            {t('settings.email_desc')}
          </p>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Active Patient Notification Scoping Card (Requirement 2) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.6rem',
          padding: '0.7rem 0.95rem',
          background: 'var(--primary-light)',
          border: '1px solid var(--primary-border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.78rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={15} color="var(--primary)" />
          <span style={{ color: 'var(--text-secondary)' }}>Configuring Preferences For:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: '700' }}>
            {patientName || activePatient?.name || 'Registered Patient'}
          </span>
          <span style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: '0.72rem' }}>
            ({patientId})
          </span>
        </div>
        {patientEmail && (
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
            Registered Email: <strong style={{ color: 'var(--text-primary)' }}>{patientEmail}</strong>
          </div>
        )}
      </div>

      {/* Status Alerts */}
      {statusMessage && (
        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'var(--stage-1-bg)',
            border: '1px solid var(--stage-1-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem',
            color: 'var(--stage-1)',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
          }}
        >
          <CheckCircle2 size={17} />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div
          style={{
            padding: '0.85rem 1rem',
            background: 'var(--stage-4-bg)',
            border: '1px solid var(--stage-4-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem',
            color: 'var(--stage-4)',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
          }}
        >
          <AlertTriangle size={17} color="var(--stage-4)" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SMTP Configuration Notice if not configured */}
      {!isSmtpConfigured && (
        <div
          style={{
            padding: '0.8rem 1rem',
            background: 'var(--stage-3-bg)',
            border: '1px solid var(--stage-3-border)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            color: 'var(--stage-3)',
            display: 'flex',
            gap: '0.65rem',
            lineHeight: '1.5',
          }}
        >
          <Server size={17} color="var(--stage-3)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Email Service Environment:</strong> Live SMTP credentials are not configured in <code style={{ color: 'var(--text-primary)', background: 'rgba(0,0,0,0.05)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>backend/.env</code>.
            In development mode, notification events and test emails are simulated in server logs. For live delivery, configure <code style={{ color: 'var(--text-primary)', background: 'rgba(0,0,0,0.05)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>SMTP_HOST</code>, <code style={{ color: 'var(--text-primary)', background: 'rgba(0,0,0,0.05)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>SMTP_USER</code>, and <code style={{ color: 'var(--text-primary)', background: 'rgba(0,0,0,0.05)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>SMTP_PASSWORD</code>.
          </div>
        </div>
      )}

      {/* ================= STAGE-BASED EDUCATIONAL PROFILE BANNER ================= */}
      <div
        style={{
          padding: '1rem 1.25rem',
          background: hasEligiblePrediction ? 'var(--primary-light)' : 'var(--bg-surface-subtle)',
          border: hasEligiblePrediction ? '1px solid var(--primary-border)' : '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Activity size={16} color={hasEligiblePrediction ? 'var(--primary)' : 'var(--text-muted)'} />
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {hasEligiblePrediction
                ? `Educational Notification Profile: Stage ${predictedStage} — ${stageLabel}`
                : 'Educational Notification Profile: General Brain Health (No Saved MRI Scan)'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-secondary)' }}>
            {hasEligiblePrediction
              ? 'Care reminders and weekly educational content are dynamically adapted to this presentation profile.'
              : 'Upload and save an MRI scan in the MRI Analysis section to link your specific presentation stage.'}
          </p>
        </div>
        <span
          style={{
            fontSize: '0.7rem',
            color: 'var(--text-secondary)',
            background: 'var(--bg-surface)',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            border: '1px solid var(--border)',
          }}
        >
          Educational guidance only • Not a clinical diagnosis
        </span>
      </div>

      {/* ================= 1. PATIENT EMAIL & MASTER TOGGLE ================= */}
      <div
        style={{
          padding: '1.25rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <User size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('settings.email_patient_profile')}
            </h3>
          </div>

          {/* Master Notifications Toggle */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              fontSize: '0.88rem',
              color: allNotificationsEnabled ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: '600',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: allNotificationsEnabled ? 'var(--primary-light)' : 'var(--bg-surface-subtle)',
              border: allNotificationsEnabled ? '1px solid var(--primary-border)' : '1px solid var(--border)',
              transition: 'all 150ms ease-out',
            }}
          >
            <input
              type="checkbox"
              checked={allNotificationsEnabled}
              onChange={(e) => setAllNotificationsEnabled(e.target.checked)}
              aria-label={t('settings.email_enable_all')}
            />
            <span>{t('settings.email_enable_all')}</span>
          </label>
        </div>

        {/* Patient Name Field */}
        <div>
          <label className="form-label">
            Patient Preferred Name (for personalized greetings)
          </label>
          <input
            type="text"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="e.g. John Doe"
            style={{
              width: '100%',
              maxWidth: '420px',
            }}
          />
        </div>

        {/* Email Input Field */}
        <div>
          <label className="form-label form-label-required">
            Patient Email Address
          </label>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input
              type="email"
              value={patientEmail}
              onChange={(e) => setPatientEmail(e.target.value)}
              placeholder="e.g. patient@example.com"
              style={{
                flex: 1,
                minWidth: '260px',
                maxWidth: '420px',
                borderColor: !isPatientEmailValid ? 'var(--stage-4)' : undefined,
              }}
            />
          </div>
          {!isPatientEmailValid && (
            <p className="form-error-text">
              <AlertTriangle size={13} />
              <span>Please enter a valid email format (e.g. name@domain.com).</span>
            </p>
          )}
        </div>

        {/* Explicit Consent Checkbox - HIGH CONTRAST WCAG AA REMEDIATION */}
        <div
          style={{
            padding: '1rem 1.15rem',
            background: patientConsent ? 'var(--primary-light)' : 'var(--bg-surface-subtle)',
            border: patientConsent ? '1.5px solid var(--primary-border)' : '1.5px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 150ms ease-out',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              cursor: 'pointer',
              fontSize: '0.85rem',
              lineHeight: '1.55',
            }}
          >
            <input
              type="checkbox"
              checked={patientConsent}
              onChange={(e) => setPatientConsent(e.target.checked)}
              style={{ marginTop: '3px' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Informed Patient Consent: </strong>
              I consent to receive automated care and medication reminder emails from NeuroScan AI. I understand that emails never substitute for clinical judgment and that I can disable notifications at any time.
            </span>
          </label>
        </div>

        {/* Timezone Selector */}
        <div>
          <label className="form-label">
            Preferred Delivery Timezone
          </label>
          <input
            type="text"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            placeholder="e.g. Asia/Kolkata, America/New_York, UTC"
            style={{
              width: '100%',
              maxWidth: '360px',
            }}
          />
        </div>
      </div>

      {/* ================= 2. CAREGIVER EMAIL & AUTHORIZATION ================= */}
      <div
        style={{
          padding: '1.25rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <HeartHandshake size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('settings.email_caregiver_title')}
            </h3>
          </div>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.65rem',
              cursor: 'pointer',
              fontSize: '0.88rem',
              color: caregiverEnabled ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: '600',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              background: caregiverEnabled ? 'var(--primary-light)' : 'var(--bg-surface-subtle)',
              border: caregiverEnabled ? '1px solid var(--primary-border)' : '1px solid var(--border)',
              transition: 'all 150ms ease-out',
            }}
          >
            <input
              type="checkbox"
              checked={caregiverEnabled}
              onChange={(e) => setCaregiverEnabled(e.target.checked)}
              aria-label={t('settings.email_caregiver_enable')}
            />
            <span>{t('settings.email_caregiver_enable')}</span>
          </label>
        </div>

        <div>
          <label className="form-label">
            Caregiver Email Address
          </label>
          <input
            type="email"
            value={caregiverEmail}
            onChange={(e) => setCaregiverEmail(e.target.value)}
            placeholder="e.g. caregiver@example.com"
            style={{
              width: '100%',
              maxWidth: '420px',
              borderColor: !isCaregiverEmailValid ? 'var(--stage-4)' : undefined,
            }}
          />
          {!isCaregiverEmailValid && (
            <p className="form-error-text">
              <AlertTriangle size={13} />
              <span>Please enter a valid caregiver email format.</span>
            </p>
          )}
        </div>

        {/* Patient Authorization Checkbox for Caregiver */}
        <div
          style={{
            padding: '1rem 1.15rem',
            background: caregiverConsent ? 'var(--primary-light)' : 'var(--bg-surface-subtle)',
            border: caregiverConsent ? '1.5px solid var(--primary-border)' : '1.5px solid var(--border-medium)',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 150ms ease-out',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              cursor: 'pointer',
              fontSize: '0.84rem',
              lineHeight: '1.55',
            }}
          >
            <input
              type="checkbox"
              checked={caregiverConsent}
              onChange={(e) => setCaregiverConsent(e.target.checked)}
              style={{ marginTop: '3px' }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)', fontWeight: '700' }}>Patient Authorization: </strong>
              I explicitly authorize NeuroScan AI to send selected care reminder emails to this caregiver email address.
            </span>
          </label>
        </div>

        {/* Selective Category Forwarding */}
        {caregiverEnabled && (
          <div
            style={{
              padding: '1rem',
              background: 'var(--bg-surface-subtle)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.65rem' }}>
              Select Categories to Forward to Caregiver
            </span>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={caregiverSettings.medications}
                  onChange={(e) => setCaregiverSettings((prev) => ({ ...prev, medications: e.target.checked }))}
                />
                <span>Medications</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={caregiverSettings.appointments}
                  onChange={(e) => setCaregiverSettings((prev) => ({ ...prev, appointments: e.target.checked }))}
                />
                <span>Appointments</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={caregiverSettings.routine}
                  onChange={(e) => setCaregiverSettings((prev) => ({ ...prev, routine: e.target.checked }))}
                />
                <span>Daily Care Routine</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.84rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={caregiverSettings.weeklyEducational}
                  onChange={(e) => setCaregiverSettings((prev) => ({ ...prev, weeklyEducational: e.target.checked }))}
                />
                <span>Weekly Educational Guidance</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ================= 3. NOTIFICATION CATEGORIES ================= */}
      <div
        style={{
          padding: '1.25rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <Clock size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.02rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('settings.email_categories_title')}
            </h3>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Schedule notifications by care category
          </span>
        </div>

        {/* Informative banner when master notifications are disabled */}
        {!allNotificationsEnabled && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
            }}
          >
            <Info size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
              Master email notifications are currently turned off. Check <strong>Enable All Email Notifications</strong> above to activate delivery. Your category preferences below remain preserved.
            </span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.15rem' }}>
          {/* Category A: Medications */}
          <div
            style={{
              padding: '1.1rem',
              background: categories.medications.enabled ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
              border: categories.medications.enabled ? '1.5px solid var(--primary-border)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: categories.medications.enabled ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              transition: 'all 150ms ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pill size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>Medications</span>
                <span
                  className="badge"
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    background: categories.medications.enabled ? 'var(--stage-1-bg)' : 'var(--bg-surface)',
                    color: categories.medications.enabled ? 'var(--stage-1)' : 'var(--text-muted)',
                    border: categories.medications.enabled ? '1px solid var(--stage-1-border)' : '1px solid var(--border)',
                  }}
                >
                  {categories.medications.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={categories.medications.enabled}
                onChange={(e) =>
                  setCategories((prev) => ({
                    ...prev,
                    medications: { ...prev.medications, enabled: e.target.checked },
                  }))
                }
                aria-label="Enable medication reminder notifications"
              />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
              Receive emails at prescribed dose administration times.
            </p>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: categories.medications.enabled ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: categories.medications.enabled ? 'pointer' : 'default',
              }}
            >
              <input
                type="checkbox"
                disabled={!categories.medications.enabled}
                checked={categories.medications.missedDoseAlert}
                onChange={(e) =>
                  setCategories((prev) => ({
                    ...prev,
                    medications: { ...prev.medications, missedDoseAlert: e.target.checked },
                  }))
                }
              />
              <span>Send missed-dose alert after 60-min grace period</span>
            </label>
          </div>

          {/* Category B: Nutrition */}
          <div
            style={{
              padding: '1.1rem',
              background: categories.nutrition.enabled ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
              border: categories.nutrition.enabled ? '1.5px solid var(--primary-border)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: categories.nutrition.enabled ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              transition: 'all 150ms ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Utensils size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>Diet & Nutrition</span>
                <span
                  className="badge"
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    background: categories.nutrition.enabled ? 'var(--stage-1-bg)' : 'var(--bg-surface)',
                    color: categories.nutrition.enabled ? 'var(--stage-1)' : 'var(--text-muted)',
                    border: categories.nutrition.enabled ? '1px solid var(--stage-1-border)' : '1px solid var(--border)',
                  }}
                >
                  {categories.nutrition.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={categories.nutrition.enabled}
                onChange={(e) =>
                  setCategories((prev) => ({
                    ...prev,
                    nutrition: { ...prev.nutrition, enabled: e.target.checked },
                  }))
                }
                aria-label="Enable diet and nutrition reminder notifications"
              />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
              Scheduled meal reminders & educational nutrition guidance.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', fontSize: '0.8rem', color: categories.nutrition.enabled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: categories.nutrition.enabled ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  disabled={!categories.nutrition.enabled}
                  checked={categories.nutrition.breakfast}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      nutrition: { ...prev.nutrition, breakfast: e.target.checked },
                    }))
                  }
                />
                <span>Breakfast ({categories.nutrition.breakfastTime})</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: categories.nutrition.enabled ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  disabled={!categories.nutrition.enabled}
                  checked={categories.nutrition.lunch}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      nutrition: { ...prev.nutrition, lunch: e.target.checked },
                    }))
                  }
                />
                <span>Lunch ({categories.nutrition.lunchTime})</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: categories.nutrition.enabled ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  disabled={!categories.nutrition.enabled}
                  checked={categories.nutrition.dinner}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      nutrition: { ...prev.nutrition, dinner: e.target.checked },
                    }))
                  }
                />
                <span>Dinner ({categories.nutrition.dinnerTime})</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: categories.nutrition.enabled ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  disabled={!categories.nutrition.enabled}
                  checked={categories.nutrition.hydration}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      nutrition: { ...prev.nutrition, hydration: e.target.checked },
                    }))
                  }
                />
                <span>Hydration</span>
              </label>
            </div>
          </div>

          {/* Category C: Daily Care Routine */}
          <div
            style={{
              padding: '1.1rem',
              background: categories.routine.enabled ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
              border: categories.routine.enabled ? '1.5px solid var(--primary-border)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: categories.routine.enabled ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              transition: 'all 150ms ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>Daily Care Routine</span>
                <span
                  className="badge"
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    background: categories.routine.enabled ? 'var(--stage-1-bg)' : 'var(--bg-surface)',
                    color: categories.routine.enabled ? 'var(--stage-1)' : 'var(--text-muted)',
                    border: categories.routine.enabled ? '1px solid var(--stage-1-border)' : '1px solid var(--border)',
                  }}
                >
                  {categories.routine.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={categories.routine.enabled}
                onChange={(e) =>
                  setCategories((prev) => ({
                    ...prev,
                    routine: { ...prev.routine, enabled: e.target.checked },
                  }))
                }
                aria-label="Enable daily routine reminder notifications"
              />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
              Structured morning, cognitive, physical, and evening habits.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', fontSize: '0.8rem', color: categories.routine.enabled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: categories.routine.enabled ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  disabled={!categories.routine.enabled}
                  checked={categories.routine.morningRoutine}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      routine: { ...prev.routine, morningRoutine: e.target.checked },
                    }))
                  }
                />
                <span>Morning ({categories.routine.morningTime})</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: categories.routine.enabled ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  disabled={!categories.routine.enabled}
                  checked={categories.routine.cognitiveExercises}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      routine: { ...prev.routine, cognitiveExercises: e.target.checked },
                    }))
                  }
                />
                <span>Cognitive ({categories.routine.cognitiveTime})</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: categories.routine.enabled ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  disabled={!categories.routine.enabled}
                  checked={categories.routine.physicalActivity}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      routine: { ...prev.routine, physicalActivity: e.target.checked },
                    }))
                  }
                />
                <span>Physical ({categories.routine.physicalTime})</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: categories.routine.enabled ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  disabled={!categories.routine.enabled}
                  checked={categories.routine.sleepRoutine}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      routine: { ...prev.routine, sleepRoutine: e.target.checked },
                    }))
                  }
                />
                <span>Sleep ({categories.routine.sleepTime})</span>
              </label>
            </div>
          </div>

          {/* Category D: Appointments */}
          <div
            style={{
              padding: '1.1rem',
              background: categories.appointments.enabled ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
              border: categories.appointments.enabled ? '1.5px solid var(--primary-border)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: categories.appointments.enabled ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              transition: 'all 150ms ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>Medical Appointments</span>
                <span
                  className="badge"
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    background: categories.appointments.enabled ? 'var(--stage-1-bg)' : 'var(--bg-surface)',
                    color: categories.appointments.enabled ? 'var(--stage-1)' : 'var(--text-muted)',
                    border: categories.appointments.enabled ? '1px solid var(--stage-1-border)' : '1px solid var(--border)',
                  }}
                >
                  {categories.appointments.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={categories.appointments.enabled}
                onChange={(e) =>
                  setCategories((prev) => ({
                    ...prev,
                    appointments: { ...prev.appointments, enabled: e.target.checked },
                  }))
                }
                aria-label="Enable medical appointment reminder notifications"
              />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
              Advance consultation reminders with prep checklist guidance.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.8rem', color: categories.appointments.enabled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: categories.appointments.enabled ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  disabled={!categories.appointments.enabled}
                  checked={categories.appointments.oneDayBefore}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      appointments: { ...prev.appointments, oneDayBefore: e.target.checked },
                    }))
                  }
                />
                <span>24 hours prior to appointment</span>
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: categories.appointments.enabled ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  disabled={!categories.appointments.enabled}
                  checked={categories.appointments.twoHoursBefore}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      appointments: { ...prev.appointments, twoHoursBefore: e.target.checked },
                    }))
                  }
                />
                <span>2 hours prior to appointment</span>
              </label>
            </div>
          </div>

          {/* Category E: Weekly Educational Guidance */}
          <div
            style={{
              padding: '1.1rem',
              background: categories.weeklyEducational?.enabled ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)',
              border: categories.weeklyEducational?.enabled ? '1.5px solid var(--primary-border)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: categories.weeklyEducational?.enabled ? 'var(--shadow-sm)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              gridColumn: '1 / -1',
              transition: 'all 150ms ease-out',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <BookOpen size={16} color="var(--primary)" />
                <span style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Weekly Stage-Specific Educational Guidance
                </span>
                <span
                  className="badge"
                  style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.5rem',
                    background: categories.weeklyEducational?.enabled ? 'var(--stage-1-bg)' : 'var(--bg-surface)',
                    color: categories.weeklyEducational?.enabled ? 'var(--stage-1)' : 'var(--text-muted)',
                    border: categories.weeklyEducational?.enabled ? '1px solid var(--stage-1-border)' : '1px solid var(--border)',
                  }}
                >
                  {categories.weeklyEducational?.enabled ? 'Active' : 'Disabled'}
                </span>
                {hasEligiblePrediction ? (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.5rem',
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      border: '1px solid var(--primary-border)',
                      fontWeight: '600',
                    }}
                  >
                    Stage {predictedStage} Profile Active
                  </span>
                ) : (
                  <span
                    className="badge"
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.5rem',
                      background: 'var(--bg-surface-subtle)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    General Health Profile
                  </span>
                )}
              </div>
              <input
                type="checkbox"
                checked={categories.weeklyEducational?.enabled || false}
                onChange={(e) =>
                  setCategories((prev) => ({
                    ...prev,
                    weeklyEducational: {
                      ...(prev.weeklyEducational || {}),
                      enabled: e.target.checked,
                    },
                  }))
                }
                aria-label="Enable weekly stage-specific educational guidance emails"
              />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
              Receive one weekly educational email adapted to your MRI stage, rotating through brain health, practical care tips, and lifestyle strategies.
            </p>

            {/* Schedule Configuration Row */}
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.2rem' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Preferred Weekday
                </label>
                <select
                  disabled={!categories.weeklyEducational?.enabled}
                  value={categories.weeklyEducational?.weekday || 'Sunday'}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      weeklyEducational: {
                        ...(prev.weeklyEducational || {}),
                        weekday: e.target.value,
                      },
                    }))
                  }
                  style={{
                    minHeight: '38px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.82rem',
                  }}
                >
                  <option value="Sunday">Every Sunday</option>
                  <option value="Monday">Every Monday</option>
                  <option value="Tuesday">Every Tuesday</option>
                  <option value="Wednesday">Every Wednesday</option>
                  <option value="Thursday">Every Thursday</option>
                  <option value="Friday">Every Friday</option>
                  <option value="Saturday">Every Saturday</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>
                  Delivery Time
                </label>
                <input
                  type="text"
                  disabled={!categories.weeklyEducational?.enabled}
                  value={categories.weeklyEducational?.time || '09:00 AM'}
                  onChange={(e) =>
                    setCategories((prev) => ({
                      ...prev,
                      weeklyEducational: {
                        ...(prev.weeklyEducational || {}),
                        time: e.target.value,
                      },
                    }))
                  }
                  placeholder="e.g. 09:00 AM"
                  style={{
                    minHeight: '38px',
                    width: '130px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.82rem',
                  }}
                />
              </div>
            </div>

            {/* Next Topic Preview */}
            {(() => {
              const stageKey = hasEligiblePrediction && [1, 2, 3, 4].includes(predictedStage) ? predictedStage : 1;
              const topicIdx = (categories.weeklyEducational?.topicIndex || 0) % 4;
              const preview = EDUCATIONAL_TOPIC_PREVIEWS[stageKey][topicIdx];
              return (
                <div
                  style={{
                    marginTop: '0.4rem',
                    padding: '0.85rem 1rem',
                    background: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    fontSize: '0.78rem',
                  }}
                >
                  <span style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Next Scheduled Topic (Topic {topicIdx + 1} of 4):
                  </span>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '0.85rem', marginTop: '0.2rem' }}>{preview.title}</div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: '1.45' }}>{preview.desc}</div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ================= 4. ACTION BAR ================= */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '1.1rem 1.25rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleSavePreferences}
            disabled={saving}
            className="btn-primary"
            style={{
              padding: '0.55rem 1.25rem',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Save size={16} />
            <span>{saving ? t('settings.email_saving') : t('settings.email_save')}</span>
          </button>

          <button
            onClick={() => handleSendTest('patient')}
            disabled={testSending || !patientEmail || !patientConsent}
            className="btn-secondary"
            title={
              !patientConsent
                ? 'Consent required before sending test email'
                : !patientEmail
                ? 'Please enter patient email'
                : 'Send a test email notification'
            }
            style={{
              padding: '0.55rem 1rem',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <Send size={15} />
            <span>{testSending ? t('settings.email_sending') : t('settings.email_send_test')}</span>
          </button>

          <button
            onClick={() => handleSendTest('educational')}
            disabled={testSending || !patientEmail || !patientConsent || !hasEligiblePrediction}
            className="btn-secondary"
            title={
              !hasEligiblePrediction
                ? 'An MRI scan must be saved first to test stage-specific educational email'
                : !patientConsent
                ? 'Consent required before sending test email'
                : !patientEmail
                ? 'Save a valid patient email address first'
                : 'Send a test copy of your current stage educational email'
            }
            style={{
              padding: '0.55rem 1rem',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}
          >
            <BookOpen size={15} />
            <span>Test Educational Email</span>
          </button>
        </div>

        <button
          onClick={() => {
            setShowHistory(!showHistory);
            if (!showHistory) loadHistory();
          }}
          className="btn-secondary"
          style={{
            padding: '0.5rem 0.95rem',
            fontSize: '0.82rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <Clock size={14} />
          <span>{showHistory ? t('settings.email_history_hide') : t('settings.email_history_btn')}</span>
        </button>
      </div>

      {/* ================= 5. NOTIFICATION DELIVERY HISTORY ================= */}
      {showHistory && (
        <div
          style={{
            padding: '1.25rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              {t('settings.email_history_title')}
            </span>
            <button
              onClick={loadHistory}
              style={{ background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
            >
              Refresh Log
            </button>
          </div>

          {historyLogs.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              No notification delivery records found yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', textAlign: 'left', background: 'var(--bg-surface-subtle)' }}>
                    <th style={{ padding: '0.65rem 0.75rem', fontWeight: '600' }}>Timestamp</th>
                    <th style={{ padding: '0.65rem 0.75rem', fontWeight: '600' }}>Recipient</th>
                    <th style={{ padding: '0.65rem 0.75rem', fontWeight: '600' }}>Category</th>
                    <th style={{ padding: '0.65rem 0.75rem', fontWeight: '600' }}>Subject</th>
                    <th style={{ padding: '0.65rem 0.75rem', fontWeight: '600' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLogs.map((log) => (
                    <tr key={log._id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>
                        {new Date(log.createdAt || log.sentAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                        {log.recipientEmail} ({log.recipient || 'patient'})
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--primary)', fontWeight: '600', textTransform: 'capitalize' }}>
                        {log.category}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>{log.subject}</td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span
                          className="badge"
                          style={{
                            padding: '0.2rem 0.55rem',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '0.72rem',
                            fontWeight: '600',
                            background:
                              log.status === 'sent'
                                ? 'var(--stage-1-bg)'
                                : log.status === 'failed'
                                ? 'var(--stage-4-bg)'
                                : 'var(--bg-surface-subtle)',
                            color:
                              log.status === 'sent'
                                ? 'var(--stage-1)'
                                : log.status === 'failed'
                                ? 'var(--stage-4)'
                                : 'var(--text-secondary)',
                            border:
                              log.status === 'sent'
                                ? '1px solid var(--stage-1-border)'
                                : log.status === 'failed'
                                ? '1px solid var(--stage-4-border)'
                                : '1px solid var(--border)',
                          }}
                        >
                          {log.status} {log.metadata?.simulated ? '(simulated)' : ''}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Mandatory Safety and Regulatory Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '0.95rem 1.15rem',
          background: 'var(--stage-4-bg)',
          border: '1px solid var(--stage-4-border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.8rem',
          color: 'var(--stage-4)',
          lineHeight: '1.5',
        }}
      >
        <ShieldAlert size={18} color="var(--stage-4)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ fontWeight: '700' }}>Privacy & Safety Protocol: </strong>
          NeuroScan AI notifications never contain MRI scan images, Grad-CAM heatmaps, diagnostic claims, or confidential neurological evaluation records. Scheduled reminders are informational only and never alter physician-prescribed dosing or therapeutic decisions.
        </div>
      </div>
    </div>
  );
}
