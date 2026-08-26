// Nutrition calculations, RDA targets, and Tolerable Upper Intake Limits (UL)

// Tolerable Upper Intake Levels (UL) - Scientific toxicity limits
export const TolerableUpperLimits = {
  calcium_mg: 2500,       // UL: 2500mg
  iron_mg: 45,            // UL: 45mg
  sodium_mg: 2300,        // Daily recommended limit
  zinc_mg: 40,            // UL: 40mg
  vitamin_a_ug: 3000,     // UL: 3000ug (retinol equivalent)
  vitamin_c_mg: 2000,     // UL: 2000mg
  vitamin_d_ug: 100,      // UL: 100ug (4000 IU)
  vitamin_e_mg: 1000,     // UL: 1000mg
  vitamin_b3_mg: 35,      // UL: 35mg (from supplements/fortification)
  vitamin_b6_mg: 100,     // UL: 100mg
  folate_b9_ug: 1000,     // UL: 1000ug (synthetic folic acid)
  magnesium_mg: 700,      // UL: 350mg for supplementary, set to 700mg for total dietary + supplement
  selenium_ug: 400,       // UL: 400ug
  copper_mg: 10,          // UL: 10mg
  manganese_mg: 11,       // UL: 11mg
  iodine_ug: 1100,        // UL: 1100ug
  phosphorus_mg: 4000     // UL: 4000mg
};

// Standard RDA targets for Micro nutrients (adjusted by gender if needed)
export const getMicroTargets = (gender = 'male') => {
  const isMale = gender.toLowerCase() === 'male';
  return {
    calcium_mg: 1000,
    iron_mg: isMale ? 8 : 18,
    sodium_mg: 2300,
    potassium_mg: isMale ? 3400 : 2600,
    vitamin_a_ug: isMale ? 900 : 700,
    vitamin_c_mg: isMale ? 90 : 75,
    vitamin_d_ug: 15,
    vitamin_e_mg: 15,
    vitamin_k_ug: isMale ? 120 : 90,
    vitamin_b1_mg: isMale ? 1.2 : 1.1,
    vitamin_b2_mg: isMale ? 1.3 : 1.1,
    vitamin_b3_mg: isMale ? 16 : 14,
    vitamin_b5_mg: 5,
    vitamin_b6_mg: 1.3,
    vitamin_b12_ug: 2.4,
    folate_b9_ug: 400,
    biotin_b7_ug: 30,
    choline_mg: isMale ? 550 : 425,
    magnesium_mg: isMale ? 400 : 310,
    zinc_mg: isMale ? 11 : 8,
    selenium_ug: 55,
    copper_mg: 0.9,
    manganese_mg: isMale ? 2.3 : 1.8,
    phosphorus_mg: 700,
    iodine_ug: 150,
    water_ml: isMale ? 3700 : 2700,
    dietary_fiber_g: isMale ? 38 : 25,
    chromium_ug: isMale ? 35 : 25,
    molybdenum_ug: 45,
    added_sugars_g: isMale ? 36 : 25,
    total_sugars_g: 50,
    saturated_fat_g: 22,
    trans_fat_g: 2,
    cholesterol_mg: 300
  };
};

// Calculate BMR, TDEE, and Target Macros
export const calculateTargets = (profile) => {
  const { age, height, weight, gender, activity_level, goal } = profile;
  
  let bmr = 0;
  if (gender === 'male') {
    bmr = 10 * weight + 6.25 * height - 5 * age + 5;
  } else {
    bmr = 10 * weight + 6.25 * height - 5 * age - 161;
  }

  const activityFactors = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725
  };
  const factor = activityFactors[activity_level] || 1.2;
  const tdee = bmr * factor;

  let calories_kcal = tdee;
  if (goal === 'lose') {
    calories_kcal = Math.max(1200, tdee - 500);
  } else if (goal === 'gain') {
    calories_kcal = tdee + 500;
  }
  calories_kcal = Math.round(calories_kcal);

  const protein_g = Math.round(weight * 2.0);
  const fat_g = Math.round((calories_kcal * 0.25) / 9);
  const proteinCalories = protein_g * 4;
  const fatCalories = fat_g * 9;
  const carbs_g = Math.round(Math.max(50, (calories_kcal - proteinCalories - fatCalories) / 4));

  const micros = getMicroTargets(gender);

  return {
    calories_kcal,
    protein_g,
    carbohydrates_g: carbs_g,
    fat_g,
    ...micros
  };
};

