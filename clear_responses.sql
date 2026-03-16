-- Find all submission tables for published forms and truncate them
-- This will remove all old test responses so fresh uploads can be tested
DO $$
DECLARE
    rec RECORD;
    tbl TEXT;
BEGIN
    FOR rec IN 
        SELECT fv.table_name, f.name
        FROM form_versions fv 
        JOIN forms f ON fv.form_id = f.id 
        WHERE fv.status = 'PUBLISHED'
    LOOP
        tbl := rec.table_name;
        RAISE NOTICE 'Truncating table: % (form: %)', tbl, rec.name;
        EXECUTE 'TRUNCATE TABLE ' || tbl;
    END LOOP;
    RAISE NOTICE 'Done! All submission tables truncated.';
END;
$$;
