CREATE FUNCTION matching_follow_up(event_id uuid,tenant uuid,actor text,inspection uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.notification_outbox o WHERE o.id=event_id
 AND o.association_id=tenant AND o.actor_id=actor AND o.inspection_id=inspection)
$$;
REVOKE ALL ON FUNCTION matching_follow_up(uuid,uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION matching_follow_up(uuid,uuid,text,uuid) TO chira_worker;
