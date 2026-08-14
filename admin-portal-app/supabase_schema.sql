-- ==============================================================================
-- ENROL OVERSEAS - SUPABASE SQL SCHEMA INITIALIZATION
-- Copy and run this script in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ==============================================================================

-- 1. Create the Leads table (supports both CamelCase and snake_case API mappings)
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    academic_level TEXT,
    stream_of_interest TEXT,
    degree_of_interest TEXT,
    score TEXT,
    budget TEXT,
    location_preference TEXT,
    source TEXT DEFAULT 'direct_apply',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'New',
    notes TEXT,
    remarks TEXT,
    follow_up_date TEXT,
    disposition TEXT,
    sub_disposition TEXT,
    priority INTEGER DEFAULT 1,
    college_id TEXT,
    college_name TEXT
);

-- Create index for faster sorting by timestamp
CREATE INDEX IF NOT EXISTS idx_leads_timestamp ON leads (timestamp DESC);

-- 2. Create the Settings table to store global configurations (e.g., Google Sheets URL)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Insert default placeholder settings
INSERT INTO settings (key, value) 
VALUES ('google_sheet_url', '')
ON CONFLICT (key) DO NOTHING;

-- 3. Configure Row Level Security (RLS)
-- To allow the Vercel landing page to post leads directly via client-side code:
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent "already exists" (42710) errors when re-running the script
DROP POLICY IF EXISTS "Allow public insert of leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated read of leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated update of leads" ON leads;
DROP POLICY IF EXISTS "Allow authenticated delete of leads" ON leads;
DROP POLICY IF EXISTS "Allow anonymous read" ON leads;
DROP POLICY IF EXISTS "Allow anonymous insert" ON leads;
DROP POLICY IF EXISTS "Allow anonymous update" ON leads;
DROP POLICY IF EXISTS "Allow anonymous delete" ON leads;

DROP POLICY IF EXISTS "Allow public select of settings" ON settings;
DROP POLICY IF EXISTS "Allow public upsert of settings" ON settings;

-- Create policies for Leads:
-- A. Allow anyone to submit a lead (INSERT) - required for the landing page
CREATE POLICY "Allow public insert of leads" 
ON leads 
FOR INSERT 
WITH CHECK (true);

-- B. Allow reading and managing leads with proper authentication
-- If you use the service role key on the backend, it automatically bypasses RLS.
-- But if you are testing using the anon key, these policies allow standard access:
CREATE POLICY "Allow authenticated read of leads" 
ON leads 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated update of leads" 
ON leads 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow authenticated delete of leads" 
ON leads 
FOR DELETE 
USING (true);

-- Create policies for Settings:
CREATE POLICY "Allow public select of settings" 
ON settings 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public upsert of settings" 
ON settings 
FOR ALL 
USING (true);
