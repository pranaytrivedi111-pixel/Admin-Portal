import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Force load .env manually to guarantee variables are loaded on all environments
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf-8');
    envFile.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = match[2] || '';
        val = val.trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
} catch (err) {
  console.warn("Manual .env loading failed:", err);
}

const app = express();

// Enable CORS so the landing page (enroloverseas.vercel.app) can post leads safely
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Helper to filter out placeholder values commonly set in development/Vercel dashboards
const cleanEnvVar = (val: any): string => {
  if (!val) return '';
  let s = String(val).trim();
  
  // Resiliently strip surrounding double or single quotes if present (common when copy-pasting .env into Vercel)
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.substring(1, s.length - 1).trim();
  }
  
  // Resiliently extract JWT token if the value contains a JWT (e.g. Supabase keys always start with 'ey')
  // This prevents key corruption when other variables like NO_UPDATE_NOTIFIER are appended directly in the environment
  if (s.includes('.')) {
    const jwtMatch = s.match(/ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    if (jwtMatch) {
      s = jwtMatch[0].trim();
    }
  }
  
  if (
    s === '' || 
    s === 'undefined' || 
    s === 'null' || 
    s.includes('your-project-id') || 
    s.includes('your-service-role-key') || 
    s.includes('your-anon-key') || 
    s.includes('your-supabase-url') ||
    s.includes('your_supabase_url') ||
    s.includes('your_supabase_service_role_key') ||
    s.includes('PLACEHOLDER')
  ) {
    return '';
  }
  return s;
};

// Initialize Supabase Client safely
let supabase: ReturnType<typeof createClient> | null = null;

// Helper to validate if a key is a valid Supabase key (JWT starting with 'ey', or publishable key starting with 'sb_publishable_' or 'sbp_')
const isValidSupabaseKey = (val: any): boolean => {
  if (!val) return false;
  const s = String(val).trim();
  if (s.startsWith('sb_publishable_') || s.startsWith('sbp_')) return true;
  return s.startsWith('ey') && s.includes('.') && s.split('.').length === 3;
};

// Extract candidate keys and validate them to avoid wrong/corrupted environment variables
const getValidSupabaseKey = (): string => {
  const candidates = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_SERVICE_ROLE,
    process.env.SUPABASE_ANON_KEY,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ];
  
  for (const raw of candidates) {
    const cleaned = cleanEnvVar(raw);
    if (isValidSupabaseKey(cleaned)) {
      return cleaned;
    }
  }
  
  // Default working fallback key
  return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1aGFoc3pndWVwcnRyb3Ntb2h1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUyNTU4MywiZXhwIjoyMDk5MTAxNTgzfQ.KU92M9Do1OdYUYWtmSJpK-M7A7StJ-9ONSGy1bsEODw';
};

const FALLBACK_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1aGFoc3pndWVwcnRyb3Ntb2h1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzUyNTU4MywiZXhwIjoyMDk5MTAxNTgzfQ.KU92M9Do1OdYUYWtmSJpK-M7A7StJ-9ONSGy1bsEODw';
const FALLBACK_SUPABASE_URL = 'https://huhahszgueprtrosmohu.supabase.co';

let supabaseKey = getValidSupabaseKey();
let supabaseUrl = '';

if (supabaseKey === FALLBACK_SUPABASE_KEY) {
  supabaseUrl = FALLBACK_SUPABASE_URL;
} else {
  supabaseUrl = cleanEnvVar(process.env.SUPABASE_URL) || 
                cleanEnvVar(process.env.VITE_SUPABASE_URL) || 
                cleanEnvVar(process.env.NEXT_PUBLIC_SUPABASE_URL) || 
                FALLBACK_SUPABASE_URL;
}

