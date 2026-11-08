import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  GitCompare,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Layers,
  ShieldAlert,
  Info,
  Clock,
  FileImage,
  RefreshCw,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { getLongitudinalHistory, compareEvaluations } from '../services/api';
import AuthenticatedMriImage from './AuthenticatedMriImage';
import { getStageInfo } from '../data/educationalContent';
import { useLanguage } from '../context/LanguageContext';

const CANONICAL_CLASSES = [
  { id: 'NonDemented', label: 'Healthy / No Dementia' },
  { id: 'VeryMildDemented', label: 'Early Stage' },
  { id: 'MildDemented', label: 'Moderate Stage' },
  { id: 'ModerateDemented', label: 'Critical Stage' },
];

export default function LongitudinalComparisonView({
  patientId,
  userRole,
  initialEvalAId = null,
  initialEvalBId = null,
  onNavigateBack,
}) {
  const { t, formatDate, translateClass } = useLanguage();
  const [evaluations, setEvaluations] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedAId, setSelectedAId] = useState(initialEvalAId);
  const [selectedBId, setSelectedBId] = useState(initialEvalBId);
  const [comparisonData, setComparisonData] = useState(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);
  const [error, setError] = useState(null);

  // Load patient's longitudinal evaluations
  useEffect(() => {
    if (!patientId) return;
    // Reset selections and comparison data when patientId changes to guarantee zero state leakage across patients
    setSelectedAId(initialEvalAId);
    setSelectedBId(initialEvalBId);
    setComparisonData(null);
    loadLongitudinalData();
  }, [patientId, userRole]);

  const loadLongitudinalData = async () => {
    setIsLoadingHistory(true);
    setError(null);
    try {
      const res = await getLongitudinalHistory(patientId, userRole);
      if (res.success) {
        const evals = res.evaluations || [];
        setEvaluations(evals);

        // Pre-select baseline (oldest) and follow-up (most recent) if available and none selected yet
        if (evals.length >= 2) {
          // evals is chronological ascending (index 0 is baseline/earliest, last index is latest follow-up)
          if (!selectedAId) setSelectedAId(evals[0]._id || evals[0].id); // Baseline (earliest)
          if (!selectedBId) setSelectedBId(evals[evals.length - 1]._id || evals[evals.length - 1].id); // Follow-up (most recent)
        } else if (evals.length === 1) {
          if (!selectedAId) setSelectedAId(evals[0]._id || evals[0].id);
        }
      } else {
        setError(res.error || 'Failed to load longitudinal records.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred loading longitudinal data.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Run side-by-side comparison when both selections are active
  useEffect(() => {
    if (selectedAId && selectedBId && selectedAId !== selectedBId) {
      runComparison(selectedAId, selectedBId);
    } else {
      setComparisonData(null);
    }
  }, [selectedAId, selectedBId]);

  const runComparison = async (idA, idB) => {
    setIsLoadingComparison(true);
    setError(null);
    try {
      const res = await compareEvaluations(idA, idB, patientId, userRole);
      if (res.success && res.comparison) {
        setComparisonData(res.comparison);
      } else {
        setError(res.error || 'Failed to generate comparison analysis.');
      }
    } catch (err) {
      setError(err.message || 'Error comparing evaluations.');
    } finally {
      setIsLoadingComparison(false);
    }
  };

  const evalA = evaluations.find((e) => (e._id || e.id) === selectedAId);
  const evalB = evaluations.find((e) => (e._id || e.id) === selectedBId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Header with Mandatory Scientific Notice */}
      <div
        className="panel"
        style={{
          padding: '1.5rem 1.75rem',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: 'var(--radius)',
                  backgroundColor: 'var(--primary-light)',
                  border: '1px solid var(--primary-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)',
                }}
              >
                <GitCompare size={20} aria-hidden="true" />
              </div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                {t('modals.comparison_title')}
              </h1>
            </div>
            <p style={{ fontSize: '0.94rem', color: 'var(--text-secondary)', margin: '0.35rem 0 0 0' }}>
              {t('prediction.progression.title')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button
              type="button"
              onClick={loadLongitudinalData}
              disabled={isLoadingHistory}
              className="btn-secondary"
              style={{ fontSize: '0.88rem' }}
              aria-label="Refresh comparison records"
            >
              <RefreshCw size={15} className={isLoadingHistory ? 'animate-spin' : ''} />
              <span>{t('history.sync')}</span>
            </button>
            {onNavigateBack && (
              <button
                type="button"
                onClick={onNavigateBack}
                className="btn-secondary"
                style={{ fontSize: '0.88rem' }}
              >
                {t('common.back')}
              </button>
            )}
          </div>
        </div>

        {/* MANDATORY SCIENTIFIC NOTICE */}
        <div
          role="note"
          aria-label="Scientific Non-Progression Notice"
          style={{
            padding: '0.85rem 1.15rem',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderLeft: '4px solid var(--primary)',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
          }}
        >
          <Info size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <div>
            <strong>Scientific Notice: </strong>
            These comparisons show differences in research model outputs and are not clinically validated measurements of disease progression. Clinical diagnosis requires certified neuroimaging interpretation and physician consultation.
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '0.85rem 1.15rem',
            backgroundColor: 'var(--stage-4-bg)',
            border: '1px solid var(--stage-4-border)',
            borderRadius: 'var(--radius)',
            color: 'var(--stage-4)',
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Evaluation Selectors */}
      <div
        className="panel"
        style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: 'var(--bg-surface)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          alignItems: 'center',
        }}
      >
        {/* Baseline / Evaluation A */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <label htmlFor="eval-a-select" style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Evaluation A (Baseline / Prior Scan)
          </label>
          <select
            id="eval-a-select"
            value={selectedAId || ''}
            onChange={(e) => setSelectedAId(e.target.value)}
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-surface-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.92rem',
              fontWeight: '500',
            }}
          >
            <option value="">Select prior evaluation...</option>
            {evaluations.map((ev) => (
              <option key={ev._id || ev.id} value={ev._id || ev.id}>
                {formatDate(ev.scanDate || ev.createdAt)} — {ev.originalFilename || 'Scan'} ({ev.displayLabel || ev.predictedClass})
              </option>
            ))}
          </select>
        </div>

        {/* Follow-up / Evaluation B */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          <label htmlFor="eval-b-select" style={{ fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            Evaluation B (Follow-up / Subsequent Scan)
          </label>
          <select
            id="eval-b-select"
            value={selectedBId || ''}
            onChange={(e) => setSelectedBId(e.target.value)}
            style={{
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-surface-subtle)',
              color: 'var(--text-primary)',
              fontSize: '0.92rem',
              fontWeight: '500',
            }}
          >
            <option value="">Select follow-up evaluation...</option>
            {evaluations.map((ev) => (
              <option key={ev._id || ev.id} value={ev._id || ev.id}>
                {formatDate(ev.scanDate || ev.createdAt)} — {ev.originalFilename || 'Scan'} ({ev.displayLabel || ev.predictedClass})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Empty or Incomplete State */}
      {(!evalA || !evalB || selectedAId === selectedBId) ? (
        <div
          className="panel"
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-secondary)',
          }}
        >
          <GitCompare size={42} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            {evaluations.length < 2
              ? 'At least two MRI evaluations are required for comparison'
              : selectedAId === selectedBId && selectedAId
              ? 'Please choose two different evaluations to compare'
              : 'Choose Evaluation A and Evaluation B above to view comparison'}
          </h3>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto' }}>
            {evaluations.length < 2
              ? 'Upload a follow-up scan or reanalyse a previous scan to establish a longitudinal history series.'
              : 'The side-by-side view displays scan images, classified categories, probability shifts, uncertainty, and attention maps.'}
          </p>
        </div>
      ) : (
        /* 4. Side-by-Side Comparison Workspace */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Side-by-Side Cards (stacked on mobile via responsive grid) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Card A (Baseline) */}
            <div
              className="panel"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: '700' }}>
                    Evaluation A
                  </span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0.15rem 0 0 0' }}>
                    {evalA.originalFilename}
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {evalA.evaluationType === 'follow_up' ? 'Follow-up' : evalA.evaluationType === 'reanalysis' ? 'Reanalysis' : 'Original Scan'}
                </span>
              </div>

              {/* Scan Image */}
              <AuthenticatedMriImage
                scanId={evalA.scanId}
                patientId={patientId}
                userRole={userRole}
                alt={`MRI scan for Evaluation A (${evalA.originalFilename || 'Scan'})`}
                evalLabel="Evaluation A"
              />

              {/* Stage Badge & Date */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Scan Date</div>
                  <strong style={{ fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                    {formatDate(evalA.scanDate || evalA.createdAt)}
                  </strong>
                </div>

                <span
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: getStageInfo(evalA.predictedClass).bg,
                    color: getStageInfo(evalA.predictedClass).color,
                    border: `1px solid ${getStageInfo(evalA.predictedClass).border}`,
                    fontWeight: '700',
                    fontSize: '0.85rem',
                  }}
                >
                  Stage {evalA.stageNumber || getStageInfo(evalA.predictedClass).stageNumber}: {evalA.displayLabel || getStageInfo(evalA.predictedClass).displayLabel}
                </span>
              </div>

              {/* Confidence & Uncertainty */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.88rem' }}>
                <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block' }}>Confidence</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {(evalA.confidence ? evalA.confidence * 100 : evalA.probabilities?.[evalA.predictedClass] ? evalA.probabilities[evalA.predictedClass] * 100 : 95).toFixed(1)}%
                  </strong>
                </div>
                <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block' }}>Uncertainty Status</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {evalA.uncertainty?.status || 'Normal'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card B (Follow-up) */}
            <div
              className="panel"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: '700' }}>
                    Evaluation B
                  </span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0.15rem 0 0 0' }}>
                    {evalB.originalFilename}
                  </h3>
                </div>
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: '600',
                    padding: '0.2rem 0.6rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {evalB.evaluationType === 'follow_up' ? 'Follow-up' : evalB.evaluationType === 'reanalysis' ? 'Reanalysis' : 'Original Scan'}
                </span>
              </div>

              {/* Scan Image */}
              <AuthenticatedMriImage
                scanId={evalB.scanId}
                patientId={patientId}
                userRole={userRole}
                alt={`MRI scan for Evaluation B (${evalB.originalFilename || 'Scan'})`}
                evalLabel="Evaluation B"
              />

              {/* Stage Badge & Date */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Scan Date</div>
                  <strong style={{ fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                    {formatDate(evalB.scanDate || evalB.createdAt)}
                  </strong>
                </div>

                <span
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-xs)',
                    backgroundColor: getStageInfo(evalB.predictedClass).bg,
                    color: getStageInfo(evalB.predictedClass).color,
                    border: `1px solid ${getStageInfo(evalB.predictedClass).border}`,
                    fontWeight: '700',
                    fontSize: '0.85rem',
                  }}
                >
                  Stage {evalB.stageNumber || getStageInfo(evalB.predictedClass).stageNumber}: {evalB.displayLabel || getStageInfo(evalB.predictedClass).displayLabel}
                </span>
              </div>

              {/* Confidence & Uncertainty */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.88rem' }}>
                <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block' }}>Confidence</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {(evalB.confidence ? evalB.confidence * 100 : evalB.probabilities?.[evalB.predictedClass] ? evalB.probabilities[evalB.predictedClass] * 100 : 95).toFixed(1)}%
                  </strong>
                </div>
                <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block' }}>Uncertainty Status</span>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>
                    {evalB.uncertainty?.status || 'Normal'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Probability Delta Analysis Table */}
          <div
            className="panel"
            style={{
              padding: '1.5rem',
              backgroundColor: 'var(--bg-surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Category Probability Comparison & Delta
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                Comparison of model class likelihood distribution from Evaluation A to Evaluation B.
              </p>
            </div>

            <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Dementia Category</th>
                    <th>Evaluation A</th>
                    <th>Evaluation B</th>
                    <th style={{ textAlign: 'right' }}>Model Output Delta (B − A)</th>
                  </tr>
                </thead>
                <tbody>
                  {CANONICAL_CLASSES.map((cls) => {
                    const probA = evalA.probabilities?.[cls.id] != null ? evalA.probabilities[cls.id] : 0;
                    const probB = evalB.probabilities?.[cls.id] != null ? evalB.probabilities[cls.id] : 0;
                    const delta = (probB - probA) * 100;

                    return (
                      <tr key={cls.id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <strong style={{ color: 'var(--text-primary)', fontSize: '0.92rem' }}>{cls.label}</strong>
                            <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cls.id}</code>
                          </div>
                        </td>
                        <td style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                          {(probA * 100).toFixed(1)}%
                        </td>
                        <td style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                          {(probB * 100).toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              fontWeight: '700',
                              fontSize: '0.92rem',
                              color:
                                Math.abs(delta) < 0.1
                                  ? 'var(--text-secondary)'
                                  : delta > 0
                                  ? 'var(--primary)'
                                  : 'var(--text-secondary)',
                            }}
                          >
                            {Math.abs(delta) < 0.1 ? (
                              <>
                                <Minus size={14} />
                                <span>0.0%</span>
                              </>
                            ) : delta > 0 ? (
                              <>
                                <TrendingUp size={14} />
                                <span>+{delta.toFixed(1)}%</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown size={14} />
                                <span>{delta.toFixed(1)}%</span>
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Side-by-Side Visual Maps (Grad-CAM & Integrated Gradients) */}
          {(evalA.heatmaps || evalB.heatmaps) && (
            <div
              className="panel"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
              }}
            >
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={20} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    Attention Map Comparison
                  </h3>
                </div>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                  Side-by-side visual explanation attribution maps comparing anatomical focus areas.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '1.5rem',
                }}
              >
                {/* Grad-CAM A */}
                <div style={{ textAlign: 'center', backgroundColor: '#0F172A', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ color: '#E2E8F0', fontSize: '0.88rem', fontWeight: '600', display: 'block', marginBottom: '0.65rem' }}>
                    Evaluation A — Brain Attention Map
                  </span>
                  {evalA.heatmaps?.gradcam ? (
                    <img
                      src={evalA.heatmaps.gradcam}
                      alt="Grad-CAM Evaluation A"
                      style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                      No Grad-CAM available
                    </div>
                  )}
                </div>

                {/* Grad-CAM B */}
                <div style={{ textAlign: 'center', backgroundColor: '#0F172A', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <span style={{ color: '#E2E8F0', fontSize: '0.88rem', fontWeight: '600', display: 'block', marginBottom: '0.65rem' }}>
                    Evaluation B — Brain Attention Map
                  </span>
                  {evalB.heatmaps?.gradcam ? (
                    <img
                      src={evalB.heatmaps.gradcam}
                      alt="Grad-CAM Evaluation B"
                      style={{ maxHeight: '200px', maxWidth: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                      No Grad-CAM available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
