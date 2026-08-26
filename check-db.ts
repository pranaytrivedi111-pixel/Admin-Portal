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

// Test full unpack/pack flow
function unpackLeadWithMetadata(dbLead: any) {
  const lead: any = { ...dbLead };
  if (lead.academic_level) lead.academicLevel = lead.academic_level;
  if (lead.stream_of_interest) lead.streamOfInterest = lead.stream_of_interest;
  if (lead.degree_of_interest) lead.degreeOfInterest = lead.degree_of_interest;
  if (lead.location_preference) lead.locationPreference = lead.location_preference;
  if (lead.follow_up_date) lead.followUpDate = lead.follow_up_date;
  if (lead.sub_disposition) lead.subDisposition = lead.sub_disposition;
  
  const searchIn = [lead.remarks, lead.notes];
  for (const text of searchIn) {
    if (typeof text === 'string' && text.includes('<!--ENROL_META:')) {
      const match = text.match(/<!--ENROL_META:([\s\S]*?)-->/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.counsellor && !lead.counsellor) {
            lead.counsellor = parsed.counsellor;
          }
          if (parsed.documents && (!lead.documents || lead.documents.length === 0)) {
            lead.documents = parsed.documents;
          }
        } catch (e) {}
      }
    }
  }

  if (typeof lead.remarks === 'string') {
    lead.remarks = lead.remarks.replace(/<!--ENROL_META:[\s\S]*?-->/g, '').trim();
  }
  return lead;
}

async function check() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  
  if (!url || !key) {
    console.error("Missing Supabase credentials!");
    return;
  }
  
  const supabase = createClient(url, key);
  try {
    const { data: rows, error } = await supabase.from('leads').select('*').order('timestamp', { ascending: false });
    if (error) {
      console.error("Error fetching leads rows:", error);
    } else if (rows && rows.length > 0) {
      console.log(`Found ${rows.length} rows in Supabase. Row columns:`, Object.keys(rows[0]));
      console.log('Sample row:', JSON.stringify(rows[0], null, 2));
      
      // Test assigning counsellor to lead 0
      const testLead = rows[0];
      console.log(`Assigning counsellor 'Siraj' to lead ${testLead.id} (${testLead.name})...`);
      
      const metaTag = `<!--ENROL_META:{"counsellor":"Siraj","documents":[]}-->`;
      const updateRes = await supabase.from('leads').update({
        remarks: `Applicant interested in USA masters.\n${metaTag}`
      }).eq('id', testLead.id).select();
      
      console.log("Update response status:", updateRes.status, updateRes.error ? `Error: ${updateRes.error.message}` : "Success");
      
      // Read back
      const { data: verifyRows } = await supabase.from('leads').select('*').order('timestamp', { ascending: false });
      if (verifyRows) {
        const mapped = verifyRows.map(unpackLeadWithMetadata);
        console.log("Verified all mapped leads from live Supabase:");
        mapped.forEach(l => {
          console.log(`- Lead ID: ${l.id} | Name: ${l.name} | Assigned Counsellor: ${l.counsellor || 'Unassigned'} | Remarks: "${l.remarks}"`);
        });
      }
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

check();
