-- Office TV Admin Database Schema
-- PostgreSQL Database Schema for DisplayOps Management System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL, -- bcrypt hash
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'site-manager', 'viewer')),
    sites TEXT[] NOT NULL DEFAULT '{}', -- Array of site IDs, ['*'] for admin
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Sites table
CREATE TABLE sites (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
    hosts TEXT[] NOT NULL DEFAULT '{}', -- Array of host IDs (mini PCs running host-agent)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Hosts table (mini PCs running host-agent)
-- Note: Status (online/offline) is calculated dynamically from last_seen timestamp
-- Status = 'online' if last_seen < 2 minutes ago, 'offline' otherwise
CREATE TABLE hosts (
    agent_id VARCHAR(100) PRIMARY KEY, -- Unique agent identifier (e.g., "agent-vtex-b9lh6z3")
    hostname VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    grpc_port INTEGER NOT NULL DEFAULT 8082,
    last_seen TIMESTAMP WITH TIME ZONE, -- Status calculated from this field
    version VARCHAR(20) DEFAULT '1.0.0',
    displays JSONB DEFAULT '[]', -- Array of display configurations
    system_info JSONB DEFAULT '{}', -- System information (CPU, RAM, etc)
    metrics JSONB DEFAULT NULL, -- Real-time metrics (CPU usage, memory usage) updated every heartbeat
    site_id VARCHAR(50), -- Optional site assignment
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);

-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(50),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Sessions/Cookies table (if needed for session management)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(50) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Dashboards table
CREATE TABLE dashboards (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    site_id VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_last_login ON users(last_login);

CREATE INDEX idx_sites_status ON sites(status);
CREATE INDEX idx_sites_updated_at ON sites(updated_at);

-- Hosts indexes (agent_id is PK, no need for separate index)
CREATE INDEX idx_hosts_last_seen ON hosts(last_seen); -- For status calculation and cleanup
CREATE INDEX idx_hosts_site_id ON hosts(site_id); -- For site lookups
CREATE INDEX idx_hosts_hostname ON hosts(hostname); -- For search
CREATE INDEX idx_hosts_ip_address ON hosts(ip_address); -- For network lookups

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_action ON audit_log(action);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_dashboards_site_id ON dashboards(site_id);
CREATE INDEX idx_dashboards_status ON dashboards(status);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hosts_updated_at BEFORE UPDATE ON hosts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();