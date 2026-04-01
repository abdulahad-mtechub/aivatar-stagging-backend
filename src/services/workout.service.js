const db = require("../config/database");
const logger = require("../utils/logger");
const { validatePaginationParams, generatePagination } = require("../utils/pagination");
const { parseBoolean, buildPartialSearchClause } = require("../utils/partialSearch");

class WorkoutService {
  static _toArray(value) {
    if (Array.isArray(value)) return value.filter((v) => v !== null && v !== undefined && String(v).trim() !== "");
    if (typeof value === "string" && value.trim()) return [value.trim()];
    return [];
  }

  static _normalizeGuide(instructions) {
    const raw = instructions && typeof instructions === "object" ? instructions : {};
    const text =
      raw.text ||
      raw.instruction ||
      raw.instructions ||
      raw.description ||
      null;
    const dos = WorkoutService._toArray(raw.dos || raw.do || raw.tips);
    const donts = WorkoutService._toArray(raw.donts || raw.dont || raw.avoid);
    const steps = WorkoutService._toArray(raw.steps);
    return {
      text: typeof text === "string" ? text : null,
      steps,
      dos,
      donts,
    };
  }

  static _toYmd(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  static _normalizeExerciseResponseFields(exercise) {
    if (!exercise || typeof exercise !== "object") return exercise;
    const targetSets = Array.isArray(exercise.target_sets) ? exercise.target_sets : [];
    const guide = WorkoutService._normalizeGuide(exercise.instructions);
    return {
      exercise_id: exercise.exercise_id ?? exercise.id ?? null,
      title: exercise.title ?? null,
      description: exercise.description ?? null,
      video_url: exercise.video_url ?? null,
      thumbnail_url: exercise.thumbnail_url ?? null,
      category: exercise.category ?? null,
      target_muscle_group: exercise.target_muscle_group ?? null,
      duration_seconds: exercise.duration_seconds ?? null,
      difficulty: exercise.difficulty ?? null,
      sequence_order: exercise.sequence_order ?? null,
      target_sets: targetSets,
      rest_time_seconds: exercise.rest_time_seconds ?? null,
      exercise_duration_seconds: exercise.exercise_duration_seconds ?? null,
      notes: exercise.notes ?? null,
      audio_url: exercise.audio_url ?? null,
      guide_text: guide.text,
      guide_steps: guide.steps,
      guide_dos: guide.dos,
      guide_donts: guide.donts,
      // Simplified helper fields
      sets: targetSets.length,
      reps: targetSets.length > 0 ? targetSets[0]?.target_reps ?? null : null,
      weight: targetSets.length > 0 ? targetSets[0]?.target_weight ?? null : null,
      lbs: targetSets.length > 0 ? targetSets[0]?.target_weight ?? null : null,
    };
  }

  static _schemaEnsured = false;

  static async ensureWorkoutSchemaColumns() {
    if (WorkoutService._schemaEnsured) return;

    // Failsafe for existing databases where `workouts` was created before
    // user-linked scheduling columns were introduced.
    await db.query(
      "ALTER TABLE workouts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE"
    );
    await db.query(
      "ALTER TABLE workouts ADD COLUMN IF NOT EXISTS parent_slot_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL"
    );
    await db.query("ALTER TABLE workouts ADD COLUMN IF NOT EXISTS week_number INTEGER");
    await db.query("ALTER TABLE workouts ADD COLUMN IF NOT EXISTS day_of_week INTEGER");
    await db.query("ALTER TABLE workouts ADD COLUMN IF NOT EXISTS plan_date DATE");
    await db.query(
      "ALTER TABLE workouts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'"
    );
    await db.query(
      "ALTER TABLE workouts ADD COLUMN IF NOT EXISTS assigned_reason VARCHAR(50)"
    );

    WorkoutService._schemaEnsured = true;
  }

  static _computeWorkoutCounts(exercises = []) {
    const exercises_count = Array.isArray(exercises) ? exercises.length : 0;
    const sets_count = (Array.isArray(exercises) ? exercises : []).reduce((sum, ex) => {
      const explicitSets = Number(ex?.sets);
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
    await WorkoutService.ensureWorkoutSchemaColumns();
    const {
      week_number,
      day_of_week,
      plan_date,
      include_all_workouts = true,
      all_workouts_limit = 25,
      missed_limit = 10,
    } = options;

    try {
      const referenceDate = WorkoutService._toYmd(plan_date) || WorkoutService._toYmd(new Date());
      const plannedWhere = [];
      const plannedParams = [userId];
      plannedWhere.push(`wp.user_id = $1`);
      // Planned rows are user-specific workouts with schedule fields filled.
      plannedWhere.push(`wp.week_number IS NOT NULL`);
      plannedWhere.push(`wp.day_of_week IS NOT NULL`);

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
          wp.status as plan_status,
          wp.created_at as plan_created_at,
          wp.updated_at as plan_updated_at,
          wp.id as workout_id,
          wp.name as workout_name,
          wp.description as workout_description,
          wp.duration_minutes,
          wp.difficulty as workout_difficulty,
          wp.workout_type,
          wp.estimated_calories,
          wp.thumbnail_url as workout_thumbnail_url,
          COALESCE(
            json_agg(
              json_build_object(
                'exercise_id', e.id,
                'title', e.title,
                'description', e.description,
                'video_url', e.video_url,
                'thumbnail_url', e.thumbnail_url,
                'audio_url', e.audio_url,
                'instructions', e.instructions,
                'category', e.category,
                'target_muscle_group', e.target_muscle_group,
                'duration_seconds', e.duration_seconds,
                'difficulty', e.difficulty,
                'default_rest_time_seconds', e.default_rest_time_seconds,
                'sequence_order', we.sequence_order,
                'target_sets', we.target_sets,
                'rest_time_seconds', we.rest_time_seconds,
                'exercise_duration_seconds', we.exercise_duration_seconds,
                'notes', we.notes
              )
              ORDER BY we.sequence_order
            ) FILTER (WHERE e.id IS NOT NULL),
            '[]'::json
          ) AS exercises
        FROM workouts wp
        LEFT JOIN workout_exercises we ON we.workout_id = wp.id
        LEFT JOIN exercises e ON e.id = we.exercise_id
        WHERE ${plannedWhere.join(" AND ")}
        GROUP BY wp.id
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
          wp.status as plan_status,
          wp.created_at as plan_created_at,
          wp.id as workout_id,
          wp.name as workout_name,
          wp.duration_minutes as duration_minutes,
          wp.difficulty as workout_difficulty,
          wp.workout_type as workout_type,
          wp.estimated_calories as estimated_calories,
          wp.thumbnail_url as workout_thumbnail_url
        FROM workouts wp
        WHERE wp.user_id = $1
          AND wp.status = 'missed'
          AND wp.week_number IS NOT NULL
          AND wp.day_of_week IS NOT NULL
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
            AND user_id IS NULL
          ORDER BY created_at DESC
          LIMIT $1
          `,
          [Number(all_workouts_limit)]
        );
        allWorkouts = allRes.rows;
      }

      // Build session/log progress for today's/planned workouts so frontend can
      // render exercise/set completion state from a single home payload.
      const plannedWorkoutIds = plannedRes.rows
        .map((r) => Number(r.workout_id))
        .filter((v) => Number.isInteger(v) && v > 0);
      const uniquePlannedWorkoutIds = [...new Set(plannedWorkoutIds)];

      const sessionByWorkoutId = new Map();
      const logsBySessionExerciseSet = new Map();
      let latestActiveSession = null;

      if (uniquePlannedWorkoutIds.length > 0) {
        const sessionsRes = await db.query(
          `
          SELECT s.*
          FROM user_workout_sessions s
          WHERE s.user_id = $1
            AND s.workout_id = ANY($2::int[])
          ORDER BY
            CASE WHEN s.status = 'active' THEN 0 ELSE 1 END,
            s.created_at DESC,
            s.id DESC
          `,
          [userId, uniquePlannedWorkoutIds]
        );

        for (const s of sessionsRes.rows) {
          if (!latestActiveSession && s.status === "active") latestActiveSession = s;
          if (!sessionByWorkoutId.has(Number(s.workout_id))) {
            sessionByWorkoutId.set(Number(s.workout_id), s);
          }
        }

        const sessionIds = sessionsRes.rows.map((s) => Number(s.id)).filter((v) => Number.isInteger(v) && v > 0);
        if (sessionIds.length > 0) {
          const logsRes = await db.query(
            `SELECT session_id, exercise_id, set_number, is_completed, actual_reps, actual_weight, created_at
             FROM workout_sets
             WHERE session_id = ANY($1::int[])
             ORDER BY created_at ASC, id ASC`,
            [sessionIds]
          );
          for (const l of logsRes.rows) {
            logsBySessionExerciseSet.set(
              `${l.session_id}:${l.exercise_id}:${l.set_number}`,
              l
            );
          }
        }
      }

      return {
        planned: plannedRes.rows.map((row) => {
          const matchedSession = sessionByWorkoutId.get(Number(row.workout_id)) || null;
          const sessionId = matchedSession?.id || null;

          const normalizedExercises = (row.exercises || []).map((ex) => {
            const normalized = WorkoutService._normalizeExerciseResponseFields(ex);
            const targetSets = Array.isArray(normalized.target_sets) ? normalized.target_sets : [];
            const targetSetsWithCompletion = targetSets.map((s, index) => {
              const setNumber = Number(s?.set_number || index + 1);
              const log = sessionId
                ? logsBySessionExerciseSet.get(
                    `${sessionId}:${normalized.exercise_id}:${setNumber}`
                  )
                : null;
              return {
                ...s,
                set_number: setNumber,
                completed: Boolean(log?.is_completed),
              };
            });

            const completedSets = targetSetsWithCompletion.filter((s) => s.completed).length;
            return {
              ...normalized,
              target_sets: targetSetsWithCompletion,
              completed_sets: completedSets,
              total_sets: targetSetsWithCompletion.length,
              completed:
                targetSetsWithCompletion.length > 0 &&
                completedSets === targetSetsWithCompletion.length,
            };
          });

          const workoutCompletedSets = normalizedExercises.reduce(
            (sum, ex) => sum + Number(ex.completed_sets || 0),
            0
          );
          const workoutTotalSets = normalizedExercises.reduce(
            (sum, ex) => sum + Number(ex.total_sets || 0),
            0
          );
          const workoutCompletedExercises = normalizedExercises.filter((ex) => ex.completed).length;

          return {
            plan: {
              id: row.plan_slot_id,
              week_number: row.week_number,
              day_of_week: row.day_of_week,
              plan_date: row.plan_date,
              status: row.plan_status,
              created_at: row.plan_created_at,
              updated_at: row.plan_updated_at,
            },
            session: matchedSession
              ? {
                  id: matchedSession.id,
                  status: matchedSession.status,
                  start_time: matchedSession.start_time,
                  end_time: matchedSession.end_time,
                  calories_burned: matchedSession.calories_burned,
                }
              : null,
            workout: row.workout_id
              ? {
                  id: row.workout_id,
                  name: row.workout_name,
                  description: row.workout_description,
                  duration_minutes: row.duration_minutes,
                  difficulty: row.workout_difficulty,
                  workout_type: row.workout_type,
                  burn_calories_target: row.estimated_calories,
                  thumbnail_url: row.workout_thumbnail_url,
                  exercises: normalizedExercises,
                  ...WorkoutService._computeWorkoutCounts(row.exercises || []),
                  progress: {
                    completed_sets: workoutCompletedSets,
                    total_sets: workoutTotalSets,
                    completed_exercises: workoutCompletedExercises,
                    total_exercises: normalizedExercises.length,
                    completed:
                      workoutTotalSets > 0 && workoutCompletedSets === workoutTotalSets,
                  },
                }
              : null,
          };
        }),
        missed: missedRes.rows.map((row) => ({
          plan: {
            id: row.plan_slot_id,
            week_number: row.week_number,
            day_of_week: row.day_of_week,
            plan_date: row.plan_date,
            status: row.plan_status,
            created_at: row.plan_created_at,
          },
          workout: row.workout_id
            ? {
                id: row.workout_id,
                name: row.workout_name,
                duration_minutes: row.duration_minutes,
                difficulty: row.workout_difficulty,
                workout_type: row.workout_type,
                burn_calories_target: row.estimated_calories,
                thumbnail_url: row.workout_thumbnail_url,
              }
            : null,
        })),
        recommendations: {
          all_workouts: allWorkouts.map((w) => {
            const { estimated_calories, ...rest } = w;
            return {
              ...rest,
              burn_calories_target: estimated_calories,
              // keep shape consistent; these may be filled when workout detail is fetched
              exercises_count: w.exercises_count ?? null,
              sets_count: w.sets_count ?? null,
            };
          }),
        },
        active_session: latestActiveSession
          ? {
              id: latestActiveSession.id,
              workout_id: latestActiveSession.workout_id,
              status: latestActiveSession.status,
              start_time: latestActiveSession.start_time,
              end_time: latestActiveSession.end_time,
              session_notes: latestActiveSession.session_notes || null,
            }
          : null,
        reference_date: referenceDate,
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
    await WorkoutService.ensureWorkoutSchemaColumns();
    const {
      include_exercises = true,
      page = 1,
      limit = 10,
      q,
      sort_by = "created_at",
      sort_order = "desc",
      not_pagination,
    } = options;
    const disablePagination = parseBoolean(not_pagination, false);
    const { page: pageNum, limit: limitNum, offset } = validatePaginationParams(page, limit);

    const sortColumns = {
      id: "w.id",
      name: "w.name",
      duration_minutes: "w.duration_minutes",
      difficulty: "w.difficulty",
      workout_type: "w.workout_type",
      estimated_calories: "w.estimated_calories",
      created_at: "w.created_at",
      updated_at: "w.updated_at",
    };
    const safeSortBy = sortColumns[String(sort_by || "").toLowerCase()] || "w.created_at";
    const safeSortOrder = String(sort_order || "").toLowerCase() === "asc" ? "ASC" : "DESC";

    try {
      const baseWhere = ["w.deleted_at IS NULL", "w.user_id IS NULL"];
      const whereParams = [];
      const search = buildPartialSearchClause(
        ["w.name", "w.description", "w.workout_type", "w.difficulty"],
        q,
        1
      );
      if (search.clause) {
        baseWhere.push(search.clause);
        whereParams.push(...search.params);
      }
      const whereSql = baseWhere.join(" AND ");

      const countRes = await db.query(
        `SELECT COUNT(*)::int AS total FROM workouts w WHERE ${whereSql}`,
        whereParams
      );
      const total = countRes.rows[0]?.total || 0;

      if (!include_exercises) {
        const params = [...whereParams];
        let paginationSql = "";
        if (!disablePagination) {
          params.push(limitNum, offset);
          paginationSql = ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
        }
        const result = await db.query(
          `SELECT *
           FROM workouts w
           WHERE ${whereSql}
           ORDER BY ${safeSortBy} ${safeSortOrder}, w.id DESC
           ${paginationSql}`,
          params
        );
        return {
          workouts: result.rows,
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
      }

      const params = [...whereParams];
      let paginationSql = "";
      if (!disablePagination) {
        params.push(limitNum, offset);
        paginationSql = ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
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
                'video_url', e.video_url,
                'thumbnail_url', e.thumbnail_url,
                'audio_url', e.audio_url,
                'instructions', e.instructions,
                'category', e.category,
                'target_muscle_group', e.target_muscle_group,
                'duration_seconds', e.duration_seconds,
                'difficulty', e.difficulty,
                'default_rest_time_seconds', e.default_rest_time_seconds,
                'sequence_order', we.sequence_order,
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
        WHERE ${whereSql}
        GROUP BY w.id
        ORDER BY ${safeSortBy} ${safeSortOrder}, w.id DESC
        ${paginationSql}
        `,
        params
      );

      // Add computed counts on each workout
      return {
        workouts: result.rows.map((row) => ({
          ...row,
          ...WorkoutService._computeWorkoutCounts(row.exercises || []),
        })),
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
      logger.error(`Error finding workouts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get workout with its exercises
   */
  static async findById(id) {
    await WorkoutService.ensureWorkoutSchemaColumns();
    try {
      const workoutRes = await db.query(
        "SELECT * FROM workouts WHERE id = $1 AND deleted_at IS NULL AND user_id IS NULL",
        [id]
      );
      
      if (!workoutRes.rows[0]) return null;

      const exercisesRes = await db.query(
        `SELECT
           e.*,
           we.sequence_order,
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
    await WorkoutService.ensureWorkoutSchemaColumns();
    const { max_duration_minutes = 20, limit = 20, offset = 0 } = options;
    try {
      const result = await db.query(
        `
        SELECT id, name, description, duration_minutes, difficulty, workout_type,
               estimated_calories, thumbnail_url, created_at
        FROM workouts
        WHERE deleted_at IS NULL
          AND user_id IS NULL
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
   * Admin: list workouts created for a specific user
   */
  static async findAllByUserId(userId, options = {}) {
    await WorkoutService.ensureWorkoutSchemaColumns();
    const {
      include_exercises = true,
      page = 1,
      limit = 10,
      q,
      sort_by = "created_at",
      sort_order = "desc",
      not_pagination,
    } = options;
    const disablePagination = parseBoolean(not_pagination, false);
    const { page: pageNum, limit: limitNum, offset } = validatePaginationParams(page, limit);

    const sortColumns = {
      id: "w.id",
      name: "w.name",
      duration_minutes: "w.duration_minutes",
      difficulty: "w.difficulty",
      workout_type: "w.workout_type",
      estimated_calories: "w.estimated_calories",
      week_number: "w.week_number",
      day_of_week: "w.day_of_week",
      created_at: "w.created_at",
      updated_at: "w.updated_at",
    };
    const safeSortBy = sortColumns[String(sort_by || "").toLowerCase()] || "w.created_at";
    const safeSortOrder = String(sort_order || "").toLowerCase() === "asc" ? "ASC" : "DESC";

    try {
      const whereParams = [userId];
      const whereParts = ["w.deleted_at IS NULL", "w.user_id = $1"];
      const search = buildPartialSearchClause(
        ["w.name", "w.description", "w.workout_type", "w.difficulty"],
        q,
        whereParams.length + 1
      );
      if (search.clause) {
        whereParts.push(search.clause);
        whereParams.push(...search.params);
      }
      const whereSql = whereParts.join(" AND ");

      const countRes = await db.query(
        `SELECT COUNT(*)::int AS total FROM workouts w WHERE ${whereSql}`,
        whereParams
      );
      const total = countRes.rows[0]?.total || 0;

      const params = [...whereParams];
      let paginationSql = "";
      if (!disablePagination) {
        params.push(limitNum, offset);
        paginationSql = ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
      }

      if (!include_exercises) {
        const result = await db.query(
          `SELECT *
           FROM workouts w
           WHERE ${whereSql}
           ORDER BY ${safeSortBy} ${safeSortOrder}, w.id DESC
           ${paginationSql}`,
          params
        );
        return {
          workouts: result.rows,
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
                'video_url', e.video_url,
                'thumbnail_url', e.thumbnail_url,
                'audio_url', e.audio_url,
                'instructions', e.instructions,
                'category', e.category,
                'target_muscle_group', e.target_muscle_group,
                'duration_seconds', e.duration_seconds,
                'difficulty', e.difficulty,
                'default_rest_time_seconds', e.default_rest_time_seconds,
                'sequence_order', we.sequence_order,
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
        WHERE ${whereSql}
        GROUP BY w.id
        ORDER BY ${safeSortBy} ${safeSortOrder}, w.id DESC
        ${paginationSql}
        `,
        params
      );

      return {
        workouts: result.rows.map((row) => ({
          ...row,
          ...WorkoutService._computeWorkoutCounts(row.exercises || []),
        })),
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
      logger.error(`Error finding user workouts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new workout template (AI-generated from frontend)
   */
  static async create(workoutData) {
    await WorkoutService.ensureWorkoutSchemaColumns();
    const {
      user_id,
      week_number,
      day_of_week,
      plan_date,
      status,
      assigned_reason,
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
           assigned_reason
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, 'pending'), $13)
         RETURNING *`,
        [
          user_id ?? null,
          name,
          description,
          duration_minutes,
          difficulty,
          workout_type,
          estimated_calories,
          thumbnail_url,
          week_number ?? null,
          day_of_week ?? null,
          plan_date ?? null,
          status ?? null,
          assigned_reason ?? null,
        ]
      );
      const workoutId = workoutRes.rows[0].id;

      // 2. Map Exercises (assuming ids are provided)
      if (exercises && Array.isArray(exercises)) {
        for (const [index, exercise] of exercises.entries()) {
          const normalizedTargetSets =
            Array.isArray(exercise.target_sets) && exercise.target_sets.length > 0
              ? exercise.target_sets
              : Array.from({ length: Number(exercise.sets || 0) }, (_, idx) => ({
                  set_number: idx + 1,
                  target_reps:
                    exercise.reps !== undefined && exercise.reps !== null
                      ? Number(exercise.reps)
                      : null,
                  target_weight:
                    exercise.weight !== undefined && exercise.weight !== null
                      ? Number(exercise.weight)
                      : null,
                }));

          await client.query(
            `INSERT INTO workout_exercises (
               workout_id,
               exercise_id,
               sequence_order,
               target_sets,
               rest_time_seconds,
               exercise_duration_seconds,
               notes
             ) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              workoutId, 
              exercise.id, 
              index + 1, 
              JSON.stringify(normalizedTargetSets),
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
