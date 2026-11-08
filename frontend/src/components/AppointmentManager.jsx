import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  HelpCircle,
  FileText,
  X,
  Stethoscope,
} from 'lucide-react';
import {
  getAppointments,
  addAppointment,
  toggleAppointmentChecklist,
  deleteAppointment,
} from '../services/api';
import WhyRecommendationCallout from './WhyRecommendationCallout';
import { getStageRecommendations } from '../data/stageRecommendations';
import { useLanguage } from '../context/LanguageContext';

export default function AppointmentManager({ patientId = null, prediction }) {
  const { t, translateStage } = useLanguage();
  const stageNumber = prediction?.stageNumber || 1;
  const stageRecs = getStageRecommendations(stageNumber);

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form states
  const [specialistName, setSpecialistName] = useState('');
  const [specialty, setSpecialty] = useState('Neurologist');
  const [facilityName, setFacilityName] = useState('');
  const [location, setLocation] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('10:00 AM');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [customQuestion, setCustomQuestion] = useState('');
  const [questions, setQuestions] = useState(
    stageRecs.followUpGuidance?.prepQuestions || []
  );

  // Update prep questions if predicted stage changes
  useEffect(() => {
    if (stageRecs.followUpGuidance?.prepQuestions) {
      setQuestions(stageRecs.followUpGuidance.prepQuestions);
    }
  }, [stageRecs.stageNumber]);

  const loadAppointments = async (isCancelledRef = { current: false }) => {
    if (!patientId) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getAppointments(patientId);
    if (!isCancelledRef.current) {
      setLoading(false);
      if (res.success) {
        setAppointments(res.data);
      }
    }
  };

  useEffect(() => {
    const isCancelledRef = { current: false };
    setAppointments([]);
    loadAppointments(isCancelledRef);
    return () => {
      isCancelledRef.current = true;
    };
  }, [patientId]);

  const handleAddQuestion = () => {
    if (customQuestion.trim()) {
      setQuestions([...questions, customQuestion.trim()]);
      setCustomQuestion('');
    }
  };

  const handleRemoveQuestion = (idx) => {
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!specialistName.trim() || !appointmentDate) {
      alert('Please specify specialist name and appointment date.');
      return;
    }

    const payload = {
      specialistName: specialistName.trim(),
      specialty,
      facilityName: facilityName.trim(),
      location: location.trim(),
      appointmentDate,
      appointmentTime,
      reasonForVisit: reasonForVisit.trim(),
      questionsToDiscuss: questions,
    };

    const res = await addAppointment(payload, patientId);
    if (res.success) {
      setSpecialistName('');
      setFacilityName('');
      setLocation('');
      setAppointmentDate('');
      setReasonForVisit('');
      setShowForm(false);
      loadAppointments();
    } else {
      alert(res.error || 'Failed to save appointment.');
    }
  };

  const handleToggleChecklist = async (apptId, itemIndex) => {
    const res = await toggleAppointmentChecklist(apptId, itemIndex);
    if (res.success) {
      loadAppointments();
    }
  };

  const handleDelete = async (apptId) => {
    if (window.confirm('Delete this appointment record?')) {
      await deleteAppointment(apptId);
      loadAppointments();
    }
  };

  return (
    <div
      className="panel"
      id="appointments"
      style={{
        padding: '1.35rem 1.45rem',
        background: 'var(--panel)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} color="var(--primary)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('appointments.title')}
            </h3>
            <span
              className="badge"
              style={{
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                border: '1px solid var(--primary-border)',
                fontSize: '0.82rem',
                fontWeight: '600',
              }}
            >
              Stage {stageRecs.stageNumber}: {translateStage(stageRecs.stageNumber) || stageRecs.displayLabel}
            </span>
          </div>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            {t('appointments.subtitle')}
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-primary"
          style={{ padding: '0.55rem 1.15rem', fontSize: '0.92rem' }}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          <span>{showForm ? t('common.cancel') : t('appointments.btn_book')}</span>
        </button>
      </div>

      {/* "Why this recommendation?" Callout */}
      <WhyRecommendationCallout stageNumber={stageRecs.stageNumber} moduleType="appointments" />

      {/* Recommended Follow-up Cadence Box */}
      <div
        style={{
          padding: '1rem 1.25rem',
          background: 'var(--bg-surface)',
          borderLeft: `4px solid ${stageRecs.badgeColor || 'var(--primary)'}`,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.65rem',
        }}
      >
        <div>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
            Recommended Clinical Review Cadence ({stageRecs.displayLabel})
          </span>
          <p style={{ fontSize: '0.96rem', color: 'var(--text-primary)', fontWeight: '600', margin: '0.25rem 0 0 0' }}>
            {stageRecs.followUpGuidance?.cadence}
          </p>
        </div>

        <span
          className="badge"
          style={{
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            fontSize: '0.82rem',
            fontWeight: '600',
          }}
        >
          Stage {stageRecs.stageNumber} Protocol
        </span>
      </div>

      {/* Add Appointment Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '1.15rem',
            background: 'var(--panel-secondary)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
          }}
        >
          <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Schedule New Clinical Follow-up
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Specialist / Doctor Name *
              </label>
              <input
                type="text"
                value={specialistName}
                onChange={(e) => setSpecialistName(e.target.value)}
                placeholder="e.g. Dr. Neurologist"
                required
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Specialty *
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              >
                <option value="Neurologist">Neurologist</option>
                <option value="Geriatrician">Geriatrician</option>
                <option value="Memory Clinic Specialist">Memory Clinic Specialist</option>
                <option value="Geriatric Psychiatrist">Geriatric Psychiatrist</option>
                <option value="Neuropsychologist">Neuropsychologist</option>
                <option value="Clinical Nutritionist">Clinical Nutritionist</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Hospital / Clinic Facility
              </label>
              <input
                type="text"
                value={facilityName}
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="e.g. NIMHANS Memory Clinic / Apollo"
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Location / City
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bangalore, Karnataka"
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Appointment Date *
              </label>
              <input
                type="date"
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Time
              </label>
              <input
                type="text"
                value={appointmentTime}
                onChange={(e) => setAppointmentTime(e.target.value)}
                placeholder="e.g. 10:30 AM"
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
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
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Reason for Visit / Primary Symptoms Observed
            </label>
            <input
              type="text"
              value={reasonForVisit}
              onChange={(e) => setReasonForVisit(e.target.value)}
              placeholder="e.g. Memory evaluation, baseline MoCA screening, review MRI classification"
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
              }}
            />
          </div>

          {/* Questions to Discuss with Physician */}
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '0.35rem' }}>
              Key Questions to Discuss with Specialist ({questions.length})
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.45rem' }}>
              {questions.map((q, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.35rem 0.6rem', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)', fontSize: '0.76rem' }}>
                  <span>{q}</span>
                  <button type="button" onClick={() => handleRemoveQuestion(idx)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                value={customQuestion}
                onChange={(e) => setCustomQuestion(e.target.value)}
                placeholder="Add your own question..."
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
              <button type="button" onClick={handleAddQuestion} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.76rem' }}>
                Add Question
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.4rem' }}>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.78rem' }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" style={{ padding: '0.4rem 0.95rem', fontSize: '0.78rem' }}>
              Save Appointment & Checklist
            </button>
          </div>
        </form>
      )}

      {/* Upcoming Appointments List */}
      {appointments.length === 0 ? (
        <div
          style={{
            padding: '2.5rem 1.5rem',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.96rem',
            background: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border-medium)',
            lineHeight: 1.55,
          }}
        >
          No upcoming appointments scheduled. Click "Schedule Appointment" to record consultation dates and prepare clinic checklists.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {appointments.map((appt) => {
            const dateStr = appt.appointmentDate ? new Date(appt.appointmentDate).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '';

            return (
              <div
                key={appt._id}
                style={{
                  background: 'var(--panel-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem 1.15rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Stethoscope size={16} color="var(--primary)" />
                      <h4 style={{ fontSize: '0.96rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                        {appt.specialistName}
                      </h4>
                      <span className="badge-cyan" style={{ fontSize: '0.65rem' }}>
                        {appt.specialty}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      {appt.facilityName} {appt.location ? `• ${appt.location}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--secondary)', fontSize: '0.76rem', fontFamily: 'var(--font-mono)' }}>
                      <Calendar size={13} />
                      <span>{dateStr} at {appt.appointmentTime}</span>
                    </div>

                    <button
                      onClick={() => handleDelete(appt._id)}
                      className="btn-secondary"
                      style={{ padding: '0.2rem 0.45rem', color: 'var(--danger)', fontSize: '0.7rem' }}
                      title="Delete appointment"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {appt.reasonForVisit && (
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    <strong>Visit Purpose:</strong> {appt.reasonForVisit}
                  </div>
                )}

                {/* Preparation Checklist */}
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Appointment Preparation Checklist:
                  </span>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '0.4rem',
                      marginTop: '0.35rem',
                    }}
                  >
                    {(appt.prepChecklist || []).map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleToggleChecklist(appt._id, idx)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          padding: '0.45rem 0.65rem',
                          background: item.completed ? 'var(--stage-1-bg)' : 'var(--bg-surface-subtle)',
                          border: item.completed ? '1px solid var(--stage-1-border)' : '1px solid var(--border)',
                          borderRadius: 'var(--radius-xs)',
                          cursor: 'pointer',
                          fontSize: '0.86rem',
                          color: item.completed ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: item.completed ? 'line-through' : 'none',
                        }}
                      >
                        {item.completed ? (
                          <CheckSquare size={14} color="var(--success)" style={{ flexShrink: 0 }} />
                        ) : (
                          <Square size={14} color="#64748b" style={{ flexShrink: 0 }} />
                        )}
                        <span>{item.item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Questions for Doctor */}
                {appt.questionsToDiscuss && appt.questionsToDiscuss.length > 0 && (
                  <div style={{ background: 'var(--bg-surface)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem', fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '600' }}>
                      <HelpCircle size={12} />
                      <span>Questions Prepared for Doctor:</span>
                    </div>
                    <ul style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: '1.2rem', lineHeight: '1.45' }}>
                      {appt.questionsToDiscuss.map((q, idx) => (
                        <li key={idx}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
