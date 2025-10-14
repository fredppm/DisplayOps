-- Migration 008: Create cookie_domains table
-- Stores cookies to be synced with hosts for dashboard authentication

CREATE TABLE cookie_domains (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    domain VARCHAR(255) NOT NULL UNIQUE,
    cookies JSONB NOT NULL DEFAULT '[]', -- Array of cookie objects
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_cookie_domains_domain ON cookie_domains(domain);
CREATE INDEX idx_cookie_domains_enabled ON cookie_domains(enabled);

-- Trigger for updated_at
CREATE TRIGGER update_cookie_domains_updated_at BEFORE UPDATE ON cookie_domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comment to document the table
COMMENT ON TABLE cookie_domains IS 'Cookies to be synchronized with hosts for dashboard authentication';

-- Example cookie structure:
-- {
--   "name": "auth_token",
--   "value": "xyz123",
--   "domain": ".example.com",
--   "path": "/",
--   "secure": true,
--   "httpOnly": true,
--   "sameSite": "Lax",
--   "expirationDate": 1735689600
-- }

