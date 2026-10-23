CREATE EXTENSION IF NOT EXISTS postgis;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE TABLE auth_users (
 id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
 email_verified boolean NOT NULL DEFAULT false, image text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auth_sessions (
 id text PRIMARY KEY, expires_at timestamptz NOT NULL, token text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 ip_address text, user_agent text, user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE TABLE auth_accounts (
 id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL,
 user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
 access_token text, refresh_token text, id_token text, access_token_expires_at timestamptz,
 refresh_token_expires_at timestamptz, scope text, password text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(provider_id, account_id)
);
CREATE TABLE auth_verifications (
 id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX auth_accounts_user ON auth_accounts(user_id);

CREATE TABLE associations (id uuid PRIMARY KEY, name text NOT NULL);
CREATE TABLE memberships (
 association_id uuid NOT NULL REFERENCES associations(id), user_id text NOT NULL REFERENCES auth_users(id),
 role text NOT NULL CHECK(role IN ('technician','coordinator')),
 PRIMARY KEY(association_id,user_id)
);
CREATE TABLE parcels (
 id uuid PRIMARY KEY, association_id uuid NOT NULL REFERENCES associations(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100), producer_name text NOT NULL,
 crop text NOT NULL, hectares numeric(10,3) NOT NULL CHECK(hectares > 0 AND hectares <= 10000),
 location geometry(Point,4326) NOT NULL, assigned_to text NOT NULL,
 UNIQUE(association_id,id),
 FOREIGN KEY(association_id,assigned_to) REFERENCES memberships(association_id,user_id)
);
CREATE INDEX parcels_location ON parcels USING gist(location);
CREATE INDEX parcels_tenant ON parcels(association_id,assigned_to);
CREATE TABLE inspections (
 id uuid PRIMARY KEY, association_id uuid NOT NULL REFERENCES associations(id), parcel_id uuid NOT NULL,
 author_id text NOT NULL REFERENCES auth_users(id), notes text NOT NULL CHECK(length(notes) BETWEEN 1 AND 5000),
 biosecurity boolean NOT NULL, photo_ids uuid[] NOT NULL DEFAULT '{}',
 status text NOT NULL CHECK(status IN ('draft','submitted','reviewed')), version integer NOT NULL CHECK(version > 0),
 observed_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(association_id,id), FOREIGN KEY(association_id,parcel_id) REFERENCES parcels(association_id,id)
);
CREATE INDEX inspections_tenant ON inspections(association_id,parcel_id);
CREATE TABLE photos (
 id uuid PRIMARY KEY, association_id uuid NOT NULL, inspection_id uuid NOT NULL,
 storage_key text NOT NULL UNIQUE, digest text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(association_id,inspection_id) REFERENCES inspections(association_id,id)
);
CREATE TABLE reviews (
 id uuid PRIMARY KEY, association_id uuid NOT NULL, inspection_id uuid NOT NULL UNIQUE,
 reviewer_id text NOT NULL REFERENCES auth_users(id), notes text NOT NULL, follow_up boolean NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(association_id,inspection_id) REFERENCES inspections(association_id,id)
);
CREATE TABLE sync_operations (
 association_id uuid NOT NULL, actor_id text NOT NULL, operation_id uuid NOT NULL,
 fingerprint text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(association_id,actor_id,operation_id)
);
CREATE TABLE audit_events (
 id uuid PRIMARY KEY, association_id uuid NOT NULL, actor_id text NOT NULL,
 action text NOT NULL, entity_id uuid NOT NULL, event_key uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notification_outbox (
 id uuid PRIMARY KEY, association_id uuid NOT NULL, actor_id text NOT NULL, inspection_id uuid NOT NULL,
 dispatched_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(association_id,inspection_id) REFERENCES inspections(association_id,id)
);

-- Trusted lookup owns membership checks, not caller-controlled role claims.
CREATE FUNCTION current_member_role(tenant uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
 SELECT role FROM public.memberships
 WHERE association_id = tenant AND user_id = current_setting('chira.user_id',true)
 AND tenant::text = current_setting('chira.association_id',true)
$$;
REVOKE ALL ON FUNCTION current_member_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION current_member_role(uuid) TO chira_app,chira_worker;

ALTER TABLE associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE associations FORCE ROW LEVEL SECURITY;
CREATE POLICY associations_access ON associations USING(current_member_role(id) IS NOT NULL);
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY memberships_self ON memberships USING(user_id=current_setting('chira.user_id',true) OR current_member_role(association_id)='coordinator');

ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels FORCE ROW LEVEL SECURITY;
CREATE POLICY parcels_read ON parcels FOR SELECT USING(current_member_role(association_id)='coordinator' OR (current_member_role(association_id)='technician' AND assigned_to=current_setting('chira.user_id',true)));
CREATE POLICY parcels_write ON parcels FOR INSERT WITH CHECK(current_member_role(association_id)='coordinator' OR (current_member_role(association_id)='technician' AND assigned_to=current_setting('chira.user_id',true)));

ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspections FORCE ROW LEVEL SECURITY;
CREATE POLICY inspections_access ON inspections USING(current_member_role(association_id) IS NOT NULL AND EXISTS(SELECT 1 FROM parcels WHERE parcels.id=parcel_id AND parcels.association_id=inspections.association_id)) WITH CHECK(current_member_role(association_id) IS NOT NULL AND EXISTS(SELECT 1 FROM parcels WHERE parcels.id=parcel_id AND parcels.association_id=inspections.association_id));
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos FORCE ROW LEVEL SECURITY;
CREATE POLICY photos_access ON photos USING(current_member_role(association_id) IS NOT NULL AND EXISTS(SELECT 1 FROM inspections WHERE inspections.id=inspection_id AND inspections.association_id=photos.association_id)) WITH CHECK(current_member_role(association_id) IS NOT NULL AND EXISTS(SELECT 1 FROM inspections WHERE inspections.id=inspection_id AND inspections.association_id=photos.association_id));
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews FORCE ROW LEVEL SECURITY;
CREATE POLICY reviews_read ON reviews FOR SELECT USING(current_member_role(association_id) IS NOT NULL AND EXISTS(SELECT 1 FROM inspections WHERE inspections.id=inspection_id));
CREATE POLICY reviews_insert ON reviews FOR INSERT WITH CHECK(current_member_role(association_id)='coordinator' AND reviewer_id=current_setting('chira.user_id',true));
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_operations FORCE ROW LEVEL SECURITY;
CREATE POLICY sync_access ON sync_operations USING(current_member_role(association_id) IS NOT NULL AND actor_id=current_setting('chira.user_id',true)) WITH CHECK(current_member_role(association_id) IS NOT NULL AND actor_id=current_setting('chira.user_id',true));
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON audit_events FOR SELECT USING(current_member_role(association_id)='coordinator');
CREATE POLICY audit_append ON audit_events FOR INSERT WITH CHECK(current_member_role(association_id) IS NOT NULL AND actor_id=current_setting('chira.user_id',true));
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_append ON notification_outbox FOR INSERT WITH CHECK(current_member_role(association_id)='coordinator' AND actor_id=current_setting('chira.user_id',true));

-- Worker capability: dispatch IDs only. No unrestricted tenant table grants.
CREATE FUNCTION pending_follow_ups() RETURNS TABLE(id uuid, association_id uuid, actor_id text, inspection_id uuid)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT id,association_id,actor_id,inspection_id FROM public.notification_outbox
 WHERE dispatched_at IS NULL ORDER BY created_at LIMIT 50
$$;
CREATE FUNCTION mark_follow_up_dispatched(event_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 UPDATE public.notification_outbox SET dispatched_at=now() WHERE id=event_id AND dispatched_at IS NULL
$$;
REVOKE ALL ON FUNCTION pending_follow_ups(),mark_follow_up_dispatched(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pending_follow_ups(),mark_follow_up_dispatched(uuid) TO chira_worker;

GRANT USAGE ON SCHEMA public TO chira_app,chira_worker,chira_auth;
GRANT SELECT,INSERT,UPDATE,DELETE ON auth_users,auth_sessions,auth_accounts,auth_verifications TO chira_auth;
GRANT SELECT ON associations,memberships,parcels,inspections,photos,reviews,sync_operations,audit_events TO chira_app;
GRANT INSERT ON parcels,inspections,photos,reviews,sync_operations,audit_events,notification_outbox TO chira_app;
GRANT UPDATE ON inspections TO chira_app;
GRANT SELECT ON associations,memberships,parcels,inspections,reviews TO chira_worker;
GRANT INSERT ON audit_events TO chira_worker;
