const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * Workout Plan Service - Flat scheduling table (similar to meal_plans)
 */
class WorkoutPlanService {
  static async getQuickSessionOptions(slotId, userId, options = {}) {
    const maxDuration = Number(options.max_duration_minutes || 20);
    const limit = Number(options.limit || 20);
    try {
      const slotRes = await db.query(
        `
          SELECT id, workout_type
          FROM workouts
          WHERE id = $1 AND user_id = $2
          LIMIT 1
        `,
        [slotId, userId]
      );
      const slot = slotRes.rows[0];
      if (!slot) return null;

      const params = [maxDuration, limit];
      let where = "deleted_at IS NULL AND user_id IS NULL AND duration_minutes IS NOT NULL AND duration_minutes <= $1";

      if (slot.workout_type) {
        params.push(slot.workout_type);
        where += ` AND LOWER(COALESCE(workout_type, '')) = LOWER(COALESCE($${params.length}, ''))`;
      }

      const listRes = await db.query(
        `
          SELECT id, name, description, duration_minutes, difficulty, workout_type,
                 estimated_calories, thumbnail_url, created_at
          FROM workouts
          WHERE ${where}
          ORDER BY duration_minutes ASC, created_at DESC
          LIMIT $2
        `,
        params
      );

      return {
        slot_id: slot.id,
        workout_type: slot.workout_type || null,
        max_duration_minutes: maxDuration,
        workouts: listRes.rows,
      };
    } catch (error) {
      logger.error(`Error fetching quick session options: ${error.message}`);
      throw error;
    }
  }

  static async getQuickSessionWorkout(slotId, userId, options = {}) {
    const result = await this.getQuickSessionOptions(slotId, userId, options);
    if (!result) return null;
    const selected = Array.isArray(result.workouts) && result.workouts.length > 0
      ? result.workouts[0]
      : null;
    return {
      slot_id: result.slot_id,
      workout_type: result.workout_type,
      quick_workout: selected,
    };
  }

  static async getSlotById(slotId, userId) {
    try {
      const res = await db.query(
        `
          SELECT *
          FROM workouts
          WHERE id = $1
            AND user_id = $2
        `,
        [slotId, userId]
      );
      return res.rows[0] || null;
    } catch (error) {
      logger.error(`Error fetching workout plan slot: ${error.message}`);
      throw error;
    }
  }