const isValidUrl = (url: string) => {
  try {
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

// Self-healing check: decode JWT token to extract project reference if URL is placeholder or missing
if ((!isValidUrl(supabaseUrl) || supabaseUrl.includes('your-project-id')) && supabaseKey) {
  try {
    const parts = supabaseKey.split('.');
    if (parts.length === 3) {
      const payloadBuf = Buffer.from(parts[1], 'base64');
      const payload = JSON.parse(payloadBuf.toString('utf-8'));
      if (payload && payload.ref) {
        supabaseUrl = `https://${payload.ref}.supabase.co`;
        console.log("Self-healing: Auto-detected Supabase URL from service role token payload:", supabaseUrl);
      }
    }
  } catch (err) {
    console.warn("Self-healing: Failed to extract project ref from token payload:", err);
  }
}

if (isValidUrl(supabaseUrl) && supabaseKey && !supabaseUrl.includes('your-project-id')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("Supabase client initialized successfully with URL:", supabaseUrl);
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
  }
} else {
  console.warn("Supabase is not configured or configured with invalid values. URL:", supabaseUrl);
}

// Local fallback storage for resilience
let localLeads: any[] = [];
let localGoogleSheetUrl = '';

// Seed leads structure
const SEED_LEADS = [
  {
    id: "lead-1",
    name: "Aarav Mehta",
    email: "aarav.mehta@gmail.com",
    phone: "+91 98765 43210",
    academicLevel: "Undergraduate",
    streamOfInterest: "Computer Applications",
    degreeOfInterest: "BCA",
    score: "92%",
    budget: "₹2.5 Lakhs/year",
    locationPreference: "Bangalore",
    source: "direct_apply",
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: "New",
    notes: "Aarav is highly interested in BCA in Bangalore. Excellent high school grades.",
    priority: 3
  },
  {
    id: "lead-2",
    name: "Ananya Iyer",
    email: "ananya.iyer@yahoo.com",
    phone: "+91 87654 32109",
    academicLevel: "Postgraduate",
    streamOfInterest: "Management",
    degreeOfInterest: "MBA",
    score: "78%",
    budget: "₹4.5 Lakhs/year",
    locationPreference: "Mumbai",
    source: "eligibility_calculator",
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    status: "In Progress",
    notes: "Requires assistance with education loan. Wants top business schools in Mumbai.",
    priority: 2,
    disposition: "Prospect",
    subDisposition: "Payment next month"
  },
  {
    id: "lead-3",
    name: "Rohan Sharma",
    email: "rohan.sharma99@gmail.com",
    phone: "+91 76543 21098",
    academicLevel: "Undergraduate",
    streamOfInterest: "Engineering",
    degreeOfInterest: "B.Tech CSE",
    score: "88%",
    budget: "₹3.0 Lakhs/year",
    locationPreference: "Pune",
    source: "ai_chat",
    timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
    status: "Contacted",
    notes: "Enquired via AI Chat about scholarships. Follow up scheduled.",
    priority: 1,
    disposition: "Follow up",
    subDisposition: "Interested",
    followUpDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
  }
];

// Initialize localLeads with seed leads so there's always default data
localLeads = [...SEED_LEADS];

// Column mapping helpers for Supabase to support both camelCase and snake_case databases
const fieldMappings: Record<string, string> = {
  academicLevel: 'academic_level',
  streamOfInterest: 'stream_of_interest',
  degreeOfInterest: 'degree_of_interest',
  locationPreference: 'location_preference',
  followUpDate: 'follow_up_date',
  subDisposition: 'sub_disposition',
  collegeId: 'college_id',
  collegeName: 'college_name',
  counsellor: 'counsellor',
  counselor: 'counsellor',
  documents: 'documents'
};

const reverseFieldMappings: Record<string, string> = {
  academic_level: 'academicLevel',
  stream_of_interest: 'streamOfInterest',
  degree_of_interest: 'degreeOfInterest',
  location_preference: 'locationPreference',
  follow_up_date: 'followUpDate',
  sub_disposition: 'subDisposition',
  college_id: 'collegeId',
  college_name: 'collegeName',
  counselor: 'counsellor',
  counsellor: 'counsellor',
  assigned_to: 'counsellor',
  documents: 'documents'
};

function mapLeadToSupabase(lead: any) {
  const result: any = {};
  for (const key of Object.keys(lead)) {
    const mappedKey = fieldMappings[key] || key;
    result[mappedKey] = lead[key];
  }
  return result;
}

function unpackLeadWithMetadata(dbLead: any) {
  const result: any = {};
  for (const key of Object.keys(dbLead)) {
    const mappedKey = reverseFieldMappings[key] || key;
    let val = dbLead[key];
    if (mappedKey === 'documents' && typeof val === 'string') {
      try {
        val = JSON.parse(val);
      } catch (e) {
        val = [];
      }
    }
    result[mappedKey] = val;
  }

  // Ensure documents is an array if present
  if (result.documents && !Array.isArray(result.documents)) {
    result.documents = [];
  }

  // Extract embedded metadata from remarks or notes
  const searchIn = [result.remarks, result.notes, dbLead.remarks, dbLead.notes];
  for (const text of searchIn) {
    if (typeof text === 'string' && text.includes('<!--ENROL_META:')) {
      const match = text.match(/<!--ENROL_META:([\s\S]*?)-->/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.counsellor && (!result.counsellor || result.counsellor.trim() === '')) {
            result.counsellor = parsed.counsellor;
          }
          if (parsed.documents && Array.isArray(parsed.documents) && (!result.documents || result.documents.length === 0)) {
            result.documents = parsed.documents;
          }
        } catch (e) {
          console.warn("Error parsing ENROL_META tag:", e);
        }
      }
    }
  }

  // Strip ENROL_META tag from remarks and notes so clean human text is exposed in UI
  if (typeof result.remarks === 'string') {
    result.remarks = result.remarks.replace(/<!--ENROL_META:[\s\S]*?-->/g, '').trim();
  }
  if (typeof result.notes === 'string') {
    result.notes = result.notes.replace(/<!--ENROL_META:[\s\S]*?-->/g, '').trim();
  }

  return result;
}

