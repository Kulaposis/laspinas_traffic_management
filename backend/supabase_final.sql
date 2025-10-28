BEGIN;
CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);


CREATE TABLE no_parking_zones (
    id SERIAL NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    description VARCHAR(500), 
    latitude FLOAT NOT NULL, 
    longitude FLOAT NOT NULL, 
    zone_type VARCHAR(50) NOT NULL, 
    restriction_reason VARCHAR(100) NOT NULL, 
    radius_meters INTEGER NOT NULL, 
    is_strict BOOLEAN NOT NULL, 
    fine_amount NUMERIC(10, 2) NOT NULL, 
    enforcement_hours VARCHAR(20) NOT NULL, 
    address VARCHAR(500) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_no_parking_zones_id ON no_parking_zones (id);

INSERT INTO alembic_version (version_num) VALUES ('1e102fe3cb1b') RETURNING alembic_version.version_num;


CREATE TYPE incidentproneareatype AS ENUM ('ACCIDENT_PRONE', 'CRIME_HOTSPOT', 'FLOOD_PRONE', 'TRAFFIC_CONGESTION', 'ROAD_HAZARD');

CREATE TABLE incident_prone_areas (
    id SERIAL NOT NULL, 
    area_name VARCHAR(255) NOT NULL, 
    area_type incidentproneareatype NOT NULL, 
    description TEXT, 
    severity_level VARCHAR(20) NOT NULL, 
    latitude FLOAT NOT NULL, 
    longitude FLOAT NOT NULL, 
    radius_meters FLOAT NOT NULL, 
    affected_roads JSON, 
    barangay VARCHAR(100), 
    incident_count INTEGER NOT NULL, 
    last_incident_date TIMESTAMP WITH TIME ZONE, 
    peak_hours JSON, 
    common_incident_types JSON, 
    risk_score FLOAT NOT NULL, 
    prevention_measures TEXT, 
    alternative_routes JSON, 
    data_source VARCHAR(100) NOT NULL, 
    source_url VARCHAR(500), 
    last_verified TIMESTAMP WITH TIME ZONE, 
    is_active BOOLEAN NOT NULL, 
    is_verified BOOLEAN NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    PRIMARY KEY (id)
);

CREATE INDEX ix_incident_prone_areas_id ON incident_prone_areas (id);

UPDATE alembic_version SET version_num='f558f3bc38dc' WHERE alembic_version.version_num = '1e102fe3cb1b';


CREATE TABLE system_logs (
    id SERIAL NOT NULL, 
    log_level VARCHAR(20) NOT NULL, 
    service_name VARCHAR(100) NOT NULL, 
    message TEXT NOT NULL, 
    error_code VARCHAR(50), 
    stack_trace TEXT, 
    extra_data JSON, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP), 
    PRIMARY KEY (id)
);

CREATE INDEX ix_system_logs_created_at ON system_logs (created_at);

CREATE INDEX ix_system_logs_id ON system_logs (id);

CREATE TABLE activity_logs (
    id SERIAL NOT NULL, 
    user_id INTEGER, 
    activity_type VARCHAR(50) NOT NULL, 
    activity_description TEXT NOT NULL, 
    ip_address VARCHAR(45), 
    user_agent TEXT, 
    session_id VARCHAR(255), 
    latitude VARCHAR(20), 
    longitude VARCHAR(20), 
    location_description TEXT, 
    extra_data JSON, 
    resource_type VARCHAR(50), 
    resource_id INTEGER, 
    is_successful BOOLEAN NOT NULL, 
    error_message TEXT, 
    response_time_ms INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP), 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_activity_logs_created_at ON activity_logs (created_at);

CREATE INDEX ix_activity_logs_id ON activity_logs (id);

CREATE TABLE audit_logs (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    action VARCHAR(100) NOT NULL, 
    table_name VARCHAR(100) NOT NULL, 
    record_id INTEGER, 
    old_values JSON, 
    new_values JSON, 
    ip_address VARCHAR(45), 
    user_agent TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP), 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

CREATE INDEX ix_audit_logs_id ON audit_logs (id);

UPDATE alembic_version SET version_num='cd8bcd54b75d' WHERE alembic_version.version_num = 'f558f3bc38dc';


ALTER TABLE emergencies ADD COLUMN photo_urls TEXT;

COMMENT ON COLUMN emergencies.photo_urls IS 'JSON array of uploaded photo URLs';

ALTER TABLE emergencies ADD COLUMN is_verified BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN emergencies.is_verified IS 'Whether the report has been verified by admin';

ALTER TABLE emergencies ADD COLUMN verification_status VARCHAR(20) DEFAULT 'pending' NOT NULL;

COMMENT ON COLUMN emergencies.verification_status IS 'pending, verified, rejected, flagged';

ALTER TABLE emergencies ADD COLUMN verified_by INTEGER;

COMMENT ON COLUMN emergencies.verified_by IS 'Admin who verified the report';

ALTER TABLE emergencies ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE emergencies ADD COLUMN verification_notes TEXT;

