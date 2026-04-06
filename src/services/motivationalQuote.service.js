const db = require('../config/database');
const logger = require('../utils/logger');

class MotivationalQuoteService {
  static async create(data) {
    const { text, author, frequency = 'daily', day_of_week, scheduled_at } = data;

    // Basic validation
    if (!text) throw new Error("Quote text is required");
    if (frequency === 'weekly' && !day_of_week) throw new Error("day_of_week is required for weekly quotes");
    if (frequency === 'one-off' && !scheduled_at) throw new Error("scheduled_at is required for one-off quotes");

    const res = await db.query(
      `INSERT INTO motivational_quotes (text, author, frequency, day_of_week, scheduled_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [text, author, frequency, day_of_week, scheduled_at]
    );
    return res.rows[0];
  }

  static async update(id, data) {
    const { text, author, frequency, day_of_week, scheduled_at, is_active } = data;
    
    // Build dynamic update query
    const fields = [];
    const values = [];
    let i = 1;

    if (text !== undefined) { fields.push(`text = $${i++}`); values.push(text); }
    if (author !== undefined) { fields.push(`author = $${i++}`); values.push(author); }
    if (frequency !== undefined) { fields.push(`frequency = $${i++}`); values.push(frequency); }
    if (day_of_week !== undefined) { fields.push(`day_of_week = $${i++}`); values.push(day_of_week); }
    if (scheduled_at !== undefined) { fields.push(`scheduled_at = $${i++}`); values.push(scheduled_at); }
    if (is_active !== undefined) { fields.push(`is_active = $${i++}`); values.push(is_active); }

    if (fields.length === 0) return null;

    values.push(id);
    const res = await db.query(
      `UPDATE motivational_quotes SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      values
    );
    return res.rows[0];
  }

  static async delete(id) {
    const res = await db.query(`DELETE FROM motivational_quotes WHERE id = $1 RETURNING *`, [id]);
    return res.rows[0];
  }

  static async list(filters = {}) {
    const { frequency, is_active } = filters;
    const where = [];
    const params = [];
    let i = 1;

    if (frequency) { where.push(`frequency = $${i++}`); params.push(frequency); }
    if (is_active !== undefined) { where.push(`is_active = $${i++}`); params.push(is_active === 'true' || is_active === true); }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const res = await db.query(
      `SELECT * FROM motivational_quotes ${whereClause} ORDER BY created_at DESC`,
      params
    );
    return res.rows;
  }

  /**
   * Fetches quotes that should be sent according to current time and frequency.
   */
  static async getDueQuotes() {
    const now = new Date();
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // JS 0=Sun -> DB 7=Sun

    // 1. One-off quotes scheduled for now (within last 5 mins to catch missed ticks)
    // 2. Weekly quotes for today
    // 3. Daily quotes
    const query = `
      SELECT * FROM motivational_quotes
      WHERE is_active = true
      AND (
        (frequency = 'one-off' AND scheduled_at <= NOW() AND scheduled_at > NOW() - INTERVAL '5 minutes')
        OR (frequency = 'weekly' AND day_of_week = $1)
        OR (frequency = 'daily')
      )
    `;
    const res = await db.query(query, [dayOfWeek]);
    return res.rows;
  }
}

module.exports = MotivationalQuoteService;
