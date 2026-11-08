import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Sliders, Check, AlertCircle, Utensils, Activity, MapPin, HeartHandshake, Shield } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const COMMON_CITIES = [
  'Bangalore',
  'Delhi-NCR',
  'Mumbai',
  'Chennai',
  'Hyderabad',
  'Kolkata',
  'Pune',
];

const COMMON_ALLERGIES = [
  'Nuts',
  'Dairy',
  'Gluten',
  'Seafood',
  'Soy',
  'Eggs',
];

export default function PatientPreferencesModal({
  isOpen,
  onClose,
  preferences,
  onSavePreferences,
}) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  const [dietType, setDietType] = useState(preferences?.dietType || 'All');
  const [includeEggs, setIncludeEggs] = useState(Boolean(preferences?.includeEggs));
  const [allergies, setAllergies] = useState(preferences?.allergies || []);
  const [customAllergy, setCustomAllergy] = useState('');
  const [mobility, setMobility] = useState(preferences?.mobility || 'Fully Mobile');
  const [preferredActivityTime, setPreferredActivityTime] = useState(
    preferences?.preferredActivityTime || 'Morning'
  );
  const [caregiverInvolvement, setCaregiverInvolvement] = useState(
    preferences?.caregiverInvolvement || 'Independent / Self-Care'
  );
  const [city, setCity] = useState(preferences?.city || 'Bangalore');
  const [isCustomCity, setIsCustomCity] = useState(
    !COMMON_CITIES.includes(preferences?.city || 'Bangalore')
  );

  const toggleAllergy = (allergy) => {
    if (allergies.includes(allergy)) {
      setAllergies(allergies.filter((a) => a !== allergy));
    } else {
      setAllergies([...allergies, allergy]);
    }
  };

  const handleAddCustomAllergy = () => {
    const trimmed = customAllergy.trim();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies([...allergies, trimmed]);
      setCustomAllergy('');
    }
  };

  const handleSave = () => {
    onSavePreferences({
      dietType,
      includeEggs: dietType === 'Vegetarian' ? includeEggs : false,
      allergies,
      mobility,
      preferredActivityTime,
      caregiverInvolvement,
      city: city.trim() || 'Bangalore',
    });
    onClose();
  };

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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
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
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-medium)',
          padding: '1.45rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.15rem',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={18} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {t('modals.preferences_title')}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.15rem 0 0 0' }}>
                Tailor nutrition, routine activities, and specialist discovery to your individual needs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.3rem',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Clinical notice */}
        <div
          style={{
            padding: '0.65rem 0.85rem',
            background: 'var(--panel-secondary)',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.72rem',
            color: 'var(--text-secondary)',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.45rem',
            border: '1px solid var(--border)',
          }}
        >
          <Shield size={14} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>
            Only preferences entered by you or your caregiver are applied. The AI model never infers medical conditions or dietary restrictions from your MRI scan.
          </span>
        </div>

        {/* 1. Dietary Pattern */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Utensils size={14} color="var(--primary)" />
            <span>Dietary Pattern</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
            {['All', 'Vegetarian', 'Non-Vegetarian', 'Vegan'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDietType(type)}
                className={`btn-secondary ${dietType === type ? 'active' : ''}`}
                style={{
                  padding: '0.5rem 0.35rem',
                  fontSize: '0.76rem',
                  justifyContent: 'center',
                  background: dietType === type ? 'var(--primary-light)' : 'var(--bg-surface)',
                  border: dietType === type ? '1.5px solid var(--primary-border)' : '1px solid var(--border)',
                  color: dietType === type ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: dietType === type ? '700' : '500',
                }}
              >
                {type}
              </button>
            ))}
          </div>
          {dietType === 'Vegetarian' && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.76rem',
                color: 'var(--text-secondary)',
                marginTop: '0.2rem',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={includeEggs}
                onChange={(e) => setIncludeEggs(e.target.checked)}
              />
              <span>Include eggs in vegetarian diet (Eggetarian)</span>
            </label>
          )}
        </div>

        {/* 2. Food Allergies & Intolerances */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Food Allergies & Exclusions
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {COMMON_ALLERGIES.map((allergy) => {
              const selected = allergies.includes(allergy);
              return (
                <button
                  key={allergy}
                  type="button"
                  onClick={() => toggleAllergy(allergy)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.74rem',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    background: selected ? 'var(--stage-4-bg)' : 'var(--bg-surface)',
                    border: selected ? '1px solid var(--stage-4-border)' : '1px solid var(--border)',
                    color: selected ? 'var(--stage-4)' : 'var(--text-secondary)',
                    fontWeight: selected ? '600' : '400',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 150ms ease-out',
                  }}
                >
                  {selected && <Check size={12} />}
                  <span>{allergy}</span>
                </button>
              );
            })}
          </div>

          {/* Custom allergy input */}
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
            <input
              type="text"
              placeholder="Add other allergen (e.g. Sesame)..."
              value={customAllergy}
              onChange={(e) => setCustomAllergy(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomAllergy();
                }
              }}
              style={{
                flex: 1,
                minHeight: '38px',
                padding: '0.4rem 0.65rem',
                fontSize: '0.78rem',
              }}
            />
            <button
              type="button"
              onClick={handleAddCustomAllergy}
              className="btn-secondary"
              style={{ minHeight: '38px', padding: '0.4rem 0.85rem', fontSize: '0.78rem' }}
            >
              Add
            </button>
          </div>
        </div>

        {/* 3. Physical Mobility Level */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Activity size={14} color="var(--primary)" />
            <span>Mobility & Physical Activity Level</span>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
            {[
              { id: 'Fully Mobile', label: 'Fully Mobile' },
              { id: 'Assisted', label: 'Assisted (Cane/Walker)' },
              { id: 'Limited Mobility', label: 'Limited / Seated' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMobility(m.id)}
                className={`btn-secondary ${mobility === m.id ? 'active' : ''}`}
                style={{
                  padding: '0.5rem 0.35rem',
                  fontSize: '0.74rem',
                  justifyContent: 'center',
                  background: mobility === m.id ? 'var(--primary-light)' : 'var(--bg-surface)',
                  border: mobility === m.id ? '1.5px solid var(--primary-border)' : '1px solid var(--border)',
                  color: mobility === m.id ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: mobility === m.id ? '700' : '500',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Preferred Activity Time & Caregiver Involvement */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Preferred Activity Time
            </label>
            <select
              value={preferredActivityTime}
              onChange={(e) => setPreferredActivityTime(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.6rem',
                fontSize: '0.76rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="Morning">Morning</option>
              <option value="Afternoon">Afternoon</option>
              <option value="Evening">Evening</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Caregiver Involvement
            </label>
            <select
              value={caregiverInvolvement}
              onChange={(e) => setCaregiverInvolvement(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.6rem',
                fontSize: '0.76rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="Independent / Self-Care">Independent / Self-Care</option>
              <option value="Family Caregiver Assisted">Family Caregiver Assisted</option>
              <option value="Full-Time Caregiver">Full-Time Caregiver</option>
            </select>
          </div>
        </div>

        {/* 5. City for Specialist Discovery (Supports Preset or Custom Indian City) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <label style={{ fontSize: '0.76rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <MapPin size={13} color="var(--primary)" />
            <span>City for Specialist Discovery</span>
          </label>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={isCustomCity ? 'Custom' : city}
              onChange={(e) => {
                if (e.target.value === 'Custom') {
                  setIsCustomCity(true);
                  setCity('');
                } else {
                  setIsCustomCity(false);
                  setCity(e.target.value);
                }
              }}
              style={{
                flex: isCustomCity ? '0 0 140px' : '1',
                padding: '0.45rem 0.6rem',
                fontSize: '0.76rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
              }}
            >
              {COMMON_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Custom">Other Indian City...</option>
            </select>

            {isCustomCity && (
              <input
                type="text"
                placeholder="Type your city (e.g. Ahmedabad, Kochi, Jaipur)..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.6rem',
                  fontSize: '0.76rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--primary)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-primary)',
                }}
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.78rem' }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.88rem' }}
          >
            {t('common.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
