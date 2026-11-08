import React, { useState } from 'react';
import { BookOpen, Brain, Users, Clock, Sparkles } from 'lucide-react';
import { EDUCATIONAL_DATA, getStageInfo } from '../data/educationalContent';
import { useLanguage } from '../context/LanguageContext';

const CLASSES = ['NonDemented', 'VeryMildDemented', 'MildDemented', 'ModerateDemented'];

export default function EducationalModule({ defaultClass = 'NonDemented' }) {
  const { t, translateClass } = useLanguage();
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
      id="educational"
      style={{
        padding: '1.5rem',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header: Title, Category selector tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '1rem',
        }}
      >
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
              <BookOpen size={18} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Educational Category Reference Guide
            </h2>
          </div>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Cognitive domain profiles corresponding to the model training dataset categories.
          </p>
        </div>

        <span
          className="badge"
          style={{
            backgroundColor: 'var(--bg-surface-subtle)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            fontSize: '0.8rem',
            fontWeight: '600',
          }}
        >
          Research Reference
        </span>
      </div>

      {/* Category Selection Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
        {CLASSES.map((cName) => {
          const item = EDUCATIONAL_DATA[cName];
          const info = getStageInfo(cName);
          const isSelected = selectedClass === cName;

          return (
            <button
              key={cName}
              type="button"
              onClick={() => setSelectedClass(cName)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.95rem',
                borderRadius: 'var(--radius)',
                fontSize: '0.88rem',
                fontWeight: isSelected ? '700' : '500',
                border: isSelected ? `2px solid ${info.color}` : '1px solid var(--border)',
                backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-surface-subtle)',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: info.color,
                }}
              />
              <span>Stage {info.stageNumber}: {translateClass(cName)}</span>
            </button>
          );
        })}
      </div>

      {/* Category Summary Banner */}
      <div
        style={{
          padding: '1rem 1.25rem',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderLeft: `4px solid ${stageInfo.color}`,
          borderRadius: 'var(--radius)',
          fontSize: '0.92rem',
          color: 'var(--text-primary)',
          lineHeight: '1.55',
          border: '1px solid var(--border)',
        }}
      >
        <strong>Category Profile: </strong> {activeData.summary}
      </div>

      {/* Domain Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
        }}
      >
        {domains.map((dom) => {
          const Icon = dom.icon;
          return (
            <div
              key={dom.title}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon size={16} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '0.96rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  {dom.title}
                </h3>
              </div>
              <p
                style={{
                  fontSize: '0.88rem',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: '1.5',
                  fontStyle: dom.isItalic ? 'italic' : 'normal',
                }}
              >
                {dom.text}
              </p>
            </div>
          );
        })}
      </div>

      {/* Clinical Reference Footnote */}
      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
        Educational reference content describes discrete dataset labels. It does not replace individualized clinical cognitive assessment.
      </p>
    </div>
  );
}
