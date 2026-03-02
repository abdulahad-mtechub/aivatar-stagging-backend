/**
 * Pagination Utility
 * Provides standardized pagination format across the entire application
 */

/**
 * Generate standardized pagination object
 * @param {number|string} page - Current page number
 * @param {number|string} limit - Items per page
 * @param {number} total - Total number of items
 * @returns {object} Standardized pagination object
 */
const generatePagination = (page, limit, total) => {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  const totalNum = parseInt(total, 10) || 0;

  return {
    page: pageNum,
    limit: limitNum,
    total: totalNum,
    pages: Math.ceil(totalNum / limitNum),
    has_next: pageNum * limitNum < totalNum,
    has_prev: pageNum > 1,
  };
};

/**
 * Calculate pagination offset
 * @param {number|string} page - Current page number
 * @param {number|string} limit - Items per page
 * @returns {number} Calculated offset
 */
const calculateOffset = (page, limit) => {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 10;
  return (pageNum - 1) * limitNum;
};

/**
 * Validate and sanitize pagination parameters
 * @param {number|string} page - Current page number
 * @param {number|string} limit - Items per page
 * @param {number} maxLimit - Maximum allowed limit (default: 100)
 * @returns {object} Validated pagination parameters
 */
const validatePaginationParams = (page, limit, maxLimit = 100) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 10));

  return {
    page: pageNum,
    limit: limitNum,
    offset: calculateOffset(pageNum, limitNum),
  };
};

/**
 * Generate pagination for empty results
 * @param {number|string} page - Current page number
 * @param {number|string} limit - Items per page
 * @returns {object} Pagination object for empty results
 */
const generateEmptyPagination = (page, limit) => {
  return generatePagination(page, limit, 0);
};

/**
 * Generate pagination with additional metadata
 * @param {number|string} page - Current page number
 * @param {number|string} limit - Items per page
 * @param {number} total - Total number of items
 * @param {object} additionalMeta - Additional metadata to include
 * @returns {object} Extended pagination object
 */
const generateExtendedPagination = (
  page,
  limit,
  total,
  additionalMeta = {}
) => {
  const pagination = generatePagination(page, limit, total);

  return {
    ...pagination,
    ...additionalMeta,
    // Add some common computed fields
    has_data: total > 0,
    current_page_items: Math.min(
      pagination.limit,
      Math.max(0, total - (pagination.page - 1) * pagination.limit)
    ),
    range: {
      start: total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0,
      end: Math.min(pagination.page * pagination.limit, total),
    },
  };
};

module.exports = {
  generatePagination,
  calculateOffset,
  validatePaginationParams,
  generateEmptyPagination,
  generateExtendedPagination,
};

