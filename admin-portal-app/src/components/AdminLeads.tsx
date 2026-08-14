import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, Search, RefreshCw, Check, ArrowUpDown, 
  Trash2, Mail, Phone, Calendar, Star, TrendingUp, Users,
  Database, ChevronDown, ChevronUp, Copy, ExternalLink, AlertCircle, Sparkles,
  MessageCircle, Flame, Zap, Snowflake, AlertTriangle, FileText, Trophy, Target,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Plus,
  UserCheck, UserPlus, Paperclip, Upload, FolderOpen, Eye, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { Lead, LeadDocument } from '../types';
import LeadDocumentVault from './LeadDocumentVault';

export interface DispositionConfig {
  category: 'Dead' | 'Cold' | 'Warm' | 'Hot';
  bgColor: string;
  textColor: string;
  borderColor: string;
  subDispositions: string[];
}

export const DISPOSITIONS_MAP: Record<string, DispositionConfig> = {
  'Follow up': {
    category: 'Hot',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    subDispositions: ['Customer Busy', 'Interested', 'Parents Approval / Internal Discussion', 'Not Answered']
  },
  'Prospect': {
    category: 'Hot',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    subDispositions: ['Payment next month', 'Payment this week', 'Payment this month', 'PO']
  },
  'Converted': {
    category: 'Hot',
    bgColor: 'bg-emerald-600',
    textColor: 'text-white',
    borderColor: 'border-emerald-700',
    subDispositions: ['Payment done!']
  },
  'Other Agent Callback': {
    category: 'Warm',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    subDispositions: ['NA']
  },
  'Other Agent FollowUp': {
    category: 'Warm',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    subDispositions: ['NA']
  },
  'Next Batch': {
    category: 'Warm',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200',
    subDispositions: ['Other course', 'Same course']
  },
  'Call Back': {
    category: 'Cold',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    subDispositions: ['Customer Busy', 'Not answering', 'RPC Not available']
  },
  'Fallout': {
    category: 'Cold',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    subDispositions: [
      'Effort Exhausted', 'Enrolled in other company', 'Enrolled in other course', 
      'Fee is high', 'Looking for Job', 'Reason not shared', 'Syllabus disinterest', 
      'Time constraint', 'Free training'
    ]
  },
  'New Lead': {
    category: 'Cold',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    subDispositions: ['NA']
  },
  'Not interested': {
    category: 'Cold',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-300',
    subDispositions: [
      'Enrolled in other company', 'Enrolled in other course', 'Fee is high', 
      'Just Exploring', 'Looking for Certification Course', 'Looking for degree course', 
      'Looking for job', 'Reason not shared', 'Syllabus disinterest', 'Time constraint'
    ]
  },
  'DNC': {
    category: 'Dead',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    subDispositions: ['NA']
  },
  'Not Eligible': {
    category: 'Dead',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    subDispositions: ['Education', 'Experience', 'Language Barrier']
  },
  'Wrong Number': {
    category: 'Dead',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    subDispositions: ['NA']
  },
  'Not Enquired': {
    category: 'Dead',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    subDispositions: [
      'Ad was not clear', 'Did not enquire', 'Enquired by mistake', 'Just Exploring', 
      'Looking For A Regular Degree', 'Looking for Degree', 'Looking for Job', 'Other Specialization'
    ]
  }
};

const DEFAULT_COUNSELLORS = ['Siraj', 'Sussan', 'Pranay', 'Shramin'];