// Scientific Color coding logic based on actual value vs. targets and Upper Limits (UL)
export const getColorCode = (key, value, target) => {
  if (!target) return { color: 'var(--text-primary)', label: 'Normal', class: '' };

  // 1. Limit nutrients where LESS is better (Sugars, Saturated Fat, Trans Fat, Cholesterol)
  const isLimitNutrient = ['added_sugars_g', 'total_sugars_g', 'saturated_fat_g', 'trans_fat_g', 'cholesterol_mg'].includes(key);

  if (isLimitNutrient) {
    if (value <= target) {
      return {
        color: 'var(--color-green)',
        label: 'Perfect',
        class: 'status-green'
      };
    } else if (value <= target * 1.5) {
      return {
        color: 'var(--color-orange)',
        label: 'High but OK',
        class: 'status-orange'
      };
    } else {
      return {
        color: 'var(--color-red)',
        label: 'Dangerously High',
        class: 'status-red'
      };
    }
  }

  // 2. Special Limit Mineral: Sodium
  if (key === 'sodium_mg') {
    if (value <= 2300) {
      return {
        color: 'var(--color-green)',
        label: 'Perfect',
        class: 'status-green'
      };
    } else if (value <= 3450) { // Up to 150% of RDA limit
      return {
        color: 'var(--color-orange)',
        label: 'High but OK',
        class: 'status-orange'
      };
    } else {
      return {
        color: 'var(--color-red)',
        label: 'Dangerously High',
        class: 'status-red'
      };
    }
  }

  // 3. RDA-based Essential nutrients (Macros & Micros)
  const percentage = Math.round((value / target) * 100);
  const ul = TolerableUpperLimits[key];

  if (ul) {
    // If we exceed the tolerable upper limit, it is scientifically dangerously high
    if (value > ul) {
      return {
        color: 'var(--color-red)',
        label: 'Dangerously High',
        class: 'status-red'
      };
    }
    // If we are above RDA target and below UL, it is a perfect safe range
    if (value >= target) {
      return {
        color: 'var(--color-green)',
        label: 'Perfect',
        class: 'status-green'
      };
    }
  } else {
    // No toxicity limit is established for this nutrient (e.g. Water, Vitamin B12, Potassium, etc.)
    // Staying above RDA is perfect
    if (value >= target) {
      return {
        color: 'var(--color-green)',
        label: 'Perfect',
        class: 'status-green'
      };
    }
  }

  // Under-consumption rules (applicable when value is below target)
  if (percentage < 60) {
    return {
      color: 'var(--color-red)',
      label: 'Dangerously Low',
      class: 'status-red'
    };
  } else if (percentage < 90) {
    return {
      color: 'var(--color-yellow)',
      label: 'Low but Fine',
      class: 'status-yellow'
    };
  } else {
    return {
      color: 'var(--color-green)',
      label: 'Perfect',
      class: 'status-green'
    };
  }
};

// Mapping nutrient keys to user-friendly labels and units
export const nutrientMetadata = {
  calories_kcal: { label: 'Calories', unit: 'kcal', group: 'Macros' },
  protein_g: { label: 'Protein', unit: 'g', group: 'Macros' },
  carbohydrates_g: { label: 'Carbs', unit: 'g', group: 'Macros' },
  fat_g: { label: 'Fat', unit: 'g', group: 'Macros' },
  
  water_ml: { label: 'Water', unit: 'ml', group: 'Hydration' },
  dietary_fiber_g: { label: 'Dietary Fiber', unit: 'g', group: 'Macros' },

  calcium_mg: { label: 'Calcium', unit: 'mg', group: 'Minerals' },
  iron_mg: { label: 'Iron', unit: 'mg', group: 'Minerals' },
  sodium_mg: { label: 'Sodium', unit: 'mg', group: 'Minerals' },
  potassium_mg: { label: 'Potassium', unit: 'mg', group: 'Minerals' },
  magnesium_mg: { label: 'Magnesium', unit: 'mg', group: 'Minerals' },
  zinc_mg: { label: 'Zinc', unit: 'mg', group: 'Minerals' },
  phosphorus_mg: { label: 'Phosphorus', unit: 'mg', group: 'Minerals' },
  selenium_ug: { label: 'Selenium', unit: 'µg', group: 'Minerals' },
  copper_mg: { label: 'Copper', unit: 'mg', group: 'Minerals' },
  manganese_mg: { label: 'Manganese', unit: 'mg', group: 'Minerals' },
  iodine_ug: { label: 'Iodine', unit: 'µg', group: 'Minerals' },
  chromium_ug: { label: 'Chromium', unit: 'µg', group: 'Minerals' },
  molybdenum_ug: { label: 'Molybdenum', unit: 'µg', group: 'Minerals' },

  vitamin_a_ug: { label: 'Vitamin A', unit: 'µg', group: 'Vitamins' },
  vitamin_c_mg: { label: 'Vitamin C', unit: 'mg', group: 'Vitamins' },
  vitamin_d_ug: { label: 'Vitamin D', unit: 'µg', group: 'Vitamins' },
  vitamin_e_mg: { label: 'Vitamin E', unit: 'mg', group: 'Vitamins' },
  vitamin_k_ug: { label: 'Vitamin K', unit: 'µg', group: 'Vitamins' },
  vitamin_b1_mg: { label: 'Thiamin (B1)', unit: 'mg', group: 'Vitamins' },
  vitamin_b2_mg: { label: 'Riboflavin (B2)', unit: 'mg', group: 'Vitamins' },
  vitamin_b3_mg: { label: 'Niacin (B3)', unit: 'mg', group: 'Vitamins' },
  vitamin_b5_mg: { label: 'Pantothenic Acid (B5)', unit: 'mg', group: 'Vitamins' },
  vitamin_b6_mg: { label: 'Vitamin B6', unit: 'mg', group: 'Vitamins' },
  biotin_b7_ug: { label: 'Biotin (B7)', unit: 'µg', group: 'Vitamins' },
  folate_b9_ug: { label: 'Folate (B9)', unit: 'µg', group: 'Vitamins' },
  vitamin_b12_ug: { label: 'Vitamin B12', unit: 'µg', group: 'Vitamins' },
  choline_mg: { label: 'Choline', unit: 'mg', group: 'Vitamins' }
};
