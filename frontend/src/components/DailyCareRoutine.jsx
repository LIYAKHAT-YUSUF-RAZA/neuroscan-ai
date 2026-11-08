import React, { useState } from 'react';
import {
  CalendarCheck,
  Sun,
  Coffee,
  Moon,
  Brain,
  Shield,
  HeartHandshake,
  CheckCircle2,
  Circle,
  Sparkles,
  Sliders,
  Activity,
  AlertCircle,
} from 'lucide-react';
import WhyRecommendationCallout from './WhyRecommendationCallout';
import {
  getStageRecommendations,
  filterRoutineByPreferences,
} from '../data/stageRecommendations';
import { useLanguage } from '../context/LanguageContext';

export default function DailyCareRoutine({
  prediction,
  preferences,
  onOpenPreferences,
}) {
  const { t, translateStage } = useLanguage();
  const [completedTaskIds, setCompletedTaskIds] = useState(new Set());
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule', 'cognitive', 'safety'

  const stageNumber = prediction?.stageNumber || 1;
  const stageRecs = getStageRecommendations(stageNumber);
  const routine = filterRoutineByPreferences(stageRecs.dailyRoutine, preferences);

  const toggleTask = (taskId) => {
    const next = new Set(completedTaskIds);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    setCompletedTaskIds(next);
  };

  const allTasks = routine.schedule.flatMap((phase) => phase.tasks);
  const totalTasks = allTasks.length;
  const completedCount = completedTaskIds.size;
  const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return (
    <div
      className="panel"
      id="daily-care-routine"
      style={{
        padding: '1.5rem',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
              }}
            >
              <CalendarCheck size={18} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('wellness.daily_routine_title')}
            </h2>
            <span
              className="badge"
              style={{
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                border: '1px solid var(--primary-border)',
                fontSize: '0.8rem',
                fontWeight: '600',
              }}
            >
              Stage {stageRecs.stageNumber}: {translateStage(stageRecs.stageNumber) || stageRecs.displayLabel}
            </span>
          </div>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            {t('wellness.daily_routine_subtitle')}
          </p>
        </div>

        {/* View Switcher & Preference Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {onOpenPreferences && (
            <button
              type="button"
              onClick={onOpenPreferences}
              className="btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', gap: '0.4rem' }}
            >
              <Sliders size={15} style={{ color: 'var(--primary)' }} />
              <span>{t('wellness.routine_btn_prefs')}</span>
            </button>
          )}

          <div
            style={{
              display: 'flex',
              gap: '0.25rem',
              backgroundColor: 'var(--bg-surface-subtle)',
              padding: '0.25rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'schedule' ? '700' : '500',
                borderRadius: 'var(--radius-xs)',
                border: activeTab === 'schedule' ? '1px solid var(--border)' : 'none',
                backgroundColor: activeTab === 'schedule' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'schedule' ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {t('wellness.routine_tab_schedule')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cognitive')}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'cognitive' ? '700' : '500',
                borderRadius: 'var(--radius-xs)',
                border: activeTab === 'cognitive' ? '1px solid var(--border)' : 'none',
                backgroundColor: activeTab === 'cognitive' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'cognitive' ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {t('wellness.routine_tab_cognitive')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('safety')}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'safety' ? '700' : '500',
                borderRadius: 'var(--radius-xs)',
                border: activeTab === 'safety' ? '1px solid var(--border)' : 'none',
                backgroundColor: activeTab === 'safety' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'safety' ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {t('wellness.routine_tab_safety')}
            </button>
          </div>
        </div>
      </div>

      {/* "Why this recommendation?" Callout */}
      <WhyRecommendationCallout stageNumber={stageRecs.stageNumber} moduleType="routine" />

      {/* Tab 1: Daily Routine Schedule Checklist */}
      {activeTab === 'schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Progress Tracker */}
          <div
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--bg-surface-subtle)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1.25rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)', display: 'block' }}>Today’s Routine Completion</span>
              <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                {completedCount} of {totalTasks} tasks completed ({progressPercent}%)
              </strong>
            </div>

            <div style={{ width: '160px', height: '10px', backgroundColor: 'var(--border)', borderRadius: '5px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  backgroundColor: 'var(--primary)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Phase Schedules */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {routine.schedule.map((phase) => {
              const icons = { Morning: Sun, Afternoon: Coffee, Evening: Moon };
              const PhaseIcon = icons[phase.phase] || Sun;

              return (
                <div
                  key={phase.phase}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: phase.isPreferredTime
                      ? '1px solid var(--primary-border)'
                      : '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    position: 'relative',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.65rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <PhaseIcon size={18} style={{ color: 'var(--primary)' }} />
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                          {phase.phase}
                        </h3>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{phase.timeRange}</span>
                      </div>
                    </div>

                    {phase.isPreferredTime && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: 'var(--primary-light)',
                          color: 'var(--primary)',
                          border: '1px solid var(--primary-border)',
                          fontSize: '0.78rem',
                          fontWeight: '600',
                        }}
                      >
                        Preferred Window
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, fontStyle: 'italic' }}>
                    {phase.title}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {phase.tasks.map((task) => {
                      const isDone = completedTaskIds.has(task.id);

                      return (
                        <div
                          key={task.id}
                          onClick={() => toggleTask(task.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.65rem',
                            padding: '0.65rem 0.75rem',
                            borderRadius: 'var(--radius-xs)',
                            backgroundColor: isDone ? 'var(--stage-1-bg)' : 'var(--bg-surface-subtle)',
                            border: isDone ? '1px solid var(--stage-1-border)' : '1px solid var(--border)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ marginTop: '2px', color: isDone ? 'var(--stage-1)' : 'var(--text-muted)' }}>
                            {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                          </div>

                          <span
                            style={{
                              fontSize: '0.88rem',
                              color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                              lineHeight: '1.45',
                              textDecoration: isDone ? 'line-through' : 'none',
                            }}
                          >
                            {task.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Cognitive Activities */}
      {activeTab === 'cognitive' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {routine.cognitiveActivities.map((act, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  {act.title}
                </h3>
                <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary-border)', fontSize: '0.78rem' }}>
                  {act.cadence}
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                {act.desc}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Safety & Fall Prevention Safeguards */}
      {activeTab === 'safety' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              padding: '0.85rem 1.15rem',
              backgroundColor: 'var(--bg-surface-subtle)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              lineHeight: '1.5',
            }}
          >
            <strong>Individualized Safety Safeguard: </strong>
            Fall prevention and daily supervision should be calibrated directly to the individual&apos;s evaluated balance, vision, and mobility. Stage 4 supportive guidance provides assistance options without mandating 24-hour confinement or surveillance for all individuals.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {routine.safety.map((item, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Shield size={16} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    {item.title}
                  </h3>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
                  {item.tip}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