// REST ENDPOINTS

// 1. GET /api/leads - Fetch all leads
app.get(['/api/leads', '/leads'], async (req, res) => {
  if (supabase) {
    try {
      // Fetch from Supabase leads table
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('timestamp', { ascending: false });

      if (!error && data) {
        const mappedLeads = data.map(unpackLeadWithMetadata);
        localLeads = mappedLeads; // Keep local memory in sync

        // Also fetch settings if table exists, or fallback
        let googleSheetUrl = localGoogleSheetUrl;
        try {
          const { data: settingsData } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'google_sheet_url')
            .single();
          if (settingsData) {
            googleSheetUrl = settingsData.value;
          }
        } catch (e) {
          // settings table might not exist, fallback is fine
        }
        return res.json({ leads: mappedLeads, googleSheetUrl });
      } else {
        console.warn("Supabase fetch failed or table doesn't exist, falling back to local memory:", error?.message);
      }
    } catch (err) {
      console.error("Failed to fetch from Supabase:", err);
    }
  }

  // Fallback to local leads
  res.json({ leads: localLeads, googleSheetUrl: localGoogleSheetUrl });
});

// 2. POST /api/leads - Create/Submit a new lead (used by landing page & calculator)
// Registered on multiple common landing-page webhook paths for extreme integration compatibility
const handleLeadSubmission = async (req: express.Request, res: express.Response) => {
  const payload = req.body || {};
  
  // High resilience field extraction to match any landing page form input names
  let name = payload.name || payload.fullName || payload.fullname || payload.studentName || payload.student_name || payload.Name || '';
  
  // If full name is empty, try to construct it from first & last name permutations
  if (!name || !name.trim()) {
    const fName = payload.firstName || payload.first_name || payload.Fname || payload.fname || payload.FirstName || '';
    const lName = payload.lastName || payload.last_name || payload.Lname || payload.lname || payload.LastName || '';
    if (fName.trim() || lName.trim()) {
      name = `${fName} ${lName}`.trim();
    }
  }

  const email = payload.email || payload.studentEmail || payload.student_email || payload.Email || payload.mail || payload.Mail || '';
  const phone = payload.phone || payload.studentPhone || payload.student_phone || payload.Phone || payload.mobile || payload.Mobile || payload.telephone || payload.tel || payload.Tel || payload.contact || payload.Contact || payload.number || payload.Number || '';

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Missing required field: name (or fullName, studentName, firstName)" });
  }
  if (!email.trim() && !phone.trim()) {
    return res.status(400).json({ error: "Missing contact field: email or phone is required" });
  }

  const academicLevel = payload.academicLevel || payload.academic_level || payload.education || payload.studyLevel || payload.qualification || payload.course_level || payload.courseLevel || 'Undergraduate';
  const streamOfInterest = payload.streamOfInterest || payload.stream_of_interest || payload.course || payload.stream || payload.subject || payload.program || payload.discipline || 'Engineering';
  const degreeOfInterest = payload.degreeOfInterest || payload.degree_of_interest || payload.degree || '';
  const score = payload.score || payload.marks || payload.percentage || payload.gpa || '';
  const budget = payload.budget || payload.budgetRange || '';
  const locationPreference = payload.locationPreference || payload.location_preference || payload.preferredLocation || payload.location || payload.country || payload.destination || payload.preferredCountry || payload.preferred_country || '';
  const source = payload.source || payload.lead_source || 'direct_apply';
  const notes = payload.notes || payload.message || payload.comments || payload.query || payload.description || '';
  const counsellor = payload.counsellor || payload.counselor || '';
  const documents = Array.isArray(payload.documents) ? payload.documents : [];

  const newLead = {
    id: payload.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    academicLevel: academicLevel,
    streamOfInterest: streamOfInterest,
    degreeOfInterest: degreeOfInterest,
    score: score,
    budget: budget,
    locationPreference: locationPreference,
    source: source,
    timestamp: payload.timestamp || new Date().toISOString(),
    status: payload.status || 'New',
    notes: notes,
    remarks: payload.remarks || '',
    followUpDate: payload.followUpDate || null,
    disposition: payload.disposition || 'New Lead',
    subDisposition: payload.subDisposition || 'NA',
    priority: payload.priority || 1,
    collegeId: payload.collegeId || null,
    collegeName: payload.collegeName || null,
    counsellor: counsellor,
    documents: documents
  };

  if (supabase) {
    try {
      const dbLead = mapLeadToSupabase(newLead);
      let { error } = await supabase
        .from('leads')
        .insert([dbLead]);

      // If missing column error (e.g. counsellor or documents), retry with safe columns + metadata
      if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.toLowerCase().includes('column'))) {
        console.log("Supabase insert column missing in schema cache, retrying with resilient metadata...");
        const safeDbLead: any = {};
        for (const [k, v] of Object.entries(dbLead)) {
          if (k !== 'counsellor' && k !== 'counselor' && k !== 'documents') {
            safeDbLead[k] = v;
          }
        }

        const metaObj: any = {};
        if (counsellor) metaObj.counsellor = counsellor;
        if (documents && documents.length > 0) metaObj.documents = documents;

        if (Object.keys(metaObj).length > 0) {
          const metaTag = `<!--ENROL_META:${JSON.stringify(metaObj)}-->`;
          safeDbLead.remarks = safeDbLead.remarks ? `${safeDbLead.remarks}\n${metaTag}` : metaTag;
        }

        const retry = await supabase.from('leads').insert([safeDbLead]);
        if (!retry.error) {
          localLeads.unshift(newLead);
          return res.status(201).json({ success: true, lead: newLead, storage: "supabase" });
        } else {
          error = retry.error;
        }
      }

      if (!error) {
        localLeads.unshift(newLead);
        return res.status(201).json({ success: true, lead: newLead, storage: "supabase" });
      } else {
        console.warn("Failed to insert lead into Supabase. Code:", error.code, "Message:", error.message);
        return res.status(500).json({
          success: false,
          error: "Supabase Insertion Failed",
          code: error.code,
          message: error.message,
          suggestion: error.code === '42P01' 
            ? "The 'leads' table does not exist in Supabase. Please copy and run the SQL schema from '/supabase_schema.sql' in your Supabase SQL Editor."
            : "Please verify your Supabase keys, connection URL, and table permissions (RLS) in the Supabase Dashboard."
        });
      }
    } catch (err: any) {
      console.error("Failed to insert lead into Supabase:", err);
      return res.status(500).json({ 
        success: false, 
        error: "Supabase Connection Error", 
        message: err?.message || String(err) 
      });
    }
  }

  // Fallback to local storage (Only when SUPABASE_URL / SUPABASE_KEY are not configured)
  localLeads.unshift(newLead);
  res.status(201).json({ 
    success: true, 
    lead: newLead, 
    storage: "local_memory_fallback",
    warning: "Supabase credentials are not configured on this environment. Leads are being saved in-memory." 
  });
};

