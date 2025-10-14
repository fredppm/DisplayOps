-- Migration 007: Create host_command_logs table
-- Audit trail for all commands sent to hosts via gRPC

CREATE TABLE host_command_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id VARCHAR(100) NOT NULL, -- agent_id of the host
    command_type VARCHAR(100) NOT NULL, -- e.g., OPEN_DASHBOARD, REFRESH_DASHBOARD, etc.
    target_display VARCHAR(100), -- display ID if command targets a specific display
    payload JSONB DEFAULT NULL, -- command parameters
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'timeout')),
    error_message TEXT, -- error details if failed
    response JSONB DEFAULT NULL, -- response from host-agent
    duration_ms INTEGER, -- execution time in milliseconds
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (host_id) REFERENCES hosts(agent_id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_host_command_logs_host_id ON host_command_logs(host_id);
CREATE INDEX idx_host_command_logs_timestamp ON host_command_logs(timestamp DESC);
CREATE INDEX idx_host_command_logs_command_type ON host_command_logs(command_type);
CREATE INDEX idx_host_command_logs_status ON host_command_logs(status);
CREATE INDEX idx_host_command_logs_target_display ON host_command_logs(target_display) WHERE target_display IS NOT NULL;

-- Composite index for common queries
CREATE INDEX idx_host_command_logs_host_timestamp ON host_command_logs(host_id, timestamp DESC);

-- Add comment to document the table
COMMENT ON TABLE host_command_logs IS 'Audit trail of all commands sent to hosts via gRPC for debugging and monitoring';

