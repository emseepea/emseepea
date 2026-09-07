CREATE TABLE IF NOT EXISTS pea_plants (
  name text PRIMARY KEY,
  pea_type text NOT NULL CHECK (pea_type IN ('shelling', 'snap'))
);

INSERT INTO pea_plants (name, pea_type) VALUES
  ('Harbour Gem', 'shelling'),
  ('Highland Snap', 'snap'),
  ('Meadow Sweet', 'snap'),
  ('Garden Pearl', 'shelling')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS reports (
  report_id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  created_by_instance text NOT NULL,
  total_plants integer NOT NULL,
  shelling_count integer NOT NULL,
  snap_count integer NOT NULL
);