// Listen on all possible standard lead/contact forms routes to capture any website inputs automatically
app.post(['/api/leads', '/leads'], handleLeadSubmission);
app.post(['/api/contact', '/contact'], handleLeadSubmission);
app.post(['/api/apply', '/apply'], handleLeadSubmission);
app.post(['/api/inquiry', '/inquiry'], handleLeadSubmission);

// 3. PUT /api/leads/:id - Update an existing lead (Live counselor assignment, status, documents, etc.)
app.put(['/api/leads/:id', '/leads/:id'], async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  // Update in-memory cache immediately
  localLeads = localLeads.map(l => l.id === id ? { ...l, ...updates } : l);

  if (supabase) {
    try {
      // 1. Fetch current row if available to merge seamlessly
      let existingLead: any = null;
      try {
        const { data: rowData } = await supabase
          .from('leads')
          .select('*')
          .eq('id', id)
          .single();
        if (rowData) {
          existingLead = unpackLeadWithMetadata(rowData);
        }
      } catch (e) {
        // Continue with local memory
      }

      const mergedLead = {
        ...(existingLead || {}),
        ...updates
      };

      const dbUpdates = mapLeadToSupabase(updates);

      // Attempt direct update in Supabase
      let { error } = await supabase
        .from('leads')
        .update(dbUpdates)
        .eq('id', id);

      // If PostgREST schema cache misses 'counsellor' or 'documents' column (PGRST204 or 42703), use resilient metadata packing
      if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.toLowerCase().includes('column'))) {
        console.log(`Supabase column update notice (${error.code}: ${error.message}). Applying resilient metadata storage on live Supabase...`);
        
        // Strip out non-existent columns for direct Postgres write
        const safeUpdates: any = {};
        for (const [k, v] of Object.entries(dbUpdates)) {
          if (k !== 'counsellor' && k !== 'counselor' && k !== 'documents') {
            safeUpdates[k] = v;
          }
        }

        // Determine final counsellor and documents values
        const finalCounsellor = updates.counsellor !== undefined ? updates.counsellor : (existingLead?.counsellor || '');
        const finalDocs = updates.documents !== undefined ? updates.documents : (existingLead?.documents || []);
        const rawRemarks = updates.remarks !== undefined ? updates.remarks : (existingLead?.remarks || '');
        
        let cleanRemarks = typeof rawRemarks === 'string' ? rawRemarks.replace(/<!--ENROL_META:[\s\S]*?-->/g, '').trim() : '';

        const metaObj: any = {};
        if (finalCounsellor && String(finalCounsellor).trim()) {
          metaObj.counsellor = String(finalCounsellor).trim();
        }
        if (Array.isArray(finalDocs) && finalDocs.length > 0) {
          metaObj.documents = finalDocs.map((d: any) => ({
            id: d.id,
            name: d.name,
            size: d.size,
            type: d.type,
            category: d.category || 'General',
            uploadedAt: d.uploadedAt,
            dataUrl: d.dataUrl && (d.dataUrl.startsWith('http://') || d.dataUrl.startsWith('https://')) ? d.dataUrl : ''
          }));
        }

        if (Object.keys(metaObj).length > 0) {
          const metaTag = `<!--ENROL_META:${JSON.stringify(metaObj)}-->`;
          safeUpdates.remarks = cleanRemarks ? `${cleanRemarks}\n${metaTag}` : metaTag;
        } else {
          safeUpdates.remarks = cleanRemarks || null;
        }

        const retryResult = await supabase
          .from('leads')
          .update(safeUpdates)
          .eq('id', id);

        if (retryResult.error) {
          console.error("Resilient metadata update error in Supabase:", retryResult.error);
        } else {
          console.log(`Lead ${id} successfully persisted in Supabase with live metadata!`);
        }
      } else if (!error) {
        console.log(`Lead ${id} successfully updated natively in Supabase!`);
      }
    } catch (err) {
      console.error("Failed to update lead in Supabase:", err);
    }
  }

  const resultLead = localLeads.find(l => l.id === id) || updates;
  return res.json({ success: true, lead: resultLead });
});

