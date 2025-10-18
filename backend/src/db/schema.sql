DROP TABLE IF EXISTS podcasts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS api_keys;

CREATE TABLE podcasts (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  rss_url TEXT NOT NULL,
  title TEXT,
  image_url TEXT,
  description TEXT
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,  
  email TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
);

CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,  
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL
);