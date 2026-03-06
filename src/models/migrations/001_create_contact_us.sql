-- Migration: Create contact_us table
-- Created at: 2026-03-06

CREATE TABLE IF NOT EXISTS contact_us (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  query TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contact_us_email ON contact_us(email);
CREATE INDEX IF NOT EXISTS idx_contact_us_deleted_at ON contact_us(deleted_at);
