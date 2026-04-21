-- Migration 071: The God-Mode Function
-- This function allows the Sovereign Architect to evolve the database schema in real-time.

CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with the privileges of the creator (postgres/admin)
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

-- Grant access only to the service_role (used by our server-side admin client)
REVOKE ALL ON FUNCTION execute_sql(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION execute_sql(TEXT) TO postgres;
