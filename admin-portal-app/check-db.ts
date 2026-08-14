import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env manually
const envFile = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let val = match[2] || '';
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
});

async function check() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  
  if (!url || !key) {
    console.error("Missing Supabase credentials!");
    return;
  }
  
  const supabase = createClient(url, key);
  try {
    // Select one row to see all columns
    const { data, error } = await supabase.from('leads').select('*').limit(1);
    if (error) {
      console.error("Error fetching leads row:", error);
    } else if (data && data.length > 0) {
      console.log("Leads Columns list:", Object.keys(data[0]));
      console.log("Full Row Example:", JSON.stringify(data[0], null, 2));
    } else {
      console.log("Leads table is empty.");
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

check();
