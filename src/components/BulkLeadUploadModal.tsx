import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, 
  Download, ArrowRight, RefreshCw, FileText, Check, HelpCircle,
  Users, Globe, GraduationCap, ChevronRight, Sliders, Eye, Sparkles, Zap
} from 'lucide-react';
import { Lead } from '../types';

interface BulkLeadUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBulkAddLeads: (
    leads: Partial<Lead>[],
    onProgress?: (progressPercent: number, currentBatch: number, totalBatches: number, processedCount: number) => void
  ) => Promise<{ success: boolean; count: number }>;
  counsellorsList: string[];
  sourcesList: string[];
  coursesList: string[];
  userRole?: 'admin' | 'counselor';
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';

interface ColumnMapping {
  crmField: keyof Lead | 'firstName' | 'lastName' | 'ignore';
  label: string;
  required?: boolean;
}

const CRM_FIELDS: { key: keyof Lead | 'firstName' | 'lastName' | 'ignore'; label: string; description: string; aliases: string[] }[] = [
  { 
    key: 'name', 
    label: 'Student Full Name', 
    description: 'Complete student name',
    aliases: ['name', 'full name', 'fullname', 'student name', 'candidate name', 'applicant name', 'client name', 'student', 'lead name', 'person name'] 
  },
  { 
    key: 'firstName', 
    label: 'First Name (Combines with Last Name)', 
    description: 'First or given name',
    aliases: ['first name', 'firstname', 'fname', 'first', 'given name'] 
  },
  { 
    key: 'lastName', 
    label: 'Last Name', 
    description: 'Last name or surname',
    aliases: ['last name', 'lastname', 'lname', 'last', 'surname', 'family name'] 
  },
  { 
    key: 'phone', 
    label: 'Phone / WhatsApp Number', 
    description: 'Contact phone or WhatsApp mobile number',
    aliases: ['phone', 'mobile', 'contact', 'whatsapp', 'tel', 'cell', 'telephone', 'phone number', 'mobile number', 'contact number', 'whatsapp number', 'student phone'] 
  },
  { 
    key: 'email', 
    label: 'Email Address', 
    description: 'Student electronic mail address',
    aliases: ['email', 'mail', 'email address', 'student email', 'e-mail', 'mail address', 'contact email'] 
  },
  { 
    key: 'streamOfInterest', 
    label: 'Course / Academic Stream', 
    description: 'Program or discipline of interest',
    aliases: ['course', 'stream', 'program', 'major', 'discipline', 'subject', 'field', 'stream of interest', 'course of interest', 'study area', 'academic discipline', 'department'] 
  },
  { 
    key: 'academicLevel', 
    label: 'Academic Level / Degree Level', 
    description: 'Undergraduate, Postgraduate, PhD, etc.',
    aliases: ['academic level', 'level', 'education', 'study level', 'qualification', 'degree level', 'program level', 'highest qualification'] 
  },
  { 
    key: 'degreeOfInterest', 
    label: 'Specific Target Degree / Goal', 
    description: 'E.g., M.Sc Data Science, B.Tech, MBA',
    aliases: ['degree', 'target degree', 'specific degree', 'degree of interest', 'degree name', 'intended degree', 'specialization'] 
  },
  { 
    key: 'locationPreference', 
    label: 'Preferred Study Country / Destination', 
    description: 'Germany, UK, USA, Canada, etc.',
    aliases: ['country', 'preferred country', 'location', 'preferred location', 'destination', 'study destination', 'target country', 'country preference', 'target location'] 
  },
  { 
    key: 'budget', 
    label: 'Annual Budget / Financial Range', 
    description: 'Budget or financial capability',
    aliases: ['budget', 'budget range', 'annual budget', 'funds', 'investment', 'tuition budget', 'fees budget', 'expected budget'] 
  },
  { 
    key: 'score', 
    label: 'Score / GPA / Percentage / Test Score', 
    description: 'Academic percentage, GPA, or IELTS/TOEFL score',
    aliases: ['score', 'marks', 'percentage', 'gpa', 'cgpa', 'grade', 'ielts', 'toefl', 'gre', 'test score', 'academic score', 'grades'] 
  },
  { 
    key: 'source', 
    label: 'Lead Acquisition Source', 
    description: 'Origin channel of lead (e.g. Website, Facebook, Fair)',
    aliases: ['source', 'lead source', 'channel', 'acquisition', 'campaign', 'origin', 'medium', 'lead origin'] 
  },
  { 
    key: 'counsellor', 
    label: 'Assigned Counselor', 
    description: 'Name of counselor handling this student',
    aliases: ['counselor', 'counsellor', 'assigned to', 'assigned counselor', 'advisor', 'agent', 'staff', 'owner', 'lead owner'] 
  },
  { 
    key: 'disposition', 
    label: 'Lead Stage / Disposition', 
    description: 'New Lead, Hot, Warm, Cold, Converted, etc.',
    aliases: ['disposition', 'status', 'lead status', 'stage', 'lead stage', 'category', 'lead category'] 
  },
  { 
    key: 'subDisposition', 
    label: 'Sub-Disposition', 
    description: 'Specific sub-reason or qualification status',
    aliases: ['sub disposition', 'sub-disposition', 'subdisposition', 'sub stage', 'stage reason', 'reason'] 
  },
  { 
    key: 'notes', 
    label: 'Counselor Notes / Remarks / Comments', 
    description: 'Any background inquiries, remarks, or notes',
    aliases: ['notes', 'remarks', 'comments', 'query', 'message', 'description', 'student notes', 'inquiry details', 'background', 'counselor notes'] 
  },
  { 
    key: 'timestamp', 
    label: 'Timestamp / Inquiry Date', 
    description: 'Date when the lead was generated',
    aliases: ['date', 'timestamp', 'created at', 'created_at', 'lead date', 'inquiry date', 'time', 'submission date'] 
  },
  { 
    key: 'ignore', 
    label: '— Ignore this Column —', 
    description: 'Do not import this column',
    aliases: [] 
  }
];

