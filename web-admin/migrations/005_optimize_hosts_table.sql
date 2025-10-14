-- Migration 005: Optimize hosts table
-- Remove redundant 'status' field (calculated dynamically from last_seen)
-- Make agent_id the real primary key

-- Step 1: Remove status column (calculated dynamically now)
ALTER TABLE hosts DROP COLUMN IF EXISTS status;

-- Step 2: Remove the old 'id' column and make agent_id the primary key
-- First, drop existing primary key constraint
ALTER TABLE hosts DROP CONSTRAINT IF EXISTS hosts_pkey;

-- Drop the old 'id' column (was redundant)
ALTER TABLE hosts DROP COLUMN IF EXISTS id;

-- Make agent_id the primary key
ALTER TABLE hosts ADD PRIMARY KEY (agent_id);

-- Step 3: Update any foreign key references (if they exist)
-- Sites table reference (if it exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sites' AND column_name = 'host_id'
    ) THEN
        -- Drop old foreign key if it exists
        ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_host_id_fkey;
        
        -- Rename column if needed
        ALTER TABLE sites RENAME COLUMN host_id TO host_agent_id;
        
        -- Add new foreign key referencing agent_id
        ALTER TABLE sites ADD CONSTRAINT sites_host_agent_id_fkey 
            FOREIGN KEY (host_agent_id) REFERENCES hosts(agent_id) ON DELETE SET NULL;
    END IF;
END $$;

-- Step 4: Add useful indexes
CREATE INDEX IF NOT EXISTS idx_hosts_last_seen ON hosts(last_seen);
CREATE INDEX IF NOT EXISTS idx_hosts_hostname ON hosts(hostname);
CREATE INDEX IF NOT EXISTS idx_hosts_ip_address ON hosts(ip_address);

-- Step 5: Add comment to document status is calculated
COMMENT ON COLUMN hosts.last_seen IS 'Last heartbeat timestamp. Status (online/offline) is calculated dynamically: online if last_seen < 2 minutes ago, otherwise offline.';

COMMENT ON TABLE hosts IS 'Hosts table stores mini PCs running host-agent. Status is calculated dynamically from last_seen timestamp (not stored).';

