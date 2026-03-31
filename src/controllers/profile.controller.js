const ProfileService = require("../services/profile.service");
const RewardService = require("../services/reward.service");
const BadgeService = require("../services/badge.service");
const ReminderService = require("../services/reminder.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");
const { validatePaginationParams, generatePagination } = require("../utils/pagination");

function stripReminderField(profile) {
    if (!profile) return profile;
    const { reminder, ...rest } = profile;
    return rest;
}

/**
 * Create a profile for the authenticated user.
 * The frontend uploads the image to Cloudinary and passes the resulting URL
 * in the request body as `profile_image` (and optionally `profile_field`).
 *
 * POST /api/profiles
 * Body: { profile_image, reminder, plan_key, goal_id, profile_field }
 */
exports.createProfile = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const { profile_image, address, reminder, plan_key, goal_id, profile_field, mentor_gender, gender, qa_list, job_type } = req.body;

    // Check if a profile already exists for this user
    const existing = await ProfileService.findByUserId(userId);
    if (existing) {
        return next(new AppError("Profile already exists for this user. Use PUT to update.", 409));
    }

    const profile = await ProfileService.create({
        user_id: userId,
        profile_image,
        address,
        reminder,
        plan_key,
        goal_id,
        mentor_gender,
        gender,
        qa_list,
        job_type,
    });

    return apiResponse(res, 201, "Resource created successfully", {
        profile: stripReminderField(profile),
    });
});

/**
 * Get the profile of the currently authenticated user.
 *
 * GET /api/profiles/me
 */
exports.getMyProfile = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;

    const profile = await ProfileService.findByUserId(userId);

    if (!profile) {
        return next(new AppError("Resource not found", 404));
    }

    const profile_completion_percentage =
        ProfileService.calculateProfileCompletionPercentage(profile);
    const balance = await RewardService.getUserBalance(userId);
    const badge = await BadgeService.getUserActiveBadge(balance.current_balance);
    const reminder = await ReminderService.getOrCreate(userId);

    return apiResponse(res, 200, "Resource retrieved successfully", {
        profile: stripReminderField(profile),
        profile_completion_percentage,
        balance,
        badge: badge || null,
        reminder,
    });
});

/**
 * Get a profile by its profile ID (admin or owner).
 *
 * GET /api/profiles/:id
 */
exports.getProfileById = asyncHandler(async (req, res, next) => {
    const idInt = parseInt(req.params.id, 10);
    if (Number.isNaN(idInt)) return next(new AppError("Invalid id parameter", 400));

    const profile = await ProfileService.findById(idInt);

    if (!profile) {
        return next(new AppError("Resource not found", 404));
    }

    // Only allow the owner or an admin to view
    if (profile.user_id !== req.user.id && req.user.role !== "admin") {
        return next(new AppError("You do not have permission to perform this action", 403));
    }

    return apiResponse(res, 200, "Resource retrieved successfully", {
        profile: stripReminderField(profile),
    });
});

/**
 * Get all profiles (admin only) with pagination.
 *
 * GET /api/profiles?page=1&limit=10
 */
exports.getAllProfiles = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 10 } = req.query;
    const { page: pageNum, limit: limitNum } = validatePaginationParams(page, limit);

    const result = await ProfileService.findAll({ page: pageNum, limit: limitNum });

    return apiResponse(res, 200, "Resources retrieved successfully", {
        profiles: (result.profiles || []).map(stripReminderField),
        pagination: result.pagination,
    });
});

/**
 * Update the authenticated user's profile.
 * Pass `profile_image` as a Cloudinary URL from the frontend.
 *
 * PUT /api/profiles/:id
 * Body: { profile_image, reminder, plan_key, goal_id, profile_field }
 */
exports.updateProfile = asyncHandler(async (req, res, next) => {
    const idInt = parseInt(req.params.id, 10);
    if (Number.isNaN(idInt)) return next(new AppError("Invalid id parameter", 400));

    const { profile_image, address, reminder, plan_key, goal_id, profile_field, mentor_gender, gender, qa_list, job_type } = req.body;

    // Normalize/validate qa_list if provided
    let parsedQaList = undefined;
    if (qa_list !== undefined) {
        if (typeof qa_list === "string") {
            try {
                parsedQaList = JSON.parse(qa_list);
            } catch (err) {
                return next(new AppError("Invalid qa_list JSON", 400));
            }
        } else {
            parsedQaList = qa_list;
        }
    }

    // Fetch existing record to verify ownership
    const existing = await ProfileService.findById(idInt);

    if (!existing) {
        return next(new AppError("Resource not found", 404));
    }

    if (existing.user_id !== req.user.id && req.user.role !== "admin") {
        return next(new AppError("You do not have permission to perform this action", 403));
    }

    const updatedProfile = await ProfileService.update(idInt, {
        profile_image,
        address,
        reminder,
        plan_key,
        goal_id,
        mentor_gender,
        gender,
        qa_list: parsedQaList,
        job_type,
    });

    if (!updatedProfile) {
        return next(new AppError("No fields to update", 400));
    }

    return apiResponse(res, 200, "Resource updated successfully", {
        profile: stripReminderField(updatedProfile),
    });
});

/**
 * Delete (soft-delete) a profile.
 *
 * DELETE /api/profiles/:id
 */
exports.deleteProfile = asyncHandler(async (req, res, next) => {
    const { id } = req.params;

    const existing = await ProfileService.findById(id);

    if (!existing) {
        return next(new AppError("Resource not found", 404));
    }

    if (existing.user_id !== req.user.id && req.user.role !== "admin") {
        return next(new AppError("You do not have permission to perform this action", 403));
    }

    await ProfileService.delete(id);

    return apiResponse(res, 200, "Resource deleted successfully");
});

/**
 * Save goal settings for current user and link goal with profile.
 *
 * PUT /api/profiles/me/goal
 * Body: { goal_type, plan_duration, goal_weight }
 */
exports.updateMyGoalSettings = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;
    const goal_type = req.body.goal_type ?? req.body.goalType;
    const plan_duration = req.body.plan_duration ?? req.body.planDuration;
    const goal_weight = req.body.goal_weight ?? req.body.goalWeight;

    if (!goal_type || !String(goal_type).trim()) {
        return next(new AppError("goal_type is required", 400));
    }

    if (
        goal_weight !== undefined &&
        goal_weight !== null &&
        goal_weight !== "" &&
        !Number.isFinite(Number(goal_weight))
    ) {
        return next(new AppError("goal_weight must be a valid number", 400));
    }

    const profile = await ProfileService.upsertGoalSettings(userId, {
        goal_type,
        plan_duration,
        goal_weight,
    });

    return apiResponse(res, 200, "Goal settings saved successfully", {
        profile: stripReminderField(profile),
    });
});