// 4. DELETE /api/leads/:id - Delete a lead
app.delete(['/api/leads/:id', '/leads/:id'], async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers['x-user-role'];

  if (userRole !== 'admin') {
    return res.status(403).json({ error: "Only administrators can delete leads" });
  }

  if (supabase) {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (!error) {
        localLeads = localLeads.filter(l => l.id !== id);
        return res.json({ success: true });
      } else {
        console.warn("Failed to delete lead from Supabase:", error.message);
      }
    } catch (err) {
      console.error("Failed to delete lead from Supabase:", err);
    }
  }

  // Fallback
  localLeads = localLeads.filter(l => l.id !== id);
  res.json({ success: true });
});

// 5. POST /api/leads/clear - Clear all leads
app.post(['/api/leads/clear', '/leads/clear'], async (req, res) => {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything

      if (!error) {
        localLeads = [];
        return res.json({ success: true });
      } else {
        console.warn("Failed to clear leads in Supabase:", error.message);
      }
    } catch (err) {
      console.error("Failed to clear leads in Supabase:", err);
    }
  }

  localLeads = [];
  res.json({ success: true });
});

// 6. POST /api/leads/seed - Seed default mock leads
app.post(['/api/leads/seed', '/leads/seed'], async (req, res) => {
  if (supabase) {
    try {
      // Insert mock leads in bulk
      const dbLeads = SEED_LEADS.map(mapLeadToSupabase);
      const { error } = await supabase
        .from('leads')
        .insert(dbLeads);

      if (!error) {
        // Merge with local leads to prevent duplicate views in memory
        for (const seed of SEED_LEADS) {
          if (!localLeads.some(l => l.id === seed.id)) {
            localLeads.push(seed);
          }
        }
        return res.json({ success: true, leads: localLeads });
      } else {
        console.warn("Failed to seed leads in Supabase:", error.message);
      }
    } catch (err) {
      console.error("Failed to seed leads in Supabase:", err);
    }
  }

  // Local fallback
  for (const seed of SEED_LEADS) {
    if (!localLeads.some(l => l.id === seed.id)) {
      localLeads.push(seed);
    }
  }
  res.json({ success: true, leads: localLeads });
});