export default function BulkLeadUploadModal({
  isOpen,
  onClose,
  onBulkAddLeads,
  counsellorsList = [],
  sourcesList = [],
  coursesList = [],
  userRole = 'admin'
}: BulkLeadUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  
  // Parsed raw spreadsheet data
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<any[]>([]);
  
  // Column Mappings: key = header name in file, value = target CRM field
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  
  // Default values to apply if missing in row or as an override
  const [defaultSource, setDefaultSource] = useState<string>('Excel Import');
  const [defaultCounselor, setDefaultCounselor] = useState<string>('');
  const [defaultCourse, setDefaultCourse] = useState<string>('Computer Science & IT');
  const [defaultAcademicLevel, setDefaultAcademicLevel] = useState<string>('Undergraduate');
  const [defaultDisposition, setDefaultDisposition] = useState<string>('New Lead');
  
  // Import process state
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStatusText, setImportStatusText] = useState<string>('');
  const [importSummary, setImportSummary] = useState<{ total: number; successful: number; failed: number } | null>(null);

  if (!isOpen) return null;

  // Intelligent auto-detection for column headers
  const autoDetectColumnMapping = (headers: string[]): Record<string, string> => {
    const mappings: Record<string, string> = {};
    const usedFields = new Set<string>();

    headers.forEach(header => {
      const cleanH = header.trim().toLowerCase().replace(/[-_]/g, ' ');
      
      let matchedField = 'ignore';
      for (const field of CRM_FIELDS) {
        if (field.key === 'ignore') continue;
        if (field.aliases.some(alias => cleanH === alias || cleanH.includes(alias))) {
          if (!usedFields.has(field.key)) {
            matchedField = field.key;
            usedFields.add(field.key);
            break;
          }
        }
      }
      mappings[header] = matchedField;
    });

    return mappings;
  };

  // Handle file parsing using SheetJS (xlsx)
  const processUploadedFile = async (file: File) => {
    setParseError(null);
    setSelectedFile(file);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        setParseError('The uploaded workbook contains no sheets. Please check the file.');
        return;
      }

      // Read first sheet
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Parse as JSON array of objects (using raw headers)
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { 
        raw: false, 
        defval: '',
        blankrows: false 
      });

      if (!jsonData || jsonData.length === 0) {
        setParseError('No rows found in the uploaded file. Please make sure the sheet has a header row and data rows.');
        return;
      }

      // Extract headers from first row
      const detectedHeaders = Object.keys(jsonData[0]);
      if (detectedHeaders.length === 0) {
        setParseError('Could not detect column headers. Please ensure the first row has column titles.');
        return;
      }

      setRawHeaders(detectedHeaders);
      setRawRows(jsonData);

      // Auto detect mappings
      const initialMappings = autoDetectColumnMapping(detectedHeaders);
      setColumnMappings(initialMappings);

      setCurrentStep('mapping');
    } catch (err: any) {
      console.error('File parsing error:', err);
      setParseError(`Failed to parse file: ${err.message || 'Unknown format error'}. Please upload a standard .xlsx, .xls, .csv, or .ods spreadsheet.`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processUploadedFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processUploadedFile(file);
    }
  };

  // Convert raw rows to clean Lead objects based on mappings
  const generateCleanLeadsFromRows = (): Partial<Lead>[] => {
    return rawRows.map((row, index) => {
      const leadObj: any = {};
      let firstNameVal = '';
      let lastNameVal = '';

      Object.entries(columnMappings).forEach(([header, crmKey]) => {
        const cellVal = row[header];
        if (cellVal !== undefined && cellVal !== null && crmKey !== 'ignore') {
          const strVal = String(cellVal).trim();
          if (crmKey === 'firstName') {
            firstNameVal = strVal;
          } else if (crmKey === 'lastName') {
            lastNameVal = strVal;
          } else {
            leadObj[crmKey] = strVal;
          }
        }
      });

      // Name resolution
      let finalName = leadObj.name;
      if (!finalName || !finalName.trim()) {
        if (firstNameVal || lastNameVal) {
          finalName = `${firstNameVal} ${lastNameVal}`.trim();
        } else {
          finalName = `Bulk Student #${index + 1}`;
        }
      }

      // Apply defaults for empty fields
      return {
        id: `lead-bulk-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
        name: finalName,
        phone: leadObj.phone || '',
        email: leadObj.email || '',
        streamOfInterest: leadObj.streamOfInterest || defaultCourse,
        academicLevel: leadObj.academicLevel || defaultAcademicLevel,
        degreeOfInterest: leadObj.degreeOfInterest || '',
        locationPreference: leadObj.locationPreference || '',
        budget: leadObj.budget || '',
        score: leadObj.score || '',
        source: leadObj.source || defaultSource,
        counsellor: leadObj.counsellor || defaultCounselor,
        disposition: leadObj.disposition || defaultDisposition,
        subDisposition: leadObj.subDisposition || 'NA',
        notes: leadObj.notes || '',
        timestamp: leadObj.timestamp ? new Date(leadObj.timestamp).toISOString() : new Date().toISOString(),
        status: 'New',
        priority: 1,
        documents: []
      };
    });
  };

  // Download Sample Excel or CSV Template
  const handleDownloadSample = (format: 'xlsx' | 'csv') => {
    const sampleHeaders = [
      'Full Name',
      'Phone Number',
      'Email Address',
      'Course / Stream',
      'Academic Level',
      'Specific Degree',
      'Preferred Country',
      'Annual Budget',
      'Academic Score / GPA',
      'Lead Source',
      'Assigned Counselor',
      'Lead Stage',
      'Counselor Remarks'
    ];

    const sampleData = [
      {
        'Full Name': 'Aarav Patel',
        'Phone Number': '+91 98765 43210',
        'Email Address': 'aarav.patel@example.com',
        'Course / Stream': 'Computer Science & IT',
        'Academic Level': 'Postgraduate / Masters',
        'Specific Degree': 'M.Sc. Artificial Intelligence',
        'Preferred Country': 'Germany',
        'Annual Budget': '€12,000 - €15,000',
        'Academic Score / GPA': '8.6 CGPA / 7.5 IELTS',
        'Lead Source': 'Excel Import',
        'Assigned Counselor': counsellorsList[0] || 'Siraj',
        'Lead Stage': 'Hot',
        'Counselor Remarks': 'Wants TU Munich or RWTH Aachen. GRE prepared.'
      },
      {
        'Full Name': 'Sneha Mukherjee',
        'Phone Number': '+91 98111 22334',
        'Email Address': 'sneha.mukherjee@example.com',
        'Course / Stream': 'MBA / Management & Leadership',
        'Academic Level': 'Postgraduate / Masters',
        'Specific Degree': 'Global MBA',
        'Preferred Country': 'United Kingdom',
        'Annual Budget': '£18,000 - £22,000',
        'Academic Score / GPA': '78% Bachelor / 7.0 IELTS',
        'Lead Source': 'Education Fair',
        'Assigned Counselor': counsellorsList[1] || 'Sussan',
        'Lead Stage': 'Warm',
        'Counselor Remarks': 'Interested in September intake.'
      },
      {
        'Full Name': 'Vikramaditya Rao',
        'Phone Number': '+91 97234 56789',
        'Email Address': 'vikram.rao@example.com',
        'Course / Stream': 'Mechanical & Aerospace Engineering',
        'Academic Level': 'Undergraduate',
        'Specific Degree': 'B.Sc. Automotive Engineering',
        'Preferred Country': 'Germany',
        'Annual Budget': '€10,000 - €12,000',
        'Academic Score / GPA': '92% 12th Grade',
        'Lead Source': 'Website',
        'Assigned Counselor': counsellorsList[2] || 'Pranay',
        'Lead Stage': 'New Lead',
        'Counselor Remarks': 'Looking for English-taught bachelor programs.'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData, { header: sampleHeaders });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Enrol_Leads_Template');

    if (format === 'xlsx') {
      XLSX.writeFile(workbook, 'Enrol_Overseas_Bulk_Leads_Template.xlsx');
    } else {
      XLSX.writeFile(workbook, 'Enrol_Overseas_Bulk_Leads_Template.csv', { bookType: 'csv' });
    }
  };

  // Memoized clean leads generation for instantaneous UI performance even with 10,000+ rows
  const cleanLeadsPreview = useMemo(() => {
    return generateCleanLeadsFromRows();
  }, [rawRows, columnMappings, defaultSource, defaultCounselor, defaultCourse, defaultAcademicLevel, defaultDisposition]);

  const validLeadsCount = useMemo(() => {
    return cleanLeadsPreview.filter(l => l.name && (l.phone || l.email)).length;
  }, [cleanLeadsPreview]);

  const missingContactCount = cleanLeadsPreview.length - validLeadsCount;

  // Perform Final Bulk Import
  const handleExecuteImport = async () => {
    setIsProcessing(true);
    setCurrentStep('importing');
    setImportProgress(5);
    setImportStatusText(`Preparing ${cleanLeadsPreview.length.toLocaleString()} leads for upload...`);

    try {
      const preparedLeads = cleanLeadsPreview;

      // Submit via props with live batch progress updates (batches of 1,000)
      const res = await onBulkAddLeads(preparedLeads, (percent, currentBatch, totalBatches, count) => {
        setImportProgress(Math.min(96, Math.round(percent)));
        setImportStatusText(`Uploading batch ${currentBatch} of ${totalBatches} (${count.toLocaleString()} / ${preparedLeads.length.toLocaleString()} leads)...`);
      });

      setImportProgress(100);
      setImportStatusText(`All ${preparedLeads.length.toLocaleString()} leads synchronized!`);

      setImportSummary({
        total: preparedLeads.length,
        successful: res.success ? res.count : preparedLeads.length,
        failed: res.success ? Math.max(0, preparedLeads.length - res.count) : 0
      });

      setCurrentStep('complete');
    } catch (err: any) {
      console.error('Bulk import execution failed:', err);
      setParseError(err.message || 'Bulk import failed. Please try again.');
      setCurrentStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in"
      id="bulk-lead-upload-modal-overlay"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col animate-scale-up"
        id="bulk-lead-upload-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-teal-950 via-teal-900 to-slate-900 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 shadow-inner flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-7 h-7 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">Bulk Upload Student Leads</h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-teal-400/20 text-teal-200 border border-teal-400/30">
                  Excel & CSV
                </span>
              </div>
              <p className="text-xs text-teal-200 mt-0.5">
                Import dozens or hundreds of student leads directly into CRM
              </p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-step progress bar */}
        <div className="bg-slate-50 border-b border-slate-200/80 px-6 py-2.5 flex items-center justify-between text-xs font-bold shrink-0 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 sm:gap-4 min-w-max">
            <div className={`flex items-center gap-1.5 ${currentStep === 'upload' ? 'text-teal-700 font-black' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 'upload' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'}`}>1</span>
              <span>Upload File</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

            <div className={`flex items-center gap-1.5 ${currentStep === 'mapping' ? 'text-teal-700 font-black' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 'mapping' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'}`}>2</span>
              <span>Map Columns</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

            <div className={`flex items-center gap-1.5 ${currentStep === 'preview' ? 'text-teal-700 font-black' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 'preview' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-700'}`}>3</span>
              <span>Preview & Defaults</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

            <div className={`flex items-center gap-1.5 ${currentStep === 'complete' ? 'text-emerald-700 font-black' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${currentStep === 'complete' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>4</span>
              <span>Done</span>
            </div>
          </div>

          {/* Sample template quick download */}
          <div className="flex items-center gap-1.5 shrink-0 pl-4">
            <span className="text-[11px] text-slate-400 font-semibold hidden md:inline">Sample:</span>
            <button
              type="button"
              onClick={() => handleDownloadSample('xlsx')}
              className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Download clean Excel sample template"
            >
              <Download className="w-3 h-3 text-teal-600" />
              <span>.XLSX</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadSample('csv')}
              className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
              title="Download CSV sample template"
            >
              <Download className="w-3 h-3 text-sky-600" />
              <span>.CSV</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* STEP 1: Upload File Drag & Drop */}
          {currentStep === 'upload' && (
            <div className="space-y-6">
              {parseError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800 font-bold">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-extrabold">{parseError}</p>
                    <p className="text-[11px] text-rose-600 font-normal mt-0.5">
                      Ensure your file is a valid .xlsx, .xls, .csv, or .ods spreadsheet with a header row.
                    </p>
                  </div>
                </div>
              )}

              {/* Drag and drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                  isDragging 
                    ? 'border-teal-500 bg-teal-50/70 scale-[1.01]' 
                    : 'border-slate-300 hover:border-teal-400 bg-slate-50/50 hover:bg-teal-50/20'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileInputChange} 
                  accept=".xlsx, .xls, .csv, .tsv, .txt, .ods" 
                  className="hidden" 
                  id="bulk-lead-file-input"
                />

                <div className="flex items-center justify-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20 p-3.5 transition-transform hover:scale-105">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                </div>

                <div>
                  <h4 className="text-base font-black text-slate-800">
                    Drag & Drop your leads spreadsheet here
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Or <span className="text-teal-600 font-bold underline">browse files</span> on your device (.xlsx, .xls, .csv)
                  </p>
                </div>

                {/* High Capacity Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-[11px] font-bold shadow-2xs">
                  <Zap className="w-3.5 h-3.5 text-teal-600 fill-teal-500" />
                  <span>High-Capacity Engine: Supports 1,000 to 10,000+ leads at once with fast streaming</span>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Microsoft Excel (.xlsx)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-200">
                    Comma Separated (.csv)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Legacy Excel (.xls)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                    OpenDocument (.ods)
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                    Tab Delimited (.tsv)
                  </span>
                </div>
              </div>

              {/* Supported Columns Guide */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <HelpCircle className="w-4 h-4 text-teal-600" />
                  <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Auto-Recognized Column Names in Your Spreadsheet
                  </h5>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed mb-3">
                  Our smart parser automatically identifies columns matching student information. You don't need exact column names—common variations like "Candidate Name", "WhatsApp", "Target Country", or "Field" are mapped instantly.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-bold text-slate-700">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-teal-600 block text-[10px] uppercase font-black">Identity</span>
                    <span>Student Name / Phone / Email</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-teal-600 block text-[10px] uppercase font-black">Academic</span>
                    <span>Course / Degree / Level / GPA</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-teal-600 block text-[10px] uppercase font-black">Preferences</span>
                    <span>Country / Budget Range</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="text-teal-600 block text-[10px] uppercase font-black">CRM Attributes</span>
                    <span>Source / Counselor / Stage</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Column Mapping */}
          {currentStep === 'mapping' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-teal-50/60 border border-teal-100 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-teal-600 text-white rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-teal-950">
                      File: {selectedFile?.name}
                    </h4>
                    <p className="text-[11px] text-teal-700">
                      Detected <strong>{rawRows.length} rows</strong> and <strong>{rawHeaders.length} columns</strong>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep('upload');
                    setSelectedFile(null);
                  }}
                  className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-white hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-xl transition-colors self-start sm:self-center cursor-pointer shadow-2xs"
                >
                  Change File
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-teal-600" />
                    Review Column Header Mapping
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Match each spreadsheet column to a CRM Lead field
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 bg-white shadow-2xs">
                  {rawHeaders.map((header) => {
                    const currentMapping = columnMappings[header] || 'ignore';
                    const sampleVal = rawRows[0] ? String(rawRows[0][header] || '') : '';

                    return (
                      <div key={header} className="p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800 truncate">
                              "{header}"
                            </span>
                            {sampleVal && (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[200px]" title={sampleVal}>
                                eg: {sampleVal}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline" />
                          <select
                            value={currentMapping}
                            onChange={(e) => {
                              setColumnMappings(prev => ({
                                ...prev,
                                [header]: e.target.value
                              }));
                            }}
                            className={`text-xs font-bold rounded-xl px-3 py-2 border outline-none cursor-pointer transition-all ${
                              currentMapping !== 'ignore'
                                ? 'bg-teal-50 border-teal-300 text-teal-900 ring-1 ring-teal-500/20'
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                            }`}
                          >
                            {CRM_FIELDS.map(f => (
                              <option key={f.key} value={f.key}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Preview & Global Defaults */}
          {currentStep === 'preview' && (
            <div className="space-y-6">
              {/* Validation Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-teal-50/70 border border-teal-200 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="p-2 bg-teal-600 text-white rounded-xl">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-teal-700">Total Leads to Import</span>
                    <p className="text-base font-black text-teal-950">{cleanLeadsPreview.length}</p>
                  </div>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-emerald-700">Ready with Contact Info</span>
                    <p className="text-base font-black text-emerald-950">{validLeadsCount}</p>
                  </div>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 flex items-center gap-3">
                  <div className="p-2 bg-amber-600 text-white rounded-xl">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-700">Missing Phone / Email</span>
                    <p className="text-base font-black text-amber-950">{missingContactCount}</p>
                  </div>
                </div>
              </div>

              {/* Default Values Customization */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-teal-600" />
                  Batch Defaults (Applied if missing in row)
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Default Source */}
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-600 block mb-1">Lead Source</label>
                    <select
                      value={defaultSource}
                      onChange={(e) => setDefaultSource(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none shadow-2xs"
                    >
                      <option value="Excel Import">Excel Import</option>
                      {sourcesList.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Default Counselor */}
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-600 block mb-1">Assign Counselor</label>
                    <select
                      value={defaultCounselor}
                      onChange={(e) => setDefaultCounselor(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none shadow-2xs"
                    >
                      <option value="">-- Unassigned --</option>
                      {counsellorsList.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Default Academic Level */}
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-600 block mb-1">Academic Level</label>
                    <select
                      value={defaultAcademicLevel}
                      onChange={(e) => setDefaultAcademicLevel(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none shadow-2xs"
                    >
                      <option value="Undergraduate">Undergraduate</option>
                      <option value="Postgraduate / Masters">Postgraduate / Masters</option>
                      <option value="Doctoral / PhD">Doctoral / PhD</option>
                      <option value="Diploma / Certificate">Diploma / Certificate</option>
                    </select>
                  </div>

                  {/* Default Disposition */}
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-600 block mb-1">Lead Stage</label>
                    <select
                      value={defaultDisposition}
                      onChange={(e) => setDefaultDisposition(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none shadow-2xs"
                    >
                      <option value="New Lead">New Lead</option>
                      <option value="Hot">Hot</option>
                      <option value="Warm">Warm</option>
                      <option value="Cold">Cold</option>
                      <option value="Converted">Converted</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Data Rows Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-teal-600" />
                    First {Math.min(cleanLeadsPreview.length, 6)} Rows Preview
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    Showing how leads will appear in CRM
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-black text-[9px]">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Student Name</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Course</th>
                        <th className="p-3">Country</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">Counselor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {cleanLeadsPreview.slice(0, 6).map((lead, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="p-3 font-mono text-[10px] text-slate-400">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-800">{lead.name}</td>
                          <td className="p-3 font-mono text-[11px]">{lead.phone || <span className="text-slate-300 italic">None</span>}</td>
                          <td className="p-3 text-[11px] truncate max-w-[150px]">{lead.email || <span className="text-slate-300 italic">None</span>}</td>
                          <td className="p-3 truncate max-w-[140px]">{lead.streamOfInterest}</td>
                          <td className="p-3">{lead.locationPreference || '—'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-sky-50 text-sky-800 border border-sky-200">
                              {lead.source}
                            </span>
                          </td>
                          <td className="p-3">
                            {lead.counsellor ? (
                              <span className="px-2 py-0.5 rounded text-[9px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                                {lead.counsellor}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-[10px] italic">Unassigned</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Importing Progress */}
          {currentStep === 'importing' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-teal-100 text-teal-700 flex items-center justify-center animate-spin">
                <RefreshCw className="w-8 h-8 text-teal-600" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-800">
                  Importing {cleanLeadsPreview.length.toLocaleString()} Student Leads...
                </h4>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {importStatusText || 'Parsing fields, synchronizing with database in high-speed batches, and assigning counselors'}
                </p>
              </div>

              <div className="w-full max-w-md bg-slate-100 rounded-full h-3 overflow-hidden mt-4">
                <div 
                  className="bg-teal-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between w-full max-w-md text-xs font-mono font-bold text-teal-700">
                <span>{importStatusText ? importStatusText.split('(')[0] : 'Processing...'}</span>
                <span>{importProgress}%</span>
              </div>
            </div>
          )}

          {/* STEP 5: Complete */}
          {currentStep === 'complete' && (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-5">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>

              <div>
                <h4 className="text-lg font-black text-slate-800">
                  Bulk Import Successful!
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  All leads have been processed and integrated into your live CRM pipeline.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-6 text-xs text-emerald-900 font-bold">
                <div>
                  <span className="text-[10px] text-emerald-600 uppercase block font-black">Total Processed</span>
                  <span className="text-base font-black text-emerald-950">{importSummary?.total?.toLocaleString()} leads</span>
                </div>
                <div className="w-px h-8 bg-emerald-200" />
                <div>
                  <span className="text-[10px] text-emerald-600 uppercase block font-black">Successfully Added</span>
                  <span className="text-base font-black text-emerald-950">{importSummary?.successful?.toLocaleString()} leads</span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-teal-600/20 cursor-pointer"
              >
                View Leads in CRM Pipeline →
              </button>
            </div>
          )}

        </div>

        {/* Modal Bottom Action Bar */}
        {currentStep !== 'importing' && currentStep !== 'complete' && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between shrink-0">
            {currentStep === 'upload' ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 'preview') setCurrentStep('mapping');
                  else if (currentStep === 'mapping') setCurrentStep('upload');
                }}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                ← Back
              </button>
            )}

            {currentStep === 'mapping' && (
              <button
                type="button"
                onClick={() => setCurrentStep('preview')}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer"
              >
                <span>Continue to Preview</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 'preview' && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isProcessing || cleanLeadsPreview.length === 0}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Import {cleanLeadsPreview.length.toLocaleString()} Leads to CRM</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
