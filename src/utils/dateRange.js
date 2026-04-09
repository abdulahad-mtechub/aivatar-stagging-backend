const AppError = require("./appError");
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value) {
  if (!DATE_ONLY_REGEX.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function getValidatedDateRange(query = {}) {
  const startRaw = query.start_date;
  const endRaw = query.end_date;

  const start_date =
    startRaw === undefined || startRaw === null || String(startRaw).trim() === ""
      ? null
      : String(startRaw).trim();
  const end_date =
    endRaw === undefined || endRaw === null || String(endRaw).trim() === ""
      ? null
      : String(endRaw).trim();

  if (start_date && !isValidDateOnly(start_date)) {
    throw new AppError("start_date must be in YYYY-MM-DD format", 400);
  }
  if (end_date && !isValidDateOnly(end_date)) {
    throw new AppError("end_date must be in YYYY-MM-DD format", 400);
  }
  if (start_date && end_date && start_date > end_date) {
    throw new AppError("start_date must be less than or equal to end_date", 400);
  }

  return { start_date, end_date };
}

function buildTimestampDateRangeFilter(columnSql, start_date, end_date, startIndex) {
  const clauses = [];
  const params = [];
  let idx = startIndex;

  if (start_date) {
    clauses.push(`${columnSql} >= $${idx}::date`);
    params.push(start_date);
    idx += 1;
  }

  if (end_date) {
    clauses.push(`${columnSql} < ($${idx}::date + INTERVAL '1 day')`);
    params.push(end_date);
  }

  return { clauses, params };
}

module.exports = {
  getValidatedDateRange,
  buildTimestampDateRangeFilter,
};