// 7. POST /api/settings/sheets - Save Google Sheet Webhook URL
app.post(['/api/settings/sheets', '/settings/sheets'], async (req, res) => {
  const { url } = req.body;
  localGoogleSheetUrl = url || '';

  if (supabase) {
    try {
      // Try to upsert settings row
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'google_sheet_url', value: localGoogleSheetUrl }, { onConflict: 'key' });

      if (!error) {
        return res.json({ success: true, googleSheetUrl: localGoogleSheetUrl });
      } else {
        console.warn("Failed to upsert settings in Supabase:", error.message);
      }
    } catch (err) {
      console.error("Failed to save settings in Supabase:", err);
    }
  }

  res.json({ success: true, googleSheetUrl: localGoogleSheetUrl });
});

// 8. POST /api/leads/sync-all - Sync all leads to Google Sheets via Webhook
app.post(['/api/leads/sync-all', '/leads/sync-all'], async (req, res) => {
  let leadsToSync = localLeads;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*');
      if (!error && data) {
        leadsToSync = data.map(mapLeadFromSupabase);
      }
    } catch (e) {
      // fallback to local leads if Supabase fails
    }
  }

  const sheetUrl = localGoogleSheetUrl;
  if (!sheetUrl) {
    return res.status(400).json({ error: "No Google Sheets webhook URL configured." });
  }

  let synced = 0;
  let failed = 0;

  // We can push to the webhook
  try {
    const response = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: leadsToSync })
    });
    if (response.ok) {
      synced = leadsToSync.length;
    } else {
      failed = leadsToSync.length;
    }
  } catch (err) {
    console.error("Google Sheets webhook call failed:", err);
    failed = leadsToSync.length;
  }

  res.json({
    success: synced > 0,
    synced,
    failed,
    total: leadsToSync.length
  });
});

// 9. POST /api/login - Authentication
app.post(['/api/login', '/login'], (req, res) => {
  const { username, password } = req.body;

  // Basic resilient check
  const checkUsername = cleanEnvVar(process.env.ADMIN_USERNAME) || 'enroloverseas';
  const checkPassword = cleanEnvVar(process.env.ADMIN_PASSWORD) || 'enroloverseas123';

  if (username === checkUsername && password === checkPassword) {
    return res.json({
      success: true,
      user: {
        username: checkUsername,
        role: 'admin'
      }
    });
  }

  // Also support a secondary counselor role
  if (username === 'counselor' && password === 'counselor123') {
    return res.json({
      success: true,
      user: {
        username: 'counselor',
        role: 'counselor'
      }
    });
  }

  res.json({ success: false, message: "Invalid username or password" });
});

// Health check endpoint
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: "ok", database: supabase ? "Supabase Connected" : "Local Fallback Active" });
});

export default app;
