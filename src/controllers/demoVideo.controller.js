const DemoVideoService = require("../services/demoVideo.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { getValidatedDateRange } = require("../utils/dateRange");

function parseId(param) {
  const id = Number.parseInt(param, 10);
  if (!Number.isFinite(id) || id < 1) return null;
  return id;
}

/** Stops the request if not an authenticated admin (defense if route middleware is miswired). */
function assertAdminRequest(req, res) {
  if (!req.user) {
    errorResponse(res, "You are not logged in. Please log in to access.", 401);
    return false;
  }
  if (req.user.role !== "admin") {
    errorResponse(res, "You do not have permission to perform this action", 403);
    return false;
  }
  return true;
}

class DemoVideoController {
  static listActiveForUser = asyncHandler(async (req, res) => {
    const videos = await DemoVideoService.listActive();
    return successResponse(res, { message: "Demo videos fetched", data: videos });
  });

  static getActiveById = asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, "Invalid video id", 400);
    const video = await DemoVideoService.findActiveById(id);
    if (!video) return errorResponse(res, "Demo video not found", 404);
    return successResponse(res, { message: "Demo video fetched", data: video });
  });

  static listAllAdmin = asyncHandler(async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    const { start_date, end_date } = getValidatedDateRange(req.query || {});
    const result = await DemoVideoService.listAllForAdmin({
      page: req.query.page,
      limit: req.query.limit,
      q: req.query.q,
      sort_by: req.query.sort_by,
      sort_order: req.query.sort_order,
      not_pagination: req.query.not_pagination,
      start_date,
      end_date,
    });
    return successResponse(res, { message: "Demo videos fetched", data: result });
  });

  static getByIdAdmin = asyncHandler(async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, "Invalid video id", 400);
    const video = await DemoVideoService.findByIdForAdmin(id);
    if (!video) return errorResponse(res, "Demo video not found", 404);
    return successResponse(res, { message: "Demo video fetched", data: video });
  });

  static create = asyncHandler(async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    const { title, description, video_url, image_url, is_active } = req.body;
    if (!title || !video_url) {
      return errorResponse(res, "title and video_url are required", 400);
    }
    const video = await DemoVideoService.create({
      title,
      description,
      video_url,
      image_url,
      is_active,
    });
    return successResponse(res, { message: "Demo video created", data: video }, 201);
  });

  static update = asyncHandler(async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, "Invalid video id", 400);
    const video = await DemoVideoService.update(id, req.body);
    if (!video) return errorResponse(res, "Demo video not found", 404);
    return successResponse(res, { message: "Demo video updated", data: video });
  });

  static remove = asyncHandler(async (req, res) => {
    if (!assertAdminRequest(req, res)) return;
    const id = parseId(req.params.id);
    if (!id) return errorResponse(res, "Invalid video id", 400);
    const video = await DemoVideoService.delete(id);
    if (!video) return errorResponse(res, "Demo video not found", 404);
    return successResponse(res, { message: "Demo video deleted", data: video });
  });
}

module.exports = DemoVideoController;
