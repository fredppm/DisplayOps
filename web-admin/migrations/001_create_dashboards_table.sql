-- Create dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    description TEXT,
    refresh_interval INTEGER NOT NULL DEFAULT 300,
    requires_auth BOOLEAN NOT NULL DEFAULT true,
    category VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_dashboards_category ON dashboards(category);
CREATE INDEX IF NOT EXISTS idx_dashboards_name ON dashboards(name);

-- Insert default data if table is empty
INSERT INTO dashboards (id, name, url, description, refresh_interval, requires_auth, category)
SELECT 'common-dashboard', 'Grafana VTEX', 'https://grafana.vtex.com/d/d7e7051f-42a2-4798-af93-cf2023dd2e28/home?orgId=1&from=now-3h&to=now&timezone=browser&var-Origin=argocd&refresh=10s', 'Common dashboard for all systems', 300, true, 'Monitoring'
WHERE NOT EXISTS (SELECT 1 FROM dashboards WHERE id = 'common-dashboard');

INSERT INTO dashboards (id, name, url, description, refresh_interval, requires_auth, category)
SELECT 'health-monitor', 'Health Monitor', 'https://healthmonitor.vtex.com/', 'Health monitor for all systems', 600, true, 'Business Intelligence'
WHERE NOT EXISTS (SELECT 1 FROM dashboards WHERE id = 'health-monitor');