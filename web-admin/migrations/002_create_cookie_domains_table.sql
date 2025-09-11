-- Create cookie_domains table
CREATE TABLE IF NOT EXISTS cookie_domains (
    id VARCHAR(255) PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    cookies JSONB NOT NULL DEFAULT '[]',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_cookie_domains_domain ON cookie_domains(domain);
CREATE INDEX IF NOT EXISTS idx_cookie_domains_last_updated ON cookie_domains(last_updated);