ALTER TABLE emergencies ADD COLUMN moderation_priority VARCHAR(20) DEFAULT 'normal' NOT NULL;

COMMENT ON COLUMN emergencies.moderation_priority IS 'low, normal, high, urgent';

ALTER TABLE emergencies ADD CONSTRAINT fk_emergencies_verified_by FOREIGN KEY(verified_by) REFERENCES users (id);

CREATE INDEX ix_emergencies_verification_status ON emergencies (verification_status);

CREATE INDEX ix_emergencies_is_verified ON emergencies (is_verified);

CREATE INDEX ix_emergencies_moderation_priority ON emergencies (moderation_priority);

UPDATE alembic_version SET version_num='add_emergency_photo_moderation' WHERE alembic_version.version_num = 'cd8bcd54b75d';


CREATE TABLE system_settings (
    id SERIAL NOT NULL, 
    key VARCHAR(255) NOT NULL, 
    value TEXT, 
    setting_type VARCHAR(20), 
    description TEXT, 
    category VARCHAR(100) NOT NULL, 
    is_public BOOLEAN, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    updated_by INTEGER, 
    PRIMARY KEY (id), 
    FOREIGN KEY(updated_by) REFERENCES users (id)
);

CREATE INDEX ix_system_settings_id ON system_settings (id);

CREATE UNIQUE INDEX ix_system_settings_key ON system_settings (key);

CREATE TABLE notification_templates (
    id SERIAL NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    template_type VARCHAR(50) NOT NULL, 
    subject VARCHAR(500), 
    content TEXT NOT NULL, 
    variables TEXT, 
    is_active BOOLEAN, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    updated_at TIMESTAMP WITH TIME ZONE, 
    created_by INTEGER, 
    PRIMARY KEY (id), 
    FOREIGN KEY(created_by) REFERENCES users (id), 
    UNIQUE (name)
);

CREATE INDEX ix_notification_templates_id ON notification_templates (id);

CREATE TABLE system_alerts (
    id SERIAL NOT NULL, 
    title VARCHAR(255) NOT NULL, 
    message TEXT NOT NULL, 
    alert_type VARCHAR(50) NOT NULL, 
    target_roles TEXT, 
    is_active BOOLEAN, 
    is_dismissible BOOLEAN, 
    start_date TIMESTAMP WITH TIME ZONE, 
    end_date TIMESTAMP WITH TIME ZONE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    created_by INTEGER NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(created_by) REFERENCES users (id)
);

CREATE INDEX ix_system_alerts_id ON system_alerts (id);

CREATE TABLE data_export_jobs (
    id SERIAL NOT NULL, 
    job_name VARCHAR(255) NOT NULL, 
    export_type VARCHAR(100) NOT NULL, 
    status VARCHAR(50), 
    file_path VARCHAR(500), 
    file_size INTEGER, 
    parameters TEXT, 
    progress INTEGER, 
    error_message TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    completed_at TIMESTAMP WITH TIME ZONE, 
    created_by INTEGER NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(created_by) REFERENCES users (id)
);

CREATE INDEX ix_data_export_jobs_id ON data_export_jobs (id);

CREATE TABLE security_events (
    id SERIAL NOT NULL, 
    event_type VARCHAR(100) NOT NULL, 
    severity VARCHAR(20), 
    source_ip VARCHAR(45), 
    user_agent TEXT, 
    user_id INTEGER, 
    description TEXT NOT NULL, 
    event_metadata TEXT, 
    is_resolved BOOLEAN, 
    resolved_at TIMESTAMP WITH TIME ZONE, 
    resolved_by INTEGER, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id), 
    FOREIGN KEY(resolved_by) REFERENCES users (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_security_events_id ON security_events (id);

CREATE TABLE system_metrics (
    id SERIAL NOT NULL, 
    metric_name VARCHAR(255) NOT NULL, 
    metric_value FLOAT NOT NULL, 
    metric_type VARCHAR(50) NOT NULL, 
    tags TEXT, 
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    PRIMARY KEY (id)
);

CREATE INDEX ix_system_metrics_id ON system_metrics (id);

CREATE TABLE user_sessions (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    session_token VARCHAR(255) NOT NULL, 
    ip_address VARCHAR(45), 
    user_agent TEXT, 
    is_active BOOLEAN, 
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id), 
    UNIQUE (session_token)
);

CREATE INDEX ix_user_sessions_id ON user_sessions (id);

CREATE TABLE content_moderation_queue (
    id SERIAL NOT NULL, 
    content_type VARCHAR(50) NOT NULL, 
    content_id INTEGER NOT NULL, 
    reason VARCHAR(255) NOT NULL, 
    status VARCHAR(50), 
    priority VARCHAR(20), 
    content_metadata TEXT, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(), 
    reviewed_at TIMESTAMP WITH TIME ZONE, 
    reviewed_by INTEGER, 
    review_notes TEXT, 
    PRIMARY KEY (id), 
    FOREIGN KEY(reviewed_by) REFERENCES users (id)
);

CREATE INDEX ix_content_moderation_queue_id ON content_moderation_queue (id);

