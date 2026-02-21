-- MMT Assessment Tool Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Question sets (versioned)
CREATE TABLE IF NOT EXISTS question_sets (
  id SERIAL PRIMARY KEY,
  version INTEGER NOT NULL UNIQUE,
  categories JSONB NOT NULL,
  indicators JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Assessments (synced from clients)
CREATE TABLE IF NOT EXISTS assessments (
  id VARCHAR(50) PRIMARY KEY,  -- assessment_YYYYMMDD_HHMMSS
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,  -- Full assessment object
  question_set_version INTEGER NOT NULL,
  created_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT NOW()
);

-- Media attachments
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  assessment_id VARCHAR(50) REFERENCES assessments(id) ON DELETE CASCADE,
  filename VARCHAR(255),
  filepath VARCHAR(500),
  file_type VARCHAR(50),
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_assessments_user_id ON assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments(created_at);
CREATE INDEX IF NOT EXISTS idx_media_assessment_id ON media(assessment_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_version ON question_sets(version);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password_hash, email, role) 
VALUES ('admin', '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', 'admin@example.com', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert initial question set (version 1) - this will be populated from the frontend data
-- You'll need to run a separate migration or admin API call to populate this
