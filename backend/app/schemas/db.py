# path: backend/app/schemas/db.py
from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel


class TransportFacts(BaseModel):
    tls_enabled: Optional[bool] = None
    min_protocol: Optional[str] = None
    session_ssl: Optional[bool] = None
    details: Optional[str] = None  # errors/notes during collection


class CredentialFacts(BaseModel):
    password_encryption: Optional[str] = None
    # MySQL password policy / rotation (optional)
    validate_password_policy: Optional[str] = None
    validate_password_length: Optional[int] = None
    default_password_lifetime: Optional[int] = None  # days; 0 = never expires


class LoggingFacts(BaseModel):
    # Postgres-style (may be None on MySQL)
    log_destination: Optional[str] = None
    logging_collector: Optional[str] = None
    log_connections: Optional[str] = None
    log_disconnections: Optional[str] = None
    log_statement: Optional[str] = None
    log_min_duration_statement: Optional[str] = None

    audit_extension_present: Optional[bool] = None

    # MySQL extras (optional)
    log_output: Optional[str] = None
    general_log: Optional[str] = None
    slow_query_log: Optional[str] = None
    log_error: Optional[str] = None


class BackupDRFacts(BaseModel):
    # Postgres terms kept for compatibility; MySQL maps wal_level -> binlog_format
    wal_level: Optional[str] = None
    archive_mode: Optional[str] = None
    archive_command: Optional[str] = None
    replication_slots: Optional[int] = None
    replication_streams: Optional[int] = None


class AccessFacts(BaseModel):
    superuser_roles: Optional[List[str]] = None
    login_roles: Optional[List[str]] = None


class DBFacts(BaseModel):
    dsn: str
    server_version: Optional[str] = None
    transport: Optional[TransportFacts] = None
    credentials: Optional[CredentialFacts] = None
    logging: Optional[LoggingFacts] = None
    backup_dr: Optional[BackupDRFacts] = None
    access: Optional[AccessFacts] = None
    storage_encrypted_hint: Optional[bool] = None
