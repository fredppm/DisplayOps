-- Migration: Add metrics column to hosts table
-- This column stores real-time metrics (CPU, memory usage) updated every heartbeat

-- Check if column exists before adding (PostgreSQL 9.6+)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'hosts' 
        AND column_name = 'metrics'
    ) THEN
        ALTER TABLE hosts 
        ADD COLUMN metrics JSONB DEFAULT NULL;
        
        COMMENT ON COLUMN hosts.metrics IS 'Real-time metrics (CPU usage, memory usage) updated every heartbeat';
    END IF;
END $$;

-- Create index for metrics queries (optional, for future performance)
CREATE INDEX IF NOT EXISTS idx_hosts_metrics ON hosts USING GIN (metrics);

