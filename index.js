const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const db = require('./db');

const app = express();
app.use(require("express").static(require("path").join(__dirname, "public")));
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'AthleteFlow API is running', timestamp: new Date().toISOString() });
});

// DAILY PLAN GENERATION
app.post('/api/daily-plan', (req, res) => {
  const { activityType, energyLevel, date } = req.body;
  
  // Calculate calorie targets based on activity
  const baseCalories = 1800;
  const activityMultipliers = {
    'muay-thai': 1.3,
    'running': 1.25,
    'soccer': 1.3,
    'strength': 1.15,
    'rest': 0.9
  };
  
  const calorieTarget = Math.round(baseCalories * (activityMultipliers[activityType] || 1.0));
  const proteinTarget = Math.round(calorieTarget * 0.25 / 4); // 25% of calories from protein
  
  // Energy level adjustments
  const energyAdjustment = energyLevel === 'low' ? -100 : energyLevel === 'high' ? 50 : 0;
  const adjustedCalories = calorieTarget + energyAdjustment;
  
  const dailyPlan = {
    date: date || new Date().toISOString().split('T')[0],
    activityType,
    energyLevel,
    calorieTarget: adjustedCalories,
    proteinTarget,
    hydrationTarget: activityType === 'rest' ? 2500 : 3000,
    recommendations: generateRecommendations(activityType, energyLevel),
    meals: generateMealPlan(adjustedCalories, proteinTarget)
  };
  
  const savedPlan = db.insert('dailyPlans', dailyPlan);
  res.json(savedPlan);
});

// GET TODAY'S PLAN
app.get('/api/daily-plan/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const plans = db.getAll('dailyPlans');
  const todayPlan = plans.find(plan => plan.date === today);
  
  if (todayPlan) {
    res.json(todayPlan);
  } else {
    // Generate default plan
    const defaultPlan = {
      date: today,
      activityType: 'muay-thai',
      energyLevel: 'medium',
      calorieTarget: 2000,
      proteinTarget: 125,
      hydrationTarget: 3000,
      recommendations: generateRecommendations('muay-thai', 'medium'),
      meals: generateMealPlan(2000, 125)
    };
    
    const savedPlan = db.insert('dailyPlans', defaultPlan);
    res.json(savedPlan);
  }
});

// MEAL MANAGEMENT
app.get('/api/meals/suggestions', (req, res) => {
  const { type, calories, protein } = req.query;
  const suggestions = getMealSuggestions(type, parseInt(calories), parseInt(protein));
  res.json(suggestions);
});

app.post('/api/meals/log', (req, res) => {
  const meal = db.insert('meals', req.body);
  res.json(meal);
});

// WORKOUT MANAGEMENT
app.get('/api/workouts/strength', (req, res) => {
  const strengthWorkout = {
    name: '10-Minute Strength Circuit',
    duration: 10,
    exercises: [
      { name: 'Sumo Squats', reps: '12-15', sets: 2 },
      { name: 'Side Lunges', reps: '10 each side', sets: 2 },
      { name: 'Romanian Deadlifts', reps: '12-15', sets: 2 },
      { name: 'Bent-over Rows', reps: '12-15', sets: 2 },
      { name: 'Tibialis Raises', reps: '15-20', sets: 2 },
      { name: 'Reverse Crunches', reps: '15-20', sets: 2 }
    ],
    restBetweenSets: '30-45 seconds',
    focus: ['Lower body strength', 'Core stability', 'Posture improvement']
  };
  
  res.json(strengthWorkout);
});

app.post('/api/workouts/log', (req, res) => {
  const workout = db.insert('workouts', req.body);
  res.json(workout);
});

// GUT HEALTH TRACKING
app.post('/api/gut-health/log', (req, res) => {
  const { bloatingLevel, constipation, triggerFoods, notes } = req.body;
  
  const gutEntry = {
    date: new Date().toISOString().split('T')[0],
    bloatingLevel,
    constipation,
    triggerFoods: triggerFoods || [],
    notes,
    recommendations: getGutHealthRecommendations(bloatingLevel, constipation)
  };
  
  const saved = db.insert('gutHealth', gutEntry);
  res.json(saved);
});

app.get('/api/gut-health/recent', (req, res) => {
  const entries = db.getAll('gutHealth')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 7);
  res.json(entries);
});

// PROGRESS TRACKING
app.post('/api/progress/log', (req, res) => {
  const progress = db.insert('progress', req.body);
  res.json(progress);
});

app.get('/api/progress/recent', (req, res) => {
  const entries = db.getAll('progress')
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);
  res.json(entries);
});

// FOOD INTELLIGENCE
app.get('/api/foods/analyze/:foodName', (req, res) => {
  const { foodName } = req.params;
  const analysis = analyzeFoodIntelligence(foodName);
  res.json(analysis);
});

