-- Demo videos (run on DBs that already applied init.sql before this table existed)

CREATE TABLE IF NOT EXISTS demo_videos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_videos_is_active ON demo_videos(is_active);
CREATE INDEX IF NOT EXISTS idx_demo_videos_created_at ON demo_videos(created_at DESC);
