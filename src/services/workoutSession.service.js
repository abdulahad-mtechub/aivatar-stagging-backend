const db = require("../config/database");
const logger = require("../utils/logger");

class WorkoutSessionService {
  static _sessionSchemaEnsured = false;

  static async ensureSessionSchema() {
    if (WorkoutSessionService._sessionSchemaEnsured) return;
    await db.query(
      "ALTER TABLE user_workout_sessions ADD COLUMN IF NOT EXISTS session_notes TEXT"
    );
    WorkoutSessionService._sessionSchemaEnsured = true;
  }

  /**
   * Start a new workout session
   */
  static async startSession(userId, workoutId) {
    await WorkoutSessionService.ensureSessionSchema();
    try {
      // `workoutId` may be either:
      // - template workout id (user_id IS NULL)
      // - or a user-specific plan-row id stored inside `workouts` (user_id IS NOT NULL)
      // In the latter case, we must store the template workout id in `user_workout_sessions`.
      const workoutRes = await db.query(
        `SELECT id, user_id, workout_id
         FROM workouts
         WHERE id = $1
           AND deleted_at IS NULL`,
        [workoutId]
      );
      const workout = workoutRes.rows[0];
      if (!workout) throw new Error("Workout not found");

      const actualTemplateWorkoutId = workout.user_id
        ? (workout.workout_id || workout.id)
        : workout.id;
      if (!actualTemplateWorkoutId) throw new Error("Template workout id not found");

      const result = await db.query(
        "INSERT INTO user_workout_sessions (user_id, workout_id) VALUES ($1, $2) RETURNING *",
        [userId, actualTemplateWorkoutId]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error starting workout session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Log a set for an exercise in a session
   */
  static async logSet(sessionId, exerciseId, setData) {
    await WorkoutSessionService.ensureSessionSchema();
    const { set_number, reps, weight, reps_target, weight_target, rest_time } = setData;
    try {
      const result = await db.query(
        `INSERT INTO workout_sets (session_id, exercise_id, set_number, actual_reps, actual_weight, target_reps, target_weight, rest_time_seconds, is_completed) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) 
         RETURNING *`,
        [sessionId, exerciseId, set_number, reps, weight, reps_target, weight_target, rest_time]
      );
      return result.rows[0];
    } catch (error) {
      logger.error(`Error logging workout set: ${error.message}`);
      throw error;
    }
  }

  /**
   * Complete a workout session and calculate summary
   */
  static async completeSession({ userId, sessionId = null, workoutId = null, startTime = null, note = null }) {
    await WorkoutSessionService.ensureSessionSchema();
    try {
      let activeSessionId = sessionId;

      // New flow: create session implicitly on complete if session_id is not provided.
      if (!activeSessionId) {
        if (!workoutId) {
          throw new Error("workout_id is required when session_id is not provided");
        }

        const workoutRes = await db.query(
          `SELECT id, user_id
           FROM workouts
           WHERE id = $1
             AND deleted_at IS NULL`,
          [workoutId]
        );
        const workout = workoutRes.rows[0];
        if (!workout) throw new Error("Workout not found");

        const resolvedStartTime = startTime ? new Date(startTime) : new Date();
        const insertRes = await db.query(
          `INSERT INTO user_workout_sessions (user_id, workout_id, start_time, session_notes)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [userId, workout.id, resolvedStartTime, note ?? null]
        );
        activeSessionId = insertRes.rows[0].id;
      } else if (startTime || note !== null) {
        // Backward compatibility: allow updating these fields when completing by session_id.
        await db.query(
          `UPDATE user_workout_sessions
           SET start_time = COALESCE($1, start_time),
               session_notes = COALESCE($2, session_notes),
               updated_at = NOW()
           WHERE id = $3`,
          [startTime || null, note, activeSessionId]
        );
      }

      // 1. Calculate stats used by workout-complete UI
      const statsRes = await db.query(
        `SELECT
           COUNT(*) as sets_done,
           COUNT(DISTINCT exercise_id) as exercises_done,
           COALESCE(SUM(actual_reps), 0) as reps_done,
           COALESCE(SUM(target_reps), 0) as target_reps_total
         FROM workout_sets 
         WHERE session_id = $1 AND is_completed = true`,
        [activeSessionId]
      );

      const { sets_done, exercises_done, reps_done, target_reps_total } = statsRes.rows[0];

      // 2. Mark session as completed
      const result = await db.query(
        `UPDATE user_workout_sessions 
         SET end_time = NOW(), status = 'completed', total_volume = $1, calories_burned = $2
         WHERE id = $3 RETURNING *`,
        [0, (sets_done || 0) * 15, activeSessionId] // Simple calorie estimation
      );

      const row = result.rows[0];
      const setsCompleted = Number(sets_done || 0);
      const exercisesDone = Number(exercises_done || 0);
      const repsDone = Number(reps_done || 0);
      const targetRepsTotal = Number(target_reps_total || 0);
      const caloriesBurned = Number(row.calories_burned || 0);
      const start = row.start_time ? new Date(row.start_time).getTime() : null;
      const end = row.end_time ? new Date(row.end_time).getTime() : null;
      const totalTimeSeconds =
        start && end && end >= start ? Math.floor((end - start) / 1000) : 0;
      const mm = String(Math.floor(totalTimeSeconds / 60)).padStart(2, "0");
      const ss = String(totalTimeSeconds % 60).padStart(2, "0");

      return {
        session_id: row.id,
        total_time: `${mm}:${ss}`,
        total_time_seconds: totalTimeSeconds,
        exercises_done: exercisesDone,
        sets_completed: setsCompleted,
        reps_completed: repsDone,
        reps_target_total: targetRepsTotal,
        calories_burned: caloriesBurned,
        note: row.session_notes || null,
      };
    } catch (error) {
      logger.error(`Error completing workout session: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get full session detail (for workout details screen)
   * Includes: session, workout, exercises (targets), and logged sets progress
   */
  static async getSessionDetail(sessionId, userId) {
    await WorkoutSessionService.ensureSessionSchema();
    try {
      const sessionRes = await db.query(
        `SELECT s.*, w.name as workout_name, w.description as workout_description,
                w.duration_minutes, w.difficulty as workout_difficulty,
                w.workout_type, w.estimated_calories, w.thumbnail_url
         FROM user_workout_sessions s
         LEFT JOIN workouts w ON s.workout_id = w.id
         WHERE s.id = $1 AND s.user_id = $2`,
        [sessionId, userId]
      );

      const session = sessionRes.rows[0];
      if (!session) return null;

      const exercisesRes = await db.query(
        `SELECT
           e.*,
           we.sequence_order,
           we.target_sets,
           we.rest_time_seconds,
           we.exercise_duration_seconds,
           we.notes
         FROM workout_exercises we
         JOIN exercises e ON e.id = we.exercise_id
         WHERE we.workout_id = $1
         ORDER BY we.sequence_order ASC`,
        [session.workout_id]
      );

      const logsRes = await db.query(
        `SELECT *
         FROM workout_sets
         WHERE session_id = $1
         ORDER BY exercise_id, set_number`,
        [sessionId]
      );

      // Index logs by exercise_id + set_number
      const logMap = new Map();
      for (const row of logsRes.rows) {
        logMap.set(`${row.exercise_id}:${row.set_number}`, row);
      }

      const exercises = exercisesRes.rows.map((ex) => {
        const setsPlanned =
          (Array.isArray(ex.target_sets) && ex.target_sets.length > 0
            ? ex.target_sets
            : []);

        const sets = setsPlanned.map((s) => {
          const key = `${ex.id}:${s.set_number}`;
          const logged = logMap.get(key);
          return {
            set_number: s.set_number,
            target_reps: s.target_reps ?? null,
            target_weight: s.target_weight ?? null,
            rest_time_seconds: s.rest_time_seconds ?? null,
            actual_reps: logged?.actual_reps ?? null,
            actual_weight: logged?.actual_weight ?? null,
            done: Boolean(logged?.is_completed),
            logged_at: logged?.created_at ?? null,
          };
        });

        return {
          ...ex,
          video_url: ex.video_url || null,
          sets,
        };
      });

      return {
        session: {
          id: session.id,
          user_id: session.user_id,
          workout_id: session.workout_id,
          status: session.status,
          start_time: session.start_time,
          end_time: session.end_time,
          note: session.session_notes,
          total_volume: session.total_volume,
          calories_burned: session.calories_burned,
          created_at: session.created_at,
          updated_at: session.updated_at,
        },
        workout: session.workout_id
          ? {
              id: session.workout_id,
              name: session.workout_name,
              description: session.workout_description,
              duration_minutes: session.duration_minutes,
              difficulty: session.workout_difficulty,
              workout_type: session.workout_type,
              estimated_calories: session.estimated_calories,
              thumbnail_url: session.thumbnail_url,
            }
          : null,
        exercises,
      };
    } catch (error) {
      logger.error(`Error getting session detail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get previous session best set for an exercise (for "Previous Session" card)
   */
  static async getExercisePreviousSession(exerciseId, userId) {
    await WorkoutSessionService.ensureSessionSchema();
    try {
      const res = await db.query(
        `
        SELECT
          s.id as session_id,
          s.end_time,
          ws.actual_reps,
          ws.actual_weight,
          (COALESCE(ws.actual_reps,0) * COALESCE(ws.actual_weight,0)) as volume,
          ws.set_number
        FROM workout_sets ws
        JOIN user_workout_sessions s ON s.id = ws.session_id
        WHERE s.user_id = $1
          AND ws.exercise_id = $2
          AND ws.is_completed = true
          AND s.status = 'completed'
        ORDER BY volume DESC, s.end_time DESC NULLS LAST
        LIMIT 1
        `,
        [userId, exerciseId]
      );

      const best = res.rows[0];
      if (!best) return null;

      return {
        session_id: best.session_id,
        date: best.end_time,
        best_set: {
          set_number: best.set_number,
          reps: best.actual_reps,
          weight: best.actual_weight,
          volume: Number(best.volume || 0),
        },
      };
    } catch (error) {
      logger.error(`Error getting previous session: ${error.message}`);
      throw error;
    }
  }
}

module.exports = WorkoutSessionService;