INSERT INTO alembic_version (version_num) VALUES ('add_admin_tables') RETURNING alembic_version.version_num;


DELETE FROM alembic_version WHERE alembic_version.version_num = 'add_admin_tables';

UPDATE alembic_version SET version_num='548ef5b8d574' WHERE alembic_version.version_num = 'add_emergency_photo_moderation';


CREATE TABLE travel_sessions (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    origin_name VARCHAR(255), 
    origin_lat FLOAT, 
    origin_lng FLOAT, 
    destination_name VARCHAR(255), 
    destination_lat FLOAT, 
    destination_lng FLOAT, 
    route_data JSON, 
    duration_minutes FLOAT, 
    distance_km FLOAT, 
    start_time TIMESTAMP WITHOUT TIME ZONE, 
    end_time TIMESTAMP WITHOUT TIME ZONE, 
    travel_mode VARCHAR(50), 
    traffic_conditions VARCHAR(50), 
    notes TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_travel_sessions_id ON travel_sessions (id);

CREATE TABLE favorite_routes (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    origin_name VARCHAR(255), 
    origin_lat FLOAT, 
    origin_lng FLOAT, 
    destination_name VARCHAR(255), 
    destination_lat FLOAT, 
    destination_lng FLOAT, 
    route_summary JSON, 
    is_default BOOLEAN, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_favorite_routes_id ON favorite_routes (id);

UPDATE alembic_version SET version_num='add_travel_history_tables' WHERE alembic_version.version_num = '548ef5b8d574';


CREATE TABLE favorite_routes (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    name VARCHAR(255) NOT NULL, 
    origin_name VARCHAR(255), 
    origin_lat FLOAT, 
    origin_lng FLOAT, 
    destination_name VARCHAR(255), 
    destination_lat FLOAT, 
    destination_lng FLOAT, 
    route_summary JSON, 
    is_default BOOLEAN, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_favorite_routes_id ON favorite_routes (id);

CREATE TABLE travel_sessions (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    origin_name VARCHAR(255), 
    origin_lat FLOAT, 
    origin_lng FLOAT, 
    destination_name VARCHAR(255), 
    destination_lat FLOAT, 
    destination_lng FLOAT, 
    route_data JSON, 
    duration_minutes FLOAT, 
    distance_km FLOAT, 
    start_time TIMESTAMP WITHOUT TIME ZONE, 
    end_time TIMESTAMP WITHOUT TIME ZONE, 
    travel_mode VARCHAR(50), 
    traffic_conditions VARCHAR(50), 
    notes TEXT, 
    created_at TIMESTAMP WITHOUT TIME ZONE, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE INDEX ix_travel_sessions_id ON travel_sessions (id);

DROP INDEX ix_traffic_lines_id;

DROP TABLE traffic_lines;

ALTER TABLE content_moderation_queue ALTER COLUMN content_metadata TYPE JSON;

ALTER TABLE data_export_jobs ALTER COLUMN parameters TYPE JSON;

ALTER TABLE emergencies ALTER COLUMN is_verified SET NOT NULL;

ALTER TABLE emergencies ALTER COLUMN verification_status SET NOT NULL;

ALTER TABLE emergencies ALTER COLUMN moderation_priority SET NOT NULL;

ALTER TABLE emergencies ADD FOREIGN KEY(verified_by) REFERENCES users (id);

ALTER TABLE notification_templates ALTER COLUMN variables TYPE JSON;

ALTER TABLE security_events ALTER COLUMN event_metadata TYPE JSON;

ALTER TABLE system_alerts ALTER COLUMN target_roles TYPE JSON;

ALTER TABLE system_metrics ALTER COLUMN tags TYPE JSON;

ALTER TABLE system_settings ALTER COLUMN setting_type TYPE settingtype;

C:\Users\aband\AppData\Local\Programs\Python\Python311\Lib\site-packages\alembic\ddl\postgresql.py:183: UserWarning: 
autoincrement and existing_autoincrement only make sense for MySQL
  super().alter_column(
ALTER TABLE traffic_monitoring ALTER COLUMN id SET NOT NULL;

ALTER TABLE traffic_monitoring ALTER COLUMN barangay TYPE VARCHAR(100);

ALTER TABLE traffic_monitoring ALTER COLUMN data_source TYPE VARCHAR(50);

ALTER TABLE traffic_monitoring ALTER COLUMN confidence_score TYPE FLOAT;

CREATE INDEX ix_traffic_monitoring_id ON traffic_monitoring (id);

ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(255);

ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL;

CREATE UNIQUE INDEX ix_users_firebase_uid ON users (firebase_uid);

UPDATE alembic_version SET version_num='adc96f8b8a52' WHERE alembic_version.version_num = 'add_travel_history_tables';


ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128);

ALTER TABLE users ADD COLUMN photo_url VARCHAR(512);

ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT '0' NOT NULL;

ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL;

CREATE UNIQUE INDEX ix_users_firebase_uid ON users (firebase_uid);

UPDATE alembic_version SET version_num='5f7218d85523' WHERE alembic_version.version_num = 'adc96f8b8a52';

COMMIT;