  static _computeNextDateISO(fromDateISO) {
    const base = fromDateISO ? new Date(fromDateISO) : new Date();
    // Normalize to local date (avoid time drift)
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  static _computeDayOfWeekMonToSun(dateISO) {
    const d = new Date(dateISO);
    // JS: 0=Sun..6=Sat  -> desired: 1=Mon..7=Sun
    const js = d.getDay();
    return js === 0 ? 7 : js; // Mon=1..Sat=6, Sun=7
  }

  static async addSlot(userId, data) {
    const { workout_id, week_number, day_of_week, plan_date, parent_slot_id, assigned_reason } = data;
    try {
      // Create user slot by copying workout detail from provided workout id
      const result = await db.query(
        `
          INSERT INTO workouts (
            user_id,
            name,
            description,
            duration_minutes,
            difficulty,
            workout_type,
            estimated_calories,
            thumbnail_url,
            week_number,
            day_of_week,
            plan_date,
            parent_slot_id,
            assigned_reason,
            status,
            created_at,
            updated_at
          )
          SELECT
            $1,
            t.name,
            t.description,
            t.duration_minutes,
            t.difficulty,
            t.workout_type,
            t.estimated_calories,
            t.thumbnail_url,
            $3,
            $4,
            $5,
            $6,
            $7,
            'pending',
            NOW(),
            NOW()
          FROM workouts t
          WHERE t.id = $2
          LIMIT 1
          RETURNING *
        `,
        [
          userId,
          workout_id,
          week_number,
          day_of_week,
          plan_date ?? null,
          parent_slot_id ?? null,
          assigned_reason ?? null,
        ]
      );

      if (!result.rows[0]) return null;
      return result.rows[0];
    } catch (error) {
      logger.error(`Error adding workout plan slot: ${error.message}`);
      throw error;
    }
  }

  static async bulkInsert(userId, slots) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const inserted = [];
      for (const slot of slots) {
        const {
          workout_id,
          week_number,
          day_of_week,
          plan_date,
          parent_slot_id,
          assigned_reason,
        } = slot;

        const result = await client.query(
          `
            INSERT INTO workouts (
              user_id,
              name,
              description,
              duration_minutes,
              difficulty,
              workout_type,
              estimated_calories,
              thumbnail_url,
              week_number,
              day_of_week,
              plan_date,
              parent_slot_id,
              assigned_reason,
              status,
              created_at,
              updated_at
            )
            SELECT
              $1,
              t.name,
              t.description,
              t.duration_minutes,
              t.difficulty,
              t.workout_type,
              t.estimated_calories,
              t.thumbnail_url,
              $3,
              $4,
              $5,
              $6,
              $7,
              'pending',
              NOW(),
              NOW()
            FROM workouts t
            WHERE t.id = $2
            LIMIT 1
            RETURNING *
          `,
          [
            userId,
            workout_id,
            week_number,
            day_of_week,
            plan_date ?? null,
            parent_slot_id ?? null,
            assigned_reason ?? null,
          ]
        );

        inserted.push(result.rows[0]);
      }

      await client.query("COMMIT");
      return inserted;
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error bulk inserting workout plan slots: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  static async getByWeek(userId, weekNumber) {
    try {
      const result = await db.query(
        `
          SELECT
            wp.id,
            wp.user_id,
            wp.parent_slot_id,
            wp.week_number,
            wp.day_of_week,
            wp.plan_date,
            wp.status,
            wp.is_skipped,
            wp.is_swapped,
            wp.assigned_reason,
            wp.created_at,
            wp.updated_at,
            wp.name as workout_name,
            wp.thumbnail_url,
            wp.difficulty,
            wp.duration_minutes,
            wp.estimated_calories,
            wp.workout_type
          FROM workouts wp
          WHERE wp.user_id = $1
            AND wp.week_number = $2
          ORDER BY wp.day_of_week, wp.created_at
        `,
        [userId, weekNumber]
      );

      const DAY_NAMES = {
        1: "Monday",
        2: "Tuesday",
        3: "Wednesday",
        4: "Thursday",
        5: "Friday",
        6: "Saturday",
        7: "Sunday",
      };

      const grouped = {};
      for (const row of result.rows) {
        const weekKey = `week_${row.week_number}`;
        const dayKey = `day_${row.day_of_week}`;

        if (!grouped[weekKey]) {
          grouped[weekKey] = { week_number: row.week_number, days: {} };
        }

        if (!grouped[weekKey].days[dayKey]) {
          grouped[weekKey].days[dayKey] = {
            day_of_week: row.day_of_week,
            day_name: DAY_NAMES[row.day_of_week] || `Day ${row.day_of_week}`,
            workouts_count: 0,
            workouts: [],
          };
        }

        grouped[weekKey].days[dayKey].workouts.push(row);
        grouped[weekKey].days[dayKey].workouts_count += 1;
      }

      for (const week of Object.values(grouped)) {
        week.days = Object.values(week.days).sort(
          (a, b) => a.day_of_week - b.day_of_week
        );
      }

      return grouped;
    } catch (error) {
      logger.error(`Error fetching workout plan by week: ${error.message}`);
      throw error;
    }
  }

  static async getByDay(userId, weekNumber, dayOfWeek) {
    try {
      const result = await db.query(
        `
          SELECT
            wp.id,
            wp.user_id,
            wp.parent_slot_id,
            wp.week_number,
            wp.day_of_week,
            wp.plan_date,
            wp.status,
            wp.is_skipped,
            wp.is_swapped,
            wp.assigned_reason,
            wp.created_at,
            wp.updated_at,
            wp.name as workout_name,
            wp.thumbnail_url,
            wp.difficulty,
            wp.duration_minutes,
            wp.estimated_calories,
            wp.workout_type
          FROM workouts wp
          WHERE wp.user_id = $1
            AND wp.week_number = $2
            AND wp.day_of_week = $3
          ORDER BY wp.created_at
        `,
        [userId, weekNumber, dayOfWeek]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching workout plan by day: ${error.message}`);
      throw error;
    }
  }

  static async updateSlot(slotId, userId, updateData) {
    const { status, workout_id } = updateData;
    try {
      const existing = await db.query(
        `
          SELECT *
          FROM workouts
          WHERE id = $1
            AND user_id = $2
        `,
        [slotId, userId]
      );
      const slot = existing.rows[0];
      if (!slot) return null;

      // Optional replacement workout source
      let newTemplate = null;
      if (workout_id !== undefined && workout_id !== null) {
        const tRes = await db.query("SELECT * FROM workouts WHERE id = $1", [workout_id]);
        newTemplate = tRes.rows[0] || null;
        if (!newTemplate) throw new Error("Workout template not found");
      }

      const result = await db.query(
        `
          UPDATE workouts
          SET
            status = COALESCE($1, status),
            name = COALESCE($2, name),
            description = COALESCE($3, description),
            duration_minutes = COALESCE($4, duration_minutes),
            difficulty = COALESCE($5, difficulty),
            workout_type = COALESCE($6, workout_type),
            estimated_calories = COALESCE($7, estimated_calories),
            thumbnail_url = COALESCE($8, thumbnail_url),
            updated_at = NOW()
          WHERE id = $9
            AND user_id = $10
          RETURNING *
        `,
        [
          status ?? null,
          newTemplate?.name ?? null,
          newTemplate?.description ?? null,
          newTemplate?.duration_minutes ?? null,
          newTemplate?.difficulty ?? null,
          newTemplate?.workout_type ?? null,
          newTemplate?.estimated_calories ?? null,
          newTemplate?.thumbnail_url ?? null,
          slotId,
          userId,
        ]
      );

      return result.rows[0] || null;
    } catch (error) {
      logger.error(`Error updating workout plan slot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Make-up tomorrow: create a new pending slot for tomorrow using same workout_id.
   * Keeps current slot untouched unless caller also updates it.
   */
  static async makeUpTomorrow(slotId, userId) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const slotRes = await client.query(
        `
          SELECT *
          FROM workouts
          WHERE id = $1
            AND user_id = $2
          FOR UPDATE
        `,
        [slotId, userId]
      );
      const slot = slotRes.rows[0];
      if (!slot) {
        await client.query("ROLLBACK");
        return null;
      }

      const tomorrowISO = WorkoutPlanService._computeNextDateISO(slot.plan_date);
      const tomorrowDay = WorkoutPlanService._computeDayOfWeekMonToSun(tomorrowISO);

      // Mark current slot as missed (if not already) and swapped to indicate reschedule happened
      await client.query(
        `
          UPDATE workouts
          SET status = CASE WHEN status = 'completed' THEN status ELSE 'missed' END,
              is_swapped = true,
              updated_at = NOW()
          WHERE id = $1 AND user_id = $2
        `,
        [slotId, userId]
      );

      // Create new slot for tomorrow
      const insertRes = await client.query(
        `
          INSERT INTO workouts (
            user_id,
            name,
            description,
            duration_minutes,
            difficulty,
            workout_type,
            estimated_calories,
            thumbnail_url,
            week_number,
            day_of_week,
            plan_date,
            status,
            is_skipped,
            is_swapped,
            parent_slot_id,
            assigned_reason,
            created_at,
            updated_at
          )
          VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending', false, true, $12, $13, NOW(), NOW())
          RETURNING *
        `,
        [
          userId,
          slot.name,
          slot.description,
          slot.duration_minutes,
          slot.difficulty,
          slot.workout_type,
          slot.estimated_calories,
          slot.thumbnail_url,
          slot.week_number,
          tomorrowDay,
          tomorrowISO,
          slot.id,
          "missed_makeup",
        ]
      );

      await client.query("COMMIT");
      return { from: slot, to: insertRes.rows[0] };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error making up tomorrow: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Rest day: mark slot as skipped (avatar can adjust schedule later)
   */
  static async restDay(slotId, userId) {
    try {
      const res = await db.query(
        `
          UPDATE workouts
          SET status = 'skipped',
              is_skipped = true,
              updated_at = NOW()
          WHERE id = $1 AND user_id = $2
          RETURNING *
        `,
        [slotId, userId]
      );
      return res.rows[0] || null;
    } catch (error) {
      logger.error(`Error setting rest day: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a quick-session slot related to a missed/skip slot.
   * - Marks the original slot as missed (if not completed).
   * - Creates a new pending slot on the SAME day/date with parent_slot_id.
   */
  static async createQuickSessionForSlot(slotId, userId, quickWorkoutId) {
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      const slotRes = await client.query(
        `
          SELECT *
          FROM workouts
          WHERE id = $1
            AND user_id = $2
          FOR UPDATE
        `,
        [slotId, userId]
      );
      const slot = slotRes.rows[0];
      if (!slot) {
        await client.query("ROLLBACK");
        return null;
      }

      const quickRes = await client.query(
        `
          SELECT *
          FROM workouts
          WHERE id = $1
            AND deleted_at IS NULL
          LIMIT 1
        `,
        [quickWorkoutId]
      );
      const quick = quickRes.rows[0];
      if (!quick) {
        await client.query("ROLLBACK");
        throw new Error("Quick workout not found");
      }
      if (
        quick.duration_minutes !== null &&
        quick.duration_minutes !== undefined &&
        Number(quick.duration_minutes) > 20
      ) {
        await client.query("ROLLBACK");
        throw new Error("Quick workout must be 20 minutes or less");
      }
      if (
        slot.workout_type &&
        quick.workout_type &&
        String(slot.workout_type).toLowerCase() !== String(quick.workout_type).toLowerCase()
      ) {
        await client.query("ROLLBACK");
        throw new Error("Quick workout type must match missed workout type");
      }

      await client.query(
        `
          UPDATE workouts
          SET status = CASE WHEN status = 'completed' THEN status ELSE 'missed' END,
              is_swapped = true,
              updated_at = NOW()
          WHERE id = $1 AND user_id = $2
        `,
        [slotId, userId]
      );

      const insertRes = await client.query(
        `
          INSERT INTO workouts (
            user_id,
            name,
            description,
            duration_minutes,
            difficulty,
            workout_type,
            estimated_calories,
            thumbnail_url,
            week_number,
            day_of_week,
            plan_date,
            status,
            is_skipped,
            is_swapped,
            parent_slot_id,
            assigned_reason,
            created_at,
            updated_at
          )
          SELECT
            $1,
            t.name,
            t.description,
            t.duration_minutes,
            t.difficulty,
            t.workout_type,
            t.estimated_calories,
            t.thumbnail_url,
            $3,
            $4,
            $5,
            'pending',
            false,
            true,
            $6,
            $7,
            NOW(),
            NOW()
          FROM workouts t
          WHERE t.id = $2
          LIMIT 1
          RETURNING *
        `,
        [
          userId,
          quickWorkoutId,
          slot.week_number,
          slot.day_of_week,
          slot.plan_date,
          slot.id,
          "quick_session",
        ]
      );

      await client.query("COMMIT");
      return { from: slot, quick: insertRes.rows[0] };
    } catch (error) {
      await client.query("ROLLBACK");
      logger.error(`Error creating quick session: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = WorkoutPlanService;

