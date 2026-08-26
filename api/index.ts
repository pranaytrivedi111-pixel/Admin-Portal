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
    streamOfInterest: "Computer Science & IT",
    degreeOfInterest: "BCA / BS CS",
    score: "92%",
    budget: "₹2.5 Lakhs/year",
    locationPreference: "Bangalore",
    source: "Website",
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: "New",
    notes: "Aarav is highly interested in BCA / Computer Science. Excellent high school grades.",
    priority: 3
  },
  {
    id: "lead-2",
    name: "Ananya Iyer",
    email: "ananya.iyer@yahoo.com",
    phone: "+91 87654 32109",
    academicLevel: "Postgraduate (Masters)",
    streamOfInterest: "MBA / Management & Leadership",
    degreeOfInterest: "MBA",
    score: "78%",
    budget: "₹4.5 Lakhs/year",
    locationPreference: "Mumbai",
    source: "Google Ads",
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
    streamOfInterest: "Data Science & AI",
    degreeOfInterest: "B.Tech Data Science",
    score: "88%",
    budget: "₹3.0 Lakhs/year",
    locationPreference: "Pune",
    source: "Walk-in",
    timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
    status: "Contacted",
    notes: "Walk-in student enquired about AI & Data Science scholarships. Follow up scheduled.",
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

// Persistent file storage directory for uploaded documents
const UPLOADS_DIR = process.env.VERCEL ? path.resolve('/tmp', 'enrol_uploads') : path.resolve(process.cwd(), 'uploads');
try {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
} catch (err) {
  try {
    const fallbackDir = path.resolve('/tmp', 'enrol_uploads');
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
  } catch (e) {
    console.warn("Could not create uploads directory:", err);
  }
}

// In-memory document binary storage cache
const documentCache = new Map<string, { buffer: Buffer; mime: string; name: string; dataUrl: string }>();

// Save document binary to disk and memory cache
function saveDocumentBinary(docId: string, name: string, mime: string, dataUrlOrBuffer: string | Buffer) {
  try {
    let buffer: Buffer;
    let dataUrl = '';
    const safeMime = mime || 'application/octet-stream';
    const safeName = name || 'document';

    if (typeof dataUrlOrBuffer === 'string') {
      dataUrl = dataUrlOrBuffer;
      if (dataUrlOrBuffer.startsWith('data:')) {
        const commaIndex = dataUrlOrBuffer.indexOf(',');
        const base64Data = dataUrlOrBuffer.substring(commaIndex + 1);
        buffer = Buffer.from(base64Data, 'base64');
      } else {
        buffer = Buffer.from(dataUrlOrBuffer, 'utf-8');
      }
    } else {
      buffer = dataUrlOrBuffer;
      dataUrl = `data:${safeMime};base64,${buffer.toString('base64')}`;
    }

    documentCache.set(docId, { buffer, mime: safeMime, name: safeName, dataUrl });

    // Also persist to disk for container resilience
    try {
      const sanitized = safeName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const safeFilename = `${docId}_${sanitized}`;
      const filePath = path.join(UPLOADS_DIR, safeFilename);
      const metaPath = path.join(UPLOADS_DIR, `${docId}.meta.json`);
      
      fs.writeFileSync(filePath, buffer);
      fs.writeFileSync(metaPath, JSON.stringify({ id: docId, name: safeName, mime: safeMime, filename: safeFilename, size: buffer.length }));
    } catch (e) {
      console.warn("Could not write document to disk, kept in memory cache:", e);
    }
  } catch (err) {
    console.error("Error saving document binary:", err);
  }
}

// Load document binary from memory cache, disk, or asynchronously from Supabase
async function getDocumentBinaryAsync(docId: string): Promise<{ buffer: Buffer; mime: string; name: string; dataUrl: string } | null> {
  if (documentCache.has(docId)) {
    return documentCache.get(docId)!;
  }

  try {
    const metaPath = path.join(UPLOADS_DIR, `${docId}.meta.json`);
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      const filePath = path.join(UPLOADS_DIR, meta.filename);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const dataUrl = `data:${meta.mime || 'application/octet-stream'};base64,${buffer.toString('base64')}`;
        const item = { buffer, mime: meta.mime || 'application/octet-stream', name: meta.name || 'document', dataUrl };
        documentCache.set(docId, item);
        return item;
      }
    }
  } catch (err) {
    console.error("Error reading document from disk:", err);
  }

  // Resilient fallback for Vercel: Query Supabase if not in local ephemeral lambda storage
  if (supabase) {
    try {
      const { data } = await supabase.from('leads').select('*');
      if (data && Array.isArray(data)) {
        for (const row of data) {
          const lead = unpackLeadWithMetadata(row);
          if (Array.isArray(lead.documents)) {
            const match = lead.documents.find((d: any) => d.id === docId);
            if (match && match.dataUrl && typeof match.dataUrl === 'string' && match.dataUrl.startsWith('data:')) {
              saveDocumentBinary(match.id, match.name, match.type, match.dataUrl);
              if (documentCache.has(docId)) {
                return documentCache.get(docId)!;
              }
            }
          }
        }
      }
    } catch (supaErr) {
      console.warn("Supabase document lookup error:", supaErr);
    }
  }

  return null;
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

  // Ensure documents is an array
  if (!Array.isArray(result.documents)) {
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
          if (parsed.source && (!result.source || result.source.trim() === '')) {
            result.source = parsed.source;
          }
          if (parsed.documents && Array.isArray(parsed.documents) && parsed.documents.length > 0) {
            result.documents = parsed.documents;
          }
        } catch (e) {
          console.warn("Error parsing ENROL_META tag:", e);
        }
      }
    }
  }

  // Ensure default source is clean and standardized
  if (!result.source || result.source === 'direct_apply' || result.source === 'contact' || result.source === 'inquiry') {
    result.source = 'Website';
  } else if (result.source === 'eligibility_calculator') {
    result.source = 'Eligibility Calculator';
  } else if (result.source === 'ai_chat') {
    result.source = 'Website (AI Chat)';
  }

  // Ensure all documents have live URLs and dataUrl preserved
  if (Array.isArray(result.documents)) {
    result.documents = result.documents.map((d: any) => {
      const docId = d.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const liveUrl = `/api/documents/${docId}`;
      const cached = documentCache.get(docId);
      const dataUrl = d.dataUrl && d.dataUrl.startsWith('data:') ? d.dataUrl : (cached?.dataUrl || d.dataUrl || liveUrl);
      return {
        id: docId,
        name: d.name || 'Document',
        size: d.size || 0,
        type: d.type || 'application/octet-stream',
        category: d.category || 'General',
        uploadedAt: d.uploadedAt || new Date().toISOString(),
        url: d.url || liveUrl,
        dataUrl
      };
    });
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
  const rawSource = payload.source || payload.lead_source || 'Website';
  let source = rawSource;
  if (source === 'direct_apply' || source === 'contact' || source === 'inquiry' || !source || source === '') {
    source = 'Website';
  } else if (source === 'eligibility_calculator') {
    source = 'Eligibility Calculator';
  } else if (source === 'ai_chat') {
    source = 'Website (AI Chat)';
  }
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

// 2b. POST /api/leads/bulk - Bulk lead creation endpoint for Excel, CSV, TSV, and JSON imports
app.post(['/api/leads/bulk', '/leads/bulk'], async (req: express.Request, res: express.Response) => {
  const body = req.body || {};
  const rawItems = Array.isArray(body) ? body : (Array.isArray(body.leads) ? body.leads : []);

  if (!rawItems || rawItems.length === 0) {
    return res.status(400).json({ success: false, error: "No leads data provided in request body" });
  }

  const processedLeads: any[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < rawItems.length; i++) {
    const payload = rawItems[i] || {};
    
    // Name resolution
    let name = payload.name || payload.fullName || payload.fullname || payload.studentName || payload.student_name || payload.Name || payload['Student Name'] || payload['Full Name'] || '';
    if (!name || !name.trim()) {
      const fName = payload.firstName || payload.first_name || payload.Fname || payload.fname || payload['First Name'] || '';
      const lName = payload.lastName || payload.last_name || payload.Lname || payload.lname || payload['Last Name'] || '';
      if (fName.trim() || lName.trim()) {
        name = `${fName} ${lName}`.trim();
      } else {
        name = `Imported Lead #${i + 1}`;
      }
    }

    const email = payload.email || payload.studentEmail || payload.student_email || payload.Email || payload.mail || payload['Email Address'] || payload['Student Email'] || '';
    const phone = payload.phone || payload.studentPhone || payload.student_phone || payload.Phone || payload.mobile || payload.Mobile || payload.telephone || payload.tel || payload['Phone Number'] || payload['Mobile Number'] || payload['Contact Number'] || '';
    const academicLevel = payload.academicLevel || payload.academic_level || payload.education || payload.studyLevel || payload.qualification || payload['Academic Level'] || payload['Education Level'] || 'Undergraduate';
    const streamOfInterest = payload.streamOfInterest || payload.stream_of_interest || payload.course || payload.stream || payload.subject || payload.program || payload['Course'] || payload['Stream'] || payload['Field of Study'] || 'Computer Science & IT';
    const degreeOfInterest = payload.degreeOfInterest || payload.degree_of_interest || payload.degree || payload['Degree'] || payload['Target Degree'] || '';
    const score = payload.score || payload.marks || payload.percentage || payload.gpa || payload['Score'] || payload['GPA'] || payload['Percentage'] || '';
    const budget = payload.budget || payload.budgetRange || payload['Budget'] || payload['Budget Range'] || '';
    const locationPreference = payload.locationPreference || payload.location_preference || payload.preferredLocation || payload.location || payload.country || payload.destination || payload['Country'] || payload['Preferred Country'] || payload['Destination'] || '';
    const rawSource = payload.source || payload.lead_source || payload['Source'] || payload['Lead Source'] || 'Excel Import';
    const notes = payload.notes || payload.message || payload.comments || payload.query || payload.description || payload['Notes'] || payload['Remarks'] || payload['Comments'] || '';
    const counsellor = payload.counsellor || payload.counselor || payload['Counselor'] || payload['Counsellor'] || payload['Assigned Counselor'] || '';
    const disposition = payload.disposition || payload['Disposition'] || payload['Stage'] || payload['Lead Status'] || 'New Lead';
    const subDisposition = payload.subDisposition || payload['Sub Disposition'] || payload['Sub-Disposition'] || 'NA';
    const documents = Array.isArray(payload.documents) ? payload.documents : [];

    const leadRecord = {
      id: payload.id || `lead-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      academicLevel: String(academicLevel).trim(),
      streamOfInterest: String(streamOfInterest).trim(),
      degreeOfInterest: String(degreeOfInterest).trim(),
      score: String(score).trim(),
      budget: String(budget).trim(),
      locationPreference: String(locationPreference).trim(),
      source: String(rawSource).trim() || 'Excel Import',
      timestamp: payload.timestamp || now,
      status: payload.status || 'New',
      notes: String(notes).trim(),
      remarks: payload.remarks || '',
      followUpDate: payload.followUpDate || null,
      disposition: String(disposition).trim(),
      subDisposition: String(subDisposition).trim(),
      priority: Number(payload.priority) || 1,
      collegeId: payload.collegeId || null,
      collegeName: payload.collegeName || null,
      counsellor: String(counsellor).trim(),
      documents: documents
    };

    processedLeads.push(leadRecord);
  }

  // Save to Supabase if connected
  if (supabase && processedLeads.length > 0) {
    try {
      const dbLeads = processedLeads.map(l => mapLeadToSupabase(l));
      
      // Batch insert in chunks of 50 for stability
      const chunkSize = 50;
      for (let c = 0; c < dbLeads.length; c += chunkSize) {
        const chunk = dbLeads.slice(c, c + chunkSize);
        let { error } = await supabase.from('leads').insert(chunk);

        if (error && (error.code === 'PGRST204' || error.code === '42703' || error.message?.toLowerCase().includes('column'))) {
          // Retry with resilient metadata
          const safeChunk = chunk.map((dbLead, idx) => {
            const orig = processedLeads[c + idx];
            const safeLead: any = {};
            for (const [k, v] of Object.entries(dbLead)) {
              if (k !== 'counsellor' && k !== 'counselor' && k !== 'documents') {
                safeLead[k] = v;
              }
            }
            const metaObj: any = {};
            if (orig.counsellor) metaObj.counsellor = orig.counsellor;
            if (orig.documents && orig.documents.length > 0) metaObj.documents = orig.documents;
            if (Object.keys(metaObj).length > 0) {
              const metaTag = `<!--ENROL_META:${JSON.stringify(metaObj)}-->`;
              safeLead.remarks = safeLead.remarks ? `${safeLead.remarks}\n${metaTag}` : metaTag;
            }
            return safeLead;
          });

          await supabase.from('leads').insert(safeChunk);
        }
      }
    } catch (dbErr) {
      console.warn("Supabase bulk insert warning (falling back to memory):", dbErr);
    }
  }

  // Update in-memory local leads
  localLeads = [...processedLeads, ...localLeads];

  return res.status(201).json({
    success: true,
    count: processedLeads.length,
    leads: processedLeads,
    message: `Successfully imported ${processedLeads.length} leads in bulk.`
  });
});

// 3. PUT /api/leads/:id - Update an existing lead (Live counselor assignment, status, documents, etc.)
app.put(['/api/leads/:id', '/leads/:id'], async (req, res) => {
  const { id } = req.params;
  const updates = req.body || {};

  // If documents are passed in updates, extract any large base64 dataUrl and save to binary storage
  if (Array.isArray(updates.documents)) {
    updates.documents = updates.documents.map((doc: any) => {
      const docId = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      if (doc.dataUrl && typeof doc.dataUrl === 'string' && doc.dataUrl.startsWith('data:')) {
        saveDocumentBinary(docId, doc.name || 'document', doc.type || 'application/octet-stream', doc.dataUrl);
      }
      return {
        ...doc,
        id: docId,
        url: `/api/documents/${docId}`,
        dataUrl: doc.dataUrl || `/api/documents/${docId}`
      };
    });
  }

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
            url: `/api/documents/${d.id}`,
            dataUrl: d.dataUrl || `/api/documents/${d.id}`
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

// 3b. POST /api/leads/:id/documents - Direct document upload endpoint
app.post(['/api/leads/:id/documents', '/leads/:id/documents'], async (req, res) => {
  const { id } = req.params;
  const { name, size, type, dataUrl, category } = req.body || {};

  if (!name || !dataUrl) {
    return res.status(400).json({ error: "Missing document name or dataUrl" });
  }

  const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const mimeType = type || 'application/octet-stream';
  
  // Save binary to server document store
  saveDocumentBinary(docId, name, mimeType, dataUrl);

  const newDocRecord = {
    id: docId,
    name,
    size: size || 0,
    type: mimeType,
    category: category || 'General',
    uploadedAt: new Date().toISOString(),
    url: `/api/documents/${docId}`,
    dataUrl: dataUrl
  };

  // Find lead and update documents
  let targetLead = localLeads.find(l => l.id === id);
  const currentDocs = targetLead?.documents || [];
  const updatedDocs = [...currentDocs, newDocRecord];

  if (targetLead) {
    targetLead.documents = updatedDocs;
  }

  // Persist update in Supabase / metadata
  if (supabase) {
    try {
      let existingLead: any = null;
      try {
        const { data: rowData } = await supabase.from('leads').select('*').eq('id', id).single();
        if (rowData) {
          existingLead = unpackLeadWithMetadata(rowData);
        }
      } catch (e) {}

      const allDocs = [...(existingLead?.documents || []), newDocRecord];
      // Deduplicate docs by id
      const uniqueDocs = Array.from(new Map(allDocs.map(d => [d.id, d])).values());

      const fullDocsToSave = uniqueDocs.map(d => ({
        id: d.id,
        name: d.name,
        size: d.size,
        type: d.type,
        category: d.category || 'General',
        uploadedAt: d.uploadedAt,
        url: `/api/documents/${d.id}`,
        dataUrl: d.dataUrl || `/api/documents/${d.id}`
      }));

      let { error } = await supabase
        .from('leads')
        .update({ documents: fullDocsToSave })
        .eq('id', id);

      if (error) {
        // Fallback to ENROL_META in remarks
        const rawRemarks = existingLead?.remarks || '';
        const cleanRemarks = typeof rawRemarks === 'string' ? rawRemarks.replace(/<!--ENROL_META:[\s\S]*?-->/g, '').trim() : '';
        const metaObj: any = {
          documents: fullDocsToSave
        };
        if (existingLead?.counsellor) {
          metaObj.counsellor = existingLead.counsellor;
        }

        const metaTag = `<!--ENROL_META:${JSON.stringify(metaObj)}-->`;
        await supabase
          .from('leads')
          .update({ remarks: cleanRemarks ? `${cleanRemarks}\n${metaTag}` : metaTag })
          .eq('id', id);
      }
    } catch (err) {
      console.error("Failed to persist document upload to Supabase:", err);
    }
  }

  return res.json({ success: true, document: newDocRecord, documents: updatedDocs });
});

// 3c. GET /api/documents/:docId - Stream/serve document file live
app.get(['/api/documents/:docId', '/documents/:docId'], async (req, res) => {
  const { docId } = req.params;
  const doc = await getDocumentBinaryAsync(docId);
  
  if (!doc) {
    return res.status(404).json({ error: "Document not found or expired from server cache" });
  }

  res.setHeader('Content-Type', doc.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.name)}"`);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(doc.buffer);
});

// 3d. DELETE /api/leads/:id/documents/:docId - Delete document
app.delete(['/api/leads/:id/documents/:docId', '/leads/:id/documents/:docId'], async (req, res) => {
  const { id, docId } = req.params;

  let targetLead = localLeads.find(l => l.id === id);
  if (targetLead && Array.isArray(targetLead.documents)) {
    targetLead.documents = targetLead.documents.filter((d: any) => d.id !== docId);
  }

  if (supabase) {
    try {
      let existingLead: any = null;
      try {
        const { data: rowData } = await supabase.from('leads').select('*').eq('id', id).single();
        if (rowData) {
          existingLead = unpackLeadWithMetadata(rowData);
        }
      } catch (e) {}

      const currentDocs = existingLead?.documents || [];
      const updatedDocs = currentDocs.filter((d: any) => d.id !== docId);

      let { error } = await supabase
        .from('leads')
        .update({ documents: updatedDocs })
        .eq('id', id);

      if (error) {
        const rawRemarks = existingLead?.remarks || '';
        const cleanRemarks = typeof rawRemarks === 'string' ? rawRemarks.replace(/<!--ENROL_META:[\s\S]*?-->/g, '').trim() : '';
        const metaObj: any = { documents: updatedDocs };
        if (existingLead?.counsellor) metaObj.counsellor = existingLead.counsellor;
        const metaTag = `<!--ENROL_META:${JSON.stringify(metaObj)}-->`;
        await supabase
          .from('leads')
          .update({ remarks: cleanRemarks ? `${cleanRemarks}\n${metaTag}` : metaTag })
          .eq('id', id);
      }
    } catch (err) {
      console.error("Failed to delete document in Supabase:", err);
    }
  }

  return res.json({ success: true });
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
  const userTrim = (username || '').trim();
  const passTrim = (password || '').trim();

  // Admin Credentials:
  // Username: Enroloverseas
  // Password: Enroloverseas@123
  const isAdminUser = userTrim.toLowerCase() === 'enroloverseas';
  const isAdminPass = passTrim === 'Enroloverseas@123' || passTrim === 'enroloverseas@123' || passTrim === 'enroloverseas123' || passTrim === (cleanEnvVar(process.env.ADMIN_PASSWORD) || '');

  if (isAdminUser && isAdminPass) {
    return res.json({
      success: true,
      user: {
        username: 'Enroloverseas',
        role: 'admin'
      }
    });
  }

  // Counsellor Credentials:
  // Username: Counsellor
  // Password: Counsellor@123
  const isCounsellorUser = userTrim.toLowerCase() === 'counsellor' || userTrim.toLowerCase() === 'counselor';
  const isCounsellorPass = passTrim === 'Counsellor@123' || passTrim === 'counsellor@123' || passTrim === 'Counselor@123' || passTrim === 'counselor@123' || passTrim === 'counselor123';

  if (isCounsellorUser && isCounsellorPass) {
    return res.json({
      success: true,
      user: {
        username: 'Counsellor',
        role: 'counselor'
      }
    });
  }

  res.status(401).json({ success: false, message: "Invalid employee username or password. Please verify your credentials." });
});

// Health check endpoint
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: "ok", database: supabase ? "Supabase Connected" : "Local Fallback Active" });
});

export default app;
