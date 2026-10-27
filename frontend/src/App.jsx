import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import UploadDropzone from './components/UploadDropzone';
import PredictionCard from './components/PredictionCard';
import ProbabilityChart from './components/ProbabilityChart';
import ExplainabilityView from './components/ExplainabilityView';
import EducationalModule from './components/EducationalModule';
import HistoryPanel from './components/HistoryPanel';
import DisclaimerBanner from './components/DisclaimerBanner';
import { getSystemHealth, predictMri, getPredictionHistory, clearPredictionHistory } from './services/api';
import { AlertCircle, BrainCircuit } from 'lucide-react';

export default function App() {
  const [health, setHealth] = useState(null);
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [isRefreshingHistory, setIsRefreshingHistory] = useState(false);

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

  // Load prediction history
  const refreshHistory = useCallback(async () => {
    setIsRefreshingHistory(true);
    try {
      const res = await getPredictionHistory(20);
      if (res.success) {
        setHistory(res.data);
      }
    } finally {
      setIsRefreshingHistory(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    refreshHistory();
  }, [refreshHealth, refreshHistory]);

  // Handle Predict Trigger
  const handlePredict = async (file) => {
    if (!file) return;
    setIsLoading(true);
    setError(null);

    const res = await predictMri(file, true); // Include Grad-CAM and Integrated Gradients
    setIsLoading(false);

    if (res.success) {
      setPrediction(res.data);
      refreshHistory(); // Refresh history table if saved
    } else {
      setError(res.error || 'Failed to complete prediction.');
    }
  };

  const handleClear = () => {
    setPrediction(null);
    setSelectedFile(null);
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

  return (
    <div className="container">
      {/* Compact Header */}
      <Navbar
        health={health}
        onRefreshHealth={refreshHealth}
        isRefreshing={isRefreshingHealth}
      />

      <main>
        {/* Main Two-Column Dashboard Grid (~40% Upload : ~60% Results) */}
        <div className="main-dashboard-grid">
          
          {/* Left Column: MRI Upload Card */}
          <div>
            <UploadDropzone
              onPredict={handlePredict}
              isLoading={isLoading}
              onClear={handleClear}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
            />
          </div>

          {/* Right Column: Prediction Results or Awaiting Placeholder */}
          <div>
            {prediction ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <PredictionCard prediction={prediction} />
                <ProbabilityChart
                  probabilities={prediction.probabilities}
                  predictedClass={prediction.predictedClass}
                />
              </div>
            ) : (
              <div
                className="panel"
                style={{
                  padding: '2.5rem 1.5rem',
                  minHeight: '340px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <div
                  style={{
                    width: '3rem',
                    height: '3rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(14, 116, 144, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '0.85rem',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <BrainCircuit size={22} color="#38bdf8" />
                </div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: '600', color: '#f1f5f9', margin: 0 }}>
                  Awaiting MRI Scan Input
                </h3>
                <p style={{ fontSize: '0.78rem', maxWidth: '320px', marginTop: '0.35rem', lineHeight: '1.45', color: '#94a3b8' }}>
                  Upload a brain MRI series on the left and select <strong>"Classify & Generate Heatmaps"</strong> to view classification metrics and attribution heatmaps.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Global Error Alert */}
        {error && (
          <div
            style={{
              marginTop: '1.25rem',
              padding: '0.9rem 1.1rem',
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '0.65rem',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <AlertCircle size={18} color="#f87171" style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: '700', fontSize: '0.86rem', color: '#fecaca', margin: 0 }}>Inference Error</p>
              <p style={{ fontSize: '0.82rem', margin: '0.15rem 0 0 0' }}>{error}</p>
            </div>
          </div>
        )}

        {/* Explainability Heatmaps (Grad-CAM & Integrated Gradients) */}
        {prediction?.heatmaps && (
          <ExplainabilityView heatmaps={prediction.heatmaps} />
        )}

        {/* Educational Reference Guide */}
        <EducationalModule
          defaultClass={prediction ? prediction.predictedClass : 'NonDemented'}
        />

        {/* Prediction History Persistence */}
        <HistoryPanel
          history={history}
          onRefreshHistory={refreshHistory}
          onClearHistory={handleClearHistory}
          dbConnected={health?.database?.connected}
          isRefreshing={isRefreshingHistory}
        />

        {/* Mandatory Research Disclaimer */}
        <DisclaimerBanner />
      </main>
    </div>
  );
}
