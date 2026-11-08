import React, { useState, useEffect } from 'react';
import {
  Pill,
  Clock,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  X,
  ShieldAlert,
  ShieldCheck,
  Bell,
  BellOff,
  Check,
  Search,
  Filter,
  RotateCcw,
  History,
  Sparkles,
  ChevronRight,
  AlertCircle,
  FileText,
  Mail,
} from 'lucide-react';
import {
  getMedications,
  getTodayDoses,
  addMedication,
  editMedication,
  updateIndividualDoseStatus,
  getMedicationHistory,
  deleteMedication,
} from '../services/api';
import WhyRecommendationCallout from './WhyRecommendationCallout';
import { getStageRecommendations } from '../data/stageRecommendations';
import EmailNotificationSettings from './EmailNotificationSettings';
import { useLanguage } from '../context/LanguageContext';

export default function MedicationReminder({ patientId = null, prediction }) {
  const { t, translateStage } = useLanguage();
  // Navigation sub-tabs: 'today', 'schedules', 'history', 'email'
  const [activeTab, setActiveTab] = useState('today');

  // Main data states
  const [todayDoses, setTodayDoses] = useState([]);
  const [summary, setSummary] = useState({ total: 0, taken: 0, upcoming: 0, missed: 0, skipped: 0 });
  const [medications, setMedications] = useState([]);
  const [historyDoses, setHistoryDoses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dbConnected, setDbConnected] = useState(true);
  const [offlineWarning, setOfflineWarning] = useState(null);

  // History filtering states
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'taken', 'missed', 'skipped'
  const [historySearch, setHistorySearch] = useState('');

  // Browser notification permission state
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [editingMedId, setEditingMedId] = useState(null);

  // Form field states
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('Once Daily');
  const [scheduledTimes, setScheduledTimes] = useState([{ time: '08:00 AM', label: 'Morning' }]);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [prescribedBy, setPrescribedBy] = useState('');
  const [notes, setNotes] = useState('');

  // Delete / Discontinue confirmation modal state
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false, medId: null, medName: '' });

  // Stage recommendations guidance
  const stageNumber = prediction?.stageNumber || 1;
  const stageRecs = getStageRecommendations(stageNumber);
  const medGuidance = stageRecs.medicationGuidance;

  // Time conversion helper
  const getMinutesFromTimeStr = (timeStr) => {
    if (!timeStr) return 0;
    const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return 0;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const modifier = match[3] ? match[3].toUpperCase() : null;
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  // Format taken timestamp
  const formatTakenAtTime = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return '';
    }
  };

  // Format history date
  const formatHistoryDate = (dateVal) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return dateVal;
    }
  };

  // Load Today's Scheduled Doses and summary
  const loadTodayDoses = async () => {
    if (!patientId) {
      setTodayDoses([]);
      setSummary({ total: 0, taken: 0, upcoming: 0, missed: 0, skipped: 0 });
      return;
    }
    const res = await getTodayDoses(patientId);
    if (res.success) {
      setTodayDoses(res.doses);
      setSummary(res.summary);
      setDbConnected(res.dbConnected);
    }
  };

  // Load Medication Schedules
  const loadMedications = async () => {
    if (!patientId) {
      setMedications([]);
      return;
    }
    const res = await getMedications(patientId);
    if (res.success) {
      setMedications(res.data);
      setDbConnected(res.dbConnected);
      setOfflineWarning(res.warning);
    }
  };

  // Load History
  const loadHistory = async () => {
    if (!patientId) {
      setHistoryDoses([]);
      return;
    }
    const res = await getMedicationHistory(patientId, historyFilter === 'all' ? '' : historyFilter);
    if (res.success) {
      setHistoryDoses(res.data);
    }
  };

  // Initial & Tab load
  useEffect(() => {
    let isCancelled = false;
    setTodayDoses([]);
    setMedications([]);
    setHistoryDoses([]);
    setSummary({ total: 0, taken: 0, upcoming: 0, missed: 0, skipped: 0 });

    if (!patientId) return;

    const loadData = async () => {
      const dosesRes = await getTodayDoses(patientId);
      if (!isCancelled && dosesRes.success) {
        setTodayDoses(dosesRes.doses);
        setSummary(dosesRes.summary);
        setDbConnected(dosesRes.dbConnected);
      }
      const medsRes = await getMedications(patientId);
      if (!isCancelled && medsRes.success) {
        setMedications(medsRes.data);
        setDbConnected(medsRes.dbConnected);
        setOfflineWarning(medsRes.warning);
      }
    };
    loadData();

    return () => {
      isCancelled = true;
    };
  }, [patientId]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    } else if (activeTab === 'schedules') {
      loadMedications();
    } else {
      loadTodayDoses();
    }
  }, [activeTab, historyFilter]);

  // Request browser notification permissions
  const handleRequestNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      alert('Desktop notifications are not supported in this browser.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        new Notification('NeuroScan AI Notifications Active', {
          body: 'Medication reminders will be displayed when doses are due.',
        });
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  // Check for upcoming doses due soon (< 30 minutes)
  const upcomingSoonDoses = todayDoses.filter((dose) => {
    if (dose.status !== 'pending') return false;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const doseMinutes = getMinutesFromTimeStr(dose.scheduledTime);
    const diff = doseMinutes - currentMinutes;
    return diff >= 0 && diff <= 30;
  });

  // Background ticker for desktop notifications
  useEffect(() => {
    if (notificationPermission !== 'granted') return;
    const interval = setInterval(() => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      todayDoses.forEach((d) => {
        if (d.status === 'pending') {
          const doseMinutes = getMinutesFromTimeStr(d.scheduledTime);
          if (Math.abs(currentMinutes - doseMinutes) <= 1) {
            try {
              new Notification(`Medication Reminder: ${d.medicationName}`, {
                body: `Scheduled dose: ${d.dosage} at ${d.scheduledTime}. ${d.instructions || ''}`,
              });
            } catch (e) {
              // Ignore notification trigger failures
            }
          }
        }
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [notificationPermission, todayDoses]);

  // Frequency preset handler
  const handleFrequencyChange = (newFreq) => {
    setFrequency(newFreq);
    if (newFreq === 'Once Daily') {
      setScheduledTimes([{ time: '08:00 AM', label: 'Morning' }]);
    } else if (newFreq === 'Twice Daily') {
      setScheduledTimes([
        { time: '08:00 AM', label: 'Morning' },
        { time: '08:00 PM', label: 'Night' },
      ]);
    } else if (newFreq === 'Three Times Daily') {
      setScheduledTimes([
        { time: '08:00 AM', label: 'Morning' },
        { time: '01:00 PM', label: 'Afternoon' },
        { time: '08:00 PM', label: 'Night' },
      ]);
    } else if (newFreq === 'Four Times Daily') {
      setScheduledTimes([
        { time: '08:00 AM', label: 'Morning' },
        { time: '12:00 PM', label: 'Noon' },
        { time: '04:00 PM', label: 'Evening' },
        { time: '08:00 PM', label: 'Night' },
      ]);
    }
  };

  // Add / remove dynamic dose time fields in modal
  const handleAddTimeField = () => {
    setScheduledTimes([
      ...scheduledTimes,
      {
        time: '08:00 PM',
        label: scheduledTimes.length === 1 ? 'Evening' : `Dose ${scheduledTimes.length + 1}`,
      },
    ]);
  };

  const handleRemoveTimeField = (index) => {
    if (scheduledTimes.length > 1) {
      setScheduledTimes(scheduledTimes.filter((_, i) => i !== index));
    }
  };

  const handleTimeFieldChange = (index, field, value) => {
    const updated = [...scheduledTimes];
    updated[index][field] = value;
    setScheduledTimes(updated);
  };

  // Open modal in Add mode
  const handleOpenAddModal = () => {
    setModalMode('add');
    setEditingMedId(null);
    setName('');
    setDosage('');
    setFrequency('Once Daily');
    setScheduledTimes([{ time: '08:00 AM', label: 'Morning' }]);
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate('');
    setInstructions('');
    setPrescribedBy('');
    setNotes('');
    setIsModalOpen(true);
  };

  // Open modal in Edit mode
  const handleOpenEditModal = (med) => {
    setModalMode('edit');
    setEditingMedId(med._id);
    setName(med.name || '');
    setDosage(med.dosage || '');
    setFrequency(med.frequency || 'Once Daily');
    const existingTimes =
      med.scheduledTimes && med.scheduledTimes.length > 0
        ? med.scheduledTimes
        : (med.doses || []).map((d) => ({ time: d.time, label: d.label }));
    setScheduledTimes(existingTimes.length > 0 ? existingTimes : [{ time: '08:00 AM', label: 'Morning' }]);
    setStartDate(med.startDate ? new Date(med.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEndDate(med.endDate ? new Date(med.endDate).toISOString().slice(0, 10) : '');
    setInstructions(med.instructions || '');
    setPrescribedBy(med.prescribedBy || '');
    setNotes(med.notes || '');
    setIsModalOpen(true);
  };

  // Handle Form Submit (Add or Edit)
  const handleSubmitModal = async (e) => {
    e.preventDefault();
    if (!name.trim() || !dosage.trim()) {
      alert('Medication name and prescribed dosage are required.');
      return;
    }

    const payload = {
      name: name.trim(),
      dosage: dosage.trim(),
      frequency,
      scheduledTimes,
      startDate,
      endDate: endDate || null,
      instructions: instructions.trim(),
      prescribedBy: prescribedBy.trim(),
      notes: notes.trim(),
    };

    if (modalMode === 'add') {
      const res = await addMedication(payload, patientId);
      if (res.success) {
        setIsModalOpen(false);
        loadMedications();
        loadTodayDoses();
      } else {
        alert(res.error || 'Failed to save medication.');
      }
    } else {
      const res = await editMedication(editingMedId, payload, patientId);
      if (res.success) {
        setIsModalOpen(false);
        loadMedications();
        loadTodayDoses();
      } else {
        alert(res.error || 'Failed to update medication schedule.');
      }
    }
  };

  // Handle Dose Status updates (Taken, Skipped, Reset to pending)
  const handleUpdateDose = async (doseId, targetStatus, userNotes = '') => {
    const res = await updateIndividualDoseStatus(doseId, targetStatus, userNotes, patientId);
    if (res.success) {
      loadTodayDoses();
      if (activeTab === 'history') loadHistory();
    } else {
      alert(res.error || 'Failed to update dose status.');
    }
  };

  // Discontinue / Delete medication
  const handleConfirmDiscontinue = async () => {
    if (!deleteModalState.medId) return;
    const res = await deleteMedication(deleteModalState.medId, patientId);
    if (res.success) {
      setDeleteModalState({ isOpen: false, medId: null, medName: '' });
      loadMedications();
      loadTodayDoses();
      if (activeTab === 'history') loadHistory();
    } else {
      alert(res.error || 'Failed to discontinue medication.');
    }
  };

  // Filter history doses
  const filteredHistory = historyDoses.filter((dose) => {
    const matchesFilter =
      historyFilter === 'all' || dose.status.toLowerCase() === historyFilter.toLowerCase();
    const matchesSearch =
      !historySearch.trim() ||
      (dose.medicationName && dose.medicationName.toLowerCase().includes(historySearch.toLowerCase())) ||
      (dose.dosage && dose.dosage.toLowerCase().includes(historySearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const adherencePercent =
    summary.total > 0 ? Math.round((summary.taken / summary.total) * 100) : 0;

  return (
    <div
      className="panel"
      id="medication-reminders"
      style={{
        padding: '1.35rem 1.45rem',
        background: 'var(--panel)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* ================= HEADER ================= */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            <Pill size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('medications.title')}
            </h3>
            <span
              className="badge"
              style={{
                background: 'var(--bg-surface-subtle)',
                color: stageRecs.badgeColor || 'var(--primary)',
                border: `1px solid ${stageRecs.badgeColor || 'var(--primary)'}40`,
                fontSize: '0.72rem',
              }}
            >
              Stage {stageRecs.stageNumber}: {translateStage(stageRecs.stageNumber) || stageRecs.displayLabel}
            </span>
            {!dbConnected && (
              <span
                className="badge"
                style={{
                  background: 'var(--stage-3-bg)',
                  color: 'var(--stage-3)',
                  border: '1px solid var(--stage-3-border)',
                  fontSize: '0.68rem',
                }}
              >
                Temporary Session Mode
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
            {t('medications.subtitle')}
          </p>
        </div>

        {/* Top Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleRequestNotification}
            className="btn-secondary"
            title="Browser push notification permission"
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: notificationPermission === 'granted' ? 'var(--success)' : 'var(--text-secondary)',
            }}
          >
            {notificationPermission === 'granted' ? <Bell size={14} /> : <BellOff size={14} />}
            <span>
              {notificationPermission === 'granted'
                ? 'Notifications Enabled'
                : notificationPermission === 'denied'
                ? 'Notifications Blocked'
                : 'Enable Notifications'}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('email')}
            className="btn-secondary"
            title="Configure verified email reminders & caregiver alerts"
            style={{
              padding: '0.45rem 0.75rem',
              fontSize: '0.76rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: activeTab === 'email' ? 'var(--primary)' : 'var(--text-secondary)',
              borderColor: activeTab === 'email' ? 'var(--primary)' : undefined,
              background: activeTab === 'email' ? 'var(--primary-light)' : undefined,
            }}
          >
            <Mail size={14} />
            <span>{t('settings.tab_notifications')}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="btn-primary"
            style={{
              padding: '0.45rem 0.95rem',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Plus size={15} />
            <span>{t('medications.btn_add_medication')}</span>
          </button>
        </div>
      </div>

      {/* ================= EDUCATIONAL & SAFETY SAFEGUARDS ================= */}
      {/* "Why this recommendation?" Callout */}
      <WhyRecommendationCallout stageNumber={stageRecs.stageNumber} moduleType="medications" />

      {/* Stage-Specific Clinical Advisory Box */}
      <div
        style={{
          padding: '1rem 1.25rem',
          background: 'var(--bg-surface)',
          borderLeft: `4px solid ${stageRecs.badgeColor || 'var(--primary)'}`,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="var(--primary)" />
            <span style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)' }}>
              Stage-Adapted Clinical Medication Advisory ({stageRecs.displayLabel})
            </span>
          </div>
          <span
            className="badge"
            style={{
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              fontSize: '0.84rem',
              fontWeight: '600',
            }}
          >
            {medGuidance.statusLabel}
          </span>
        </div>

        <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
          {medGuidance.advisory}
        </p>

        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.55' }}>
          {medGuidance.rules.map((rule, idx) => (
            <li key={idx}>{rule}</li>
          ))}
        </ul>
      </div>

      {/* Mandatory Clinical Disclaimer & Missed Dose Protocol */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          padding: '0.9rem 1.15rem',
          background: 'var(--stage-4-bg)',
          border: '1px solid var(--stage-4-border)',
          borderRadius: 'var(--radius)',
          fontSize: '0.88rem',
          color: 'var(--stage-4)',
          lineHeight: '1.55',
        }}
      >
        <ShieldAlert size={20} color="var(--stage-4)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <strong style={{ color: 'var(--stage-4)' }}>Strict Safety Protocol — Not an Autonomous Prescribing Tool:</strong> Only enter medications and dosages prescribed by a qualified physician. NeuroScan AI never prescribes, recommends, or alters pharmaceutical treatments.
          <div style={{ marginTop: '0.35rem', color: 'var(--stage-4)' }}>
            <strong style={{ color: 'var(--stage-4)' }}>Missed Dose Safety Rule:</strong> Never take a double dose to make up for a missed dose. If a dose is missed beyond the scheduled window, follow your physician's instructions or consult your pharmacist.
          </div>
        </div>
      </div>

      {/* ================= SUB-TABS NAVIGATION ================= */}
      <div
        style={{
          display: 'flex',
          gap: '0.4rem',
          background: 'var(--panel-secondary)',
          padding: '0.25rem',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => setActiveTab('today')}
          style={{
            padding: '0.4rem 0.85rem',
            background: activeTab === 'today' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'today' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.78rem',
            fontWeight: activeTab === 'today' ? '600' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <Clock size={14} />
          <span>{t('medications.tab_schedule')}</span>
          <span
            style={{
              padding: '0.1rem 0.35rem',
              borderRadius: '999px',
              fontSize: '0.66rem',
              background: activeTab === 'today' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.05)',
              color: activeTab === 'today' ? '#ffffff' : 'inherit',
              fontWeight: '700',
            }}
          >
            {summary.total}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('schedules')}
          style={{
            padding: '0.4rem 0.85rem',
            background: activeTab === 'schedules' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'schedules' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.78rem',
            fontWeight: activeTab === 'schedules' ? '600' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <Pill size={14} />
          <span>{t('medications.tab_all')}</span>
          <span
            style={{
              padding: '0.1rem 0.35rem',
              borderRadius: '999px',
              fontSize: '0.66rem',
              background: activeTab === 'schedules' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.05)',
              color: activeTab === 'schedules' ? '#ffffff' : 'inherit',
              fontWeight: '700',
            }}
          >
            {medications.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          style={{
            padding: '0.4rem 0.85rem',
            background: activeTab === 'history' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'history' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.78rem',
            fontWeight: activeTab === 'history' ? '600' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <History size={14} />
          <span>{t('medications.tab_history')}</span>
        </button>

        <button
          onClick={() => setActiveTab('email')}
          style={{
            padding: '0.4rem 0.85rem',
            background: activeTab === 'email' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'email' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.78rem',
            fontWeight: activeTab === 'email' ? '600' : '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            transition: 'all 0.15s ease',
          }}
        >
          <Mail size={14} />
          <span>{t('settings.tab_notifications')}</span>
        </button>
      </div>

      {/* ================= TAB 1: TODAY'S SCHEDULE & TRACKER ================= */}
      {activeTab === 'today' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          {/* Upcoming Alert Banner if any dose is due within next 30 minutes */}
          {upcomingSoonDoses.length > 0 && (
            <div
              style={{
                padding: '0.85rem 1.15rem',
                background: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Clock size={18} color="var(--primary)" />
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Upcoming Dose Due Soon: {upcomingSoonDoses[0].medicationName} ({upcomingSoonDoses[0].dosage})
                  </span>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    Scheduled for {upcomingSoonDoses[0].scheduledTime} ({upcomingSoonDoses[0].label}). {upcomingSoonDoses[0].instructions || ''}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleUpdateDose(upcomingSoonDoses[0]._id || upcomingSoonDoses[0].doseId, 'taken')}
                className="btn-primary"
                style={{
                  padding: '0.35rem 0.8rem',
                  fontSize: '0.74rem',
                  background: 'var(--success)',
                  color: '#ffffff',
                }}
              >
                <Check size={14} />
                <span>Mark as Taken Now</span>
              </button>
            </div>
          )}

          {/* Section A: Today's Medication Summary Cards (4 Cards) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {/* Card 1: Total */}
            <div
              style={{
                background: 'var(--panel-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>
                  Total Doses
                </span>
                <Pill size={15} color="var(--text-muted)" />
              </div>
              <span style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {summary.total}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Scheduled for today</span>
            </div>

            {/* Card 2: Taken */}
            <div
              style={{
                background: 'var(--stage-1-bg)',
                border: '1px solid var(--stage-1-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--stage-1)', textTransform: 'uppercase', fontWeight: '600' }}>
                  Taken
                </span>
                <CheckCircle2 size={15} color="var(--stage-1)" />
              </div>
              <span style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--stage-1)' }}>
                {summary.taken}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Doses confirmed</span>
            </div>

            {/* Card 3: Upcoming */}
            <div
              style={{
                background: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--primary-dark)', textTransform: 'uppercase', fontWeight: '600' }}>
                  Upcoming
                </span>
                <Clock size={15} color="var(--primary)" />
              </div>
              <span style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--primary-dark)' }}>
                {summary.upcoming}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Pending administration</span>
            </div>

            {/* Card 4: Missed */}
            <div
              style={{
                background: 'var(--stage-4-bg)',
                border: '1px solid var(--stage-4-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.85rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--stage-4)', textTransform: 'uppercase', fontWeight: '600' }}>
                  Missed
                </span>
                <AlertTriangle size={15} color="var(--stage-4)" />
              </div>
              <span style={{ fontSize: '1.45rem', fontWeight: '800', color: 'var(--stage-4)' }}>
                {summary.missed}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Past 60-min window</span>
            </div>
          </div>

          {/* Adherence Progress Bar */}
          {summary.total > 0 && (
            <div
              style={{
                padding: '0.85rem 1.15rem',
                background: 'var(--panel-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                  Today's Adherence: {summary.taken} of {summary.total} doses taken
                  {summary.skipped > 0 && ` • (${summary.skipped} skipped)`}
                </span>
                <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)', fontWeight: '700' }}>
                  {adherencePercent}%
                </span>
              </div>
              <div className="progress-bar-bg" style={{ height: '0.45rem' }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${adherencePercent}%`,
                    background: 'linear-gradient(90deg, var(--primary), var(--secondary))',
                  }}
                />
              </div>
            </div>
          )}

          {/* Section B: Today's Scheduled Doses (Chronological List) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <h4 style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Today's Chronological Dose Timeline
              </h4>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {todayDoses.length === 0 ? (
              <div
                style={{
                  padding: '2.5rem 1rem',
                  textAlign: 'center',
                  background: 'var(--panel-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px dashed var(--border)',
                  color: 'var(--text-muted)',
                }}
              >
                <Pill size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                  No medication doses scheduled for today.
                </p>
                <p style={{ margin: '0.25rem 0 1rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Add your clinician-prescribed medicines to start tracking your daily schedule.
                </p>
                <button onClick={handleOpenAddModal} className="btn-primary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.76rem' }}>
                  <Plus size={14} /> Add Prescribed Medicine
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {todayDoses.map((dose) => {
                  const isTaken = dose.status === 'taken';
                  const isMissed = dose.status === 'missed';
                  const isSkipped = dose.status === 'skipped';
                  const isPending = dose.status === 'pending';

                  let statusBadgeStyle = {
                    background: 'var(--primary-light)',
                    color: 'var(--primary)',
                    border: '1px solid var(--primary-border)',
                  };
                  let statusLabel = 'Upcoming';

                  if (isTaken) {
                    statusBadgeStyle = {
                      background: 'var(--stage-1-bg)',
                      color: 'var(--stage-1)',
                      border: '1px solid var(--stage-1-border)',
                    };
                    statusLabel = `✓ Taken ${dose.takenAt ? `at ${formatTakenAtTime(dose.takenAt)}` : ''}`;
                  } else if (isMissed) {
                    statusBadgeStyle = {
                      background: 'var(--stage-4-bg)',
                      color: 'var(--stage-4)',
                      border: '1px solid var(--stage-4-border)',
                    };
                    statusLabel = 'Missed';
                  } else if (isSkipped) {
                    statusBadgeStyle = {
                      background: 'var(--bg-surface-subtle)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    };
                    statusLabel = 'Skipped';
                  }

                  return (
                    <div
                      key={dose._id || dose.doseId}
                      className={isTaken ? 'med-taken-card' : ''}
                      style={{
                        padding: '1rem 1.25rem',
                        background: isTaken
                          ? 'var(--stage-1-bg)'
                          : isMissed
                          ? 'var(--stage-4-bg)'
                          : 'var(--bg-surface)',
                        border: isTaken
                          ? '1px solid var(--stage-1-border)'
                          : isMissed
                          ? '1px solid var(--stage-4-border)'
                          : '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '0.85rem',
                        transition: 'background-color 300ms ease-out, border-color 300ms ease-out',
                      }}
                    >
                      {/* Left: Time and Medication Info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, minWidth: '240px' }}>
                        {/* Time Box */}
                        <div
                          style={{
                            padding: '0.45rem 0.65rem',
                            borderRadius: 'var(--radius-xs)',
                            background: 'var(--bg-surface-subtle)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            minWidth: '85px',
                          }}
                        >
                          <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                            {dose.scheduledTime}
                          </span>
                          <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            {dose.label}
                          </span>
                        </div>

                        {/* Medicine details */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                              {dose.medicationName}
                            </span>
                            <span
                              className="badge-cyan"
                              style={{ fontSize: '0.88rem', fontFamily: 'var(--font-mono)' }}
                            >
                              {dose.dosage}
                            </span>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.88rem',
                                fontWeight: '600',
                                ...statusBadgeStyle,
                              }}
                            >
                              {isTaken && (
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="var(--stage-1)"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="check-drawn"
                                  aria-hidden="true"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                              <span>{statusLabel}</span>
                            </span>
                          </div>

                          {dose.instructions && (
                            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                              Instructions: {dose.instructions}
                            </span>
                          )}

                          {dose.notes && (
                            <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                              Note: {dose.notes}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {isPending && (
                          <>
                            <button
                              onClick={() => handleUpdateDose(dose._id || dose.doseId, 'taken')}
                              style={{
                                padding: '0.4rem 0.75rem',
                                background: 'var(--success)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.74rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                              }}
                            >
                              <Check size={13} />
                              <span>Mark Taken</span>
                            </button>

                            <button
                              onClick={() => {
                                const reason = prompt('Optional: Reason for skipping this dose?');
                                handleUpdateDose(dose._id || dose.doseId, 'skipped', reason || '');
                              }}
                              style={{
                                padding: '0.4rem 0.65rem',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.74rem',
                                cursor: 'pointer',
                              }}
                            >
                              Skip
                            </button>
                          </>
                        )}

                        {isMissed && (
                          <>
                            <button
                              onClick={() => handleUpdateDose(dose._id || dose.doseId, 'taken')}
                              style={{
                                padding: '0.4rem 0.75rem',
                                background: 'var(--stage-1-bg)',
                                color: 'var(--stage-1)',
                                border: '1px solid var(--stage-1-border)',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.74rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                              }}
                              title="Mark as taken late"
                            >
                              Mark Taken Late
                            </button>
                            <button
                              onClick={() => handleUpdateDose(dose._id || dose.doseId, 'skipped')}
                              style={{
                                padding: '0.4rem 0.65rem',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-xs)',
                                fontSize: '0.74rem',
                                cursor: 'pointer',
                              }}
                            >
                              Skip
                            </button>
                          </>
                        )}

                        {isTaken && (
                          <button
                            onClick={() => handleUpdateDose(dose._id || dose.doseId, 'pending')}
                            style={{
                              padding: '0.3rem 0.55rem',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                            title="Reset dose to pending if marked by mistake"
                          >
                            <RotateCcw size={11} />
                            <span>Undo</span>
                          </button>
                        )}

                        {isSkipped && (
                          <button
                            onClick={() => handleUpdateDose(dose._id || dose.doseId, 'pending')}
                            style={{
                              padding: '0.3rem 0.55rem',
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                            title="Reset dose to pending"
                          >
                            <RotateCcw size={11} />
                            <span>Undo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 2: PRESCRIPTION SCHEDULES (SECTION C) ================= */}
      {activeTab === 'schedules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Active Prescribed Medication Regimens
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                Manage ongoing prescription regimens. Modifying or discontinuing preserves past dose audit logs.
              </p>
            </div>
            <button onClick={handleOpenAddModal} className="btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.76rem' }}>
              <Plus size={14} /> Add Medicine
            </button>
          </div>

          {medications.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                background: 'var(--panel-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              No active prescriptions configured. Click "Add Medicine" to enter your doctor's prescriptions.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.85rem' }}>
              {medications.map((med) => (
                <div
                  key={med._id}
                  style={{
                    background: 'var(--panel-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '1rem 1.15rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {/* Header: Name, Dosage, Frequency */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <Pill size={16} color="var(--primary)" />
                        <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {med.name}
                        </span>
                      </div>
                      <span className="badge-cyan" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                        {med.dosage}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Frequency: <strong style={{ color: 'var(--text-secondary)' }}>{med.frequency}</strong>
                      {med.prescribedBy && ` • Rx: ${med.prescribedBy}`}
                    </div>

                    {med.instructions && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        Instructions: {med.instructions}
                      </div>
                    )}

                    {/* Scheduled Times List */}
                    <div style={{ marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                        Scheduled Daily Times:
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        {(med.scheduledTimes || med.doses || []).map((t, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '0.2rem 0.5rem',
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.72rem',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--primary)',
                            }}
                          >
                            {t.time} ({t.label})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Edit & Discontinue */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '0.5rem',
                      paddingTop: '0.6rem',
                      borderTop: '1px solid var(--border)',
                    }}
                  >
                    <button
                      onClick={() => handleOpenEditModal(med)}
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                    >
                      <Edit3 size={12} /> Edit Schedule
                    </button>

                    <button
                      onClick={() => setDeleteModalState({ isOpen: true, medId: med._id, medName: med.name })}
                      className="btn-secondary"
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.72rem',
                        color: 'var(--danger)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Trash2 size={12} /> Discontinue
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: DOSE HISTORY (SECTION D) ================= */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Historical Dose Administration Logs
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                Complete audit trail of taken, missed, and skipped medication doses.
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Filter by medicine..."
                  style={{
                    padding: '0.4rem 0.65rem 0.4rem 1.8rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--text-primary)',
                    fontSize: '0.76rem',
                    width: '160px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {['all', 'taken', 'missed', 'skipped'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '0.72rem',
                      textTransform: 'capitalize',
                      cursor: 'pointer',
                      background: historyFilter === f ? 'var(--primary)' : 'var(--bg-surface-subtle)',
                      color: historyFilter === f ? '#ffffff' : 'var(--text-secondary)',
                      border: historyFilter === f ? '1px solid var(--primary)' : '1px solid var(--border)',
                      fontWeight: historyFilter === f ? '700' : '500',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div
              style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                background: 'var(--panel-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              No dose administration records matching the selected criteria.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.55rem 0.75rem' }}>Scheduled Date & Time</th>
                    <th style={{ padding: '0.55rem 0.75rem' }}>Medication & Dosage</th>
                    <th style={{ padding: '0.55rem 0.75rem' }}>Status</th>
                    <th style={{ padding: '0.55rem 0.75rem' }}>Actual Time Administered</th>
                    <th style={{ padding: '0.55rem 0.75rem' }}>Notes / Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.map((hDose, idx) => {
                    const isTaken = hDose.status === 'taken';
                    const isMissed = hDose.status === 'missed';
                    const isSkipped = hDose.status === 'skipped';

                    return (
                      <tr
                        key={hDose._id || hDose.doseId || idx}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          background: idx % 2 === 0 ? 'transparent' : 'var(--bg-surface-subtle)',
                        }}
                      >
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          {hDose.scheduledDate} {hDose.scheduledTime}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{hDose.medicationName}</span>
                          <span style={{ marginLeft: '0.35rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                            ({hDose.dosage})
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem' }}>
                          <span
                            style={{
                              padding: '0.15rem 0.45rem',
                              borderRadius: 'var(--radius-xs)',
                              fontSize: '0.68rem',
                              fontWeight: '600',
                              background: isTaken
                                ? 'rgba(16, 185, 129, 0.15)'
                                : isMissed
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(148, 163, 184, 0.12)',
                              color: isTaken
                                ? 'var(--success)'
                                : isMissed
                                ? 'var(--danger)'
                                : 'var(--text-muted)',
                              textTransform: 'capitalize',
                            }}
                          >
                            {hDose.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: isTaken ? 'var(--success)' : 'var(--text-muted)' }}>
                          {hDose.takenAt ? `${formatHistoryDate(hDose.takenAt)}, ${formatTakenAtTime(hDose.takenAt)}` : '—'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-secondary)' }}>
                          {hDose.notes || hDose.instructions || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 4: EMAIL NOTIFICATION SETTINGS ================= */}
      {activeTab === 'email' && (
        <div style={{ marginTop: '0.5rem' }}>
          <EmailNotificationSettings patientId={patientId} />
        </div>
      )}

      {/* ================= ADD & EDIT MEDICATION MODAL ================= */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.45rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Pill size={18} color="var(--primary)" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  {modalMode === 'add' ? 'Add Clinician-Prescribed Medication' : 'Edit Medication Schedule'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitModal} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                    Medication Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Donepezil, Memantine, Metformin"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.7rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                    Prescribed Dosage *
                  </label>
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g. 5 mg, 10 mg tablet, 1 puff"
                    required
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.7rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                    Frequency Prescribed
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => handleFrequencyChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.7rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  >
                    <option value="Once Daily">Once Daily</option>
                    <option value="Twice Daily">Twice Daily</option>
                    <option value="Three Times Daily">Three Times Daily</option>
                    <option value="Four Times Daily">Four Times Daily</option>
                    <option value="Custom">Custom Schedule</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                    Prescribing Doctor / Clinic
                  </label>
                  <input
                    type="text"
                    value={prescribedBy}
                    onChange={(e) => setPrescribedBy(e.target.value)}
                    placeholder="e.g. Dr. Neurologist / NIMHANS"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.7rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              {/* Dynamic Scheduled Times List */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-xs)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
                    Daily Dose Times ({scheduledTimes.length} doses per day)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddTimeField}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                  >
                    + Add Time
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {scheduledTimes.map((doseItem, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={doseItem.label}
                        onChange={(e) => handleTimeFieldChange(idx, 'label', e.target.value)}
                        placeholder="e.g. Morning, Night"
                        style={{
                          flex: 1,
                          padding: '0.4rem 0.6rem',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-xs)',
                          color: 'var(--text-primary)',
                          fontSize: '0.78rem',
                        }}
                      />
                      <input
                        type="text"
                        value={doseItem.time}
                        onChange={(e) => handleTimeFieldChange(idx, 'time', e.target.value)}
                        placeholder="e.g. 08:00 AM"
                        style={{
                          width: '120px',
                          padding: '0.4rem 0.6rem',
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-xs)',
                          color: 'var(--primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.78rem',
                        }}
                      />
                      {scheduledTimes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTimeField(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--danger)',
                            cursor: 'pointer',
                            padding: '0.3rem',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Start Date & End Date */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.7rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                    End Date (Optional / Ongoing)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.7rem',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                    }}
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                  Prescription Instructions
                </label>
                <input
                  type="text"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Take with food and a full glass of water. Do not chew."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.7rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: '0.3rem', fontWeight: '600' }}>
                  Caregiver / Patient Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Kept in upper medicine cabinet."
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.7rem',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                  style={{ padding: '0.45rem 0.95rem', fontSize: '0.78rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '0.45rem 1.15rem', fontSize: '0.78rem' }}
                >
                  {modalMode === 'add' ? 'Save Medication' : 'Update Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DISCONTINUE CONFIRMATION MODAL ================= */}
      {deleteModalState.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '460px',
              padding: '1.45rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
              <AlertCircle size={20} />
              <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Discontinue Medication Schedule?
              </h4>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Are you sure you want to discontinue <strong>{deleteModalState.medName}</strong>?
            </p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Future scheduled doses will be cancelled, but all past dose administration records will be safely preserved in your history log.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.55rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => setDeleteModalState({ isOpen: false, medId: null, medName: '' })}
                className="btn-secondary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.76rem' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDiscontinue}
                style={{
                  padding: '0.4rem 0.95rem',
                  background: 'var(--danger)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '0.76rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Discontinue Medication
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
