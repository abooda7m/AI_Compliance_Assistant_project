# path: backend/app/db_collector.py
from __future__ import annotations

import os
import ssl
from typing import Optional, List
from urllib.parse import urlparse

from app.schemas.db import (
    DBFacts,
    TransportFacts,
    CredentialFacts,
    LoggingFacts,
    BackupDRFacts,
    AccessFacts,
)

# -------------------- Utilities --------------------


def _bool_from_env(name: str) -> Optional[bool]:
    val = os.getenv(name)
    if val is None:
        return None
    return val.strip().lower() in ("1", "true", "yes", "on")


def _safe_int(val) -> Optional[int]:
    try:
        if val is None:
            return None
        if isinstance(val, int):
            return val
        s = str(val).strip()
        if s.upper() == "OFF":
            return 0
        return int(s)
    except Exception:
        return None


# -------------------- MySQL helpers --------------------


def _mysql_get_var(cursor, name: str):
    try:
        cursor.execute("SHOW VARIABLES LIKE %s", (name,))
        row = cursor.fetchone()
        if row and len(row) >= 2:
            return row[1]
    except Exception:
        return None
    return None


def _mysql_session_ssl(cursor) -> Optional[bool]:
    try:
        cursor.execute("SHOW STATUS LIKE 'Ssl_cipher'")
        row = cursor.fetchone()
        if row and len(row) >= 2:
            return bool(row[1])
    except Exception:
        return None
    return None


def _mysql_tls_version_min(cursor) -> Optional[str]:
    """
    Parse 'tls_version' variable: e.g. 'TLSv1.2,TLSv1.3' -> return lowest 'TLSv1.2'
    """
    try:
        val = _mysql_get_var(cursor, "tls_version")
        if not val:
            return None
        parts = [p.strip() for p in str(val).split(",") if p.strip()]
        if not parts:
            return None

        def key(v: str):
            try:
                return tuple(int(x) for x in v.replace("TLSv", "").split("."))
            except Exception:
                return (999, 999)

        parts_sorted = sorted(parts, key=key)
        return parts_sorted[0]
    except Exception:
        return None


def _mysql_fetch_password_policy(cursor):
    """
    Returns (policy, min_length). Works if validate_password plugin/vars exist.
    """
    try:
        policy = _mysql_get_var(cursor, "validate_password.policy") or _mysql_get_var(
            cursor, "validate_password_policy"
        )
        length = _mysql_get_var(cursor, "validate_password.length") or _mysql_get_var(
            cursor, "validate_password_length"
        )
        length_i = _safe_int(length)
        return policy, length_i
    except Exception:
        return None, None


def _mysql_fetch_default_password_lifetime(cursor) -> Optional[int]:
    try:
        val = _mysql_get_var(cursor, "default_password_lifetime")
        return _safe_int(val)
    except Exception:
        return None


def _mysql_fetch_logging_extras(cursor) -> dict:
    out = {}
    for v in ("log_output", "general_log", "slow_query_log", "log_error"):
        out[v] = _mysql_get_var(cursor, v)
    return out


def _mysql_detect_audit_plugin(cursor) -> Optional[bool]:
    try:
        cursor.execute(
            "SELECT PLUGIN_NAME, PLUGIN_STATUS FROM INFORMATION_SCHEMA.PLUGINS WHERE PLUGIN_NAME LIKE 'audit%%'"
        )
        rows = cursor.fetchall() or []
        for name, status, *rest in rows:
            if str(status).upper() in ("ACTIVE", "ON"):
                return True
        return False
    except Exception:
        return None


def _mysql_replication_streams(cursor) -> Optional[int]:
    try:
        cursor.execute(
            "SELECT COUNT(*) FROM performance_schema.replication_connection_status"
        )
        row = cursor.fetchone()
        if row:
            return _safe_int(row[0])
    except Exception:
        pass
    try:
        cursor.execute(
            "SELECT COUNT(*) FROM performance_schema.replication_applier_status"
        )
        row = cursor.fetchone()
        if row:
            return _safe_int(row[0])
    except Exception:
        pass
    return 0


