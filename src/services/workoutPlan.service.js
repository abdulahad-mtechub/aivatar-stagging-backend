const db = require("../config/database");
const logger = require("../utils/logger");

/**
 * Workout Plan Service - Flat scheduling table (similar to meal_plans)
 */
class WorkoutPlanService {
  static async getSlotById(slotId, userId) {
    try {
      const res = await db.query(
        `SELECT * FROM workout_plans WHERE id = $1 AND user_id = $2`,
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
    const { workout_id, week_number, day_of_week, plan_date, slot_type, parent_slot_id, assigned_reason } = data;
    try {
      const result = await db.query(
        `INSERT INTO workout_plans
          (user_id, workout_id, week_number, day_of_week, plan_date, slot_type, parent_slot_id, assigned_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          userId,
          workout_id,
          week_number,
          day_of_week,
          plan_date,
          slot_type || "workout",
          parent_slot_id || null,
          assigned_reason || null,
        ]
      );
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
        const { workout_id, week_number, day_of_week, plan_date, slot_type, parent_slot_id, assigned_reason } = slot;
        const result = await client.query(
          `INSERT INTO workout_plans
            (user_id, workout_id, week_number, day_of_week, plan_date, slot_type, parent_slot_id, assigned_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            userId,
            workout_id,
            week_number,
            day_of_week,
            plan_date,
            slot_type || "workout",
            parent_slot_id || null,
            assigned_reason || null,
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
        `SELECT wp.*,
                w.name as workout_name,
                w.thumbnail_url,
                w.difficulty,
                w.duration_minutes,
                w.estimated_calories,
                w.workout_type
         FROM workout_plans wp
         LEFT JOIN workouts w ON wp.workout_id = w.id
         WHERE wp.user_id = $1 AND wp.week_number = $2
         ORDER BY wp.day_of_week, wp.created_at`,
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
        `SELECT wp.*,
                w.name as workout_name,
                w.thumbnail_url,
                w.difficulty,
                w.duration_minutes,
                w.estimated_calories,
                w.workout_type
         FROM workout_plans wp
         LEFT JOIN workouts w ON wp.workout_id = w.id
         WHERE wp.user_id = $1 AND wp.week_number = $2 AND wp.day_of_week = $3
         ORDER BY wp.created_at`,
        [userId, weekNumber, dayOfWeek]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error fetching workout plan by day: ${error.message}`);
      throw error;
    }
  }

  static async updateSlot(slotId, userId, updateData) {
    const { status, is_skipped, is_swapped, workout_id } = updateData;
    try {
      const result = await db.query(
        `UPDATE workout_plans
         SET status      = COALESCE($1, status),
             is_skipped  = COALESCE($2, is_skipped),
             is_swapped  = COALESCE($3, is_swapped),
             workout_id  = COALESCE($4, workout_id),
             updated_at  = NOW()
         WHERE id = $5 AND user_id = $6
         RETURNING *`,
        [status, is_skipped, is_swapped, workout_id, slotId, userId]
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
        `SELECT * FROM workout_plans WHERE id = $1 AND user_id = $2 FOR UPDATE`,
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
        `UPDATE workout_plans
         SET status = CASE WHEN status = 'completed' THEN status ELSE 'missed' END,
             is_swapped = true,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [slotId, userId]
      );

      // Create new slot for tomorrow
      const insertRes = await client.query(
        `INSERT INTO workout_plans
          (user_id, workout_id, week_number, day_of_week, plan_date, slot_type, status, is_skipped, is_swapped, parent_slot_id, assigned_reason)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', false, true, $7, $8)
         RETURNING *`,
        [
          userId,
          slot.workout_id,
          slot.week_number,
          tomorrowDay,
          tomorrowISO,
          slot.slot_type || "workout",
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
        `UPDATE workout_plans
         SET status = 'skipped',
             is_skipped = true,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
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
        `SELECT * FROM workout_plans WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [slotId, userId]
      );
      const slot = slotRes.rows[0];
      if (!slot) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query(
        `UPDATE workout_plans
         SET status = CASE WHEN status = 'completed' THEN status ELSE 'missed' END,
             is_swapped = true,
             updated_at = NOW()
         WHERE id = $1 AND user_id = $2`,
        [slotId, userId]
      );

      const insertRes = await client.query(
        `INSERT INTO workout_plans
          (user_id, workout_id, week_number, day_of_week, plan_date, slot_type, status, is_skipped, is_swapped, parent_slot_id, assigned_reason)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending', false, true, $7, $8)
         RETURNING *`,
        [
          userId,
          quickWorkoutId,
          slot.week_number,
          slot.day_of_week,
          slot.plan_date,
          slot.slot_type || "workout",
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

