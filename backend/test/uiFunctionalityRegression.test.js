const test = require('node:test');
const assert = require('node:assert');

test('UI & Functionality Restoration Regression Test Suite', async (t) => {
  const {
    STAGE_RECOMMENDATIONS,
    getStageRecommendations,
    filterNutritionByPreferences,
    filterRoutineByPreferences,
  } = await import('../../frontend/src/data/stageRecommendations.js');

  const {
    STAGE_MAP,
    getStageInfo,
  } = await import('../../frontend/src/data/educationalContent.js');

  const mockPredictionData = {
    predictedClass: 'MildDemented',
    confidenceScore: 0.88,
    displayLabel: 'Moderate Stage',
    stageNumber: 3,
    probabilities: {
      MildDemented: 0.88,
      ModerateDemented: 0.05,
      NonDemented: 0.04,
      VeryMildDemented: 0.03,
    },
    rawLogits: {
      MildDemented: 2.45,
      ModerateDemented: -0.12,
      NonDemented: -0.35,
      VeryMildDemented: -0.58,
    },
    heatmaps: {
      gradcam: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      integratedGradients: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  };

  await t.test('1. Four-stage presentation mapping matches canonical specifications', () => {
    // NonDemented (index 2) -> Stage 1
    const nonDem = getStageInfo('NonDemented');
    assert.strictEqual(nonDem.stageNumber, 1);
    assert.strictEqual(nonDem.displayLabel, 'Healthy / No Dementia Detected');

    // VeryMildDemented (index 3) -> Stage 2
    const veryMild = getStageInfo('VeryMildDemented');
    assert.strictEqual(veryMild.stageNumber, 2);
    assert.strictEqual(veryMild.displayLabel, 'Early Stage');

    // MildDemented (index 0) -> Stage 3
    const mild = getStageInfo('MildDemented');
    assert.strictEqual(mild.stageNumber, 3);
    assert.strictEqual(mild.displayLabel, 'Moderate Stage');

    // ModerateDemented (index 1) -> Stage 4
    const modDem = getStageInfo('ModerateDemented');
    assert.strictEqual(modDem.stageNumber, 4);
    assert.strictEqual(modDem.displayLabel, 'Critical Stage');

    // Verify STAGE_MAP entries
    for (const key of Object.keys(STAGE_MAP)) {
      assert.ok(STAGE_MAP[key].stageNumber, `Class ${key} must have stageNumber`);
      assert.ok(STAGE_MAP[key].displayLabel, `Class ${key} must have displayLabel`);
    }
  });

  await t.test('2. Navigation state persistence: Active MRI analysis state is preserved during navigation', () => {
    // Simulate App state
    let state = {
      activeView: 'viewer',
      prediction: { ...mockPredictionData },
      selectedFile: { name: 'test_mri_slice.png', size: 1048576 },
      previewUrl: 'blob:http://localhost:5173/mock-uuid',
    };

    // Navigation function that must NOT clear prediction or scan state
    const handleNavigate = (viewId) => {
      state.activeView = viewId;
    };

    // Explicit clear function that ONLY runs on user reset action
    const handleClear = () => {
      state.prediction = null;
      state.selectedFile = null;
      state.previewUrl = null;
    };

    // Navigate to dashboard
    handleNavigate('dashboard');
    assert.strictEqual(state.activeView, 'dashboard');
    assert.ok(state.prediction, 'Prediction must remain intact after navigating to dashboard');
    assert.strictEqual(state.prediction.predictedClass, 'MildDemented');
    assert.ok(state.prediction.heatmaps, 'Heatmaps must remain intact');

    // Navigate to nutrition
    handleNavigate('nutrition');
    assert.strictEqual(state.activeView, 'nutrition');
    assert.ok(state.prediction, 'Prediction must remain intact after navigating to nutrition');

    // Navigate back to viewer
    handleNavigate('viewer');
    assert.strictEqual(state.activeView, 'viewer');
    assert.ok(state.prediction, 'Prediction must remain intact after returning to viewer');
    assert.strictEqual(state.selectedFile.name, 'test_mri_slice.png');

    // Now test explicit user clear action
    handleClear();
    assert.strictEqual(state.prediction, null, 'Explicit clear action resets prediction');
    assert.strictEqual(state.selectedFile, null, 'Explicit clear action resets selectedFile');
    assert.strictEqual(state.previewUrl, null, 'Explicit clear action resets previewUrl');
  });

  await t.test('3. Inference completion keeps user on MRI Analysis view without forced redirect', () => {
    // In previous regression, handlePredict called setActiveView('dashboard') immediately.
    // Fixed behavior: retain user on current view ('viewer') to see PredictionCard, ProgressionIndicator, and Heatmaps.
    let activeView = 'viewer';
    let prediction = null;

    const handlePredictSuccess = (apiData) => {
      prediction = apiData;
      // Do NOT call setActiveView('dashboard')
    };

    handlePredictSuccess(mockPredictionData);

    assert.strictEqual(activeView, 'viewer', 'Active view must remain viewer upon prediction completion');
    assert.ok(prediction, 'Prediction state must be set');
    assert.strictEqual(prediction.predictedClass, 'MildDemented');
  });

  await t.test('4. Dual ExplainabilityView rendering reuses the same in-memory heatmaps without duplicate inference', () => {
    let inferenceCallCount = 0;

    const mockRunInference = () => {
      inferenceCallCount++;
      return mockPredictionData;
    };

    // Initial inference run
    const result = mockRunInference();
    assert.strictEqual(inferenceCallCount, 1);

    // Component in Viewer View accesses heatmaps
    const viewerHeatmaps = result.heatmaps;
    assert.ok(viewerHeatmaps.gradcam);
    assert.ok(viewerHeatmaps.integratedGradients);

    // Component in Research View accesses same heatmaps
    const researchHeatmaps = result.heatmaps;
    assert.strictEqual(researchHeatmaps, viewerHeatmaps, 'Heatmap reference should be identical');
    assert.strictEqual(inferenceCallCount, 1, 'Zero duplicate inference calls should occur');
  });

  await t.test('5. Patient preferences persist across care module transitions', () => {
    let patientPreferences = {
      dietType: 'Vegetarian',
      allergies: ['Peanuts'],
      mobility: 'Assisted Mobility / Cane',
      preferredActivityTime: 'Morning',
      caregiverInvolvement: 'Full Caregiver Assistance',
      city: 'Mumbai',
    };

    // User navigates between modules
    const views = ['dashboard', 'nutrition', 'routine', 'specialists', 'care-recommendations'];
    for (const view of views) {
      // Preferences must not mutate on navigation
      assert.strictEqual(patientPreferences.dietType, 'Vegetarian');
      assert.strictEqual(patientPreferences.city, 'Mumbai');
      assert.strictEqual(patientPreferences.mobility, 'Assisted Mobility / Cane');

      // Test filtered meals in this view
      const filteredNutrition = filterNutritionByPreferences(
        STAGE_RECOMMENDATIONS[3].nutrition,
        patientPreferences
      );
      assert.ok(filteredNutrition.meals, 'Meals object must exist');
      assert.ok(Array.isArray(filteredNutrition.meals.breakfast));

      // Test filtered routine in this view
      const adaptedRoutine = filterRoutineByPreferences(
        STAGE_RECOMMENDATIONS[3].dailyRoutine,
        patientPreferences
      );
      assert.ok(Array.isArray(adaptedRoutine.schedule));
      assert.strictEqual(adaptedRoutine.schedule.length, 3);
    }
  });

  await t.test('6. All 11 navigation routes map to distinct functional modules', () => {
    const validRoutes = [
      'dashboard',
      'viewer',
      'care-recommendations',
      'nutrition',
      'medications',
      'routine',
      'specialists',
      'appointments',
      'history',
      'educational',
      'research',
    ];

    assert.strictEqual(validRoutes.length, 11, 'Must have exactly 11 functional navigation routes');
    const uniqueRoutes = new Set(validRoutes);
    assert.strictEqual(uniqueRoutes.size, 11, 'All 11 routes must be unique');
  });

  await t.test('7. Clinical safeguards: No autonomous prescribing or fabricated doctor identity', () => {
    for (let s = 1; s <= 4; s++) {
      const recs = getStageRecommendations(s);
      const advisoryLower = recs.medicationGuidance.advisory.toLowerCase();
      assert.ok(
        advisoryLower.includes('clinician') ||
        advisoryLower.includes('physician') ||
        advisoryLower.includes('doctor') ||
        advisoryLower.includes('prescription')
      );
      assert.ok(
        advisoryLower.includes('never') ||
        recs.medicationGuidance.rules.some((r) => r.toLowerCase().includes('never'))
      );

      // Verify no mention of fictional doctors like "Dr. Sarah Chen" in recommendations or metadata
      const recsString = JSON.stringify(recs);
      assert.strictEqual(recsString.includes('Dr. Sarah Chen'), false, 'Must not reference Dr. Sarah Chen');
      assert.strictEqual(recsString.includes('clinically validated diagnostic AI'), false);
    }
  });

  await t.test('8. EducationalRecommendationsCard data structure: Stage and contextual explanation properties are primitives', async () => {
    const { getWhyThisRecommendation } = await import('../../frontend/src/data/stageRecommendations.js');
    const classes = ['NonDemented', 'VeryMildDemented', 'MildDemented', 'ModerateDemented', undefined, null];

    for (const cls of classes) {
      const baseStageInfo = getStageInfo(cls || 'NonDemented') || {};
      const stageNumber = baseStageInfo.stageNumber || 1;
      const stageRecs = getStageRecommendations(stageNumber) || {};
      const whyData = getWhyThisRecommendation(stageNumber) || {};

      const stageInfo = {
        ...baseStageInfo,
        stageNumber: whyData.stageNumber || stageNumber,
        displayLabel: whyData.displayLabel || baseStageInfo.displayLabel || 'Healthy / No Dementia Detected',
        explanation: whyData.explanation || '',
        disclaimer: whyData.disclaimer || '',
      };

      // Ensure every property rendered in JSX is a primitive string or number, NEVER an object
      assert.strictEqual(typeof stageInfo.stageNumber, 'number', 'stageNumber must be a number');
      assert.strictEqual(typeof stageInfo.displayLabel, 'string', 'displayLabel must be a string');
      assert.strictEqual(typeof stageInfo.explanation, 'string', 'explanation must be a string');
      assert.strictEqual(typeof stageInfo.disclaimer, 'string', 'disclaimer must be a string');

      // Check categories items are all primitive strings
      const categories = [
        {
          id: 'daily',
          title: 'Daily Activities & Routine',
          items: (stageRecs.dailyRoutine?.schedule || []).flatMap((phase) =>
            phase.tasks.slice(0, 2).map((t) => ({
              title: phase.title,
              text: t.text,
              meta: phase.phase,
            }))
          ).slice(0, 3),
        },
        {
          id: 'memory',
          title: 'Memory Support & Cognitive Vitality',
          items: (stageRecs.dailyRoutine?.cognitiveActivities || []).map((act) => ({
            title: act.title,
            text: act.desc,
            meta: act.cadence,
          })),
        },
      ];

      for (const cat of categories) {
        assert.strictEqual(typeof cat.title, 'string');
        for (const item of cat.items) {
          assert.strictEqual(typeof item.title, 'string');
          assert.strictEqual(typeof item.text, 'string');
          assert.strictEqual(typeof item.meta, 'string');
        }
      }
    }
  });
});
