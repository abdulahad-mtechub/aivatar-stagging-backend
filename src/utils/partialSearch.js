function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return defaultValue;
}

function normalizeSearchTerm(value) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : "";
}

function buildPartialSearchClause(columns = [], searchTerm = "", startParamIndex = 1) {
  const q = normalizeSearchTerm(searchTerm);
  if (!q || !Array.isArray(columns) || columns.length === 0) {
    return {
      clause: "",
      params: [],
      nextParamIndex: startParamIndex,
    };
  }

  const clauses = columns.map((col, idx) => `${col} ILIKE $${startParamIndex + idx}`);
  const token = `%${q}%`;
  const params = columns.map(() => token);

  return {
    clause: `(${clauses.join(" OR ")})`,
    params,
    nextParamIndex: startParamIndex + columns.length,
  };
}

module.exports = {
  parseBoolean,
  normalizeSearchTerm,
  buildPartialSearchClause,
};