interface AdminLeadsProps {
  leads: Lead[];
  onUpdateLeadStatus: (leadId: string, newStatus: Lead['status']) => void;
  onUpdateLeadDetails?: (leadId: string, updates: Partial<Lead>) => void;
  onClearLeads: () => void;
  onSeedLeads: () => void;
  googleSheetUrl: string;
  onSaveGoogleSheetUrl: (url: string) => Promise<boolean>;
  onSyncAllLeads: () => Promise<{ success: boolean; synced: number; failed: number; total: number }>;
  onDeleteLead?: (leadId: string) => void;
  userRole?: 'admin' | 'counselor';
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function AdminLeads({ 
  leads = [], 
  onUpdateLeadStatus, 
  onUpdateLeadDetails,
  onClearLeads, 
  onSeedLeads,
  googleSheetUrl,
  onSaveGoogleSheetUrl,
  onSyncAllLeads,
  onDeleteLead,
  userRole = 'admin',
  onRefresh,
  isRefreshing = false
}: AdminLeadsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Hot' | 'Warm' | 'Cold' | 'Dead' | 'Converted' | 'New'>('All');
  const [counsellorFilter, setCounsellorFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Counsellors List State (Default 4 + dynamically added custom names, persisted in localStorage)
  const [counsellorsList, setCounsellorsList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('enrol_counsellors_list');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return Array.from(new Set([...DEFAULT_COUNSELLORS, ...parsed]));
        }
      }
    } catch (e) {
      console.error('Error loading counsellors:', e);
    }
    return DEFAULT_COUNSELLORS;
  });

  // Dynamic input for typing counsellor names live
  const [dynamicCounsellorInput, setDynamicCounsellorInput] = useState('');
  const [activeDocModalLead, setActiveDocModalLead] = useState<Lead | null>(null);

  // Sheet configurations state
  const [sheetUrlInput, setSheetUrlInput] = useState(googleSheetUrl);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [isSavingUrl, setIsSavingUrl] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; failed: number; total: number } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // CRM state variables
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [drawerActiveTab, setDrawerActiveTab] = useState<'details' | 'documents' | 'whatsapp'>('details');
  const [tempRemarks, setTempRemarks] = useState('');
  const [tempFollowUpDate, setTempFollowUpDate] = useState('');
  const [tempDisposition, setTempDisposition] = useState('');
  const [tempSubDisposition, setTempSubDisposition] = useState('');
  const [tempPriority, setTempPriority] = useState<number>(3);
  const [tempCounsellor, setTempCounsellor] = useState('');
  const [customWhatsAppMessage, setCustomWhatsAppMessage] = useState('');
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);
  const [updateSuccessMsg, setUpdateSuccessMsg] = useState<string | null>(null);

  // Reset page to 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, counsellorFilter, startDate, endDate, itemsPerPage]);

  const addCounsellorToPool = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!counsellorsList.includes(trimmed)) {
      const updated = [...counsellorsList, trimmed];
      setCounsellorsList(updated);
      try {
        localStorage.setItem('enrol_counsellors_list', JSON.stringify(updated));
      } catch (e) {}
    }
  };

  const handleLiveAssignCounsellor = async (leadId: string, counsellorName: string) => {
    const trimmed = counsellorName.trim();
    if (trimmed) {
      addCounsellorToPool(trimmed);
    }
    setTempCounsellor(trimmed);
    if (onUpdateLeadDetails) {
      await onUpdateLeadDetails(leadId, { counsellor: trimmed });
      setUpdateSuccessMsg(trimmed ? `Assigned to ${trimmed} live!` : 'Lead unassigned');
      setTimeout(() => setUpdateSuccessMsg(null), 3000);
    }
  };

  const handleUpdateDocumentsForLead = async (leadId: string, documents: LeadDocument[]) => {
    if (onUpdateLeadDetails) {
      await onUpdateLeadDetails(leadId, { documents });
      if (activeDocModalLead && activeDocModalLead.id === leadId) {
        setActiveDocModalLead({ ...activeDocModalLead, documents });
      }
    }
  };

  const getLeadCategory = (lead: Lead): 'Hot' | 'Warm' | 'Cold' | 'Dead' => {
    const disp = lead.disposition || 'New Lead';
    if (DISPOSITIONS_MAP[disp]) {
      return DISPOSITIONS_MAP[disp].category;
    }
    return 'Cold'; // default fallback for unassigned leads
  };

  const filteredLeads = leads.filter(l => {
    const name = l.name || '';
    const email = l.email || '';
    const phone = l.phone || '';
    const collegeName = l.collegeName || '';
    const disposition = l.disposition || '';
    const subDisposition = l.subDisposition || '';
    const counsellor = l.counsellor || '';

    const matchesSearch = 
      name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm) ||
      collegeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      disposition.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subDisposition.toLowerCase().includes(searchTerm.toLowerCase()) ||
      counsellor.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = 
      categoryFilter === 'All' || 
      (categoryFilter === 'Converted' ? l.disposition === 'Converted' : 
       categoryFilter === 'New' ? (!l.disposition || l.disposition === 'New Lead') :
       getLeadCategory(l) === categoryFilter);

    const matchesCounsellor = 
      counsellorFilter === 'All' || 
      (counsellorFilter === 'Unassigned' ? (!l.counsellor || l.counsellor.trim() === '') : 
       l.counsellor === counsellorFilter);

    let matchesDate = true;
    if (l.timestamp) {
      const leadDate = new Date(l.timestamp);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const leadCompare = new Date(leadDate);
        leadCompare.setHours(0, 0, 0, 0);
        if (leadCompare < start) matchesDate = false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        const leadCompare = new Date(leadDate);
        leadCompare.setHours(0, 0, 0, 0);
        if (leadCompare > end) matchesDate = false;
      }
    } else if (startDate || endDate) {
      matchesDate = false;
    }

    return matchesSearch && matchesCategory && matchesCounsellor && matchesDate;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLeads = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);

  // Calculate metrics based on CRM categories for dashboard
  const totalLeads = leads.length;
  const newLeadsCount = leads.filter(l => !l.disposition || l.disposition === 'New Lead').length;
  const convertedLeadsCount = leads.filter(l => l.disposition === 'Converted').length;
  const hotLeadsCount = leads.filter(l => getLeadCategory(l) === 'Hot' && l.disposition !== 'Converted').length;
  const warmLeadsCount = leads.filter(l => getLeadCategory(l) === 'Warm').length;
  const coldLeadsCount = leads.filter(l => getLeadCategory(l) === 'Cold' && l.disposition && l.disposition !== 'New Lead').length;
  const deadLeadsCount = leads.filter(l => getLeadCategory(l) === 'Dead').length;

  const toggleLeadExpand = (lead: Lead) => {
    if (expandedLeadId === lead.id) {
      setExpandedLeadId(null);
    } else {
      setExpandedLeadId(lead.id);
      setDrawerActiveTab('details');
      setTempRemarks(lead.remarks || '');
      setTempFollowUpDate(lead.followUpDate || '');
      setTempDisposition(lead.disposition || '');
      setTempSubDisposition(lead.subDisposition || '');
      setTempPriority(lead.priority !== undefined ? lead.priority : 3);
      setTempCounsellor(lead.counsellor || '');
      setDynamicCounsellorInput('');
      setCustomWhatsAppMessage('');
      setUpdateSuccessMsg(null);
    }
  };

  const applyTemplate = (lead: Lead, templateType: 'welcome' | 'followup' | 'eligibility') => {
    let msg = '';
    const name = lead.name;
    const stream = lead.streamOfInterest || 'Global Admissions';
    const budget = lead.budget || 'your budget preference';
    const dateStr = tempFollowUpDate 
      ? new Date(tempFollowUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'scheduled follow-up';

    switch (templateType) {
      case 'welcome':
        msg = `Hello ${name}! This is Enrol Overseas. Thank you for registering with us for ${stream} programs. Let me know when you are free for a quick counseling call to discuss top university matches.`;
        break;
      case 'followup':
        msg = `Hello ${name}! This is Enrol Overseas following up on our scheduled discussion on ${dateStr}. Please keep your academic transcripts ready so we can run an eligibility check.`;
        break;
      case 'eligibility':
        msg = `Hi ${name}! Regarding your profile for ${stream} programs: we found excellent NAAC-accredited university options matching your budget of ${budget}. Let's chat today to short-list them!`;
        break;
    }
    setCustomWhatsAppMessage(msg);
  };

  const handleSaveDetails = async (leadId: string) => {
    if (!onUpdateLeadDetails) return;
    setIsUpdatingDetails(true);
    try {
      const lead = leads.find(l => l.id === leadId);
      const updates: Partial<Lead> = {
        remarks: tempRemarks,
        followUpDate: tempFollowUpDate,
        disposition: tempDisposition || 'New Lead',
        subDisposition: tempSubDisposition || 'NA',
        priority: tempPriority,
        counsellor: tempCounsellor
      };

      if (lead && lead.status === 'New') {
        if (tempDisposition === 'Converted') {
          updates.status = 'Enrolled';
        } else if (tempDisposition && tempDisposition !== 'New Lead') {
          updates.status = 'In Progress';
        }
      }

      if (tempCounsellor) {
        addCounsellorToPool(tempCounsellor);
      }

      await onUpdateLeadDetails(leadId, updates);
      setUpdateSuccessMsg('CRM Record Saved Successfully!');
      setTimeout(() => setUpdateSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Failed to save CRM details:', err);
    } finally {
      setIsUpdatingDetails(false);
    }
  };

  const renderCrmOutreachDrawer = (lead: Lead) => {
    const docCount = (lead.documents || []).length;

    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-md max-w-full overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
        
        {/* Drawer Header & Quick Navigation Tabs */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-4 mb-5" id={`crm-hdr-${lead.id}`}>
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-600 animate-pulse" />
              Lead Workspace: {lead.name}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Assign counselors live, manage disposition stages, attach verification documents, and dispatch WhatsApp communications.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setDrawerActiveTab('details')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  drawerActiveTab === 'details'
                    ? 'bg-white text-slate-800 shadow-sm font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                <span>CRM & Counselor</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerActiveTab('documents')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  drawerActiveTab === 'documents'
                    ? 'bg-white text-teal-700 shadow-sm font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5 text-teal-600" />
                <span>Documents ({docCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerActiveTab('whatsapp')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  drawerActiveTab === 'whatsapp'
                    ? 'bg-white text-emerald-700 shadow-sm font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp Sandbox</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: CRM Details, Counselor Assignment, Disposition */}
        {drawerActiveTab === 'details' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id={`crm-layout-grid-${lead.id}`}>
            {/* Left Panel */}
            <div className="lg:col-span-7 flex flex-col space-y-4" id={`crm-left-panel-${lead.id}`}>
              
              {/* LIVE COUNSELLOR ASSIGNMENT BOX */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-[11px] font-black text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-indigo-600" />
                    Assigned Counselor (Live Assignment)
                  </label>
                  {tempCounsellor ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      <Check className="w-3 h-3 text-indigo-600" /> Currently: {tempCounsellor}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Unassigned
                    </span>
                  )}
                </div>

                {/* Dropdown Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">Select from Dropdown:</span>
                    <select
                      value={tempCounsellor}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTempCounsellor(val);
                        handleLiveAssignCounsellor(lead.id, val);
                      }}
                      className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-xs"
                      id={`counsellor-dropdown-${lead.id}`}
                    >
                      <option value="">-- Unassigned --</option>
                      {counsellorsList.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Dynamic Name Typing Field */}
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block mb-1">Or Type Name Dynamically:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="e.g. Siraj, Sussan, Pranay..."
                        value={dynamicCounsellorInput}
                        onChange={(e) => setDynamicCounsellorInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (dynamicCounsellorInput.trim()) {
                              handleLiveAssignCounsellor(lead.id, dynamicCounsellorInput);
                              setDynamicCounsellorInput('');
                            }
                          }
                        }}
                        className="flex-1 bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-xs"
                        id={`dynamic-counsellor-input-${lead.id}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (dynamicCounsellorInput.trim()) {
                            handleLiveAssignCounsellor(lead.id, dynamicCounsellorInput);
                            setDynamicCounsellorInput('');
                          }
                        }}
                        disabled={!dynamicCounsellorInput.trim()}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 shadow-xs"
                        title="Assign newly typed counselor name to lead immediately"
                      >
                        Assign Live
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick 1-Click Counselor Shortcut Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-indigo-100/70">
                  <span className="text-[9px] font-black uppercase text-indigo-700 mr-1">Quick Select:</span>
                  {DEFAULT_COUNSELLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleLiveAssignCounsellor(lead.id, c)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        tempCounsellor === c
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                  {tempCounsellor && (
                    <button
                      type="button"
                      onClick={() => handleLiveAssignCounsellor(lead.id, '')}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 ml-auto transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Dispositions Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`disposition-select-${lead.id}`} className="text-[10px] font-black text-slate-700 uppercase block mb-1 tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                    Lead Disposition
                  </label>
                  <select
                    value={tempDisposition}
                    onChange={(e) => {
                      const newDisp = e.target.value;
                      setTempDisposition(newDisp);
                      const subOptions = DISPOSITIONS_MAP[newDisp]?.subDispositions || [];
                      setTempSubDisposition(subOptions[0] || '');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-extrabold cursor-pointer transition-all"
                    id={`disposition-select-${lead.id}`}
                  >
                    <option value="">-- Select Disposition --</option>
                    {Object.keys(DISPOSITIONS_MAP).map((disp) => {
                      const cfg = DISPOSITIONS_MAP[disp];
                      return (
                        <option key={disp} value={disp}>
                          {disp} ({cfg.category})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label htmlFor={`sub-disposition-select-${lead.id}`} className="text-[10px] font-black text-slate-700 uppercase block mb-1 tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-teal-500" />
                    Sub-Disposition
                  </label>
                  <select
                    value={tempSubDisposition}
                    onChange={(e) => setTempSubDisposition(e.target.value)}
                    disabled={!tempDisposition}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-extrabold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    id={`sub-disposition-select-${lead.id}`}
                  >
                    <option value="">-- Select Sub-Disposition --</option>
                    {tempDisposition && DISPOSITIONS_MAP[tempDisposition]?.subDispositions.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor={`remarks-textarea-${lead.id}`} className="text-[10px] font-black text-slate-700 uppercase block mb-1 tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-teal-600" />
                  Counselor Remarks & Internal Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Add notes about student profile, target intake, specific country preferences, or interview remarks..."
                  value={tempRemarks}
                  onChange={(e) => setTempRemarks(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none font-medium leading-relaxed"
                  id={`remarks-textarea-${lead.id}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`followup-date-picker-${lead.id}`} className="text-[10px] font-black text-slate-700 uppercase block mb-1 tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    Set Follow-Up Date
                  </label>
                  <input
                    type="date"
                    value={tempFollowUpDate}
                    onChange={(e) => setTempFollowUpDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer font-bold"
                    id={`followup-date-picker-${lead.id}`}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => handleSaveDetails(lead.id)}
                    disabled={isUpdatingDetails}
                    className={`w-full text-xs font-black py-2.5 px-4 rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 ${
                      isUpdatingDetails 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/10'
                    }`}
                    id={`save-crm-btn-${lead.id}`}
                  >
                    {isUpdatingDetails ? 'Saving Record...' : 'Save All Changes'}
                  </button>
                </div>
              </div>

              {updateSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-bold" id={`update-success-alert-${lead.id}`}>
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{updateSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Right Panel: Quick Document Summary & WhatsApp preview */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              {/* Document Summary Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <FolderOpen className="w-4 h-4 text-teal-600" />
                    Student Documents ({docCount})
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawerActiveTab('documents')}
                    className="text-[11px] font-black text-teal-600 hover:underline"
                  >
                    Open Document Vault →
                  </button>
                </div>

                {docCount === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No documents uploaded yet. Click to attach passports, marksheets, scorecards, or SOPs.
                  </p>
                ) : (
                  <div className="space-y-1.5 mt-2">
                    {(lead.documents || []).slice(0, 3).map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between bg-white border border-slate-200/60 rounded-xl px-3 py-1.5 text-xs">
                        <span className="font-bold text-slate-700 truncate max-w-[170px]" title={doc.name}>
                          {doc.name}
                        </span>
                        <span className="text-[9px] font-extrabold px-2 py-0.5 bg-teal-50 text-teal-800 rounded-md">
                          {doc.category}
                        </span>
                      </div>
                    ))}
                    {docCount > 3 && (
                      <span className="text-[10px] text-slate-400 font-bold block pt-1">
                        + {docCount - 3} more files
                      </span>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setDrawerActiveTab('documents')}
                  className="w-full mt-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-extrabold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5 text-teal-600" />
                  <span>Upload & Manage Files</span>
                </button>
              </div>

              {/* Quick WhatsApp Jump */}
              <div className="bg-emerald-50/40 border border-emerald-100 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    Quick WhatsApp Outreach
                  </span>
                  <button
                    type="button"
                    onClick={() => setDrawerActiveTab('whatsapp')}
                    className="text-[11px] font-black text-emerald-600 hover:underline"
                  >
                    Open Sandbox →
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mb-3">
                  Direct WhatsApp messaging configured for student phone <strong>{lead.phone}</strong>.
                </p>
                <a
                  href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${lead.name}! This is Enrol Overseas. We are following up regarding your university admission profile.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-white" />
                  <span>Launch WhatsApp Direct</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Document Vault */}
        {drawerActiveTab === 'documents' && (
          <div className="animate-in fade-in duration-200">
            <LeadDocumentVault
              lead={lead}
              onUpdateLeadDocuments={(leadId, docs) => handleUpdateDocumentsForLead(leadId, docs)}
            />
          </div>
        )}

        {/* Tab 3: WhatsApp Sandbox */}
        {drawerActiveTab === 'whatsapp' && (
          <div className="flex flex-col space-y-4 animate-in fade-in duration-200" id={`crm-whatsapp-panel-${lead.id}`}>
            <div className="flex flex-wrap gap-1.5 mb-1">
              <span className="text-[10px] font-black uppercase text-slate-400 self-center mr-1">Load Template:</span>
              <button
                type="button"
                onClick={() => applyTemplate(lead, 'welcome')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-black uppercase text-slate-700 transition-colors"
              >
                👋 Welcome
              </button>
              <button
                type="button"
                onClick={() => applyTemplate(lead, 'followup')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-black uppercase text-slate-700 transition-colors"
              >
                📅 Follow-up
              </button>
              <button
                type="button"
                onClick={() => applyTemplate(lead, 'eligibility')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[10px] font-black uppercase text-slate-700 transition-colors"
              >
                🎓 Eligibility
              </button>
            </div>

            <textarea
              rows={6}
              value={customWhatsAppMessage}
              onChange={(e) => setCustomWhatsAppMessage(e.target.value)}
              className="w-full bg-emerald-50/20 border border-emerald-100 rounded-xl p-3 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono leading-relaxed"
              placeholder="Draft a bespoke counselor message here to send to the student over WhatsApp..."
              id={`whatsapp-composer-${lead.id}`}
            />

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-1">
              <p className="text-[10px] text-slate-400 font-semibold">
                * Browser will trigger wa.me protocol cleanly to {lead.phone}.
              </p>
              
              <a
                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(customWhatsAppMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl transition-all shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                id={`dispatch-wa-btn-${lead.id}`}
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Send WhatsApp Message</span>
              </a>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="py-8 bg-transparent" id="admin-leads-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b border-slate-100 pb-6" id="admin-header-block">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2" id="admin-title">
              <FileSpreadsheet className="w-8 h-8 text-teal-500" />
              Lead Conversion & CRM Workspace
            </h2>
            <p className="text-sm text-slate-400 mt-1" id="admin-subtitle">
              Live counselor assignment, document vault, disposition tracking, and direct WhatsApp outreach.
            </p>
          </div>
          
          <div className="flex items-center flex-wrap gap-3 self-start sm:self-center" id="admin-header-actions">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl border border-sky-200 hover:border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 transition-all cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-75"
                id="admin-refresh-btn"
                title="Force sync leads database with Supabase Postgres"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-600' : ''}`} />
                <span>{isRefreshing ? 'Syncing...' : 'Sync Live'}</span>
              </button>
            )}

            {userRole === 'admin' ? (
              <button
                onClick={onClearLeads}
                disabled={leads.length === 0}
                className={`text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  leads.length > 0 
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200/60' 
                    : 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                }`}
                id="admin-clear-btn"
              >
                Clear All Leads
              </button>
            ) : (
              <div className="text-xs text-slate-400 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl font-medium shrink-0">
                🔒 Standard Counselor Access
              </div>
            )}
          </div>
        </div>

        {/* Lead Stage Analytics Dashboard */}
        <div className="mb-8" id="admin-analytics-dashboard">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between w-full" id="analytics-chart-panel">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Lead Stage & Pipeline Metrics
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Click any stage bar to filter leads below.
                </p>
              </div>

              {/* Counsellor Fast Filters Overview */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Counselors:</span>
                {counsellorsList.map((c) => {
                  const count = leads.filter(l => l.counsellor === c).length;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCounsellorFilter(counsellorFilter === c ? 'All' : c)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                        counsellorFilter === c
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100'
                      }`}
                    >
                      {c}: {count}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Rendered Bar Graph */}
            <div className="my-2 relative flex flex-col items-center justify-center w-full">
              <div className="w-full overflow-x-auto scrollbar-thin select-none" id="chart-scroll-wrapper">
                <div className="min-w-[500px] sm:min-w-0 w-full h-[160px] relative flex items-end justify-between px-4 pb-6 pt-4 border-b border-slate-100">
                  
                  {/* Horizontal dotted gridlines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 pt-4 px-2">
                    <div className="w-full border-t border-dashed border-slate-100" />
                    <div className="w-full border-t border-dashed border-slate-100" />
                    <div className="w-full border-t border-dashed border-slate-100" />
                  </div>

                  {/* Bars logic */}
                  {[
                    { id: 'All', count: totalLeads, label: 'All Leads', color: 'from-slate-700 to-slate-600 bg-slate-600', activeFilter: 'All' },
                    { id: 'New', count: newLeadsCount, label: 'New Leads', color: 'from-indigo-600 to-indigo-500 bg-indigo-500', activeFilter: 'New' },
                    { id: 'Hot', count: hotLeadsCount, label: 'Hot Leads', color: 'from-emerald-600 to-emerald-500 bg-emerald-500', activeFilter: 'Hot' },
                    { id: 'Warm', count: warmLeadsCount, label: 'Warm Leads', color: 'from-amber-500 to-amber-400 bg-amber-400', activeFilter: 'Warm' },
                    { id: 'Cold', count: coldLeadsCount, label: 'Cold Leads', color: 'from-sky-500 to-sky-400 bg-sky-400', activeFilter: 'Cold' },
                    { id: 'Dead', count: deadLeadsCount, label: 'Dead Leads', color: 'from-rose-500 to-rose-400 bg-rose-400', activeFilter: 'Dead' },
                    { id: 'Converted', count: convertedLeadsCount, label: 'Converted', color: 'from-teal-600 to-teal-500 bg-teal-500', activeFilter: 'Converted' },
                  ].map((bar) => {
                    const maxVal = Math.max(totalLeads, 1);
                    const barHeightPct = Math.max((bar.count / maxVal) * 100, 8);
                    const isHovered = hoveredBar === bar.id;
                    const isCurrentFilter = categoryFilter === bar.activeFilter;

                    return (
                       <div 
                        key={bar.id}
                        className="flex-1 flex flex-col items-center justify-end h-full group px-1 sm:px-2 relative z-10 cursor-pointer"
                        onMouseEnter={() => setHoveredBar(bar.id)}
                        onMouseLeave={() => setHoveredBar(null)}
                        onClick={() => setCategoryFilter(bar.activeFilter as any)}
                      >
                        <div className={`absolute -top-10 bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg pointer-events-none transition-all duration-200 z-30 ${
                          isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
                        }`}>
                          {bar.count} leads ({totalLeads > 0 ? Math.round((bar.count / totalLeads) * 100) : 0}%)
                        </div>

                        <div className="w-full flex justify-center items-end h-full">
                          <div 
                            style={{ height: `${barHeightPct}%` }}
                            className={`w-full max-w-[44px] rounded-t-xl transition-all duration-300 shadow-sm ${
                              isCurrentFilter ? 'ring-2 ring-indigo-500 ring-offset-2 scale-105' : ''
                            } ${bar.color}`}
                          />
                        </div>
                        <span className={`text-[10px] mt-2 font-black uppercase tracking-wider text-center truncate w-full ${
                          isCurrentFilter ? 'text-indigo-600 font-extrabold' : 'text-slate-400'
                        }`}>
                          {bar.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6" id="admin-filter-bar">
          {/* Search Box */}
          <div className="relative flex-1" id="admin-search-wrapper">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student name, phone, email, university, counselor, disposition..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-700 placeholder-slate-400 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-sm"
              id="admin-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter by Counselor */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-sm">
              <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <select
                value={counsellorFilter}
                onChange={(e) => setCounsellorFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-700 font-extrabold outline-none cursor-pointer"
                id="admin-counsellor-filter-select"
              >
                <option value="All">All Counselors</option>
                <option value="Unassigned">Unassigned Only</option>
                {counsellorsList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Filter by Category */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none cursor-pointer font-black shadow-sm"
              id="admin-category-select"
            >
              <option value="All">All Dispositions</option>
              <option value="New">New Leads</option>
              <option value="Converted">Converted Leads</option>
              <option value="Hot">Hot Leads</option>
              <option value="Warm">Warm Leads</option>
              <option value="Cold">Cold Leads</option>
              <option value="Dead">Dead Leads</option>
            </select>

            {/* Date Range Picker */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-sm text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer font-bold"
                title="Start Date"
                id="admin-filter-start-date"
              />
              <span className="text-slate-300">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none cursor-pointer font-bold"
                title="End Date"
                id="admin-filter-end-date"
              />
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-rose-500 hover:bg-rose-50 px-1 py-0.5 rounded text-[10px] font-extrabold transition-colors"
                  title="Clear Date Filter"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Leads Table/List Container */}
        {filteredLeads.length > 0 ? (
          <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm" id="leads-table-wrapper">
            
            {/* Desktop View (Table Layout) */}
            <div className="hidden md:block overflow-x-auto" id="leads-table-scroll">
              <table className="w-full text-left text-xs border-collapse" id="leads-table">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase font-semibold text-[10px]" id="leads-table-head">
                  <tr>
                    <th className="p-4">Student Details</th>
                    <th className="p-4">Assigned Counselor</th>
                    <th className="p-4">Academic & Budget</th>
                    <th className="p-4">Documents</th>
                    <th className="p-4">Timestamp & Source</th>
                    <th className="p-4">Disposition & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600" id="leads-table-body">
                  {currentLeads.map((lead) => {
                    const isExpanded = expandedLeadId === lead.id;
                    const docsCount = (lead.documents || []).length;

                    return (
                      <React.Fragment key={lead.id}>
                        <tr className={`hover:bg-slate-50/50 transition-colors animate-fade-in ${isExpanded ? 'bg-slate-50/60 font-medium' : ''}`} id={`lead-row-${lead.id}`}>
                          
                          {/* Student Details */}
                          <td className="p-4" id={`lead-cell-student-${lead.id}`}>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-800 text-sm" id={`lead-row-name-${lead.id}`}>{lead.name}</span>
                            </div>
                            <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-1" id={`lead-row-phone-${lead.id}`}>
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              {lead.phone}
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5" id={`lead-row-email-${lead.id}`}>
                              <Mail className="w-3.5 h-3.5 text-slate-300" />
                              {lead.email}
                            </span>
                            
                            {/* Disposition Pill */}
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase border shadow-2xs ${
                                DISPOSITIONS_MAP[lead.disposition || 'New Lead']?.category === 'Hot' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                DISPOSITIONS_MAP[lead.disposition || 'New Lead']?.category === 'Warm' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                                DISPOSITIONS_MAP[lead.disposition || 'New Lead']?.category === 'Cold' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                'bg-rose-50 border-rose-200 text-rose-700'
                              }`}>
                                {lead.disposition || 'New Lead'}
                                {(lead.subDisposition || 'NA') !== 'NA' && ` • ${lead.subDisposition}`}
                              </span>
                            </div>
                          </td>

                          {/* Assigned Counselor Cell */}
                          <td className="p-4" id={`lead-cell-counsellor-${lead.id}`}>
                            <div className="flex flex-col gap-1.5 min-w-[140px]">
                              {lead.counsellor ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 border border-indigo-200 text-indigo-800 shadow-2xs">
                                  <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span className="truncate">{lead.counsellor}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-400">
                                  <UserPlus className="w-3 h-3 text-slate-400" />
                                  Unassigned
                                </span>
                              )}

                              {/* Inline fast assign select */}
                              <select
                                value={lead.counsellor || ''}
                                onChange={(e) => handleLiveAssignCounsellor(lead.id, e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[10px] text-slate-600 font-bold outline-none cursor-pointer hover:border-indigo-300 transition-colors shadow-2xs"
                                title="Quick change assigned counselor live"
                              >
                                <option value="">Assign Counselor...</option>
                                {counsellorsList.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* Academic Score & Budget */}
                          <td className="p-4" id={`lead-cell-academic-${lead.id}`}>
                            {lead.academicLevel && (
                              <span className="text-[9px] font-extrabold text-teal-600 uppercase tracking-wider block mb-0.5">
                                {lead.academicLevel}
                              </span>
                            )}
                            <span className="font-semibold text-slate-700 block" id={`lead-row-stream-${lead.id}`}>
                              {lead.streamOfInterest || 'General'}
                            </span>
                            {lead.degreeOfInterest && (
                              <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                                Goal: {lead.degreeOfInterest}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-400 mt-1 block" id={`lead-row-score-${lead.id}`}>
                              Score: {lead.score || 'N/A'}
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5 block" id={`lead-row-budget-${lead.id}`}>
                              Budget: {lead.budget || 'N/A'}
                            </span>
                          </td>

                          {/* Documents Vault Trigger Cell */}
                          <td className="p-4" id={`lead-cell-documents-${lead.id}`}>
                            <div className="flex flex-col gap-1.5 min-w-[110px]">
                              {docsCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveDocModalLead(lead)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 transition-all cursor-pointer shadow-2xs group"
                                  title="Open student document vault"
                                >
                                  <FolderOpen className="w-3.5 h-3.5 text-teal-600 group-hover:scale-110 transition-transform" />
                                  <span>{docsCount} {docsCount === 1 ? 'Doc' : 'Docs'}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setActiveDocModalLead(lead)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 transition-all cursor-pointer"
                                  title="Upload student documents"
                                >
                                  <Upload className="w-3 h-3 text-slate-400" />
                                  <span>Upload Docs</span>
                                </button>
                              )}
                              <span className="text-[9px] text-slate-400">PDF, Img, Doc, etc.</span>
                            </div>
                          </td>

                          {/* Timestamp & Source */}
                          <td className="p-4 text-[11px] text-slate-400" id={`lead-cell-time-${lead.id}`}>
                            <span className="flex items-center gap-1" id={`lead-row-time-${lead.id}`}>
                              <Calendar className="w-3.5 h-3.5 text-slate-300" />
                              {new Date(lead.timestamp).toLocaleDateString()}
                            </span>
                            <span className="block mt-0.5" id={`lead-row-time-hour-${lead.id}`}>
                              {new Date(lead.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-[9px] uppercase mt-1 ${
                              lead.source === 'eligibility_calculator' ? 'bg-teal-50 text-teal-700' :
                              lead.source === 'ai_chat' ? 'bg-orange-50 text-orange-700' :
                              lead.source === 'direct_apply' ? 'bg-amber-50 text-amber-700' :
                              'bg-slate-50 text-slate-600'
                            }`} id={`lead-row-source-${lead.id}`}>
                              {lead.source.replace('_', ' ')}
                            </span>
                          </td>

                          {/* Action Buttons Row */}
                          <td className="p-4" id={`lead-cell-actions-${lead.id}`}>
                            <div className="flex flex-col gap-1.5 min-w-[150px]">
                              <button
                                type="button"
                                onClick={() => toggleLeadExpand(lead)}
                                className={`px-3 py-1.5 rounded-xl border text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm ${
                                  isExpanded
                                    ? 'bg-teal-600 text-white border-teal-600'
                                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                                }`}
                                title="Open CRM outreach and documents workspace"
                                id={`crm-toggle-${lead.id}`}
                              >
                                <Sparkles className={`w-3.5 h-3.5 ${isExpanded ? 'animate-pulse text-yellow-300' : 'text-teal-500'}`} />
                                <span>CRM Workspace</span>
                                {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                              </button>

                              {userRole === 'admin' && onDeleteLead && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete the lead for ${lead.name}?`)) {
                                      onDeleteLead(lead.id);
                                    }
                                  }}
                                  className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                                  title="Delete Lead Record"
                                  id={`delete-lead-${lead.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible CRM Workspace Drawer */}
                        {isExpanded && (
                          <tr key={`expanded-row-${lead.id}`} className="bg-slate-50/50">
                            <td colSpan={6} className="p-4 sm:p-6 border-b border-slate-200/80 bg-slate-50/60" id={`expanded-panel-${lead.id}`}>
                              {renderCrmOutreachDrawer(lead)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile View (Touch-Optimized Responsive Card List) */}
            <div className="block md:hidden divide-y divide-slate-100" id="leads-mobile-list">
              {currentLeads.map((lead) => {
                const isExpanded = expandedLeadId === lead.id;
                const docsCount = (lead.documents || []).length;

                return (
                  <div 
                    key={lead.id} 
                    className={`p-4 transition-all duration-300 ${
                      isExpanded ? 'bg-slate-50/50' : 'bg-white'
                    }`}
                    id={`lead-card-${lead.id}`}
                  >
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm leading-tight">{lead.name}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {lead.counsellor ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black bg-indigo-50 border border-indigo-200 text-indigo-800">
                              <UserCheck className="w-2.5 h-2.5 text-indigo-600" />
                              {lead.counsellor}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold bg-slate-100 border border-slate-200 text-slate-400">
                              Unassigned
                            </span>
                          )}

                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                            DISPOSITIONS_MAP[lead.disposition || 'New Lead']?.category === 'Hot' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                            DISPOSITIONS_MAP[lead.disposition || 'New Lead']?.category === 'Warm' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                            DISPOSITIONS_MAP[lead.disposition || 'New Lead']?.category === 'Cold' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                            'bg-rose-50 border-rose-200 text-rose-700'
                          }`}>
                            {lead.disposition || 'New Lead'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right text-[10px] text-slate-400 shrink-0">
                        <span className="flex items-center justify-end gap-1 font-semibold text-slate-500">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(lead.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {lead.phone}
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-500 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {lead.email}
                      </span>
                    </div>

                    {/* Documents & Counselor fast action bar */}
                    <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setActiveDocModalLead(lead)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 transition-all cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-teal-600" />
                        <span>Documents ({docsCount})</span>
                      </button>

                      {/* Counselor Quick Selector for mobile */}
                      <select
                        value={lead.counsellor || ''}
                        onChange={(e) => handleLiveAssignCounsellor(lead.id, e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-700 font-bold outline-none shadow-2xs"
                      >
                        <option value="">Counselor...</option>
                        {counsellorsList.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => toggleLeadExpand(lead)}
                        className={`px-3 py-2 rounded-xl border text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm flex-1 ${
                          isExpanded
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                        }`}
                        id={`crm-toggle-mobile-${lead.id}`}
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isExpanded ? 'animate-pulse text-yellow-300' : 'text-teal-500'}`} />
                        <span>CRM Workspace</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>

                      {userRole === 'admin' && onDeleteLead && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete the lead for ${lead.name}?`)) {
                              onDeleteLead(lead.id);
                            }
                          }}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 transition-all cursor-pointer"
                          title="Delete Lead"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Expanded Drawer on Mobile */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        {renderCrmOutreachDrawer(lead)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="bg-slate-50 border-t border-slate-100 px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-4" id="admin-crm-pagination-controls">
              <div className="text-xs text-slate-500 font-medium" id="pagination-info">
                Showing <span className="font-bold text-slate-800">{filteredLeads.length === 0 ? 0 : indexOfFirstItem + 1}</span> to{' '}
                <span className="font-bold text-slate-800">
                  {Math.min(indexOfLastItem, filteredLeads.length)}
                </span>{' '}
                of <span className="font-bold text-slate-800">{filteredLeads.length}</span> leads
                {filteredLeads.length !== totalLeads && (
                  <span className="text-[10px] text-slate-400 font-normal ml-1">
                    (filtered from {totalLeads} total)
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4" id="pagination-actions">
                {/* Items per Page Selector */}
                <div className="flex items-center gap-1.5" id="items-per-page-selector">
                  <span className="text-xs text-slate-500">Per page:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-bold outline-none cursor-pointer"
                    id="items-per-page-select"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                {/* Page Navigation */}
                <div className="flex items-center gap-1" id="pagination-nav-buttons">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="First Page"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="text-xs font-bold px-2 text-slate-700">
                    {currentPage} / {Math.max(totalPages, 1)}
                  </span>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Last Page"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700 mb-1">No Leads Match Your Criteria</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
              Try adjusting your search terms, counselor filter, disposition selection, or date range.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('All');
                setCounsellorFilter('All');
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )}

        {/* Global Standalone Document Vault Modal */}
        {activeDocModalLead && (
          <LeadDocumentVault
            lead={activeDocModalLead}
            onUpdateLeadDocuments={(leadId, docs) => handleUpdateDocumentsForLead(leadId, docs)}
            isOpenModal={true}
            onCloseModal={() => setActiveDocModalLead(null)}
          />
        )}

      </div>
    </section>
  );
}
