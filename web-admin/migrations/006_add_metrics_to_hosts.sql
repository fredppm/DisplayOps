-- Migration 006: Add metrics column to hosts table
-- Adds real-time system metrics (CPU, memory usage) to hosts

-- Add metrics column to store real-time system metrics
ALTER TABLE hosts 
ADD COLUMN IF NOT EXISTS metrics JSONB DEFAULT NULL;

-- Add comment to document the column
COMMENT ON COLUMN hosts.metrics IS 'Real-time system metrics: CPU usage, memory usage, etc. Updated every heartbeat (~30s)';

-- Example metrics structure:
-- {
--   "cpuUsagePercent": 45.2,
--   "memoryUsagePercent": 62.8,
--   "memoryUsedGB": 10.1,
--   "memoryTotalGB": 16.0
-- }

