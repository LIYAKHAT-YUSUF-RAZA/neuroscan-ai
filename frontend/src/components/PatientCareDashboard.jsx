import React, { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  UploadCloud,
  Pill,
  Calendar,
  Heart,
  ArrowRight,
  Clock,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { getStageInfo } from '../data/educationalContent';
import { getStageRecommendations } from '../data/stageRecommendations';
import { getTodayDoses, getAppointments } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function PatientCareDashboard({
  prediction,
  preferences,
  onOpenPreferences,
  onNavigate,
  onNewAnalysis,
  patientId,
  activePatient,
  userRole = 'researcher',
}) {
  const { t, formatDate, translateClass } = useLanguage();
  const [nextDose, setNextDose] = useState(null);
  const [dosesSummary, setDosesSummary] = useState(null);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [loadingCareData, setLoadingCareData] = useState(false);

  const shouldReduceMotion = useReducedMotion();

  const stageNumber = prediction?.stageNumber || (prediction?.predictedClass ? getStageInfo(prediction.predictedClass).stageNumber : 1);
  const stageInfo = prediction ? getStageInfo(prediction.predictedClass) : getStageInfo('NonDemented');
  const stageRecs = getStageRecommendations(stageNumber);

  // Time-of-day greeting (Rule A.9)
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greeting_morning');
    if (hour < 18) return t('dashboard.greeting_afternoon');
    return t('dashboard.greeting_evening');
  };

  // Fetch today's medication dose and upcoming appointment
  useEffect(() => {
    let isCancelled = false;
    if (!patientId) {
      setNextDose(null);
      setDosesSummary(null);
      setNextAppointment(null);
      return;
    }

    const loadDashboardCareData = async () => {
      setLoadingCareData(true);
      try {
        const tz = activePatient?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
        const [dosesRes, apptsRes] = await Promise.all([
          getTodayDoses(patientId, tz, userRole),
          getAppointments(patientId, userRole),
        ]);

        if (isCancelled) return;

        if (dosesRes.success && dosesRes.doses) {
          const pending = dosesRes.doses.filter((d) => d.status === 'pending');
          setNextDose(pending.length > 0 ? pending[0] : null);
          setDosesSummary(dosesRes.summary);
        } else {
          setNextDose(null);
          setDosesSummary(null);
        }

        if (apptsRes.success && apptsRes.data && apptsRes.data.length > 0) {
          const today = new Date().toISOString().slice(0, 10);
          const upcoming = apptsRes.data
            .filter((a) => !a.appointmentDate || a.appointmentDate >= today)
            .sort((a, b) => (a.appointmentDate || '').localeCompare(b.appointmentDate || ''));
          setNextAppointment(upcoming.length > 0 ? upcoming[0] : apptsRes.data[0]);
        } else {
          setNextAppointment(null);
        }
      } catch (e) {
        // Non-blocking
      } finally {
        if (!isCancelled) setLoadingCareData(false);
      }
    };

    loadDashboardCareData();
    return () => {
      isCancelled = true;
    };
  }, [patientId, userRole, activePatient]);

  const topProb = prediction?.probabilities && prediction?.predictedClass
    ? (prediction.probabilities[prediction.predictedClass] * 100).toFixed(1)
    : (prediction?.confidence ? (prediction.confidence * 100).toFixed(1) : null);

  // Framer-motion animation variants (Section B & C)
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.05,
      },
    },
  };

  const cardVariants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 10,
    },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: 'easeOut',
      },
    },
  };

  return (
    <motion.div
      className="app-main-content"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* 1. Calm greeting line replacing bulky overview card (Rule A.9) */}
      <motion.div variants={cardVariants} style={{ marginBottom: '0.25rem' }}>
        <h2 style={{ fontSize: '1.65rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
          {getGreeting()}, {activePatient?.name || 'Patient'}
        </h2>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
          Here is your brain health overview and today's schedule.
        </p>
      </motion.div>

      {/* 2. Primary Card: Upload Brain MRI or Latest Result (Rule A.1, A.2, A.5, A.10) */}
      <motion.div
        variants={cardVariants}
        className="card-primary"
        style={{
          borderLeft: prediction ? `5px solid ${stageInfo.color}` : '1.5px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Activity size={22} style={{ color: prediction ? stageInfo.color : 'var(--primary)' }} aria-hidden="true" />
            <h3 style={{ fontSize: '1.18rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {prediction ? 'Latest Brain MRI Scan' : 'Brain MRI Scan Check'}
            </h3>
          </div>

          {prediction ? (
            <span
              className="badge"
              style={{
                background: stageInfo.bg,
                color: stageInfo.color,
                border: `1px solid ${stageInfo.border}`,
                fontWeight: '700',
              }}
            >
              Stage {stageNumber}: {stageInfo.displayLabel}
            </span>
          ) : (
            <span
              className="badge"
              style={{
                background: 'var(--bg-surface-subtle)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              Ready to check
            </span>
          )}
        </div>

        {prediction ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
            <div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Evaluated Result
              </div>
              <div style={{ fontSize: '1.35rem', fontWeight: '700', color: stageInfo.color, marginTop: '0.15rem' }}>
                {prediction.displayLabel || prediction.stageLabel || stageInfo.displayLabel}
              </div>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', lineHeight: '1.5' }}>
                {stageInfo.description || 'Scan evaluated using computerized attention maps to inspect brain patterns.'}
              </p>
            </div>

            {/* Model-assigned probability bar */}
            {topProb && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{t('dashboard.confidence_score')}</span>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {topProb}%
                  </span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{
                      width: `${Math.max(Number(topProb), 5)}%`,
                      backgroundColor: 'var(--primary)',
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                {prediction.timestamp ? t('dashboard.checked_on', { date: formatDate(prediction.timestamp) }) : t('dashboard.current_session')}
              </span>

              <button
                type="button"
                onClick={() => onNavigate('viewer')}
                className="btn-primary"
                style={{ fontSize: '0.95rem', padding: '0.55rem 1.15rem' }}
              >
                <span>{t('dashboard.view_full_scan')}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          /* Empty state: high contrast text, plain language, ONE primary button (Rule A.1, A.2, A.5) */
          <div
            style={{
              padding: '1.75rem 1.25rem',
              textAlign: 'center',
              background: 'var(--bg-surface-subtle)',
              borderRadius: 'var(--radius)',
              border: '1px dashed var(--border-medium)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <UploadCloud size={24} aria-hidden="true" />
            </div>

            <div style={{ maxWidth: '520px' }}>
              <h4 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {t('dashboard.empty_scans_title')}
              </h4>
              <p style={{ fontSize: '0.96rem', color: 'var(--text-secondary)', margin: '0.45rem 0 0 0', lineHeight: '1.55' }}>
                {t('dashboard.empty_scans_desc')}
              </p>
            </div>

            {/* ONE clear primary button on this screen (Rule A.2) */}
            <button
              type="button"
              onClick={() => onNavigate('viewer')}
              className="btn-primary"
              style={{ marginTop: '0.35rem' }}
            >
              <UploadCloud size={18} aria-hidden="true" />
              <span>{t('dashboard.upload_mri_btn')}</span>
            </button>
          </div>
        )}
      </motion.div>

      {/* 3. Three Care Summary Cards: Fully Clickable, Clear Single Links (Rule A.4, A.10) */}
      <motion.div
        variants={containerVariants}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.25rem' }}
      >
        {/* Card 1: Today's medicines */}
        <motion.div
          variants={cardVariants}
          className="card-secondary card-interactive"
          onClick={() => onNavigate('medications')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('medications');
            }
          }}
          aria-label="Open medicines schedule"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: 'var(--radius)',
                    backgroundColor: 'var(--primary-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)',
                  }}
                >
                  <Pill size={18} aria-hidden="true" />
                </div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Today's medicines
                </h4>
              </div>
            </div>

            {/* Content: show "0 of 2 taken" OR empty text, NEVER both (Rule A.4) */}
            {dosesSummary && dosesSummary.total > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {dosesSummary.taken} of {dosesSummary.total} taken
                </div>
                {nextDose ? (
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Next: <strong style={{ color: 'var(--text-primary)' }}>{nextDose.medicationName}</strong> at {nextDose.scheduledTime}
                  </p>
                ) : (
                  <p style={{ fontSize: '0.88rem', color: 'var(--stage-1)', margin: 0, fontWeight: '600' }}>
                    All scheduled doses completed for today
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
                {loadingCareData ? 'Checking your medicine list...' : 'No medicines scheduled for today'}
              </p>
            )}
          </div>

          {/* Single link (Rule A.4) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--primary)',
              fontWeight: '600',
              fontSize: '0.92rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span>Open medicines</span>
            <ArrowRight size={16} aria-hidden="true" />
          </div>
        </motion.div>

        {/* Card 2: Next doctor visit */}
        <motion.div
          variants={cardVariants}
          className="card-secondary card-interactive"
          onClick={() => onNavigate('appointments')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('appointments');
            }
          }}
          aria-label="Open doctor appointments"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <Calendar size={18} aria-hidden="true" />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Next doctor visit
              </h4>
            </div>

            {/* Content: show visit details or "No visits booked" (Rule A.4) */}
            {nextAppointment ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {nextAppointment.specialistName}
                </div>
                <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  {nextAppointment.specialty || 'Neurology Specialist'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <Clock size={14} style={{ color: 'var(--primary)' }} />
                  <span>{nextAppointment.appointmentDate}</span>
                  {nextAppointment.appointmentTime && <span>• {nextAppointment.appointmentTime}</span>}
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
                {loadingCareData ? 'Checking upcoming visits...' : 'No visits booked'}
              </p>
            )}
          </div>

          {/* Single link (Rule A.4) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--primary)',
              fontWeight: '600',
              fontSize: '0.92rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span>{nextAppointment ? 'View visit details' : 'Add a visit'}</span>
            <ArrowRight size={16} aria-hidden="true" />
          </div>
        </motion.div>

        {/* Card 3: Care tips */}
        <motion.div
          variants={cardVariants}
          className="card-secondary card-interactive"
          onClick={() => onNavigate('care-recommendations')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigate('care-recommendations');
            }
          }}
          aria-label="Open care tips and guidance"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--stage-1-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--stage-1)',
                }}
              >
                <Heart size={18} aria-hidden="true" />
              </div>
              <h4 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Care tips
              </h4>
            </div>

            {/* Content: 2 short tips (Rule A.4) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {stageRecs.priorityFocus.slice(0, 2).map((focusItem, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    fontSize: '0.88rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.45',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                      marginTop: '6px',
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />
                  <span>{focusItem}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Single link (Rule A.4) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--primary)',
              fontWeight: '600',
              fontSize: '0.92rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid var(--border)',
            }}
          >
            <span>More tips</span>
            <ArrowRight size={16} aria-hidden="true" />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
