-- Missing traffic tables for Supabase
-- Run this in Supabase SQL Editor

-- Traffic monitoring table
CREATE TABLE IF NOT EXISTS traffic_monitoring (
    id SERIAL PRIMARY KEY,
    road_name VARCHAR(255) NOT NULL,
    road_type VARCHAR(50) NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    barangay VARCHAR(100) NOT NULL,
    traffic_status VARCHAR(50) NOT NULL DEFAULT 'free_flow',
    average_speed_kmh FLOAT,
    vehicle_count INTEGER NOT NULL DEFAULT 0,
    congestion_percentage FLOAT NOT NULL DEFAULT 0.0,
    estimated_travel_time FLOAT,
    road_segment_length FLOAT,
    data_source VARCHAR(50) NOT NULL DEFAULT 'tomtom_api',
    confidence_score FLOAT NOT NULL DEFAULT 1.0,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Road incidents table
CREATE TABLE IF NOT EXISTS road_incidents (
    id SERIAL PRIMARY KEY,
    incident_type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'medium',
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    address VARCHAR(500),
    affected_roads JSON,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    estimated_clearance_time TIMESTAMPTZ,
    impact_radius_meters FLOAT NOT NULL DEFAULT 500.0,
    reporter_source VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Route alternatives table
CREATE TABLE IF NOT EXISTS route_alternatives (
    id SERIAL PRIMARY KEY,
    origin_lat FLOAT NOT NULL,
    origin_lng FLOAT NOT NULL,
    destination_lat FLOAT NOT NULL,
    destination_lng FLOAT NOT NULL,
    route_name VARCHAR(255),
    route_coordinates JSON NOT NULL,
    distance_km FLOAT NOT NULL,
    estimated_duration_minutes INTEGER NOT NULL,
    traffic_conditions VARCHAR(50) NOT NULL,
    is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    road_segments JSON,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS ix_traffic_monitoring_id ON traffic_monitoring(id);
CREATE INDEX IF NOT EXISTS ix_traffic_monitoring_barangay ON traffic_monitoring(barangay);
CREATE INDEX IF NOT EXISTS ix_traffic_monitoring_road_type ON traffic_monitoring(road_type);
CREATE INDEX IF NOT EXISTS ix_traffic_monitoring_traffic_status ON traffic_monitoring(traffic_status);

CREATE INDEX IF NOT EXISTS ix_road_incidents_id ON road_incidents(id);
CREATE INDEX IF NOT EXISTS ix_road_incidents_is_active ON road_incidents(is_active);
CREATE INDEX IF NOT EXISTS ix_road_incidents_incident_type ON road_incidents(incident_type);
CREATE INDEX IF NOT EXISTS ix_road_incidents_created_at ON road_incidents(created_at);

CREATE INDEX IF NOT EXISTS ix_route_alternatives_id ON route_alternatives(id);
CREATE INDEX IF NOT EXISTS ix_route_alternatives_is_recommended ON route_alternatives(is_recommended);

-- Insert some sample data for testing
INSERT INTO traffic_monitoring (road_name, road_type, latitude, longitude, barangay, traffic_status, average_speed_kmh, vehicle_count, congestion_percentage, data_source, confidence_score)
VALUES 
    ('Alabang-Zapote Road', 'main_road', 14.4504, 121.0170, 'Almanza Uno', 'moderate', 25.5, 45, 35.0, 'tomtom_api', 0.9),
    ('CAA Road', 'main_road', 14.4600, 121.0200, 'CAA', 'light', 40.2, 28, 15.0, 'tomtom_api', 0.95),
    ('C-5 Extension', 'highway', 14.4700, 121.0300, 'Pamplona Uno', 'free_flow', 55.0, 12, 5.0, 'tomtom_api', 0.98)
ON CONFLICT DO NOTHING;

INSERT INTO road_incidents (incident_type, title, description, severity, latitude, longitude, address, affected_roads, is_active, reporter_source)
VALUES 
    ('road_work', 'Road Construction on Alabang-Zapote', 'Lane closure for road repair', 'medium', 14.4504, 121.0170, 'Alabang-Zapote Road, Las Piñas', '["Alabang-Zapote Road"]', TRUE, 'system'),
    ('accident', 'Minor Vehicle Collision', 'Two vehicles involved in minor collision', 'low', 14.4600, 121.0200, 'CAA Road, Las Piñas', '["CAA Road"]', TRUE, 'citizen')
ON CONFLICT DO NOTHING;
