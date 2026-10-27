import React, { useState } from 'react';
import { BookOpen, Brain, Users, Clock, Sparkles, HelpCircle } from 'lucide-react';
import { EDUCATIONAL_DATA, getStageInfo } from '../data/educationalContent';

const CLASSES = ['NonDemented', 'VeryMildDemented', 'MildDemented', 'ModerateDemented'];

export default function EducationalModule({ defaultClass = 'NonDemented' }) {
  const [selectedClass, setSelectedClass] = useState(defaultClass);

  const activeData = EDUCATIONAL_DATA[selectedClass] || EDUCATIONAL_DATA.NonDemented;
  const stageInfo = getStageInfo(selectedClass);

  const domains = [
    { title: 'Memory Function', icon: Brain, text: activeData.memory },
    { title: 'Familiar People Recognition', icon: Users, text: activeData.familiarPeople },
    { title: 'Daily Living & Behaviour', icon: Clock, text: activeData.dailyBehaviour },
    { title: 'Illustrative Scenario', icon: Sparkles, text: activeData.example, isItalic: true },
  ];

  return (
    <div
      className="panel"
      style={{
        padding: '1.25rem 1.45rem',
        marginTop: '1.15rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      {/* Header: Title, Category selector tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <BookOpen size={16} color="#38bdf8" />
            <h3 style={{ fontSize: '0.98rem', fontWeight: '600', color: '#f8fafc', margin: 0 }}>
              Educational Category Reference Guide
            </h3>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0.15rem 0 0 0' }}>
            Cognitive domain profiles corresponding to the model training dataset categories.
          </p>
        </div>

        <span
          className="badge"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            color: 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.68rem',
          }}
        >
          Reference Documentation
        </span>
      </div>

      {/* Category Selection Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {CLASSES.map((cName) => {
          const item = EDUCATIONAL_DATA[cName];
          const info = getStageInfo(cName);
          const isSelected = selectedClass === cName;

          return (
            <button
              key={cName}
              onClick={() => setSelectedClass(cName)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.78rem',
                fontWeight: isSelected ? '600' : '500',
                border: isSelected ? `1px solid ${info.color}` : '1px solid var(--border-subtle)',
                background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface-muted)',
                color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: info.color,
                }}
              />
              <span>{item.categoryName}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                ({info.stageLabel})
              </span>
            </button>
          );
        })}
      </div>

      {/* Four-Column Desktop Reference Grid */}
      <div className="educational-grid">
        {domains.map((domain, idx) => {
          const IconComp = domain.icon;
          return (
            <div
              key={idx}
              style={{
                background: 'var(--bg-surface-muted)',
                padding: '0.95rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <IconComp size={14} color="#38bdf8" />
                <h4 style={{ fontSize: '0.8rem', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>
                  {domain.title}
                </h4>
              </div>
              
              <p
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.45',
                  fontStyle: domain.isItalic ? 'italic' : 'normal',
                  margin: 0,
                  flex: 1,
                }}
              >
                {domain.isItalic ? `"${domain.text}"` : domain.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Clinical Context Reminder Box */}
      <div
        style={{
          padding: '0.75rem 0.95rem',
          background: 'rgba(14, 116, 144, 0.05)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.76rem',
          color: '#cbd5e1',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.55rem',
        }}
      >
        <HelpCircle size={15} color="#38bdf8" style={{ flexShrink: 0, marginTop: '1px' }} />
        <div>
          <span style={{ fontWeight: '600', color: '#e0f2fe' }}>Clinical Context Reminder: </span>
          <span>{activeData.clinicalNotice}</span>
          <p style={{ marginTop: '0.25rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
            Descriptions are educational profiles regarding cognitive domains; they do not characterize patient-specific clinical conditions.
          </p>
        </div>
      </div>
    </div>
  );
}
