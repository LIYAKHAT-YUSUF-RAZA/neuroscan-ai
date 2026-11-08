import React, { useState } from 'react';
import {
  Utensils,
  Droplet,
  Apple,
  Moon,
  Sun,
  Printer,
  Sliders,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  Info,
  Filter,
} from 'lucide-react';
import WhyRecommendationCallout from './WhyRecommendationCallout';
import {
  getStageRecommendations,
  filterNutritionByPreferences,
} from '../data/stageRecommendations';
import {
  generateWeeklyMealPlan,
  filterFoodCategories,
} from '../data/nutritionContent';
import { useLanguage } from '../context/LanguageContext';

export default function NutritionRecommendations({
  prediction,
  preferences,
  onOpenPreferences,
}) {
  const { t, translateStage } = useLanguage();
  const [activeTab, setActiveTab] = useState('suggestions'); // 'suggestions', 'planner', 'categories'
  const [strictFilter, setStrictFilter] = useState(true);

  const stageNumber = prediction?.stageNumber || 1;
  const stageRecs = getStageRecommendations(stageNumber);

  // Apply patient dietary preferences (dietType, includeEggs, allergies)
  const nutrition = filterNutritionByPreferences(
    stageRecs.nutrition,
    preferences,
    { strict: strictFilter }
  );

  // Generate 7-day plan dynamically matching preferences
  const weeklyPlan = generateWeeklyMealPlan(
    stageNumber,
    preferences
  );

  // Dynamically adapt food categories guide for active preferences
  const adaptedFoodCategories = filterFoodCategories(
    undefined,
    preferences
  );

  const handlePrint = () => {
    window.print();
  };

  const hasActiveFilters =
    preferences &&
    preferences.dietType &&
    preferences.dietType !== 'All' ||
    (preferences.allergies && preferences.allergies.length > 0) ||
    preferences.includeEggs;

  return (
    <div
      className="panel"
      id="diet-nutrition"
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
              <Utensils size={18} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {t('wellness.nutrition_title')}
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
            {nutrition.overview}
          </p>
        </div>

        {/* Tab & Preferences & Print Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {onOpenPreferences && (
            <button
              type="button"
              onClick={onOpenPreferences}
              className="btn-secondary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', gap: '0.4rem' }}
            >
              <Sliders size={15} style={{ color: 'var(--primary)' }} />
              <span>{t('wellness.nutrition_btn_prefs')}</span>
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
              onClick={() => setActiveTab('suggestions')}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'suggestions' ? '700' : '500',
                borderRadius: 'var(--radius-xs)',
                border: activeTab === 'suggestions' ? '1px solid var(--border)' : 'none',
                backgroundColor: activeTab === 'suggestions' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'suggestions' ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {t('wellness.nutrition_tab_meals')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('planner')}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'planner' ? '700' : '500',
                borderRadius: 'var(--radius-xs)',
                border: activeTab === 'planner' ? '1px solid var(--border)' : 'none',
                backgroundColor: activeTab === 'planner' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'planner' ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {t('wellness.nutrition_tab_planner')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('categories')}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.85rem',
                fontWeight: activeTab === 'categories' ? '700' : '500',
                borderRadius: 'var(--radius-xs)',
                border: activeTab === 'categories' ? '1px solid var(--border)' : 'none',
                backgroundColor: activeTab === 'categories' ? 'var(--bg-surface)' : 'transparent',
                color: activeTab === 'categories' ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {t('wellness.nutrition_tab_guide')}
            </button>
          </div>

          <button
            type="button"
            onClick={handlePrint}
            className="btn-secondary"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.88rem', gap: '0.35rem' }}
            title={t('common.print')}
          >
            <Printer size={15} />
            <span>{t('common.print')}</span>
          </button>
        </div>
      </div>

      {/* "Why this recommendation?" Callout */}
      <WhyRecommendationCallout stageNumber={stageRecs.stageNumber} moduleType="nutrition" />

      {/* Clinical Notice on Eating Support & Swallowing Safeguard */}
      {(stageNumber === 3 || stageNumber === 4) && (
        <div
          role="note"
          style={{
            padding: '0.85rem 1.15rem',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderLeft: '4px solid var(--stage-3)',
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.9rem',
            color: 'var(--text-primary)',
            lineHeight: '1.5',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem',
          }}
        >
          <AlertCircle size={18} style={{ color: 'var(--stage-3)', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Individualized Nutrition Safeguard: </strong>
            Suggested meals are familiar, home-cooked foods tailored for calm, supportive eating. We do not automatically assume swallowing difficulties or mandate pureed diets. Only if persistent coughing during meals, swallowing difficulty (dysphagia), or choking is clinically observed should a formal evaluation by a speech-language pathologist or physician be requested before altering food textures.
          </div>
        </div>
      )}

      {/* Active Filter Bar & Strict Filtering Toggle */}
      {hasActiveFilters && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius)',
            fontSize: '0.88rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Filter size={15} style={{ color: 'var(--primary)' }} />
            <span>
              Dietary filter: <strong style={{ color: 'var(--text-primary)' }}>{preferences.dietType || 'All'}</strong>
              {preferences.dietType === 'Vegetarian' && preferences.includeEggs && ' (Eggetarian)'}
              {preferences.allergies?.length > 0 && ` • Excluded allergens: ${preferences.allergies.join(', ')}`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                fontSize: '0.86rem',
                color: strictFilter ? 'var(--primary)' : 'var(--text-muted)',
                fontWeight: strictFilter ? '600' : '400',
              }}
            >
              <input
                type="checkbox"
                checked={strictFilter}
                onChange={(e) => setStrictFilter(e.target.checked)}
                style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span>Strict Safe-Only View</span>
            </label>

            <button
              type="button"
              onClick={onOpenPreferences}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                cursor: 'pointer',
                fontSize: '0.86rem',
                padding: 0,
                textDecoration: 'underline',
                fontWeight: '600',
              }}
            >
              Edit Preferences
            </button>
          </div>
        </div>
      )}

      {/* Tab 1: Stage-Specific Meal Ideas */}
      {activeTab === 'suggestions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Hydration Guidance Bar */}
          <div
            style={{
              padding: '0.85rem 1.15rem',
              backgroundColor: 'var(--primary-light)',
              border: '1px solid var(--primary-border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}
          >
            <Droplet size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
              <strong style={{ color: 'var(--primary)' }}>Hydration Target: </strong>
              <strong>{nutrition.hydration.dailyTarget}</strong> — <em>{nutrition.hydration.tip}</em>
            </div>
          </div>

          {/* Meal Courses Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {['breakfast', 'lunch', 'snack', 'dinner'].map((course) => {
              const items = nutrition.meals[course] || [];
              const icons = {
                breakfast: Sun,
                lunch: Utensils,
                snack: Apple,
                dinner: Moon,
              };
              const CourseIcon = icons[course];

              return (
                <div
                  key={course}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem',
                    boxShadow: 'var(--shadow-xs)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CourseIcon size={18} style={{ color: 'var(--primary)' }} />
                      <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, textTransform: 'capitalize' }}>
                        {course} Ideas
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {items.length} {items.length === 1 ? 'option' : 'options'}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <div
                      style={{
                        padding: '1rem',
                        backgroundColor: 'var(--stage-4-bg)',
                        border: '1px dashed var(--stage-4-border)',
                        borderRadius: 'var(--radius-xs)',
                        fontSize: '0.86rem',
                        color: 'var(--stage-4)',
                        lineHeight: '1.45',
                      }}
                    >
                      No {course} options match all active dietary restrictions ({preferences.dietType || 'Current Diet'}, {preferences.allergies?.join(', ') || 'Allergies'}). Please consult a clinical dietitian for personalized allergen-free alternatives.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {items.map((meal, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '0.85rem',
                            backgroundColor: 'var(--bg-surface-subtle)',
                            borderRadius: 'var(--radius-xs)',
                            border: meal.hasAllergenWarning
                              ? '1px solid var(--stage-4-border)'
                              : !meal.isDietMatch
                              ? '1px dashed var(--border)'
                              : '1px solid var(--border)',
                            opacity: !meal.isDietMatch ? 0.6 : 1,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.94rem', color: 'var(--text-primary)' }}>
                              {meal.name}
                            </strong>
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.76rem',
                                backgroundColor: meal.diet === 'Vegetarian' || meal.diet === 'Vegan' ? 'var(--stage-1-bg)' : 'var(--bg-surface)',
                                color: meal.diet === 'Vegetarian' || meal.diet === 'Vegan' ? 'var(--stage-1)' : 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {meal.diet}
                            </span>
                          </div>

                          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: '0.35rem 0', lineHeight: '1.45' }}>
                            {meal.desc}
                          </p>

                          {/* Ingredient List */}
                          {meal.ingredients && meal.ingredients.length > 0 && (
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                              <strong style={{ color: 'var(--text-secondary)' }}>Ingredients: </strong>
                              {meal.ingredients.join(', ')}
                            </div>
                          )}

                          {/* Allergen Warning Flag */}
                          {meal.hasAllergenWarning && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                marginTop: '0.45rem',
                                fontSize: '0.82rem',
                                color: 'var(--stage-4)',
                              }}
                            >
                              <AlertTriangle size={14} style={{ color: 'var(--stage-4)', flexShrink: 0 }} />
                              <span>{meal.warningText || `Contains excluded allergen: ${meal.matchedAllergens.join(', ')}`}</span>
                            </div>
                          )}

                          {/* Incomplete Ingredients Alert */}
                          {meal.hasIncompleteIngredients && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                marginTop: '0.45rem',
                                fontSize: '0.82rem',
                                color: 'var(--stage-3)',
                              }}
                            >
                              <AlertCircle size={14} style={{ color: 'var(--stage-3)', flexShrink: 0 }} />
                              <span>Incomplete ingredient info — cannot guarantee allergen safety</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stage Dietitian Advisory */}
          <div
            style={{
              padding: '0.85rem 1.15rem',
              backgroundColor: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5',
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>Dietitian Consultation Guidance: </strong>
            {nutrition.dietitianNote}
          </div>
        </div>
      )}

      {/* Tab 2: 7-Day Educational Planner */}
      {activeTab === 'planner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              Personalized 7-day Indian meal schedule generated dynamically for <strong style={{ color: 'var(--text-primary)' }}>Stage {stageRecs.stageNumber} ({stageRecs.displayLabel})</strong>.
            </div>
            {hasActiveFilters && (
              <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary-border)', fontSize: '0.78rem' }}>
                Strict dietary & allergy exclusions applied
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {weeklyPlan.map((dayPlan, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.55rem',
                  boxShadow: 'var(--shadow-xs)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '0.35rem' }}>
                  <strong style={{ fontSize: '0.94rem', color: 'var(--primary)' }}>
                    {dayPlan.day}
                  </strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>MIND/Med Plan</span>
                </div>

                <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Breakfast: </strong>
                  <span>{dayPlan.breakfast.text}</span>
                </div>

                <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Lunch: </strong>
                  <span>{dayPlan.lunch.text}</span>
                </div>

                <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Snack: </strong>
                  <span>{dayPlan.snack.text}</span>
                </div>

                <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Dinner: </strong>
                  <span>{dayPlan.dinner.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Food Categories Guide */}
      {activeTab === 'categories' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Evidence-based whole food guide across 6 essential categories, dynamically filtered for your dietary preferences.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {adaptedFoodCategories.map((cat, idx) => (
              <div
                key={idx}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                    {cat.category}
                  </h3>
                  <span className="badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary-border)', fontSize: '0.78rem' }}>
                    {cat.serving}
                  </span>
                </div>

                <div style={{ fontSize: '0.86rem', color: 'var(--primary)', lineHeight: '1.45' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>Examples: </strong>
                  {cat.examples}
                </div>

                <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>
                  {cat.benefit}
                </p>

                {cat.extraNote && (
                  <div
                    style={{
                      padding: '0.45rem 0.65rem',
                      backgroundColor: 'var(--primary-light)',
                      borderRadius: 'var(--radius-xs)',
                      fontSize: '0.82rem',
                      color: 'var(--primary)',
                      lineHeight: '1.4',
                      marginTop: '0.25rem',
                    }}
                  >
                    {cat.extraNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