def _mysql_login_roles(cursor) -> List[str]:
    try:
        cursor.execute("SELECT user, host FROM mysql.user")
        rows = cursor.fetchall() or []
        return [f"{u}@{h}" for (u, h, *_) in rows if u]
    except Exception:
        return []


def _mysql_superuser_roles(cursor, known_logins: List[str]) -> List[str]:
    supers: List[str] = []
    try:
        for lh in known_logins:
            user = lh.split("@", 1)[0] if "@" in lh else lh
            if user in ("root", "mysql.session", "dba_super"):
                supers.append(lh)
    except Exception:
        pass
    return supers


# -------------------- Collector entrypoint --------------------


def collect_db_facts(dsn: str) -> DBFacts:
    """
    Read-only fact collector for MySQL and Postgres DSNs.
    DSN must be provided by the caller (no .env fallback).
    Any missing permission results in None/unknown fields, not exceptions.
    """
    storage_hint = _bool_from_env("DB_STORAGE_ENCRYPTED")

    if not dsn:
        return DBFacts(
            dsn="unknown",
            server_version=None,
            transport=TransportFacts(details="DSN missing"),
            credentials=CredentialFacts(),
            logging=LoggingFacts(),
            backup_dr=BackupDRFacts(),
            access=AccessFacts(),
            storage_encrypted_hint=storage_hint,
        )

    parsed = urlparse(dsn)
    scheme = (parsed.scheme or "").lower()

    if scheme in ("mysql", "mysql+pymysql"):
        return _collect_mysql_facts(parsed, dsn, storage_hint)

    elif scheme in ("postgres", "postgresql", "postgres+psycopg2"):
        return _collect_postgres_facts(parsed, dsn, storage_hint)

    return DBFacts(
        dsn=dsn,
        server_version=None,
        transport=TransportFacts(details=f"Unsupported DSN scheme '{scheme}'"),
        credentials=CredentialFacts(),
        logging=LoggingFacts(),
        backup_dr=BackupDRFacts(),
        access=AccessFacts(),
        storage_encrypted_hint=storage_hint,
    )


# -------------------- MySQL implementation --------------------


