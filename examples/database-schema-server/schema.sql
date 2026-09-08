CREATE TYPE pea_catalog_summary AS (
  pea_type text,
  variety_count integer,
  fastest_days_to_maturity integer
);

CREATE TABLE pea_varieties (
  name text PRIMARY KEY,
  pea_type text NOT NULL,
  growth_habit text NOT NULL,
  days_to_maturity integer NOT NULL CHECK (days_to_maturity > 0),
  notes text NOT NULL DEFAULT ''
);

CREATE VIEW pea_variety_catalog AS
SELECT name, pea_type, growth_habit, days_to_maturity, notes
FROM pea_varieties;

CREATE PROCEDURE summarize_pea_catalog(
  IN selected_pea_type text,
  INOUT summary pea_catalog_summary
)
LANGUAGE plpgsql
AS $$
BEGIN
  SELECT
    COALESCE(selected_pea_type, 'all'),
    COUNT(*)::integer,
    MIN(days_to_maturity)::integer
  INTO summary.pea_type, summary.variety_count, summary.fastest_days_to_maturity
  FROM pea_variety_catalog
  WHERE selected_pea_type IS NULL OR pea_type = selected_pea_type;
END;
$$;

INSERT INTO pea_variety_catalog
  (name, pea_type, growth_habit, days_to_maturity, notes)
VALUES
  ('Green Arrow', 'shelling', 'climbing', 68, 'Long pods with sweet peas.'),
  ('Sugar Ann', 'snap', 'bush', 56, 'Compact plants with edible pods.'),
  ('Oregon Sugar Pod II', 'snow', 'bush', 65, 'Flat edible pods.');

COMMENT ON VIEW pea_variety_catalog IS
  'Stable read and write boundary for the pea variety catalogue.';
COMMENT ON TYPE pea_catalog_summary IS
  'Summary returned by the secondary stored-procedure example.';
