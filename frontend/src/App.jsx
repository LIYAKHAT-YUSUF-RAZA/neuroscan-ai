import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import PatientCareDashboard from './components/PatientCareDashboard';
import MriViewer from './components/MriViewer';
import PredictionCard from './components/PredictionCard';
import ProgressionIndicator from './components/ProgressionIndicator';
import ProbabilityChart from './components/ProbabilityChart';
import EducationalRecommendationsCard from './components/EducationalRecommendationsCard';
import HistoryPanel from './components/HistoryPanel';
import DisclaimerBanner from './components/DisclaimerBanner';
import { useLanguage } from './context/LanguageContext';

// Code-split secondary views and modals to optimize initial bundle size
const NutritionRecommendations = lazy(() => import('./components/NutritionRecommendations'));
const MedicationReminder = lazy(() => import('./components/MedicationReminder'));
const DailyCareRoutine = lazy(() => import('./components/DailyCareRoutine'));
const SpecialistFinder = lazy(() => import('./components/SpecialistFinder'));
const AppointmentManager = lazy(() => import('./components/AppointmentManager'));
const CaregiverSupport = lazy(() => import('./components/CaregiverSupport'));
const EducationalModule = lazy(() => import('./components/EducationalModule'));
const ResearchDetailsView = lazy(() => import('./components/ResearchDetailsView'));
const ExplainabilityView = lazy(() => import('./components/ExplainabilityView'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const PatientPreferencesModal = lazy(() => import('./components/PatientPreferencesModal'));
const PatientSwitchModal = lazy(() => import('./components/PatientSwitchModal'));
const EmailNotificationSettings = lazy(() => import('./components/EmailNotificationSettings'));
const LongitudinalComparisonView = lazy(() => import('./components/LongitudinalComparisonView'));
const ReanalyseModal = lazy(() => import('./components/ReanalyseModal'));
import {
  getSystemHealth,
  predictMri,
  getPredictionHistory,
  clearPredictionHistory,
  getCurrentPatient,
  seedDemoPatients,
  getStoredToken,
  setStoredToken,
  initializeSessionAuth,
  reanalyseMriScan,
  getScanImageUrl,
  fetchScanImageBlob,
} from './services/api';
import {
  AlertCircle,
  User,
  Calendar,
  FileText,
  CheckCircle,
  CheckCircle2,
  Cpu,
  Clock,
  Layers,
  ShieldCheck,
  Activity,
  ArrowRight,
  Brain,
  Sparkles,
} from 'lucide-react';

export default function App() {
  const { t, translateClass } = useLanguage();
  const [health, setHealth] = useState(null);
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isReanalyseModalOpen, setIsReanalyseModalOpen] = useState(false);
  const [comparisonEvalA, setComparisonEvalA] = useState(null);
  const [comparisonEvalB, setComparisonEvalB] = useState(null);
  const shouldReduceMotion = useReducedMotion();

  // Multi-Patient Architecture: Dynamic Active Patient State (Requirement 1 & 8)
  const [patientId, setPatientId] = useState(
    () => localStorage.getItem('neuroscan_active_patient_id') || 'demo-patient-a'
  );
  const [activePatient, setActivePatient] = useState(null);
  const [userRole, setUserRole] = useState(
    () => localStorage.getItem('neuroscan_user_role') || 'researcher'
  );
  const [isPatientSwitchOpen, setIsPatientSwitchOpen] = useState(false);

  const activePatientIdRef = useRef(patientId);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    activePatientIdRef.current = patientId;
  }, [patientId]);

  // Patient-specific preferences state
  const [patientPreferences, setPatientPreferences] = useState({
    dietType: 'All',
    includeEggs: false,
    allergies: [],
    mobility: 'Fully Mobile',
    preferredActivityTime: 'Morning',
    caregiverInvolvement: 'Independent / Self-Care',
    city: 'Bangalore',
  });

  // Load system health
  const refreshHealth = useCallback(async () => {
    setIsRefreshingHealth(true);
    try {
      const res = await getSystemHealth();
      if (res.success) {
        setHealth(res.data);
      } else {
        setHealth({ status: 'offline', gateway: 'Unreachable' });
      }
    } finally {
      setIsRefreshingHealth(false);
    }
  }, []);

  // Load prediction history from MongoDB
  const refreshHistory = useCallback(async () => {
    const currentRequestedId = patientId;
    if (!currentRequestedId) return;
    setIsRefreshingHistory(true);
    try {
      const res = await getPredictionHistory(20, currentRequestedId, userRole);
      if (currentRequestedId === activePatientIdRef.current && res.success) {
        setHistory(res.data);
        if (res.data.length > 0) {
          setPrediction((prev) => {
            if (prev && prev.patientId === currentRequestedId && prev.probabilities) {
              return prev;
            }
            const latest = res.data[0];
            return {
              _id: latest._id,
              scanId: latest.scanId,
              predictedClass: latest.predictedClass,
              stageLabel: latest.stageLabel,
              stageNumber: latest.stageNumber || 1,
              displayLabel: latest.displayLabel || latest.stageLabel,
              alertLevel: latest.alertLevel || 'info',
              probabilities: latest.probabilities || null,
              confidence: latest.confidence || (latest.probabilities ? Math.max(...Object.values(latest.probabilities)) : 0.95),
              hasHeatmaps: Boolean(latest.hasHeatmaps),
              heatmaps: latest.heatmaps || null,
              patientId: latest.patientId,
              scanDate: latest.scanDate || latest.createdAt,
              evaluationType: latest.evaluationType || 'original',
              originalFilename: latest.originalFilename,
              notes: latest.notes,
              rawLogits: latest.rawLogits || [],
            };
          });

          const latestScanId = res.data[0].scanId;
          if (latestScanId) {
            setPreviewUrl((prev) => {
              if (prev) return prev;
              fetchScanImageBlob(latestScanId, currentRequestedId, userRole)
                .then((blob) => {
                  if (activePatientIdRef.current !== currentRequestedId) return;
                  setPreviewUrl(URL.createObjectURL(blob));
                })
                .catch(() => {});
              return prev;
            });
          }
        }
      }
    } finally {
      if (currentRequestedId === activePatientIdRef.current) {
        setIsRefreshingHistory(false);
      }
    }
  }, [patientId, userRole]);

  // Load active patient profile from MongoDB
  const loadActivePatient = useCallback(async () => {
    const currentRequestedId = patientId;
    if (!currentRequestedId) return;
    try {
      const res = await getCurrentPatient(currentRequestedId, userRole);
      // Prevent race conditions: check if patientId hasn't changed while request was in-flight
      if (currentRequestedId !== activePatientIdRef.current) {
        return;
      }
      if (res.success && res.data) {
        setActivePatient(res.data);
      } else {
        setActivePatient(null);
      }
    } catch (err) {
      console.warn('[App] Error loading active patient profile:', err);
    }
  }, [patientId, userRole]);

  useEffect(() => {
    const initAppSession = async () => {
      const existingToken = getStoredToken();
      if (!existingToken) {
        // Initialize verified dev session on first application load in development
        await initializeSessionAuth({ role: userRole, patientId });
      }
      refreshHealth();
      refreshHistory();
      loadActivePatient();
    };
    initAppSession();
  }, [patientId, userRole, refreshHealth, refreshHistory, loadActivePatient]);

  // Handle switching active patient with clean React state isolation (Requirement 8)
  const handleSwitchPatient = async (newPatient) => {
    if (!newPatient || !newPatient.patientId) return;

    const newId = newPatient.patientId;

    // Abort previous in-flight requests to eliminate race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    activePatientIdRef.current = newId;

    // Reset previous patient's in-memory inference, viewer and comparison state cleanly
    setSelectedFile(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setError(null);
    setPrediction(null);
    setHistory([]);
    setComparisonEvalA(null);
    setComparisonEvalB(null);

    setPatientId(newId);
    setActivePatient(newPatient);
    localStorage.setItem('neuroscan_active_patient_id', newId);

    // If new patient object has a minted token, store it
    if (newPatient.token) {
      setStoredToken(newPatient.token, newPatient.role || userRole, newId);
    } else if (userRole === 'patient') {
      // Synchronize session token for the switched patient
      await initializeSessionAuth({ role: 'patient', patientId: newId });
    }

    // Actively query new patient's actual history from MongoDB
    try {
      const historyRes = await getPredictionHistory(20, newId, userRole, { signal: abortSignal });
      if (activePatientIdRef.current !== newId) return;

      if (historyRes.success && historyRes.data && historyRes.data.length > 0) {
        setHistory(historyRes.data);
        const latest = historyRes.data[0];
        setPrediction({
          _id: latest._id,
          scanId: latest.scanId,
          predictedClass: latest.predictedClass,
          stageLabel: latest.stageLabel,
          stageNumber: latest.stageNumber || 1,
          displayLabel: latest.displayLabel || latest.stageLabel,
          alertLevel: latest.alertLevel || 'info',
          probabilities: latest.probabilities || null,
          confidence: latest.confidence || (latest.probabilities ? Math.max(...Object.values(latest.probabilities)) : 0.95),
          hasHeatmaps: Boolean(latest.hasHeatmaps),
          heatmaps: latest.heatmaps || null,
          patientId: latest.patientId,
          scanDate: latest.scanDate || latest.createdAt,
          evaluationType: latest.evaluationType || 'original',
          originalFilename: latest.originalFilename,
          notes: latest.notes,
          rawLogits: latest.rawLogits || [],
        });

        if (latest.scanId) {
          fetchScanImageBlob(latest.scanId, newId, userRole, { signal: abortSignal })
            .then((blob) => {
              if (activePatientIdRef.current !== newId) return;
              setPreviewUrl((prev) => {
                if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                return URL.createObjectURL(blob);
              });
            })
            .catch(() => {});
        }
      } else {
        // Patient has no scans -> state remains completely clean (null prediction, empty history, null preview)
        setPrediction(null);
        setHistory([]);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[App] Error loading switched patient history:', err);
      }
    }

    try {
      const profRes = await getCurrentPatient(newId, userRole);
      if (activePatientIdRef.current === newId && profRes.success && profRes.data) {
        setActivePatient(profRes.data);
      }
    } catch (err) {
      console.warn('[App] Error loading switched patient details:', err);
    }
  };

  // Handle Predict Trigger (Reusing single pipeline with optional follow-up metadata)
  const handlePredict = async (file, options = {}) => {
    if (!file) return;
    const currentPatientId = patientId;
    setIsLoading(true);
    setError(null);

    const res = await predictMri(file, true, currentPatientId, userRole, options);
    setIsLoading(false);

    if (currentPatientId !== activePatientIdRef.current) return;

    if (res.success) {
      setPrediction(res.data);
      refreshHistory(); // Refresh persistent MongoDB history
    } else {
      setError(res.error || 'Failed to complete prediction.');
    }
  };

  // Reanalyse stored scan without reuploading
  const handleReanalyseScan = async (scanId) => {
    if (!scanId) return;
    const currentPatientId = patientId;
    setIsLoading(true);
    setError(null);

    const res = await reanalyseMriScan(scanId, true, currentPatientId, userRole);
    setIsLoading(false);

    if (currentPatientId !== activePatientIdRef.current) return;

    if (res.success && res.data) {
      setPrediction(res.data);
      if (res.data.scanId) {
        fetchScanImageBlob(res.data.scanId, currentPatientId, userRole)
          .then((blob) => {
            if (activePatientIdRef.current !== currentPatientId) return;
            setPreviewUrl((prev) => {
              if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
              return URL.createObjectURL(blob);
            });
          })
          .catch(() => {});
      }
      refreshHistory();
      setActiveView('viewer');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setError(res.error || 'Failed to reanalyse MRI scan.');
    }
  };

  // Handle Action 1: View Current Results (Guaranteed to resolve active patient evaluation)
  const handleViewCurrentResults = async () => {
    setActiveView('viewer');
    // If active prediction exists, has probabilities and matches patient, scroll to results
    if (prediction && prediction.patientId === patientId && prediction.probabilities) {
      setTimeout(() => {
        const el = document.getElementById('prediction-results') || document.querySelector('.prediction-card');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
      return;
    }

    // Otherwise, fetch latest valid evaluation from API for active patient
    try {
      setIsLoading(true);
      const res = await getPredictionHistory(1, patientId, userRole);
      setIsLoading(false);
      if (res.success && res.data && res.data.length > 0) {
        const latest = res.data[0];
        setPrediction({
          _id: latest._id,
          scanId: latest.scanId,
          predictedClass: latest.predictedClass,
          stageLabel: latest.stageLabel,
          stageNumber: latest.stageNumber || 1,
          displayLabel: latest.displayLabel || latest.stageLabel,
          alertLevel: latest.alertLevel || 'info',
          probabilities: latest.probabilities || null,
          confidence: latest.confidence || (latest.probabilities ? Math.max(...Object.values(latest.probabilities)) : 0.95),
          hasHeatmaps: Boolean(latest.hasHeatmaps),
          heatmaps: latest.heatmaps || null,
          patientId: latest.patientId,
          scanDate: latest.scanDate || latest.createdAt,
          evaluationType: latest.evaluationType || 'original',
          originalFilename: latest.originalFilename,
          notes: latest.notes,
          rawLogits: latest.rawLogits || [],
        });

        if (latest.scanId) {
          fetchScanImageBlob(latest.scanId, patientId, userRole)
            .then((blob) => {
              if (activePatientIdRef.current !== patientId) return;
              setPreviewUrl((prev) => {
                if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
                return URL.createObjectURL(blob);
              });
            })
            .catch(() => {});
        }

        setTimeout(() => {
          const el = document.getElementById('prediction-results') || document.querySelector('.prediction-card');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } else {
        setError('No diagnostic evaluation records found for this patient. Please upload an MRI scan to evaluate.');
      }
    } catch (err) {
      setIsLoading(false);
      setError('Failed to retrieve current results for this patient.');
    }
  };

  const handleReanalyseCurrent = () => {
    let targetScanId = prediction?.scanId;
    if (!targetScanId && history && history.length > 0 && history[0].scanId) {
      targetScanId = history[0].scanId;
    }
    if (targetScanId) {
      handleReanalyseScan(targetScanId);
    } else {
      setIsReanalyseModalOpen(true);
    }
  };

  const handleCompareScans = (eval1Id, eval2Id) => {
    setComparisonEvalA(eval1Id);
    setComparisonEvalB(eval2Id);
    setActiveView('comparison');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReanalyseSuccess = (newPrediction, scan) => {
    setPrediction(newPrediction);
    if (scan?.scanId) {
      fetchScanImageBlob(scan.scanId, patientId, userRole)
        .then((blob) => {
          setPreviewUrl((prev) => {
            if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
        })
        .catch(() => {});
    }
    refreshHistory();
    setActiveView('viewer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClear = () => {
    setPrediction(null);
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setError(null);
  };

  const handleClearHistory = async () => {
    const res = await clearPredictionHistory();
    if (res.success) {
      setHistory([]);
    } else {
      alert(res.error || 'Failed to clear history');
    }
  };

  const handleNavigate = (viewId) => {
    setActiveView(viewId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewAnalysis = () => {
    handleClear();
    setActiveView('viewer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="app-container">
      {/* 1. Left Sidebar Navigation (11 Functional Items) */}
      <Sidebar
        activeView={activeView}
        onNavigate={handleNavigate}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNewAnalysis={handleNewAnalysis}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* 2. Main Content Workspace */}
      <main className="app-main">
        {/* Top Header Bar */}
        <Navbar
          health={health}
          onRefreshHealth={refreshHealth}
          isRefreshing={isRefreshingHealth}
          onToggleMobileNav={() => setIsMobileNavOpen((prev) => !prev)}
          activePatient={activePatient}
          onOpenPatientSwitch={() => setIsPatientSwitchOpen(true)}
          userRole={userRole}
          activeView={activeView}
          onNavigate={handleNavigate}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenPreferences={() => setIsPreferencesOpen(true)}
        />

        {/* Global Error Alert */}
        {error && (
          <div
            style={{
              padding: '0.9rem 1.15rem',
              background: 'var(--stage-4-bg)',
              border: '1px solid var(--stage-4-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--stage-4)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <AlertCircle size={18} color="var(--stage-4)" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: '700', fontSize: '0.86rem', color: 'var(--stage-4)', margin: 0 }}>
                Inference Processing Error
              </p>
              <p style={{ fontSize: '0.82rem', margin: '0.15rem 0 0 0' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Dynamic Main Views Based on Sidebar Selection with smooth route transitions (200ms fade + 8px slide) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
          >
          {activeView === 'dashboard' && (
            <PatientCareDashboard
              prediction={prediction}
              preferences={patientPreferences}
              onOpenPreferences={() => setIsPreferencesOpen(true)}
              onNavigate={handleNavigate}
              onNewAnalysis={handleNewAnalysis}
              patientId={patientId}
              activePatient={activePatient}
              userRole={userRole}
            />
          )}

        {activeView === 'viewer' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* A. Clean Page Header */}
            <div
              className="panel"
              style={{
                padding: '1.35rem 1.65rem',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  {t('mri.title')}
                </h2>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                  {t('mri.subtitle')}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                {/* Active Patient Information Pill */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border)',
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius)',
                    fontSize: '0.88rem',
                  }}
                >
                  <User size={16} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {activePatient?.name || patientId}
                  </strong>
                  <span style={{ color: 'var(--text-muted)' }}>•</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                    {activePatient?.patientId || patientId}
                  </span>
                  {activePatient?.age && (
                    <>
                      <span style={{ color: 'var(--text-muted)' }}>•</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{activePatient.age}y</span>
                    </>
                  )}
                </div>

                {prediction && (
                  <span
                    style={{
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      border: '1px solid var(--primary-border)',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      padding: '0.45rem 0.85rem',
                      borderRadius: 'var(--radius)',
                    }}
                  >
                    Stage {prediction.stageNumber}: {translateClass(prediction.predictedClass)}
                  </span>
                )}
              </div>
            </div>

            {/* B. MRI Analysis Workspace (60% / 40% Balanced Split) */}
            <div className="workspace-grid">
              {/* Main Column (~60%) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <MriViewer
                  selectedFile={selectedFile}
                  setSelectedFile={setSelectedFile}
                  previewUrl={previewUrl}
                  setPreviewUrl={setPreviewUrl}
                  onPredict={handlePredict}
                  isLoading={isLoading}
                  prediction={prediction}
                  onClear={handleClear}
                  onOpenReanalyseModal={() => setIsReanalyseModalOpen(true)}
                  onReanalyseCurrent={handleReanalyseCurrent}
                  onViewCurrentResults={handleViewCurrentResults}
                  onNavigateToComparison={() => handleNavigate('comparison')}
                />

                {/* Prediction Result directly beneath viewer */}
                {prediction && (
                  <PredictionCard prediction={prediction} />
                )}
              </div>

              {/* Secondary Column (~40%) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {prediction ? (
                  <>
                    {/* Scan Information Summary Card */}
                    <div
                      className="panel"
                      style={{
                        padding: '1.25rem 1.35rem',
                        backgroundColor: 'var(--bg-surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.65rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FileText size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                          <h3 style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                            Scan File Details
                          </h3>
                        </div>
                        <span
                          style={{
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            padding: '0.2rem 0.55rem',
                            backgroundColor: 'var(--stage-1-bg)',
                            color: 'var(--stage-1)',
                            border: '1px solid var(--stage-1-border)',
                            borderRadius: 'var(--radius-xs)',
                          }}
                        >
                          Evaluated
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.88rem' }}>
                        <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block' }}>File Name</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: '600', wordBreak: 'break-all' }}>{selectedFile?.name || 'mri_scan.png'}</span>
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block' }}>Scan Resolution</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>224×224 px Axial</span>
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block' }}>Model Network</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>EfficientNet + Swin</span>
                        </div>
                        <div style={{ backgroundColor: 'var(--bg-surface-subtle)', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.76rem', display: 'block' }}>Visual Overlays</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>Grad-CAM & IG</span>
                        </div>
                      </div>
                    </div>

                    {/* Progression Spectrum Indicator */}
                    <ProgressionIndicator predictedClass={prediction.predictedClass} />

                    {/* Category Probability Distribution Breakdown */}
                    {prediction.probabilities && (
                      <ProbabilityChart
                        probabilities={prediction.probabilities}
                        predictedClass={prediction.predictedClass}
                      />
                    )}

                    {/* Patient Context Card */}
                    <div
                      className="panel"
                      style={{
                        padding: '1.25rem 1.35rem',
                        backgroundColor: 'var(--bg-surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={18} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                          <h3 style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                            Patient Profile Context
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsPatientSwitchOpen(true)}
                          className="btn-secondary"
                          style={{ minHeight: '34px', fontSize: '0.82rem', padding: '0.2rem 0.55rem' }}
                        >
                          Switch
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.9rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Patient Name:</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{activePatient?.name || patientId}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Scans on Record:</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{history.length} scans</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Last Evaluation:</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{history[0]?.createdAt ? new Date(history[0].createdAt).toLocaleDateString() : 'Today'}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Scan Preparation & Context Panel when no prediction yet */
                  <div
                    className="panel"
                    style={{
                      padding: '1.5rem',
                      backgroundColor: 'var(--bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.15rem',
                    }}
                  >
                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Brain size={20} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                          How to Prepare Your Scan
                        </h3>
                      </div>
                      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', lineHeight: '1.45' }}>
                        Follow these simple recommendations to ensure the most accurate computerized scan check.
                      </p>
                    </div>

                    {/* Patient Context Quick Card */}
                    <div
                      style={{
                        padding: '0.75rem 0.95rem',
                        backgroundColor: 'var(--bg-surface-subtle)',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        fontSize: '0.88rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Current Patient:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{activePatient?.name || patientId}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Patient ID:</span>
                        <code style={{ color: 'var(--primary)' }}>{activePatient?.patientId || patientId}</code>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Historical Scans:</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{history.length} scans</span>
                      </div>
                    </div>

                    {/* Guidelines List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                        Scan Requirements
                      </h4>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} aria-hidden="true" />
                          <span>Standard 2D axial view brain MRI slice</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} aria-hidden="true" />
                          <span>Clear contrast without heavy motion blur</span>
                        </li>
                        <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <CheckCircle2 size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} aria-hidden="true" />
                          <span>Supported image files: PNG, JPEG, WEBP, or TIFF (under 10 MB)</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* C. Dedicated Explainability Visualizations Section */}
            {prediction?.heatmaps && !prediction?.isOOD && !prediction?.outOfDistribution && (
              <Suspense fallback={<div style={{ padding: '1rem', color: 'var(--text-muted)' }}>{t('common.loading')}</div>}>
                <ExplainabilityView heatmaps={prediction.heatmaps} />
              </Suspense>
            )}

            {/* D. Personalized Care Guidance Section */}
            {prediction && !prediction?.isOOD && !prediction?.outOfDistribution && (
              <EducationalRecommendationsCard prediction={prediction} />
            )}
          </div>
        )}

        {activeView === 'care-recommendations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {prediction ? (
              <PredictionCard prediction={prediction} />
            ) : (
              <div
                className="panel"
                style={{
                  padding: '1.25rem 1.35rem',
                  background: 'var(--panel)',
                  borderLeft: '4px solid var(--stage-1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '700' }}>
                    DIAGNOSTIC SUMMARY
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--stage-1)', margin: '0.2rem 0' }}>
                    Stage 1 — Healthy / No Dementia Detected
                  </h3>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Baseline research cohort preview. To evaluate an MRI scan, navigate to New MRI Analysis.
                  </p>
                </div>
                <span
                  className="badge"
                  style={{
                    background: 'var(--stage-1-bg)',
                    color: 'var(--stage-1)',
                    border: '1px solid var(--stage-1-border)',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                  }}
                >
                  Baseline Preview
                </span>
              </div>
            )}
            <EducationalRecommendationsCard
              prediction={
                prediction || {
                  predictedClass: 'NonDemented',
                  stageNumber: 1,
                  displayLabel: 'Healthy / No Dementia Detected',
                }
              }
            />
          </div>
        )}

        <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('common.loading')}</div>}>
          {activeView === 'nutrition' && (
            <NutritionRecommendations
              prediction={prediction}
              preferences={patientPreferences}
              onOpenPreferences={() => setIsPreferencesOpen(true)}
            />
          )}

          {activeView === 'medications' && (
            <MedicationReminder
              patientId={patientId}
              prediction={prediction}
            />
          )}

          {activeView === 'routine' && (
            <DailyCareRoutine
              prediction={prediction}
              preferences={patientPreferences}
              onOpenPreferences={() => setIsPreferencesOpen(true)}
            />
          )}

          {activeView === 'specialists' && (
            <SpecialistFinder
              prediction={prediction}
              preferences={patientPreferences}
              onOpenPreferences={() => setIsPreferencesOpen(true)}
            />
          )}

          {activeView === 'appointments' && (
            <AppointmentManager
              patientId={patientId}
              prediction={prediction}
            />
          )}

          {activeView === 'history' && (
            <HistoryPanel
              history={history}
              onRefreshHistory={refreshHistory}
              onClearHistory={handleClearHistory}
              dbConnected={health?.database?.connected}
              isRefreshing={isRefreshingHistory}
              onReanalyseScan={handleReanalyseScan}
              onCompareScans={handleCompareScans}
            />
          )}

          {activeView === 'comparison' && (
            <LongitudinalComparisonView
              patientId={patientId}
              userRole={userRole}
              initialEvalAId={comparisonEvalA}
              initialEvalBId={comparisonEvalB}
              onNavigateBack={() => handleNavigate('history')}
            />
          )}

          {(activeView === 'educational' || activeView === 'caregiver') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <CaregiverSupport
                prediction={prediction}
                preferences={patientPreferences}
              />
              <EducationalModule
                defaultClass={prediction ? prediction.predictedClass : 'NonDemented'}
              />
            </div>
          )}

          {activeView === 'research' && (
            <ResearchDetailsView prediction={prediction} />
          )}

          {activeView === 'notifications' && (
            <EmailNotificationSettings
              patientId={patientId}
              activePatient={activePatient}
            />
          )}
        </Suspense>
          </motion.div>
        </AnimatePresence>

        {/* Compact Persistent Medical & Regulatory Notice */}
        <DisclaimerBanner />
      </main>

      {/* Lazy-loaded Modals */}
      <Suspense fallback={null}>
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          health={health}
          patientId={patientId}
          activePatient={activePatient}
        />

        <PatientSwitchModal
          isOpen={isPatientSwitchOpen}
          onClose={() => setIsPatientSwitchOpen(false)}
          activePatient={activePatient}
          onSelectPatient={handleSwitchPatient}
          userRole={userRole}
        />

        <PatientPreferencesModal
          isOpen={isPreferencesOpen}
          onClose={() => setIsPreferencesOpen(false)}
          preferences={patientPreferences}
          onSavePreferences={setPatientPreferences}
        />

        <ReanalyseModal
          isOpen={isReanalyseModalOpen}
          onClose={() => setIsReanalyseModalOpen(false)}
          patientId={patientId}
          userRole={userRole}
          onReanalyseSuccess={handleReanalyseSuccess}
        />
      </Suspense>
    </div>
  );
}

