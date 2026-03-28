const AnalyticsService = require("../services/analytics.service");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { apiResponse } = require("../utils/apiResponse");

const TRUNC_UNITS = new Set(["day", "week", "month", "year"]);

function utcStartOfDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function utcStartOfNextDay(d) {
  const t = utcStartOfDay(d);
  t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

function parseYmd(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  const s = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    throw new AppError(`${fieldName} must be YYYY-MM-DD`, 400);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) {
    throw new AppError(`${fieldName} is not a valid calendar date`, 400);
  }
  return dt;
}

function formatPeriodLabel(truncUnit, periodStart) {
  if (!periodStart) return null;
  const d = new Date(periodStart);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (truncUnit === "year") return String(y);
  if (truncUnit === "month") return `${y}-${mo}`;
  return `${y}-${mo}-${day}`;
}

exports.getUserAnalytics = asyncHandler(async (req, res) => {
  const data = await AnalyticsService.getUserStats();
  return apiResponse(res, 200, "User analytics retrieved successfully", data);
});

/**
 * GET /api/analytics/users/timeseries
 * Query: group=day|week|month|year (default month)
 *        from=YYYY-MM-DD (optional), to=YYYY-MM-DD (optional)
 *        If from omitted: all registrations from the beginning up to to (or now).
 *        If to omitted: from from (or beginning) through end of today UTC.
 * Calendar shortcut (cannot mix with from/to): year + month both required — limits to that calendar month (UTC).
 */
exports.getUserRegistrationsTimeseries = asyncHandler(async (req, res, next) => {
  const groupRaw = (req.query.group || req.query.granularity || "month").toLowerCase();
  if (!TRUNC_UNITS.has(groupRaw)) {
    return next(
      new AppError("group must be one of: day, week, month, year", 400)
    );
  }

  const fromQ = req.query.from;
  const toQ = req.query.to;
  const hasFromTo = fromQ !== undefined && String(fromQ).trim() !== "";
  const hasTo = toQ !== undefined && String(toQ).trim() !== "";

  const hasYear = req.query.year !== undefined && String(req.query.year).trim() !== "";
  const hasMonth = req.query.month !== undefined && String(req.query.month).trim() !== "";

  let fromInclusive = null;
  let toExclusive = null;

  if (hasFromTo || hasTo) {
    if (hasYear || hasMonth) {
      return next(
        new AppError("Use either from/to or year+month, not both", 400)
      );
    }
    const fromParsed = hasFromTo ? parseYmd(fromQ, "from") : null;
    const toParsed = hasTo ? parseYmd(toQ, "to") : null;
    fromInclusive = fromParsed ? utcStartOfDay(fromParsed) : null;
    if (toParsed) {
      toExclusive = utcStartOfNextDay(toParsed);
    } else {
      toExclusive = utcStartOfNextDay(new Date());
    }
    if (fromInclusive && toExclusive && fromInclusive >= toExclusive) {
      return next(new AppError("from must be before to", 400));
    }
  } else if (hasYear || hasMonth) {
    if (!hasYear || !hasMonth) {
      return next(
        new AppError(
          "When filtering by calendar date, both year and month are required (month 1-12)",
          400
        )
      );
    }
    const y = Number.parseInt(req.query.year, 10);
    const mo = Number.parseInt(req.query.month, 10);
    if (!Number.isFinite(y) || y < 1970 || y > 2100) {
      return next(new AppError("year must be a valid number", 400));
    }
    if (!Number.isFinite(mo) || mo < 1 || mo > 12) {
      return next(new AppError("month must be 1-12", 400));
    }
    fromInclusive = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
    toExclusive = mo === 12
      ? new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0, 0))
      : new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
  } else {
    const now = new Date();
    toExclusive = utcStartOfNextDay(now);
    const defFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1, 0, 0, 0, 0));
    fromInclusive = defFrom;
  }

  const series = await AnalyticsService.getUserRegistrationsSeries({
    truncUnit: groupRaw,
    fromInclusive,
    toExclusive,
  });

  const payload = {
    group: groupRaw,
    from: fromInclusive ? fromInclusive.toISOString() : null,
    to_exclusive: toExclusive ? toExclusive.toISOString() : null,
    series: series.map((row) => ({
      period_start: row.period_start
        ? new Date(row.period_start).toISOString()
        : null,
      label: formatPeriodLabel(groupRaw, row.period_start),
      count: row.count,
    })),
  };

  return apiResponse(
    res,
    200,
    "User registration timeseries retrieved successfully",
    payload
  );
});
