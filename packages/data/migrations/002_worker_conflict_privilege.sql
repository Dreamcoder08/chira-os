-- PostgreSQL requires read permission on the conflict key for ON CONFLICT.
GRANT SELECT(event_key) ON audit_events TO chira_worker;
