const db = require("../config/database");
const logger = require("../utils/logger");

class WorkoutService {
  static _computeWorkoutCounts(exercises = []) {
    const exercises_count = Array.isArray(exercises) ? exercises.length : 0;
    const sets_count = (Array.isArray(exercises) ? exercises : []).reduce((sum, ex) => {
      const explicitSets = Number(ex?.default_sets ?? ex?.sets);
      if (Number.isFinite(explicitSets) && explicitSets > 0) return sum + explicitSets;

      const targetSetsLen = Array.isArray(ex?.target_sets) ? ex.target_sets.length : 0;
      if (targetSetsLen > 0) return sum + targetSetsLen;

      return sum;
    }, 0);

    return { exercises_count, sets_count };
  }

  /**
   * Workout Home (First screen) - aggregated hierarchical payload
   */
  static async getHome(userId, options = {}) {
    const {
      week_number,
      day_of_week,
      plan_date,
      include_all_workouts = true,
      all_workouts_limit = 25,
      missed_limit = 10,
    } = options;

    try {
      const plannedWhere = [];
      const plannedParams = [userId];
      plannedWhere.push(`wp.user_id = $1`);

      if (week_number) {
        plannedParams.push(Number(week_number));
        plannedWhere.push(`wp.week_number = $${plannedParams.length}`);
      }

      if (day_of_week) {
        plannedParams.push(Number(day_of_week));
        plannedWhere.push(`wp.day_of_week = $${plannedParams.length}`);
      }

      if (plan_date) {
        plannedParams.push(plan_date);
        plannedWhere.push(`wp.plan_date = $${plannedParams.length}`);
      }

      const plannedRes = await db.query(
        `
        SELECT
          wp.id as plan_slot_id,
          wp.week_number,
          wp.day_of_week,
          wp.plan_date,
          wp.slot_type,
          wp.status as plan_status,
          wp.is_skipped,
          wp.is_swapped,
          wp.created_at as plan_created_at,
          wp.updated_at as plan_updated_at,
          w.id as workout_id,
          w.name as workout_name,
          w.description as workout_description,
          w.duration_minutes,
          w.difficulty as workout_difficulty,
          w.workout_type,
          w.estimated_calories,
          w.thumbnail_url as workout_thumbnail_url,
          COALESCE(
            json_agg(
              json_build_object(
                'exercise_id', e.id,
                'title', e.title,
                'description', e.description,
                'video_url', COALESCE(e.video_url, e.media_url),
                'thumbnail_url', e.thumbnail_url,
                'audio_url', e.audio_url,
                'instructions', e.instructions,
                'category', e.category,
                'target_muscle_group', e.target_muscle_group,
                'duration_seconds', e.duration_seconds,
                'equipment', e.equipment,
                'difficulty', e.difficulty,
                'default_rest_time_seconds', e.default_rest_time_seconds,
                'sequence_order', we.sequence_order,
                'default_sets', we.default_sets,
                'default_reps', we.default_reps,
                'default_weight', we.default_weight,
                'target_sets', we.target_sets,
                'rest_time_seconds', we.rest_time_seconds,
                'exercise_duration_seconds', we.exercise_duration_seconds,
                'notes', we.notes
              )
              ORDER BY we.sequence_order
            ) FILTER (WHERE e.id IS NOT NULL),
            '[]'::json
          ) AS exercises
        FROM workout_plans wp
        LEFT JOIN workouts w ON wp.workout_id = w.id
        LEFT JOIN workout_exercises we ON we.workout_id = w.id
        LEFT JOIN exercises e ON e.id = we.exercise_id
        WHERE ${plannedWhere.join(" AND ")}
        GROUP BY wp.id, w.id
        ORDER BY wp.day_of_week, wp.plan_date NULLS LAST, wp.created_at DESC
        `,
        plannedParams
      );

      const missedRes = await db.query(
        `
        SELECT
          wp.id as plan_slot_id,
          wp.week_number,
          wp.day_of_week,
          wp.plan_date,
          wp.slot_type,
          wp.status as plan_status,
          wp.is_skipped,
          wp.is_swapped,
          wp.created_at as plan_created_at,
          w.id as workout_id,
          w.name as workout_name,
          w.duration_minutes,
          w.difficulty as workout_difficulty,
          w.workout_type,
          w.estimated_calories,
          w.thumbnail_url as workout_thumbnail_url
        FROM workout_plans wp
        LEFT JOIN workouts w ON wp.workout_id = w.id
        WHERE wp.user_id = $1 AND wp.status = 'missed'
        ORDER BY COALESCE(wp.plan_date::timestamp, wp.created_at) DESC
        LIMIT $2
        `,
        [userId, Number(missed_limit)]
      );

      let allWorkouts = [];
      if (include_all_workouts) {
        const allRes = await db.query(
          `
          SELECT id, name, description, duration_minutes, difficulty, workout_type,
                 estimated_calories, thumbnail_url, created_at
          FROM workouts
          WHERE deleted_at IS NULL
          ORDER BY created_at DESC
          LIMIT $1
          `,
          [Number(all_workouts_limit)]
        );
        allWorkouts = allRes.rows;
      }

      return {
        planned: plannedRes.rows.map((row) => ({
          plan: {
            id: row.plan_slot_id,
            week_number: row.week_number,
            day_of_week: row.day_of_week,
            plan_date: row.plan_date,
            slot_type: row.slot_type,
            status: row.plan_status,
            is_skipped: row.is_skipped,
            is_swapped: row.is_swapped,
            created_at: row.plan_created_at,
            updated_at: row.plan_updated_at,
          },
          workout: row.workout_id
            ? {
                id: row.workout_id,
                name: row.workout_name,
                description: row.workout_description,
                duration_minutes: row.duration_minutes,
                difficulty: row.workout_difficulty,
                workout_type: row.workout_type,
                estimated_calories: row.estimated_calories,
                thumbnail_url: row.workout_thumbnail_url,
                exercises: row.exercises || [],
                ...WorkoutService._computeWorkoutCounts(row.exercises || []),
              }
            : null,
        })),
        missed: missedRes.rows.map((row) => ({
          plan: {
            id: row.plan_slot_id,
            week_number: row.week_number,
            day_of_week: row.day_of_week,
            plan_date: row.plan_date,
            slot_type: row.slot_type,
            status: row.plan_status,
            is_skipped: row.is_skipped,
            is_swapped: row.is_swapped,
            created_at: row.plan_created_at,
          },
          workout: row.workout_id
            ? {
                id: row.workout_id,
                name: row.workout_name,
                duration_minutes: row.duration_minutes,
                difficulty: row.workout_difficulty,
                workout_type: row.workout_type,
                estimated_calories: row.estimated_calories,
                thumbnail_url: row.workout_thumbnail_url,
              }
            : null,
        })),
        recommendations: {
          all_workouts: allWorkouts.map((w) => ({
            ...w,
            // keep shape consistent; these may be filled when workout detail is fetched
            exercises_count: w.exercises_count ?? null,
            sets_count: w.sets_count ?? null,
          })),
        },
      };
    } catch (error) {
      logger.error(`Error building workout home: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all workout templates
   */
  static async findAll(options = {}) {
    const {
      include_exercises = true,
      limit = 50,
      offset = 0,
    } = options;

    try {
      if (!include_exercises) {
        const result = await db.query(
          "SELECT * FROM workouts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2",
          [Number(limit), Number(offset)]
        );
        return result.rows;
      }

      const result = await db.query(
        `
        SELECT
          w.*,
          COALESCE(
            json_agg(
              json_build_object(
                'exercise_id', e.id,
                'title', e.title,
                'description', e.description,
                'video_url', COALESCE(e.video_url, e.media_url),
                'thumbnail_url', e.thumbnail_url,
                'audio_url', e.audio_url,
                'instructions', e.instructions,
                'category', e.category,
                'target_muscle_group', e.target_muscle_group,
                'duration_seconds', e.duration_seconds,
                'equipment', e.equipment,
                'difficulty', e.difficulty,
                'default_rest_time_seconds', e.default_rest_time_seconds,
                'sequence_order', we.sequence_order,
                'default_sets', we.default_sets,
                'default_reps', we.default_reps,
                'default_weight', we.default_weight,
                'target_sets', we.target_sets,
                'rest_time_seconds', we.rest_time_seconds,
                'exercise_duration_seconds', we.exercise_duration_seconds,
                'notes', we.notes
              )
              ORDER BY we.sequence_order
            ) FILTER (WHERE e.id IS NOT NULL),
            '[]'::json
          ) AS exercises
        FROM workouts w
        LEFT JOIN workout_exercises we ON we.workout_id = w.id
        LEFT JOIN exercises e ON e.id = we.exercise_id
        WHERE w.deleted_at IS NULL
        GROUP BY w.id
        ORDER BY w.created_at DESC
        LIMIT $1 OFFSET $2
        `,
        [Number(limit), Number(offset)]
      );

      // Add computed counts on each workout
      return result.rows.map((row) => ({
        ...row,
        ...WorkoutService._computeWorkoutCounts(row.exercises || []),
      }));
    } catch (error) {
      logger.error(`Error finding workouts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get workout with its exercises
   */
  static async findById(id) {
    try {
      const workoutRes = await db.query(
        "SELECT * FROM workouts WHERE id = $1 AND deleted_at IS NULL",
        [id]
      );
      
      if (!workoutRes.rows[0]) return null;

      const exercisesRes = await db.query(
        `SELECT
           e.*,
           we.sequence_order,
           we.default_sets,
           we.default_reps,
           we.default_weight,
           we.target_sets,
           we.rest_time_seconds,
           we.exercise_duration_seconds,
           we.notes
         FROM exercises e 
         JOIN workout_exercises we ON e.id = we.exercise_id 
         WHERE we.workout_id = $1 
         ORDER BY we.sequence_order ASC`,
        [id]
      );

      const counts = WorkoutService._computeWorkoutCounts(exercisesRes.rows);
      return {
        ...workoutRes.rows[0],
        exercises: exercisesRes.rows,
        ...counts,
      };
    } catch (error) {
      logger.error(`Error finding workout detail: ${error.message}`);
      throw error;
    }
  }

  /**
   * Quick workouts list (used by "Quick 20-min session now" option)
   */
  static async findQuick(options = {}) {
    const { max_duration_minutes = 20, limit = 20, offset = 0 } = options;
    try {
      const result = await db.query(
        `
        SELECT id, name, description, duration_minutes, difficulty, workout_type,
               estimated_calories, thumbnail_url, created_at
        FROM workouts
        WHERE deleted_at IS NULL
          AND duration_minutes IS NOT NULL
          AND duration_minutes <= $1
        ORDER BY duration_minutes ASC, created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [Number(max_duration_minutes), Number(limit), Number(offset)]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Error finding quick workouts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new workout template (AI-generated from frontend)
   */
  static async create(workoutData) {
    const {
      name,
      description,
      duration_minutes,
      difficulty,
      workout_type,
      estimated_calories,
      thumbnail_url,
      exercises,
    } = workoutData;
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. Create Workout
      const workoutRes = await client.query(
        `INSERT INTO workouts (
           name,
           description,
           duration_minutes,
           difficulty,
           workout_type,
           estimated_calories,
           thumbnail_url
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          name,
          description,
          duration_minutes,
          difficulty,
          workout_type,
          estimated_calories,
          thumbnail_url,
        ]
      );
      const workoutId = workoutRes.rows[0].id;

      // 2. Map Exercises (assuming ids are provided)
      if (exercises && Array.isArray(exercises)) {
        for (const [index, exercise] of exercises.entries()) {
          await client.query(
            `INSERT INTO workout_exercises (
               workout_id,
               exercise_id,
               sequence_order,
               default_sets,
               default_reps,
               default_weight,
               target_sets,
               rest_time_seconds,
               exercise_duration_seconds,
               notes
             ) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              workoutId, 
              exercise.id, 
              index + 1, 
              exercise.sets || 3, 
              exercise.reps || 10, 
              exercise.weight || 0.0, 
              JSON.stringify(exercise.target_sets || []),
              exercise.rest_time_seconds,
              exercise.exercise_duration_seconds,
              exercise.notes,
            ]
          );
        }
      }

      await client.query('COMMIT');
      const counts = WorkoutService._computeWorkoutCounts(exercises || []);
      return { ...workoutRes.rows[0], exercises: exercises || [], ...counts };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error(`Error creating workout: ${error.message}`);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = WorkoutService;
