-- Fix enum values in Supabase to match SQLAlchemy expectations
-- Run this in your Supabase SQL Editor

-- First, check if there's existing data with lowercase enum values
-- If there is, we need to update it first

-- Update any existing traffic_monitoring records with lowercase road_type values
UPDATE traffic_monitoring 
SET road_type = UPPER(road_type)
WHERE road_type IN ('highway', 'main_road', 'side_street', 'residential', 'bridge');

-- Update any existing traffic_monitoring records with lowercase traffic_status values  
UPDATE traffic_monitoring
SET traffic_status = UPPER(traffic_status)
WHERE traffic_status IN ('free_flow', 'light', 'moderate', 'heavy', 'standstill');

-- Update incident_prone_areas with lowercase area_type values
UPDATE incident_prone_areas
SET area_type = UPPER(area_type)
WHERE area_type IN ('accident_prone', 'crime_hotspot', 'flood_prone', 'traffic_congestion', 'road_hazard');

-- Note: If you get errors about enum values, you may need to:
-- 1. Drop the existing enum type
-- 2. Recreate it with uppercase values
-- 3. Or alter the column to use text type temporarily

-- Alternative: Convert columns to use uppercase enum values
-- This is safer if you have existing data

-- For RoadType enum
DO $$ 
BEGIN
    -- Try to add uppercase values to enum if they don't exist
    ALTER TYPE roadtype ADD VALUE IF NOT EXISTS 'HIGHWAY';
    ALTER TYPE roadtype ADD VALUE IF NOT EXISTS 'MAIN_ROAD';
    ALTER TYPE roadtype ADD VALUE IF NOT EXISTS 'SIDE_STREET';
    ALTER TYPE roadtype ADD VALUE IF NOT EXISTS 'RESIDENTIAL';
    ALTER TYPE roadtype ADD VALUE IF NOT EXISTS 'BRIDGE';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- For TrafficStatus enum
DO $$ 
BEGIN
    ALTER TYPE trafficstatus ADD VALUE IF NOT EXISTS 'FREE_FLOW';
    ALTER TYPE trafficstatus ADD VALUE IF NOT EXISTS 'LIGHT';
    ALTER TYPE trafficstatus ADD VALUE IF NOT EXISTS 'MODERATE';
    ALTER TYPE trafficstatus ADD VALUE IF NOT EXISTS 'HEAVY';
    ALTER TYPE trafficstatus ADD VALUE IF NOT EXISTS 'STANDSTILL';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- For IncidentProneAreaType enum
DO $$ 
BEGIN
    ALTER TYPE incidentproneareatype ADD VALUE IF NOT EXISTS 'ACCIDENT_PRONE';
    ALTER TYPE incidentproneareatype ADD VALUE IF NOT EXISTS 'CRIME_HOTSPOT';
    ALTER TYPE incidentproneareatype ADD VALUE IF NOT EXISTS 'FLOOD_PRONE';
    ALTER TYPE incidentproneareatype ADD VALUE IF NOT EXISTS 'TRAFFIC_CONGESTION';
    ALTER TYPE incidentproneareatype ADD VALUE IF NOT EXISTS 'ROAD_HAZARD';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Verify the changes
SELECT DISTINCT road_type FROM traffic_monitoring;
SELECT DISTINCT traffic_status FROM traffic_monitoring;
SELECT DISTINCT area_type FROM incident_prone_areas;
