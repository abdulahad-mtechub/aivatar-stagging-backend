const db = require("../config/database");
const logger = require("../utils/logger");
const AppError = require("../utils/appError");

class CoinPriceService {
  static normalizePayload(payload = {}) {
    const coins = Number(payload.coins);
    const rawPrice =
      payload.coinsPrice !== undefined
        ? payload.coinsPrice
        : payload.coinsprice !== undefined
          ? payload.coinsprice
          : payload.coins_price;
    const coinsPrice = Number(rawPrice);
    const currency = String(payload.currency || "").trim().toUpperCase();

    if (!Number.isFinite(coins) || coins <= 0) {
      throw new AppError("coins must be a positive number", 400);
    }
    if (!Number.isFinite(coinsPrice) || coinsPrice < 0) {
      throw new AppError("coinsPrice must be a non-negative number", 400);
    }
    if (!currency) {
      throw new AppError("currency is required", 400);
    }

    return { coins, coinsPrice, currency };
  }

  static async upsertSingleton(payload = {}) {
    const { coins, coinsPrice, currency } = this.normalizePayload(payload);

    try {
      const existingRes = await db.query(
        `SELECT id
         FROM coin_prices
         ORDER BY created_at DESC
         LIMIT 1`
      );

      const existing = existingRes.rows[0];
      if (!existing) {
        const insertRes = await db.query(
          `INSERT INTO coin_prices (coins, coins_price, currency)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [coins, coinsPrice, currency]
        );
        return { row: insertRes.rows[0], created: true };
      }

      const updateRes = await db.query(
        `UPDATE coin_prices
         SET coins = $1, coins_price = $2, currency = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [coins, coinsPrice, currency, existing.id]
      );

      await db.query(`DELETE FROM coin_prices WHERE id <> $1`, [existing.id]);
      return { row: updateRes.rows[0], created: false };
    } catch (error) {
      logger.error(`Error upserting coin price: ${error.message}`);
      throw error;
    }
  }

  static async getCurrent() {
    const res = await db.query(
      `SELECT * FROM coin_prices
       ORDER BY created_at DESC`
    );
    return res.rows[0] || null;
  }

  static async update(id, payload = {}) {
    const fields = [];
    const values = [];
    let i = 1;

    if (payload.coins !== undefined) {
      const coins = Number(payload.coins);
      if (!Number.isFinite(coins) || coins <= 0) {
        throw new AppError("coins must be a positive number", 400);
      }
      fields.push(`coins = $${i++}`);
      values.push(coins);
    }

    const rawPrice =
      payload.coinsPrice !== undefined
        ? payload.coinsPrice
        : payload.coinsprice !== undefined
          ? payload.coinsprice
          : payload.coins_price;
    if (rawPrice !== undefined) {
      const coinsPrice = Number(rawPrice);
      if (!Number.isFinite(coinsPrice) || coinsPrice < 0) {
        throw new AppError("coinsPrice must be a non-negative number", 400);
      }
      fields.push(`coins_price = $${i++}`);
      values.push(coinsPrice);
    }

    if (payload.currency !== undefined) {
      const currency = String(payload.currency || "").trim().toUpperCase();
      if (!currency) {
        throw new AppError("currency cannot be empty", 400);
      }
      fields.push(`currency = $${i++}`);
      values.push(currency);
    }

    if (fields.length === 0) {
      throw new AppError("At least one field is required to update", 400);
    }

    values.push(id);
    const res = await db.query(
      `UPDATE coin_prices
       SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${i}
       RETURNING *`,
      values
    );
    return res.rows[0] || null;
  }

  static async remove(id) {
    const res = await db.query(
      `DELETE FROM coin_prices
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return res.rows[0] || null;
  }
}

module.exports = CoinPriceService;
