-- ==========================================
-- Migration 008: Create meal_ingredients table
-- Pre-measured Quantities for each meal
-- ==========================================

CREATE TABLE IF NOT EXISTS meal_ingredients (
  id SERIAL PRIMARY KEY,
  meal_id INTEGER NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,           -- e.g. 'Chicken Breast'
  quantity VARCHAR(100) NOT NULL,        -- e.g. '200g'
  unit VARCHAR(50),                      -- e.g. 'g', 'ml', 'cup', 'tbsp'
  image_url TEXT,                        -- Optional image for the ingredient
  calories INTEGER DEFAULT 0,
  protein FLOAT DEFAULT 0.0,
  carbs FLOAT DEFAULT 0.0,
  fats FLOAT DEFAULT 0.0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meal_ingredients_meal_id ON meal_ingredients(meal_id);
