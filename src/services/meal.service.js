const db = require("../config/database");
const logger = require("../utils/logger");
const { validatePaginationParams, generatePagination } = require("../utils/pagination");
const { parseBoolean, buildPartialSearchClause } = require("../utils/partialSearch");
const { buildTimestampDateRangeFilter } = require("../utils/dateRange");

/**
 * Meal Service - Handles global meal library and nutrition
 */
class MealService {
  /**
   * Create a new meal with nutrition energy
   */
  static async create(userId, mealData) {
    const { title, description, image_url, category, preparation_time, complexity, energy } = mealData;

    try {
      // Check for duplicate meal (same title + category for this user)
      const duplicate = await db.query(
        "SELECT id FROM meals WHERE user_id = $1 AND LOWER(title) = LOWER($2) AND LOWER(category) = LOWER($3)",
        [userId, title, category]
      );

      if (duplicate.rows.length > 0) {
        throw new Error(`A meal with the title "${title}" already exists in the "${category}" category`);
      }

      // 1. Create energy record
      const energyResult = await db.query(
        "INSERT INTO meal_energy (calories, protein, carbs, fats) VALUES ($1, $2, $3, $4) RETURNING id",
        [energy.calories || 0, energy.protein || 0, energy.carbs || 0, energy.fats || 0]
      );
      const energyId = energyResult.rows[0].id;

      // 2. Create meal record
      const mealResult = await db.query(
        "INSERT INTO meals (user_id, title, description, image_url, category, preparation_time, complexity, energy_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
        [userId, title, description, image_url, category, preparation_time, complexity, energyId]
      );

      return mealResult.rows[0];
    } catch (error) {
      logger.error(`Error creating meal: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update meal + optional energy (partial merge). Caller must enforce ownership/admin.
   */
  static async update(mealId, mealData) {
    try {
      const mealResult = await db.query("SELECT * FROM meals WHERE id = $1", [mealId]);
      const meal = mealResult.rows[0];
      if (!meal) return null;

      const merged = {
        title: mealData.title !== undefined ? mealData.title : meal.title,
        description:
          mealData.description !== undefined ? mealData.description : meal.description,
        image_url: mealData.image_url !== undefined ? mealData.image_url : meal.image_url,
        category: mealData.category !== undefined ? mealData.category : meal.category,
        preparation_time:
          mealData.preparation_time !== undefined
            ? mealData.preparation_time
            : meal.preparation_time,
        complexity:
          mealData.complexity !== undefined ? mealData.complexity : meal.complexity,
        quantity: mealData.quantity !== undefined ? mealData.quantity : meal.quantity,
      };

      const dup = await db.query(
        `SELECT id FROM meals
         WHERE user_id = $1
           AND LOWER(title) = LOWER($2)
           AND LOWER(COALESCE(category, '')) = LOWER(COALESCE($3::text, ''))
           AND id != $4`,
        [meal.user_id, merged.title, merged.category, mealId]
      );
      if (dup.rows.length > 0) {
        throw new Error(
          `A meal with the title "${merged.title}" already exists in the "${merged.category}" category`
        );
      }

      await db.query(
        `UPDATE meals SET
          title = $1,
          description = $2,
          image_url = $3,
          category = $4,
          preparation_time = $5,
          complexity = $6,
          quantity = $7,
          updated_at = NOW()
         WHERE id = $8`,
        [
          merged.title,
          merged.description,
          merged.image_url,
          merged.category,
          merged.preparation_time,
          merged.complexity,
          merged.quantity,
          mealId,
        ]
      );

      if (mealData.energy !== undefined && mealData.energy !== null) {
        const e = mealData.energy;
        if (meal.energy_id) {
          await db.query(
            `UPDATE meal_energy SET
              calories = COALESCE($1, calories),
              protein = COALESCE($2, protein),
              carbs = COALESCE($3, carbs),
              fats = COALESCE($4, fats)
             WHERE id = $5`,
            [
              e.calories !== undefined ? e.calories : null,
              e.protein !== undefined ? e.protein : null,
              e.carbs !== undefined ? e.carbs : null,
              e.fats !== undefined ? e.fats : null,
              meal.energy_id,
            ]
          );
        } else {
          const energyResult = await db.query(
            "INSERT INTO meal_energy (calories, protein, carbs, fats) VALUES ($1, $2, $3, $4) RETURNING id",
            [
              e.calories ?? 0,
              e.protein ?? 0,
              e.carbs ?? 0,
              e.fats ?? 0,
            ]
          );
          const energyId = energyResult.rows[0].id;
          await db.query("UPDATE meals SET energy_id = $1, updated_at = NOW() WHERE id = $2", [
            energyId,
            mealId,
          ]);
        }
      }

      return this.findById(mealId);
    } catch (error) {
      logger.error(`Error updating meal: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find meal by ID with energy details
   */
  static async findById(id) {
    try {
      const mealResult = await db.query(
        `SELECT m.*, e.calories, e.protein, e.carbs, e.fats
         FROM meals m
         LEFT JOIN meal_energy e ON m.energy_id = e.id
         WHERE m.id = $1`,
        [id]
      );
      if (!mealResult.rows[0]) return null;
      const meal = mealResult.rows[0];

      // Fetch pre-measured quantities
      const ingResult = await db.query(
        `SELECT id, meal_id, name, quantity, unit, image_url, calories, protein, carbs, fats, created_at, updated_at 
         FROM meal_ingredients WHERE meal_id = $1 ORDER BY id ASC`,
        [id]
      );
      meal.pre_measured_quantities = ingResult.rows;

      return meal;
    } catch (error) {
      logger.error(`Error finding meal by ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all meals for a specific user (flat list)
   */
  static async findAll(userId, options = {}) {
    const {
      page = 1,
      limit = 10,
      q,
      sort_by = "created_at",
      sort_order = "desc",
      not_pagination,
      start_date,
      end_date,
    } = options;

    const disablePagination = parseBoolean(not_pagination, false);
    const { page: pageNum, limit: limitNum, offset } = validatePaginationParams(page, limit);

    const sortColumns = {
      id: "m.id",
      title: "m.title",
      category: "m.category",
      complexity: "m.complexity",
      preparation_time: "m.preparation_time",
      created_at: "m.created_at",
      updated_at: "m.updated_at",
    };
    const safeSortBy = sortColumns[String(sort_by || "").toLowerCase()] || "m.created_at";
    const safeSortOrder = String(sort_order || "").toLowerCase() === "asc" ? "ASC" : "DESC";

    try {
      const whereParams = [userId];
      const whereParts = ["m.user_id = $1"];

      const search = buildPartialSearchClause(
        ["m.title", "m.description", "m.category", "m.complexity"],
        q,
        whereParams.length + 1
      );
      if (search.clause) {
        whereParts.push(search.clause);
        whereParams.push(...search.params);
      }
      const dateFilter = buildTimestampDateRangeFilter(
        "m.created_at",
        start_date,
        end_date,
        whereParams.length + 1
      );
      if (dateFilter.clauses.length > 0) {
        whereParts.push(...dateFilter.clauses);
        whereParams.push(...dateFilter.params);
      }

      const whereSql = whereParts.join(" AND ");
      const countRes = await db.query(
        `SELECT COUNT(*)::int AS total
         FROM meals m
         WHERE ${whereSql}`,
        whereParams
      );
      const total = countRes.rows[0]?.total || 0;

      const dataParams = [...whereParams];
      let paginationSql = "";
      if (!disablePagination) {
        dataParams.push(limitNum, offset);
        paginationSql = ` LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`;
      }

      const result = await db.query(
        `SELECT m.*,
                e.calories, e.protein, e.carbs, e.fats,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', mi.id,
                      'name', mi.name,
                      'quantity', mi.quantity,
                      'unit', mi.unit,
                      'calories', mi.calories,
                      'protein', mi.protein,
                      'carbs', mi.carbs,
                      'fats', mi.fats
                    ) ORDER BY mi.id
                  ) FILTER (WHERE mi.id IS NOT NULL),
                  '[]'
                ) AS pre_measured_quantities
         FROM meals m
         LEFT JOIN meal_energy e ON m.energy_id = e.id
         LEFT JOIN meal_ingredients mi ON mi.meal_id = m.id
         WHERE ${whereSql}
         GROUP BY m.id, e.id
         ORDER BY ${safeSortBy} ${safeSortOrder}, m.id DESC
         ${paginationSql}`,
        dataParams
      );
      return {
        meals: result.rows,
        ...(disablePagination
          ? {}
          : {
              pagination: {
                ...generatePagination(pageNum, limitNum, total),
                sort_by: Object.keys(sortColumns).find((k) => sortColumns[k] === safeSortBy) || "created_at",
                sort_order: safeSortOrder.toLowerCase(),
              },
            }),
      };
    } catch (error) {
      logger.error(`Error finding all meals: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all meals grouped by category
   */
  static async findAllGrouped(userId) {
    try {
      const result = await db.query(
        `SELECT m.*,
                e.calories, e.protein, e.carbs, e.fats,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', mi.id,
                      'name', mi.name,
                      'quantity', mi.quantity,
                      'unit', mi.unit,
                      'image_url', mi.image_url,
                      'calories', mi.calories,
                      'protein', mi.protein,
                      'carbs', mi.carbs,
                      'fats', mi.fats
                    ) ORDER BY mi.id
                  ) FILTER (WHERE mi.id IS NOT NULL),
                  '[]'
                ) AS pre_measured_quantities
         FROM meals m
         LEFT JOIN meal_energy e ON m.energy_id = e.id
         LEFT JOIN meal_ingredients mi ON mi.meal_id = m.id
         WHERE m.user_id = $1
         GROUP BY m.id, e.id
         ORDER BY m.category ASC, m.created_at DESC`,
        [userId]
      );

      // Group meals by category key
      const grouped = result.rows.reduce((acc, meal) => {
        const cat = meal.category || "Uncategorized";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(meal);
        return acc;
      }, {});

      return grouped;
    } catch (error) {
      logger.error(`Error finding grouped meals: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get meals filtered by a specific category
   */
  static async findByCategory(userId, category) {
    try {
      const result = await db.query(
        `SELECT m.*,
                e.calories, e.protein, e.carbs, e.fats,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', mi.id,
                      'name', mi.name,
                      'quantity', mi.quantity,
                      'unit', mi.unit,
                      'calories', mi.calories,
                      'protein', mi.protein,
                      'carbs', mi.carbs,
                      'fats', mi.fats
                    ) ORDER BY mi.id
                  ) FILTER (WHERE mi.id IS NOT NULL),
                  '[]'
                ) AS pre_measured_quantities
         FROM meals m
         LEFT JOIN meal_energy e ON m.energy_id = e.id
         LEFT JOIN meal_ingredients mi ON mi.meal_id = m.id
         WHERE m.user_id = $1 AND LOWER(m.category) = LOWER($2)
         GROUP BY m.id, e.id
         ORDER BY m.created_at DESC`,
        [userId, category]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error finding meals by category: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all meals in the user's grocery list
   */
  static async getGroceryList(userId) {
    try {
      const result = await db.query(
        `SELECT m.*, e.calories, e.protein, e.carbs, e.fats
         FROM meals m
         LEFT JOIN meal_energy e ON m.energy_id = e.id
         WHERE m.user_id = $1 AND m.is_in_grocery = true
         ORDER BY m.created_at DESC`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching grocery list: ${error.message}`);
      throw error;
    }
  }

