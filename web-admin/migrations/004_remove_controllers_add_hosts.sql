-- Migration: Remove Controllers, Add Hosts
-- Replace the controllers table with hosts table for direct host-agent connections
-- Date: 2025-10-14

-- Step 1: Drop foreign keys and references to controllers
ALTER TABLE dashboards DROP CONSTRAINT IF EXISTS dashboards_controller_id_fkey;
ALTER TABLE dashboards DROP COLUMN IF EXISTS controller_id;

-- Step 2: Update sites table
ALTER TABLE sites RENAME COLUMN controllers TO hosts;

-- Step 3: Drop controllers table and its indexes
DROP TRIGGER IF EXISTS update_controllers_updated_at ON controllers;
DROP INDEX IF EXISTS idx_controllers_status;
DROP INDEX IF EXISTS idx_controllers_last_sync;
DROP TABLE IF EXISTS controllers CASCADE;

-- Step 4: Create hosts table (mini PCs running host-agent)
CREATE TABLE IF NOT EXISTS hosts (
    id VARCHAR(50) PRIMARY KEY,
    agent_id VARCHAR(100) NOT NULL UNIQUE, -- Unique agent identifier
    hostname VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    grpc_port INTEGER NOT NULL DEFAULT 8082,
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error')),
    last_seen TIMESTAMP WITH TIME ZONE,
    version VARCHAR(20) DEFAULT '1.0.0',
    displays JSONB DEFAULT '[]', -- Array of display configurations
    system_info JSONB DEFAULT '{}', -- System information (CPU, RAM, etc)
    site_id VARCHAR(50), -- Optional site assignment
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);

-- Step 5: Create indexes for hosts table
CREATE INDEX idx_hosts_agent_id ON hosts(agent_id);
CREATE INDEX idx_hosts_status ON hosts(status);
CREATE INDEX idx_hosts_last_seen ON hosts(last_seen);
CREATE INDEX idx_hosts_site_id ON hosts(site_id);

-- Step 6: Create trigger for updated_at
CREATE TRIGGER update_hosts_updated_at BEFORE UPDATE ON hosts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 7: Add comment
COMMENT ON TABLE hosts IS 'Mini PCs running host-agent that connect directly to Web-Admin';
COMMENT ON COLUMN hosts.agent_id IS 'Unique identifier from host-agent config';
COMMENT ON COLUMN hosts.grpc_port IS 'gRPC port for bidirectional communication';
COMMENT ON COLUMN hosts.displays IS 'JSON array of connected displays with their configurations';
COMMENT ON COLUMN hosts.system_info IS 'JSON object with system information (CPU, RAM, OS, etc)';

