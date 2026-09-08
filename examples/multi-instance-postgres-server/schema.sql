CREATE TABLE IF NOT EXISTS harvest_reports (
  garden_bed text NOT NULL,
  harvest_date date NOT NULL,
  shelling_count integer NOT NULL CHECK (shelling_count >= 0),
  snap_count integer NOT NULL CHECK (snap_count >= 0),
  PRIMARY KEY (garden_bed, harvest_date)
);
