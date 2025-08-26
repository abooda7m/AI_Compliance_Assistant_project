import os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
ORG_ID = os.environ.get("ORG_ID")

def supa() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

def supa_as_user(token: str) -> Client:
    """Client that respects RLS using the caller's JWT."""
    c = supa()
    c.postgrest.auth(token)
    return c

def get_user_and_org(token: str) -> tuple[str, str]:
    c = supa()
    u = c.auth.get_user(token)
    user_id = u.user.id
    pr = c.table("profiles").select("org_id").eq("user_id", user_id).single().execute()
    org_id = pr.data["org_id"]
    return user_id, org_id