// Helper functions
function generateRecommendations(activityType, energyLevel) {
  const recommendations = [];
  
  if (activityType === 'muay-thai') {
    recommendations.push('Pre-workout: banana + almond butter 1hr before');
    recommendations.push('Post-workout: protein shake within 30min');
    recommendations.push('Focus on anti-inflammatory foods today');
  }
  
  if (energyLevel === 'low') {
    recommendations.push('Prioritize sleep - aim for 8+ hours tonight');
    recommendations.push('Consider light movement instead of intense training');
    recommendations.push('Add extra magnesium and B-vitamins');
  }
  
  if (activityType === 'rest') {
    recommendations.push('Perfect day for meal prep');
    recommendations.push('Focus on gut-healing foods');
    recommendations.push('Gentle yoga or stretching recommended');
  }
  
  return recommendations;
}

function generateMealPlan(calories, protein) {
  const breakfastCals = Math.round(calories * 0.25);
  const lunchCals = Math.round(calories * 0.35);
  const dinnerCals = Math.round(calories * 0.3);
  const snackCals = calories - breakfastCals - lunchCals - dinnerCals;
  
  return {
    breakfast: {
      calories: breakfastCals,
      protein: Math.round(protein * 0.3),
      suggestions: [
        'Greek yogurt parfait with berries and granola',
        'Scrambled eggs with spinach and avocado toast',
        'Protein smoothie with banana and almond butter'
      ]
    },
    lunch: {
      calories: lunchCals,
      protein: Math.round(protein * 0.4),
      note: 'Import from Uber Cafe menu',
      suggestions: [
        'Grilled chicken salad with quinoa',
        'Turkey and hummus wrap with vegetables',
        'Salmon bowl with brown rice and vegetables'
      ]
    },
    dinner: {
      calories: dinnerCals,
      protein: Math.round(protein * 0.25),
      suggestions: [
        'Grilled fish with roasted vegetables',
        'Turkey meatballs with zucchini noodles',
        'Chicken stir-fry with broccoli and bell peppers'
      ]
    },
    snack: {
      calories: snackCals,
      protein: Math.round(protein * 0.05),
      suggestions: [
        'Apple with almond butter',
        'Greek yogurt with cucumber',
        'Handful of nuts and berries'
      ]
    }
  };
}

function getMealSuggestions(type, calories, protein) {
  const gutFriendlyOptions = {
    breakfast: [
      'Overnight oats with chia seeds and berries',
      'Scrambled eggs with sautéed spinach',
      'Green smoothie with ginger and mint'
    ],
    lunch: [
      'Quinoa Buddha bowl with grilled chicken',
      'Turkey lettuce wraps with avocado',
      'Lentil soup with side salad'
    ],
    dinner: [
      'Baked salmon with roasted sweet potato',
      'Ground turkey with cauliflower rice',
      'Grilled chicken with steamed broccoli'
    ]
  };
  
  return gutFriendlyOptions[type] || [];
}

function getGutHealthRecommendations(bloatingLevel, constipation) {
  const recommendations = [];
  
  if (bloatingLevel > 6) {
    recommendations.push('Avoid dairy and gluten today');
    recommendations.push('Drink peppermint tea after meals');
    recommendations.push('Take a probiotic supplement');
  }
  
  if (constipation) {
    recommendations.push('Increase fiber intake gradually');
    recommendations.push('Drink extra water (aim for 3L+)');
    recommendations.push('Add ground flaxseed to meals');
  }
  
  if (bloatingLevel > 7 && constipation) {
    recommendations.push('Consider a 3-day gut reset protocol');
    recommendations.push('Eliminate processed foods completely');
    recommendations.push('Focus on cooked vegetables over raw');
  }
  
  return recommendations;
}

function analyzeFoodIntelligence(foodName) {
  const food = foodName.toLowerCase();
  
  // Simple food classification
  const analysis = {
    name: foodName,
    fatLossFriendly: 'medium',
    bloatRisk: 'low',
    proteinDensity: 'low',
    athleteFriendly: 'medium',
    flags: []
  };
  
  // High protein foods
  if (['chicken', 'fish', 'salmon', 'eggs', 'turkey', 'tofu'].some(protein => food.includes(protein))) {
    analysis.proteinDensity = 'high';
    analysis.fatLossFriendly = 'high';
    analysis.athleteFriendly = 'high';
  }
  
  // Bloat risk foods
  if (['beans', 'broccoli', 'cauliflower', 'cabbage'].some(bloaty => food.includes(bloaty))) {
    analysis.bloatRisk = 'medium';
  }
  
  if (['milk', 'cheese', 'cream', 'yogurt'].some(dairy => food.includes(dairy))) {
    analysis.flags.push('dairy sensitivity risk');
  }
  
  if (['pizza', 'chips', 'cookies', 'candy'].some(processed => food.includes(processed))) {
    analysis.flags.push('ultra-processed');
    analysis.fatLossFriendly = 'low';
  }
  
  return analysis;
}

// Schedule daily plan generation
cron.schedule('0 6 * * *', () => {
  console.log('Running daily plan generation...');
  // Auto-generate plans for active users
});

app.listen(PORT, () => {
  console.log(`AthleteFlow API server running on port ${PORT}`);
});