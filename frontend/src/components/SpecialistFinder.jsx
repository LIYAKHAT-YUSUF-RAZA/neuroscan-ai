import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Building2,
  ExternalLink,
  Phone,
  Search,
  Sliders,
  Sparkles,
  Info,
  Stethoscope,
  ChevronRight,
} from 'lucide-react';
import {
  INDIAN_CITIES,
  MEDICAL_SPECIALTIES,
  VERIFIED_SPECIALIST_CENTERS,
} from '../data/specialistDirectory';
import { getStageRecommendations } from '../data/stageRecommendations';
import WhyRecommendationCallout from './WhyRecommendationCallout';
import { useLanguage } from '../context/LanguageContext';

export default function SpecialistFinder({
  prediction,
  preferences,
  onOpenPreferences,
}) {
  const { t, translateStage } = useLanguage();
  const [selectedCity, setSelectedCity] = useState(
    preferences?.city || 'All Cities'
  );
  const [selectedSpecialty, setSelectedSpecialty] = useState('All Specialties');
  const [searchQuery, setSearchQuery] = useState('');

  // Extract stage-specific guidance
  const stageNumber = prediction?.stageNumber || 1;
  const stageRecs = getStageRecommendations(stageNumber);
  const specGuidance = stageRecs.specialistGuidance || {
    consultationTiming: 'Maintain regular wellness and cognitive baseline checks with your family physician.',
    recommendedSpecialties: ['Neurologist', 'Geriatrician'],
  };

  // Filter centers dynamically based on city, specialty, and text query
  const filteredCenters = useMemo(() => {
    return VERIFIED_SPECIALIST_CENTERS.filter((center) => {
      if (selectedCity && selectedCity !== 'All Cities' && center.city !== selectedCity) {
        return false;
      }
      if (
        selectedSpecialty &&
        selectedSpecialty !== 'All Specialties' &&
        !center.specialties.includes(selectedSpecialty)
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = center.institutionName.toLowerCase().includes(q);
        const matchesDept = center.department.toLowerCase().includes(q);
        const matchesCity = center.city.toLowerCase().includes(q);
        const matchesAddr = center.address.toLowerCase().includes(q);
        if (!matchesName && !matchesDept && !matchesCity && !matchesAddr) {
          return false;
        }
      }
      return true;
    });
  }, [selectedCity, selectedSpecialty, searchQuery]);

  return (
    <div
      className="panel"
      id="specialists"
      style={{
        padding: '1.5rem',
        backgroundColor: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* Header */}
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
              <Stethoscope size={18} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Specialist & Memory Clinic Directory
            </h2>
          </div>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Verified public healthcare institutions and established tertiary neurology departments across Indian cities.
          </p>
        </div>

        {onOpenPreferences && (
          <button
            type="button"
            onClick={onOpenPreferences}
            className="btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', gap: '0.4rem' }}
          >
            <Sliders size={15} style={{ color: 'var(--primary)' }} />
            <span>Change City / Filters</span>
          </button>
        )}
      </div>

      {/* "Why this recommendation?" Callout */}
      <WhyRecommendationCallout stageNumber={stageRecs.stageNumber} moduleType="specialists" />

      {/* Stage Consultation Timing Box */}
      <div
        style={{
          padding: '1.15rem 1.25rem',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderLeft: `4px solid ${stageRecs.badgeColor || 'var(--primary)'}`,
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={16} style={{ color: 'var(--primary)' }} />
          <strong style={{ fontSize: '0.96rem', color: 'var(--text-primary)' }}>
            Recommended Evaluation Focus for Stage {stageRecs.stageNumber} ({translateStage(stageRecs.stageNumber) || stageRecs.displayLabel})
          </strong>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
          {specGuidance.consultationTiming}
        </p>

        {/* Recommended Specialties Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>Prioritized Specialties:</span>
          {specGuidance.recommendedSpecialties.map((spec, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                const match = MEDICAL_SPECIALTIES.find((s) => spec.toLowerCase().includes(s.toLowerCase()));
                if (match) setSelectedSpecialty(match);
              }}
              className="badge"
              style={{
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                border: '1px solid var(--primary-border)',
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: '0.2rem 0.55rem',
              }}
              title="Click to filter by this specialty"
            >
              ★ {spec}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          padding: '1.15rem',
          backgroundColor: 'var(--bg-surface-subtle)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
        }}
      >
        {/* City Filter */}
        <div>
          <label htmlFor="specialist-city-select" style={{ display: 'block', fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            City / Region
          </label>
          <select
            id="specialist-city-select"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
          >
            {INDIAN_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Specialty Filter */}
        <div>
          <label htmlFor="specialist-area-select" style={{ display: 'block', fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            Specialty Area
          </label>
          <select
            id="specialist-area-select"
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
          >
            {MEDICAL_SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Keyword Search */}
        <div>
          <label htmlFor="specialist-search-input" style={{ display: 'block', fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            Search Center or Hospital
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              id="specialist-search-input"
              type="text"
              placeholder="e.g. NIMHANS, AIIMS, Apollo, Fortis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem 0.55rem 2.25rem',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
          </div>
        </div>
      </div>

      {/* Results Count & Zero-Fabrication Disclaimer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          Showing <strong>{filteredCenters.length}</strong> verified healthcare center(s)
        </span>
        <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
          ✓ Verified public institutions & established hospital departments • Zero fabricated ratings
        </span>
      </div>

      {/* Centers Grid or Empty State */}
      {filteredCenters.length === 0 ? (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border)',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <Building2 size={36} style={{ color: 'var(--text-muted)' }} />
          <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: '600' }}>
            No verified centers found matching &quot;{searchQuery || selectedCity}&quot;.
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '480px', lineHeight: '1.5' }}>
            NeuroScan AI only lists verified tertiary memory clinics and established hospital departments. Please clear your search or select a neighboring metropolitan center.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCity('All Cities');
              setSelectedSpecialty('All Specialties');
              setSearchQuery('');
            }}
            className="btn-secondary"
            style={{ marginTop: '0.5rem', padding: '0.45rem 0.85rem', fontSize: '0.88rem' }}
          >
            Reset Filters & View All Centers
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {filteredCenters.map((center) => (
            <div
              key={center.id}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
                boxShadow: 'var(--shadow-xs)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                      {center.institutionName}
                    </h3>
                    <p style={{ fontSize: '0.88rem', color: 'var(--primary)', fontWeight: '600', margin: '0.2rem 0 0 0' }}>
                      {center.department}
                    </p>
                  </div>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: 'var(--stage-1-bg)',
                      color: 'var(--stage-1)',
                      border: '1px solid var(--stage-1-border)',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      flexShrink: 0,
                    }}
                  >
                    Verified
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem', marginTop: '0.65rem', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                  <MapPin size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--text-muted)' }} />
                  <span>{center.address}</span>
                </div>

                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.65rem 0 0 0', lineHeight: '1.45' }}>
                  {center.notes}
                </p>

                {/* Specialties tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.75rem' }}>
                  {center.specialties.map((s, idx) => {
                    const isStageRec = specGuidance.recommendedSpecialties.some((rec) =>
                      rec.toLowerCase().includes(s.toLowerCase())
                    );
                    return (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 'var(--radius-xs)',
                          backgroundColor: isStageRec ? 'var(--primary-light)' : 'var(--bg-surface-subtle)',
                          border: isStageRec ? '1px solid var(--primary-border)' : '1px solid var(--border)',
                          color: isStageRec ? 'var(--primary)' : 'var(--text-secondary)',
                          fontWeight: isStageRec ? '600' : '500',
                        }}
                      >
                        {s}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Contact & Links */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <a
                  href={`tel:${center.contactPhone}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.86rem',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    fontWeight: '500',
                  }}
                >
                  <Phone size={14} style={{ color: 'var(--primary)' }} />
                  <span>{center.contactPhone}</span>
                </a>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {center.appointmentPortal && (
                    <a
                      href={center.appointmentPortal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', gap: '0.3rem' }}
                    >
                      <span>OPD Booking</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                  {center.website && (
                    <a
                      href={center.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary"
                      style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', gap: '0.3rem' }}
                    >
                      <span>Website</span>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