  /**
   * Toggle bought status for a meal
   */
  static async toggleBoughtStatus(userId, mealId, isBought) {
    try {
      const result = await db.query(
        `UPDATE meals SET is_bought = $1, updated_at = NOW() 
         WHERE user_id = $2 AND id = $3 RETURNING *`,
        [isBought, userId, mealId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error toggling bought status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk update grocery status
   */
  static async updateGroceryStatus(userId, mealIds, isInGrocery) {
    try {
      const result = await db.query(
        `UPDATE meals SET is_in_grocery = $1, updated_at = NOW() 
         WHERE user_id = $2 AND id = ANY($3) RETURNING *`,
        [isInGrocery, userId, mealIds]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error updating grocery status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk update bought status
   */
  static async updateBoughtStatus(userId, mealIds, isBought) {
    try {
      const result = await db.query(
        `UPDATE meals SET is_bought = $1, updated_at = NOW() 
         WHERE user_id = $2 AND id = ANY($3) RETURNING *`,
        [isBought, userId, mealIds]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error updating bought status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clear grocery list for user
   */
  static async clearGroceryList(userId) {
    try {
      const result = await db.query(
        `UPDATE meals SET is_in_grocery = false, is_bought = false, updated_at = NOW() 
         WHERE user_id = $1 AND is_in_grocery = true RETURNING *`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error clearing grocery list: ${error.message}`);
      throw error;
    }
  }
}

module.exports = MealService;
