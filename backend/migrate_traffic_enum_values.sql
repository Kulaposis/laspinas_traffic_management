-- Migrate existing traffic data enum values from lowercase to UPPERCASE
-- Run this in Supabase SQL Editor or via psql

BEGIN;

-- Update road_type values
UPDATE traffic_monitoring
SET road_type = UPPER(road_type)
WHERE road_type IN ('highway', 'main_road', 'side_street', 'residential', 'bridge');

-- Update traffic_status values  
UPDATE traffic_monitoring
SET traffic_status = UPPER(traffic_status)
WHERE traffic_status IN ('free_flow', 'light', 'moderate', 'heavy', 'standstill');

-- Verify the changes
SELECT 
    'road_type' as column_name,
    road_type as value,
    COUNT(*) as count
FROM traffic_monitoring
GROUP BY road_type

UNION ALL

SELECT 
    'traffic_status' as column_name,
    traffic_status as value,
    COUNT(*) as count
FROM traffic_monitoring
GROUP BY traffic_status
ORDER BY column_name, value;

COMMIT;
