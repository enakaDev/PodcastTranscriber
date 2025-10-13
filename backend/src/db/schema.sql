DROP TABLE IF EXISTS podcasts;

CREATE TABLE podcasts (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  rss_url TEXT NOT NULL,
  title TEXT,
  image_url TEXT,
  description TEXT
);