def _collect_mysql_facts(parsed, dsn: str, storage_hint: Optional[bool]) -> DBFacts:
    import pymysql  # PyMySQL

    host = parsed.hostname or "127.0.0.1"
    user = parsed.username or "root"
    password = parsed.password or ""
    port = int(parsed.port or 3306)
    database = (parsed.path or "/mysql").lstrip("/") or "mysql"

    conn = None
    tls_details = None

    try:
        conn = pymysql.connect(
            host=host, user=user, password=password, port=port, database=database
        )
    except pymysql.err.OperationalError as e:
        # 3159: Connections using insecure transport are prohibited...
        if getattr(e, "args", None) and len(e.args) >= 1 and e.args[0] == 3159:
            try:
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                conn = pymysql.connect(
                    host=host,
                    user=user,
                    password=password,
                    port=port,
                    database=database,
                    ssl={"ssl": ctx},
                )
                tls_details = "Connected with TLS (no cert verification)"
            except Exception as e2:
                return DBFacts(
                    dsn=dsn,
                    server_version=None,
                    transport=TransportFacts(
                        details=f"Connection failed (TLS required but failed): {type(e2).__name__}: {e2}"
                    ),
                    credentials=CredentialFacts(),
                    logging=LoggingFacts(),
                    backup_dr=BackupDRFacts(),
                    access=AccessFacts(),
                    storage_encrypted_hint=storage_hint,
                )
        else:
            return DBFacts(
                dsn=dsn,
                server_version=None,
                transport=TransportFacts(details=f"Connection failed: {type(e).__name__}: {e}"),
                credentials=CredentialFacts(),
                logging=LoggingFacts(),
                backup_dr=BackupDRFacts(),
                access=AccessFacts(),
                storage_encrypted_hint=storage_hint,
            )

    try:
        with conn.cursor() as cur:
            # Server version
            cur.execute("SELECT VERSION()")
            row = cur.fetchone()
            server_version = row[0] if row else None

            # TLS/transport
            require_secure = _mysql_get_var(cur, "require_secure_transport")
            tls_enabled = (str(require_secure).upper() == "ON") if require_secure is not None else None
            session_ssl = _mysql_session_ssl(cur)
            min_tls = _mysql_tls_version_min(cur)

            # Credentials / auth plugin
            default_auth_plugin = _mysql_get_var(cur, "default_authentication_plugin")

            # Password policy & rotation
            pol, minlen = _mysql_fetch_password_policy(cur)
            pw_life = _mysql_fetch_default_password_lifetime(cur)

            # Logging extras (+ map MySQL log_output into our log_destination)
            log_extras = _mysql_fetch_logging_extras(cur)
            log_output = (log_extras.get("log_output") or "").upper() or None
            log_destination = log_output

            # Audit plugin presence
            audit_present = _mysql_detect_audit_plugin(cur)

            # Replication / backup posture (map binlog_format)
            binlog_format = _mysql_get_var(cur, "binlog_format")
            replication_streams = _mysql_replication_streams(cur)

            # Roles
            login_roles = _mysql_login_roles(cur)
            superuser_roles = _mysql_superuser_roles(cur, login_roles)

        facts = DBFacts(
            dsn=dsn,
            server_version=server_version,
            transport=TransportFacts(
                tls_enabled=tls_enabled,
                min_protocol=min_tls,
                session_ssl=session_ssl,
                details=tls_details,
            ),
            credentials=CredentialFacts(
                password_encryption=default_auth_plugin,
                validate_password_policy=pol,
                validate_password_length=minlen,
                default_password_lifetime=pw_life,
            ),
            logging=LoggingFacts(
                log_destination=log_destination,
                logging_collector=None,
                log_connections=None,
                log_disconnections=None,
                log_statement=None,
                log_min_duration_statement=None,
                audit_extension_present=audit_present,
                log_output=log_output,
                general_log=log_extras.get("general_log"),
                slow_query_log=log_extras.get("slow_query_log"),
                log_error=log_extras.get("log_error"),
            ),
            backup_dr=BackupDRFacts(
                wal_level=binlog_format,  # map binlog_format
                archive_mode=None,
                archive_command=None,
                replication_slots=None,
                replication_streams=replication_streams,
            ),
            access=AccessFacts(
                superuser_roles=superuser_roles,
                login_roles=login_roles,
            ),
            storage_encrypted_hint=_bool_from_env("DB_STORAGE_ENCRYPTED"),
        )
        return facts
    except Exception as e:
        return DBFacts(
            dsn=dsn,
            server_version=None,
            transport=TransportFacts(details=f"Collection error: {type(e).__name__}: {e}"),
            credentials=CredentialFacts(),
            logging=LoggingFacts(),
            backup_dr=BackupDRFacts(),
            access=AccessFacts(),
            storage_encrypted_hint=storage_hint,
        )
    finally:
        try:
            conn.close()
        except Exception:
            pass


# -------------------- Minimal Postgres (kept for compatibility) --------------------


def _collect_postgres_facts(parsed, dsn: str, storage_hint: Optional[bool]) -> DBFacts:
    # Minimal stub for Postgres to avoid breaking callers; evidence expansion can be added later.
    return DBFacts(
        dsn=dsn,
        server_version=None,
        transport=TransportFacts(details="Postgres collection minimal; extend for full signals."),
        credentials=CredentialFacts(),
        logging=LoggingFacts(),
        backup_dr=BackupDRFacts(),
        access=AccessFacts(),
        storage_encrypted_hint=storage_hint,
    )
