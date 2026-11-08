const test = require('node:test');
const assert = require('node:assert');

test('Stage-Specific Personalized Recommendation Engine Tests', async (t) => {
  const {
    STAGE_RECOMMENDATIONS,
    getStageRecommendations,
    filterNutritionByPreferences,
    filterRoutineByPreferences,
    getWhyThisRecommendation,
    SIMPLIFIED_STAGE_RECOMMENDATIONS,
    getSimplifiedRecommendations,
  } = await import('../../frontend/src/data/stageRecommendations.js');

  const {
    checkMealSafety,
    generateWeeklyMealPlan,
    filterFoodCategories,
    FOOD_CATEGORIES,
  } = await import('../../frontend/src/data/nutritionContent.js');

  await t.test('All four stage profiles exist with required properties', () => {
    for (let s = 1; s <= 4; s++) {
      const profile = STAGE_RECOMMENDATIONS[s];
      assert.ok(profile, `Stage ${s} profile must exist`);
      assert.strictEqual(profile.stageNumber, s);
      assert.ok(profile.displayLabel, `Stage ${s} must have displayLabel`);
      assert.ok(profile.purpose, `Stage ${s} must have purpose`);
      assert.ok(profile.guidanceMessage, `Stage ${s} must have guidanceMessage`);
      assert.ok(Array.isArray(profile.priorityFocus), `Stage ${s} priorityFocus must be array`);
      assert.ok(profile.nutrition, `Stage ${s} must have nutrition object`);
      assert.ok(profile.dailyRoutine, `Stage ${s} must have dailyRoutine object`);
      assert.ok(profile.medicationGuidance, `Stage ${s} must have medicationGuidance`);
      assert.ok(profile.specialistGuidance, `Stage ${s} must have specialistGuidance`);
      assert.ok(profile.caregiverGuidance, `Stage ${s} must have caregiverGuidance`);
      assert.ok(profile.followUpGuidance, `Stage ${s} must have followUpGuidance`);
    }
  });

  await t.test('All four stage profiles are genuinely distinct and not shared', () => {
    const p1 = STAGE_RECOMMENDATIONS[1];
    const p2 = STAGE_RECOMMENDATIONS[2];
    const p3 = STAGE_RECOMMENDATIONS[3];
    const p4 = STAGE_RECOMMENDATIONS[4];

    // Check display labels
    assert.strictEqual(p1.displayLabel, 'Healthy / No Dementia Detected');
    assert.strictEqual(p2.displayLabel, 'Early Stage');
    assert.strictEqual(p3.displayLabel, 'Moderate Stage');
    assert.strictEqual(p4.displayLabel, 'Critical Stage');

    // Check distinct purposes
    assert.notStrictEqual(p1.purpose, p2.purpose);
    assert.notStrictEqual(p2.purpose, p3.purpose);
    assert.notStrictEqual(p3.purpose, p4.purpose);

    // Check distinct guidance messages
    assert.notStrictEqual(p1.guidanceMessage, p2.guidanceMessage);
    assert.notStrictEqual(p2.guidanceMessage, p3.guidanceMessage);
    assert.notStrictEqual(p3.guidanceMessage, p4.guidanceMessage);

    // Check distinct nutrition overviews
    assert.notStrictEqual(p1.nutrition.overview, p2.nutrition.overview);
    assert.notStrictEqual(p2.nutrition.overview, p3.nutrition.overview);
    assert.notStrictEqual(p3.nutrition.overview, p4.nutrition.overview);

    // Check distinct medication advisories
    assert.notStrictEqual(p1.medicationGuidance.advisory, p2.medicationGuidance.advisory);
    assert.notStrictEqual(p2.medicationGuidance.advisory, p3.medicationGuidance.advisory);
    assert.notStrictEqual(p3.medicationGuidance.advisory, p4.medicationGuidance.advisory);

    // Check distinct specialist recommendations
    assert.notDeepStrictEqual(
      p1.specialistGuidance.recommendedSpecialties,
      p2.specialistGuidance.recommendedSpecialties
    );
    assert.notDeepStrictEqual(
      p2.specialistGuidance.recommendedSpecialties,
      p4.specialistGuidance.recommendedSpecialties
    );
  });

  await t.test('getStageRecommendations handles various inputs and fallbacks', () => {
    // Numbers
    assert.strictEqual(getStageRecommendations(1).stageNumber, 1);
    assert.strictEqual(getStageRecommendations(2).stageNumber, 2);
    assert.strictEqual(getStageRecommendations(3).stageNumber, 3);
    assert.strictEqual(getStageRecommendations(4).stageNumber, 4);

    // Strings
    assert.strictEqual(getStageRecommendations('1').stageNumber, 1);
    assert.strictEqual(getStageRecommendations('4').stageNumber, 4);

    // Canonical classes
    assert.strictEqual(getStageRecommendations('NonDemented').stageNumber, 1);
    assert.strictEqual(getStageRecommendations('VeryMildDemented').stageNumber, 2);
    assert.strictEqual(getStageRecommendations('MildDemented').stageNumber, 3);
    assert.strictEqual(getStageRecommendations('ModerateDemented').stageNumber, 4);

    // Prediction object
    assert.strictEqual(
      getStageRecommendations({ stageNumber: 3, predictedClass: 'MildDemented' }).stageNumber,
      3
    );
    assert.strictEqual(
      getStageRecommendations({ predictedClass: 'VeryMildDemented' }).stageNumber,
      2
    );

    // Safe fallback for null, undefined, invalid
    assert.strictEqual(getStageRecommendations(null).stageNumber, 1);
    assert.strictEqual(getStageRecommendations(undefined).stageNumber, 1);
    assert.strictEqual(getStageRecommendations('UnknownCategory').stageNumber, 1);
    assert.strictEqual(getStageRecommendations(99).stageNumber, 1);
  });

  await t.test('Dietary preferences filter meal suggestions appropriately', () => {
    const stage2Nutrition = STAGE_RECOMMENDATIONS[2].nutrition;

    // Filter Vegetarian
    const vegFiltered = filterNutritionByPreferences(stage2Nutrition, { dietType: 'Vegetarian' });
    const breakfast = vegFiltered.meals.breakfast;
    const scrambledEggs = breakfast.find((m) => m.name.includes('Scrambled Eggs'));
    const idlis = breakfast.find((m) => m.name.includes('Idlis'));

    assert.ok(idlis.isDietMatch, 'Vegetarian idlis should match vegetarian diet');
    assert.strictEqual(scrambledEggs.isDietMatch, false, 'Non-veg eggs should not match vegetarian diet');

    // Filter Vegan
    const veganFiltered = filterNutritionByPreferences(stage2Nutrition, { dietType: 'Vegan' });
    const rolledOatsDairy = veganFiltered.meals.breakfast.find((m) => m.name.includes('Rolled Oats'));
    assert.strictEqual(rolledOatsDairy.isDietMatch, false, 'Oats with dairy should not match vegan diet');

    // Filter Allergies (Nuts)
    const allergyFiltered = filterNutritionByPreferences(stage2Nutrition, {
      allergies: ['Nuts'],
    });
    const soakedWalnuts = allergyFiltered.meals.snack.find((m) => m.name.includes('Walnuts'));
    const tenderCoconut = allergyFiltered.meals.snack.find((m) => m.name.includes('Coconut'));

    assert.ok(soakedWalnuts.hasAllergenWarning, 'Walnuts must have allergen warning');
    assert.deepStrictEqual(soakedWalnuts.matchedAllergens, ['Nuts']);
    assert.strictEqual(tenderCoconut.hasAllergenWarning, false, 'Coconut should not flag nuts');
  });

  await t.test('Mobility preferences adapt daily routine physical tasks', () => {
    const stage1Routine = STAGE_RECOMMENDATIONS[1].dailyRoutine;

    // Default mobile
    const normalRoutine = filterRoutineByPreferences(stage1Routine, { mobility: 'Fully Mobile' });
    const normalTask = normalRoutine.schedule[0].tasks.find((t) => t.category === 'Physical');
    assert.ok(normalTask.text.includes('Brisk 30-minute walk'));

    // Limited mobility
    const limitedRoutine = filterRoutineByPreferences(stage1Routine, { mobility: 'Limited Mobility' });
    const limitedTask = limitedRoutine.schedule[0].tasks.find((t) => t.category === 'Physical');
    assert.ok(limitedTask.text.includes('Seated gentle limb stretches'));

    // Assisted mobility
    const assistedRoutine = filterRoutineByPreferences(stage1Routine, { mobility: 'Assisted' });
    const assistedTask = assistedRoutine.schedule[0].tasks.find((t) => t.category === 'Physical');
    assert.ok(assistedTask.text.includes('Supported walk with cane/walker'));
  });

  await t.test('Preferred activity time flags the appropriate phase', () => {
    const stage2Routine = STAGE_RECOMMENDATIONS[2].dailyRoutine;
    const afternoonPref = filterRoutineByPreferences(stage2Routine, {
      preferredActivityTime: 'Afternoon',
    });

    const morningPhase = afternoonPref.schedule.find((p) => p.phase === 'Morning');
    const afternoonPhase = afternoonPref.schedule.find((p) => p.phase === 'Afternoon');

    assert.strictEqual(morningPhase.isPreferredTime, false);
    assert.strictEqual(afternoonPhase.isPreferredTime, true);
  });

  await t.test('Medication guidance enforces clinical safeguards across all stages', () => {
    // Stage 1 must NOT claim no medication is needed
    const s1Med = STAGE_RECOMMENDATIONS[1].medicationGuidance;
    assert.ok(!s1Med.advisory.toLowerCase().includes('does not need medication'));
    assert.ok(s1Med.rules.some((r) => r.includes('Never conclude that a patient does not need medication')));

    // No stage should prescribe specific drugs, dosages, or autonomous treatments
    const prohibitedTerms = ['take 10mg', 'take 5mg', 'donepezil 10', 'memantine 20', 'we prescribe', 'take twice daily'];
    for (let s = 1; s <= 4; s++) {
      const med = STAGE_RECOMMENDATIONS[s].medicationGuidance;
      for (const term of prohibitedTerms) {
        assert.ok(
          !med.advisory.toLowerCase().includes(term),
          `Stage ${s} advisory must not recommend specific dose '${term}'`
        );
      }
      // Must emphasize clinician / doctor / physician oversight
      assert.ok(
        med.advisory.toLowerCase().includes('physician') ||
          med.advisory.toLowerCase().includes('doctor') ||
          med.advisory.toLowerCase().includes('clinician'),
        `Stage ${s} must mandate doctor/clinician oversight`
      );
    }
  });

  await t.test('Clinical safeguards in nutrition and supportive care are preserved', () => {
    // Swallowing safeguard in Stage 3 & 4
    const s3Principles = STAGE_RECOMMENDATIONS[3].nutrition.principles;
    assert.ok(
      s3Principles.some((p) => p.includes('swallowing difficulties') || p.includes('chewing fatigue'))
    );

    const s4Specialist = STAGE_RECOMMENDATIONS[4].specialistGuidance;
    assert.ok(
      s4Specialist.consultationTiming.includes(
        'do not mean every patient automatically requires palliative care or 24-hour supervision'
      )
    );
  });

  await t.test('getWhyThisRecommendation returns stage-specific explanation', () => {
    const rec2 = getWhyThisRecommendation(2, 'nutrition');
    assert.strictEqual(rec2.stageNumber, 2);
    assert.ok(rec2.explanation.includes('Stage 2 (Early Stage)'));
    assert.ok(rec2.explanation.includes('nutrition'));
    assert.ok(rec2.disclaimer.includes('educational personalization'));

    const rec4 = getWhyThisRecommendation(4, 'specialists');
    assert.strictEqual(rec4.stageNumber, 4);
    assert.ok(rec4.explanation.includes('Stage 4 (Critical Stage)'));
    assert.ok(rec4.explanation.includes('specialist'));
  });

  await t.test('Dynamic stage transitions change rendered recommendations across all modules', () => {
    const predictions = [
      { stageNumber: 1, predictedClass: 'NonDemented', displayLabel: 'Healthy / No Dementia Detected' },
      { stageNumber: 2, predictedClass: 'VeryMildDemented', displayLabel: 'Early Stage' },
      { stageNumber: 3, predictedClass: 'MildDemented', displayLabel: 'Moderate Stage' },
      { stageNumber: 4, predictedClass: 'ModerateDemented', displayLabel: 'Critical Stage' },
    ];

    const results = predictions.map((pred) => {
      const rec = getStageRecommendations(pred);
      const whyNutrition = getWhyThisRecommendation(rec.stageNumber, 'nutrition');
      const whyRoutine = getWhyThisRecommendation(rec.stageNumber, 'routine');
      const whyMed = getWhyThisRecommendation(rec.stageNumber, 'medications');

      return {
        stage: rec.stageNumber,
        label: rec.displayLabel,
        guidance: rec.guidanceMessage,
        specialties: rec.specialistGuidance.recommendedSpecialties,
        advisory: rec.medicationGuidance.advisory,
        whyNutrition: whyNutrition.explanation,
        whyRoutine: whyRoutine.explanation,
        whyMed: whyMed.explanation,
      };
    });

    // Verify all 4 transition results are mutually distinct
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        assert.notStrictEqual(results[i].stage, results[j].stage);
        assert.notStrictEqual(results[i].label, results[j].label);
        assert.notStrictEqual(results[i].guidance, results[j].guidance);
        assert.notStrictEqual(results[i].advisory, results[j].advisory);
        assert.notStrictEqual(results[i].whyNutrition, results[j].whyNutrition);
        assert.notStrictEqual(results[i].whyRoutine, results[j].whyRoutine);
        assert.notStrictEqual(results[i].whyMed, results[j].whyMed);
      }
    }
  });

  await t.test('Legacy prediction records without stageNumber work safely', () => {
    // Old legacy database records only had predictedClass
    const legacy1 = { predictedClass: 'NonDemented' };
    const legacy2 = { predictedClass: 'VeryMildDemented' };
    const legacy3 = { predictedClass: 'MildDemented' };
    const legacy4 = { predictedClass: 'ModerateDemented' };

    assert.strictEqual(getStageRecommendations(legacy1).stageNumber, 1);
    assert.strictEqual(getStageRecommendations(legacy2).stageNumber, 2);
    assert.strictEqual(getStageRecommendations(legacy3).stageNumber, 3);
    assert.strictEqual(getStageRecommendations(legacy4).stageNumber, 4);

    // Corrupted record
    assert.strictEqual(getStageRecommendations({ corruptedField: true }).stageNumber, 1);
  });

  await t.test('Specialist suggestions change by stage and filter correctly by city', async () => {
    const { VERIFIED_SPECIALIST_CENTERS } = await import('../../frontend/src/data/specialistDirectory.js');

    // Verify centers exist across Indian metropolitan regions
    const blrCenters = VERIFIED_SPECIALIST_CENTERS.filter((c) => c.city === 'Bangalore');
    const delhiCenters = VERIFIED_SPECIALIST_CENTERS.filter((c) => c.city === 'Delhi-NCR');
    const mumbaiCenters = VERIFIED_SPECIALIST_CENTERS.filter((c) => c.city === 'Mumbai');

    assert.ok(blrCenters.length > 0, 'Bangalore centers must exist');
    assert.ok(delhiCenters.length > 0, 'Delhi-NCR centers must exist');
    assert.ok(mumbaiCenters.length > 0, 'Mumbai centers must exist');

    // Stage 2 vs Stage 4 recommendations
    const s2Recs = getStageRecommendations(2).specialistGuidance.recommendedSpecialties;
    const s4Recs = getStageRecommendations(4).specialistGuidance.recommendedSpecialties;

    assert.ok(s2Recs.includes('Neuropsychologist'), 'Stage 2 recommends Neuropsychologist');
    assert.ok(
      s4Recs.some((s) => s.toLowerCase().includes('palliative') || s.toLowerCase().includes('allied')),
      'Stage 4 recommends Allied / Supportive care'
    );
  });

  await t.test('Simplified 4-Point Care Recommendations are distinct and match user requirements', async () => {
    const {
      SIMPLIFIED_STAGE_RECOMMENDATIONS,
      getSimplifiedRecommendations,
    } = await import('../../frontend/src/data/stageRecommendations.js');

    const expectedByCategory = {
      NonDemented: {
        stageNumber: 1,
        titles: [
          'Maintain a balanced and nutritious diet.',
          'Perform regular physical activity.',
          'Maintain a consistent sleep routine.',
          'Engage in brain-stimulating and social activities.',
        ],
      },
      VeryMildDemented: {
        stageNumber: 2,
        titles: [
          'Practice simple memory exercises.',
          'Use calendars, reminders, and written notes.',
          'Follow a consistent daily routine.',
          'Consider a professional memory or neurological evaluation.',
        ],
      },
      MildDemented: {
        stageNumber: 3,
        titles: [
          'Get assistance with difficult daily activities when needed.',
          'Practice simple, guided activities.',
          'Encourage family or caregiver involvement.',
          'Maintain regular specialist follow-up.',
        ],
      },
      ModerateDemented: {
        stageNumber: 4,
        titles: [
          'Provide assistance with personal care and daily activities when needed.',
          'Maintain a safe home environment and reduce fall risks.',
          'Encourage caregiver involvement and support.',
          'Obtain specialist-led individualized care planning.',
        ],
      },
    };

    const categories = ['NonDemented', 'VeryMildDemented', 'MildDemented', 'ModerateDemented'];

    // 1. Check each category has exactly 4 recommendations matching exact titles
    for (const cat of categories) {
      const data = SIMPLIFIED_STAGE_RECOMMENDATIONS[cat];
      assert.ok(data, `${cat} must exist in SIMPLIFIED_STAGE_RECOMMENDATIONS`);
      assert.strictEqual(data.stageNumber, expectedByCategory[cat].stageNumber);
      assert.strictEqual(data.recommendations.length, 4, `${cat} must have exactly 4 recommendations`);
      assert.ok(data.whyExplanation, `${cat} must have whyExplanation`);

      const actualTitles = data.recommendations.map((r) => r.title);
      assert.deepStrictEqual(actualTitles, expectedByCategory[cat].titles);

      // Verify each recommendation has id, title, desc, iconName
      for (const rec of data.recommendations) {
        assert.ok(rec.id, 'Must have id');
        assert.ok(rec.title, 'Must have title');
        assert.ok(rec.desc, 'Must have desc');
        assert.ok(rec.iconName, 'Must have iconName');
      }
    }

    // 2. Check all categories are mutually distinct
    const allTitles = categories.flatMap((c) => SIMPLIFIED_STAGE_RECOMMENDATIONS[c].recommendations.map((r) => r.title));
    const uniqueTitles = new Set(allTitles);
    assert.strictEqual(uniqueTitles.size, 16, 'All 16 recommendations across 4 categories must be mutually distinct');

    const allExplanations = categories.map((c) => SIMPLIFIED_STAGE_RECOMMENDATIONS[c].whyExplanation);
    const uniqueExplanations = new Set(allExplanations);
    assert.strictEqual(uniqueExplanations.size, 4, 'All 4 whyExplanations must be distinct');

    // 3. Test getSimplifiedRecommendations resolver
    assert.strictEqual(getSimplifiedRecommendations('NonDemented').stageNumber, 1);
    assert.strictEqual(getSimplifiedRecommendations('VeryMildDemented').stageNumber, 2);
    assert.strictEqual(getSimplifiedRecommendations('MildDemented').stageNumber, 3);
    assert.strictEqual(getSimplifiedRecommendations('ModerateDemented').stageNumber, 4);

    assert.strictEqual(getSimplifiedRecommendations(1).canonicalClass, 'NonDemented');
    assert.strictEqual(getSimplifiedRecommendations(2).canonicalClass, 'VeryMildDemented');
    assert.strictEqual(getSimplifiedRecommendations(3).canonicalClass, 'MildDemented');
    assert.strictEqual(getSimplifiedRecommendations(4).canonicalClass, 'ModerateDemented');

    // Fallbacks
    assert.strictEqual(getSimplifiedRecommendations(null).stageNumber, 1);
    assert.strictEqual(getSimplifiedRecommendations(undefined).stageNumber, 1);
    assert.strictEqual(getSimplifiedRecommendations('UnknownCategory').stageNumber, 1);
  });

  await t.test('Diet & Nutrition: All four stage nutrition profiles have distinct Indian meal sets with ingredients', () => {
    const courses = ['breakfast', 'lunch', 'snack', 'dinner'];
    const overviews = [];

    for (let s = 1; s <= 4; s++) {
      const nutrition = STAGE_RECOMMENDATIONS[s].nutrition;
      assert.ok(nutrition, `Stage ${s} must have nutrition object`);
      assert.ok(nutrition.overview, `Stage ${s} must have overview`);
      overviews.push(nutrition.overview);

      // Verify each course has meals and every meal has non-empty ingredients
      for (const course of courses) {
        const mealList = nutrition.meals[course];
        assert.ok(Array.isArray(mealList), `Stage ${s} ${course} must be array`);
        assert.ok(mealList.length >= 3, `Stage ${s} ${course} must have at least 3 meals`);

        for (const meal of mealList) {
          assert.ok(meal.name, `Stage ${s} meal must have name`);
          assert.ok(meal.desc, `Stage ${s} meal must have desc`);
          assert.ok(['Vegetarian', 'Non-Vegetarian', 'Vegan'].includes(meal.diet), `Stage ${s} meal must have valid diet`);
          assert.ok(Array.isArray(meal.ingredients), `Stage ${s} meal ${meal.name} must have ingredients array`);
          assert.ok(meal.ingredients.length > 0, `Stage ${s} meal ${meal.name} must have non-empty ingredients`);
          assert.ok(Array.isArray(meal.allergens), `Stage ${s} meal must have allergens array`);
        }
      }
    }

    // Overviews must be mutually distinct across all 4 stages
    const uniqueOverviews = new Set(overviews);
    assert.strictEqual(uniqueOverviews.size, 4, 'All four stage nutrition overviews must be mutually distinct');
  });

  await t.test('Diet & Nutrition: Stage 4 strictly avoids blanket pureed, liquid, or feeding tube mandates', () => {
    const s4Nutrition = STAGE_RECOMMENDATIONS[4].nutrition;
    const allS4Text = JSON.stringify(s4Nutrition).toLowerCase();

    // Must NOT mandate pureed or liquid diet or feeding tubes
    assert.ok(
      allS4Text.includes('never automatically recommend pureed food') ||
      allS4Text.includes('never impose blanket pureed diets'),
      'Stage 4 must explicitly forbid automatic pureed diet mandates'
    );

    // Meals in Stage 4 must feature familiar, normal home-cooked meals
    const lunchNames = s4Nutrition.meals.lunch.map((m) => m.name.toLowerCase());
    assert.ok(lunchNames.some((n) => n.includes('khichdi')), 'Stage 4 lunch includes familiar khichdi');
    assert.ok(lunchNames.some((n) => n.includes('rice')), 'Stage 4 lunch includes familiar rice');
  });

  await t.test('Diet & Nutrition: Ingredient-level allergen filtering handles aliases and incomplete ingredients', () => {
    // 1. Alias test: Dairy matches paneer and ghee
    const mealWithPaneer = {
      name: 'Paneer Sabzi',
      diet: 'Vegetarian',
      ingredients: ['paneer', 'tomatoes', 'spices'],
      allergens: [],
    };
    const dairyCheck = checkMealSafety(mealWithPaneer, { allergies: ['Dairy'] });
    assert.strictEqual(dairyCheck.isAllergenSafe, false, 'Paneer must trigger dairy allergy');
    assert.ok(dairyCheck.matchedAllergens.includes('Dairy'));

    // 2. Alias test: Gluten matches atta, suji, semolina
    const mealWithSuji = {
      name: 'Rava Upma',
      diet: 'Vegetarian',
      ingredients: ['semolina', 'peas', 'mustard seeds'],
      allergens: [],
    };
    const glutenCheck = checkMealSafety(mealWithSuji, { allergies: ['Gluten'] });
    assert.strictEqual(glutenCheck.isAllergenSafe, false, 'Semolina must trigger gluten allergy');
    assert.ok(glutenCheck.matchedAllergens.includes('Gluten'));

    // 3. Incomplete ingredient information is NEVER labelled safe when allergies are specified
    const mealWithIncompleteInfo = {
      name: 'Mystery Dish',
      diet: 'Vegetarian',
      ingredients: [], // Empty/unknown
      allergens: [],
    };
    const incompleteCheck = checkMealSafety(mealWithIncompleteInfo, { allergies: ['Nuts'] });
    assert.strictEqual(incompleteCheck.isAllergenSafe, false, 'Incomplete ingredients must not be marked safe');
    assert.strictEqual(incompleteCheck.hasIncompleteIngredients, true);

    // 4. Incomplete ingredient information is acceptable if user has NO allergies
    const noAllergyCheck = checkMealSafety(mealWithIncompleteInfo, { allergies: [] });
    assert.strictEqual(noAllergyCheck.isAllergenSafe, true, 'No allergies means no allergen conflict');
  });

  await t.test('Diet & Nutrition: Dietary pattern filtering strictly enforces Vegan and Vegetarian rules', () => {
    const honeyDish = {
      name: 'Fruit Salad with Honey',
      diet: 'Vegetarian',
      ingredients: ['apple', 'banana', 'honey'],
      allergens: [],
    };
    const curdDish = {
      name: 'Plain Curd',
      diet: 'Vegetarian',
      ingredients: ['curd', 'milk'],
      allergens: ['Dairy'],
    };
    const eggDish = {
      name: 'Boiled Egg Whites',
      diet: 'Non-Vegetarian',
      ingredients: ['egg whites'],
      allergens: ['Eggs'],
    };
    const fishDish = {
      name: 'Steamed Fish',
      diet: 'Non-Vegetarian',
      ingredients: ['fish fillet'],
      allergens: ['Seafood'],
    };

    // Vegan excludes honey, dairy, eggs, fish
    assert.strictEqual(checkMealSafety(honeyDish, { dietType: 'Vegan' }).isDietMatch, false, 'Vegan excludes honey');
    assert.strictEqual(checkMealSafety(curdDish, { dietType: 'Vegan' }).isDietMatch, false, 'Vegan excludes dairy');
    assert.strictEqual(checkMealSafety(eggDish, { dietType: 'Vegan' }).isDietMatch, false, 'Vegan excludes eggs');
    assert.strictEqual(checkMealSafety(fishDish, { dietType: 'Vegan' }).isDietMatch, false, 'Vegan excludes fish');

    // Vegetarian without eggs excludes eggs and fish, allows dairy
    assert.strictEqual(checkMealSafety(fishDish, { dietType: 'Vegetarian', includeEggs: false }).isDietMatch, false);
    assert.strictEqual(checkMealSafety(eggDish, { dietType: 'Vegetarian', includeEggs: false }).isDietMatch, false);
    assert.strictEqual(checkMealSafety(curdDish, { dietType: 'Vegetarian', includeEggs: false }).isDietMatch, true);

    // Vegetarian with eggs allows eggs, excludes fish
    assert.strictEqual(checkMealSafety(eggDish, { dietType: 'Vegetarian', includeEggs: true }).isDietMatch, true);
    assert.strictEqual(checkMealSafety(fishDish, { dietType: 'Vegetarian', includeEggs: true }).isDietMatch, false);

    // Non-Vegetarian allows all
    assert.strictEqual(checkMealSafety(fishDish, { dietType: 'Non-Vegetarian' }).isDietMatch, true);
    assert.strictEqual(checkMealSafety(curdDish, { dietType: 'Non-Vegetarian' }).isDietMatch, true);
  });

  await t.test('Diet & Nutrition: Dynamic 7-Day Meal Planner provides variety and handles heavy restrictions', () => {
    // Normal Stage 1 planner
    const plan = generateWeeklyMealPlan(1, { dietType: 'Vegetarian' });
    assert.strictEqual(plan.length, 7, 'Planner must produce 7 days');
    assert.ok(plan[0].breakfast.text, 'Must have breakfast text');
    assert.ok(plan[0].lunch.text, 'Must have lunch text');
    assert.ok(plan[0].snack.text, 'Must have snack text');
    assert.ok(plan[0].dinner.text, 'Must have dinner text');

    // Heavy restriction test: Vegan + allergic to almost everything -> graceful explanation instead of unsafe food
    const impossiblePlan = generateWeeklyMealPlan(1, {
      dietType: 'Vegan',
      allergies: ['Gluten', 'Nuts', 'Soy', 'Dairy', 'Eggs', 'Seafood', 'Rice'],
    });
    assert.strictEqual(impossiblePlan.length, 7);
    // At least one course should indicate insufficient safe options
    const hasExplanatoryNotice = impossiblePlan.some((d) =>
      d.breakfast.isUnavailable || d.lunch.isUnavailable || d.snack.isUnavailable || d.dinner.isUnavailable
    );
    assert.ok(hasExplanatoryNotice, 'Must explain insufficient safe meals rather than showing unsafe food');
  });

  await t.test('Diet & Nutrition: Hydration guidance is individualized and respects clinical fluid restrictions', () => {
    for (let s = 1; s <= 4; s++) {
      const hydration = STAGE_RECOMMENDATIONS[s].nutrition.hydration;
      assert.ok(hydration, `Stage ${s} must have hydration object`);
      assert.ok(hydration.dailyTarget.toLowerCase().includes('individualized'), `Stage ${s} must state individualized target`);
      assert.ok(
        hydration.tip.toLowerCase().includes('restriction') || hydration.tip.toLowerCase().includes('clinician'),
        `Stage ${s} hydration must advise respecting clinician fluid restrictions`
      );
    }
  });

  await t.test('Diet & Nutrition: Food Categories Guide provides 6 categories and adapts to dietary preferences', () => {
    assert.strictEqual(FOOD_CATEGORIES.length, 6, 'Must have exactly 6 food categories');
    const categoryNames = FOOD_CATEGORIES.map((c) => c.category);
    assert.deepStrictEqual(categoryNames, [
      'Fruits',
      'Vegetables',
      'Whole Grains',
      'Protein Sources',
      'Nuts & Seeds',
      'Dairy & Alternatives',
    ]);

    // Adaptation: Vegan filter on Dairy & Alternatives
    const veganGuide = filterFoodCategories(FOOD_CATEGORIES, { dietType: 'Vegan' });
    const dairyCat = veganGuide.find((c) => c.category === 'Dairy & Alternatives');
    assert.ok(dairyCat.extraNote.includes('Plant-based focus'), 'Vegan guide emphasizes plant milks');

    // Adaptation: Nut allergy on Nuts & Seeds
    const nutAllergyGuide = filterFoodCategories(FOOD_CATEGORIES, { allergies: ['Nuts'] });
    const nutCat = nutAllergyGuide.find((c) => c.category === 'Nuts & Seeds');
    assert.ok(nutCat.extraNote.includes('Active Nut Allergy'), 'Nut allergy guide advises safe seeds');
  });
});

