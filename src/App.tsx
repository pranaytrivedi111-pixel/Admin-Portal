import React, { useState, useEffect } from 'react';
import { 
  Lock, AlertCircle, LogOut, CheckCircle, GraduationCap
} from 'lucide-react';
import { Lead } from './types';
import AdminLeads from './components/AdminLeads';

// Configurable API base URL to allow separate hosting of the admin portal
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'counselor' | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  // Helper to build fully-qualified API URLs
  const getApiUrl = (path: string) => {
    const cleanPath = path.replace(/^\//, '');
    // If we are in production / deployed on Vercel, always use relative paths for perfect same-origin reliability.
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `/${cleanPath}`;
    }
    const base = API_BASE_URL.replace(/\/$/, '');
    return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
  };

  const safeSaveOfflineLeads = (leadsToSave: Lead[]) => {
    try {
      // Create clean copy without giant dataUrls for localStorage so 5MB limit is never exceeded
      const sanitized = leadsToSave.map(l => ({
        ...l,
        documents: (l.documents || []).map(d => ({
          ...d,
          dataUrl: d.dataUrl && d.dataUrl.length > 500 ? '' : d.dataUrl
        }))
      }));
      localStorage.setItem('enrol_leads_offline', JSON.stringify(sanitized));
    } catch (e) {
      console.warn('localStorage quota reached or unavailable:', e);
    }
  };

  const fetchLeads = async (silent = false) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoadingLeads(true);
    }
    try {
      const res = await fetch(getApiUrl('/api/leads'));
      if (res.ok) {
        const data = await res.json();
        const incomingLeads: Lead[] = data.leads || [];
        setLeads(prevLeads => {
          return incomingLeads.map(incoming => {
            const prev = prevLeads.find(p => p.id === incoming.id);
            const prevDocs = prev?.documents || [];
            const incDocs = incoming.documents || [];
            
            // Seamlessly preserve local hydrated document dataUrls
            let finalDocs: LeadDocument[] = [];
            if (Array.isArray(incoming.documents)) {
              finalDocs = incoming.documents.map(incDoc => {
                const existing = prevDocs.find(p => p.id === incDoc.id);
                return {
                  ...incDoc,
                  dataUrl: incDoc.dataUrl || existing?.dataUrl || ''
                };
              });
            } else {
              finalDocs = prevDocs;
            }

            return {
              ...incoming,
              documents: finalDocs
            };
          });
        });
        setGoogleSheetUrl(data.googleSheetUrl || '');
        safeSaveOfflineLeads(data.leads || []);
      } else {
        const savedLeads = localStorage.getItem('enrol_leads_offline');
        if (savedLeads) {
          setLeads(JSON.parse(savedLeads));
        }
      }
    } catch (err) {
      console.error('Failed to fetch leads from API:', err);
      const savedLeads = localStorage.getItem('enrol_leads_offline');
      if (savedLeads) {
        setLeads(JSON.parse(savedLeads));
      }
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setIsLoadingLeads(false);
      }
    }
  };

  // Persist login state in session storage
  useEffect(() => {
    const savedUser = sessionStorage.getItem('crm_admin_user');
    const savedRole = sessionStorage.getItem('crm_admin_role');
    if (savedUser && savedRole) {
      setUserName(savedUser);
      setUserRole(savedRole as 'admin' | 'counselor');
      setIsAdminLoggedIn(true);
    }
  }, []);

  // Fetch leads when authenticated and setup real-time background auto-polling
  useEffect(() => {
    if (!isAdminLoggedIn) return;

    // Load leads with initial full-page spinner
    fetchLeads(false);

    // Auto-sync interval (every 8 seconds) to pull new website inquiries in real-time
    const syncInterval = setInterval(() => {
      fetchLeads(true);
    }, 8000);

    return () => clearInterval(syncInterval);
  }, [isAdminLoggedIn]);

  // Handle server-based authentication with local fallback
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsAuthenticating(true);

    const userTrim = adminUsername.trim();
    const passTrim = adminPassword.trim();

    if (!userTrim || !passTrim) {
      setLoginError('Please enter both username and access password.');
      setIsAuthenticating(false);
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userTrim, password: passTrim })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserRole(data.user.role || 'counselor');
          setUserName(data.user.username);
          setIsAdminLoggedIn(true);
          sessionStorage.setItem('crm_admin_user', data.user.username);
          sessionStorage.setItem('crm_admin_role', data.user.role || 'counselor');
          showToast(`Welcome back, ${data.user.username}!`);
        } else {
          setLoginError(data.message || 'Authentication failed. Invalid username or password.');
        }
      } else {
        // Safe offline validation fallback if server is down/unreachable
        const isAdmin = userTrim.toLowerCase() === 'enroloverseas' && (passTrim === 'Enroloverseas@123' || passTrim === 'enroloverseas@123' || passTrim === 'enroloverseas123');
        const isCounsellor = (userTrim.toLowerCase() === 'counsellor' || userTrim.toLowerCase() === 'counselor') && (passTrim === 'Counsellor@123' || passTrim === 'counsellor@123' || passTrim === 'Counselor@123' || passTrim === 'counselor@123' || passTrim === 'counselor123');

        if (isAdmin) {
          setUserRole('admin');
          setUserName('Enroloverseas');
          setIsAdminLoggedIn(true);
          sessionStorage.setItem('crm_admin_user', 'Enroloverseas');
          sessionStorage.setItem('crm_admin_role', 'admin');
          showToast('Welcome back, Admin (Enroloverseas)!');
        } else if (isCounsellor) {
          setUserRole('counselor');
          setUserName('Counsellor');
          setIsAdminLoggedIn(true);
          sessionStorage.setItem('crm_admin_user', 'Counsellor');
          sessionStorage.setItem('crm_admin_role', 'counselor');
          showToast('Welcome back, Counsellor!');
        } else {
          setLoginError('Invalid credentials. Check username or password.');
        }
      }
    } catch (err) {
      console.warn('Authentication API error. Doing safe offline credential validation:', err);
      const isAdmin = userTrim.toLowerCase() === 'enroloverseas' && (passTrim === 'Enroloverseas@123' || passTrim === 'enroloverseas@123' || passTrim === 'enroloverseas123');
      const isCounsellor = (userTrim.toLowerCase() === 'counsellor' || userTrim.toLowerCase() === 'counselor') && (passTrim === 'Counsellor@123' || passTrim === 'counsellor@123' || passTrim === 'Counselor@123' || passTrim === 'counselor@123' || passTrim === 'counselor123');

      if (isAdmin) {
        setUserRole('admin');
        setUserName('Enroloverseas');
        setIsAdminLoggedIn(true);
        sessionStorage.setItem('crm_admin_user', 'Enroloverseas');
        sessionStorage.setItem('crm_admin_role', 'admin');
        showToast('Welcome back, Admin (Enroloverseas)!');
      } else if (isCounsellor) {
        setUserRole('counselor');
        setUserName('Counsellor');
        setIsAdminLoggedIn(true);
        sessionStorage.setItem('crm_admin_user', 'Counsellor');
        sessionStorage.setItem('crm_admin_role', 'counselor');
        showToast('Welcome back, Counsellor!');
      } else {
        setLoginError('Invalid credentials. Check username or password.');
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    setUserRole(null);
    setUserName('');
    setAdminUsername('');
    setAdminPassword('');
    sessionStorage.clear();
    showToast('Logged out successfully');
  };

  const handleAddLead = async (newLeadData: Partial<Lead>): Promise<Lead | null> => {
    const finalLead: Lead = {
      id: newLeadData.id || `lead-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: newLeadData.name || 'New Student',
      email: newLeadData.email || '',
      phone: newLeadData.phone || '',
      academicLevel: newLeadData.academicLevel || 'Undergraduate',
      streamOfInterest: newLeadData.streamOfInterest || 'Computer Science & IT',
      degreeOfInterest: newLeadData.degreeOfInterest || '',
      score: newLeadData.score || '',
      budget: newLeadData.budget || '',
      locationPreference: newLeadData.locationPreference || '',
      source: newLeadData.source || 'Website',
      timestamp: new Date().toISOString(),
      status: newLeadData.status || 'New',
      disposition: newLeadData.disposition || 'New Lead',
      subDisposition: newLeadData.subDisposition || 'NA',
      priority: newLeadData.priority || 3,
      counsellor: newLeadData.counsellor || '',
      notes: newLeadData.notes || '',
      remarks: newLeadData.remarks || '',
      documents: newLeadData.documents || []
    };

    setLeads(prev => [finalLead, ...prev]);

    try {
      const res = await fetch(getApiUrl('/api/leads'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalLead)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lead) {
          setLeads(prev => prev.map(l => l.id === finalLead.id ? { ...l, ...data.lead } : l));
        }
        showToast(`Lead for ${finalLead.name} created successfully!`);
        return data.lead || finalLead;
      }
    } catch (err) {
      console.error('Failed to create lead on server:', err);
    }
    showToast(`Lead for ${finalLead.name} created!`);
    return finalLead;
  };

  const handleBulkAddLeads = async (newLeads: Partial<Lead>[]): Promise<{ success: boolean; count: number }> => {
    if (!newLeads || newLeads.length === 0) return { success: false, count: 0 };
    
    try {
      const res = await fetch(getApiUrl('/api/leads/bulk'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: newLeads })
      });
      if (res.ok) {
        const data = await res.json();
        const freshRes = await fetch(getApiUrl('/api/leads'));
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          if (Array.isArray(freshData.leads)) {
            setLeads(freshData.leads);
            safeSaveOfflineLeads(freshData.leads);
          }
        }
        showToast(`Successfully imported ${data.count || newLeads.length} student leads in bulk!`);
        return { success: true, count: data.count || newLeads.length };
      }
    } catch (err) {
      console.error('Failed to import leads in bulk via API:', err);
    }

    // Fallback if backend API is unreachable
    const timestamp = new Date().toISOString();
    const fallbackLeads: Lead[] = newLeads.map((item, idx) => ({
      id: item.id || `lead-bulk-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      name: item.name || `Imported Student #${idx + 1}`,
      email: item.email || '',
      phone: item.phone || '',
      academicLevel: item.academicLevel || 'Undergraduate',
      streamOfInterest: item.streamOfInterest || 'Computer Science & IT',
      degreeOfInterest: item.degreeOfInterest || '',
      score: item.score || '',
      budget: item.budget || '',
      locationPreference: item.locationPreference || '',
      source: item.source || 'Excel Import',
      timestamp: item.timestamp || timestamp,
      status: item.status || 'New',
      disposition: item.disposition || 'New Lead',
      subDisposition: item.subDisposition || 'NA',
      priority: item.priority || 1,
      counsellor: item.counsellor || '',
      notes: item.notes || '',
      remarks: item.remarks || '',
      documents: item.documents || []
    }));

    setLeads(prev => [...fallbackLeads, ...prev]);
    safeSaveOfflineLeads([...fallbackLeads, ...leads]);
    showToast(`Imported ${fallbackLeads.length} student leads locally!`);
    return { success: true, count: fallbackLeads.length };
  };

  const handleUpdateLeadStatus = async (leadId: string, newStatus: Lead['status']) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));

    try {
      const res = await fetch(getApiUrl(`/api/leads/${leadId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        const freshRes = await fetch(getApiUrl('/api/leads'));
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          setLeads(freshData.leads);
          safeSaveOfflineLeads(freshData.leads);
        }
      }
    } catch (err) {
      console.error('Failed to update status on server:', err);
    }
  };

  const handleUpdateLeadDetails = async (leadId: string, updates: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updates } : l));

    try {
      const res = await fetch(getApiUrl(`/api/leads/${leadId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.lead) {
          setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...data.lead } : l));
        }
        const freshRes = await fetch(getApiUrl('/api/leads'));
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          if (Array.isArray(freshData.leads)) {
            setLeads(freshData.leads);
            safeSaveOfflineLeads(freshData.leads);
          }
        }
      }
    } catch (err) {
      console.error('Failed to update lead details on server:', err);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));

    try {
      const res = await fetch(getApiUrl(`/api/leads/${leadId}`), {
        method: 'DELETE',
        headers: {
          'x-user-role': userRole || ''
        }
      });
      if (res.ok) {
        const freshRes = await fetch(getApiUrl('/api/leads'));
        if (freshRes.ok) {
          const freshData = await freshRes.json();
          setLeads(freshData.leads);
          localStorage.setItem('enrol_leads_offline', JSON.stringify(freshData.leads));
        }
      }
    } catch (err) {
      console.error('Failed to delete lead from server:', err);
    }
  };

  const handleClearLeads = async () => {
    setLeads([]);
    localStorage.removeItem('enrol_leads_offline');
    try {
      await fetch(getApiUrl('/api/leads/clear'), { method: 'POST' });
    } catch (err) {
      console.error('Failed to clear leads on server:', err);
    }
  };

  const handleSeedLeadsManual = async () => {
    setIsLoadingLeads(true);
    try {
      const res = await fetch(getApiUrl('/api/leads/seed'), { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads);
        localStorage.setItem('enrol_leads_offline', JSON.stringify(data.leads));
        showToast('Sample seed leads populated in database');
      }
    } catch (err) {
      console.error('Failed to seed leads:', err);
    } finally {
      setIsLoadingLeads(false);
    }
  };

  const handleSaveGoogleSheetUrl = async (url: string): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl('/api/settings/sheets'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (res.ok) {
        const data = await res.json();
        setGoogleSheetUrl(data.googleSheetUrl);
        showToast('Google Sheet Webhook settings saved successfully');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to save Google Sheets URL:', err);
      return false;
    }
  };

  const handleSyncAllLeads = async (): Promise<{ success: boolean; synced: number; failed: number; total: number }> => {
    try {
      const res = await fetch(getApiUrl('/api/leads/sync-all'), { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        return {
          success: true,
          synced: data.synced,
          failed: data.failed,
          total: data.total
        };
      }
      return { success: false, synced: 0, failed: 0, total: 0 };
    } catch (err) {
      console.error('Failed to sync all leads to Google Sheets:', err);
      return { success: false, synced: 0, failed: 0, total: 0 };
    }
  };

  return (
    <div className={`min-h-screen ${isAdminLoggedIn ? 'bg-slate-50 text-slate-800' : 'bg-slate-900 text-slate-100'} flex flex-col font-sans transition-colors duration-300 selection:bg-sky-500 selection:text-white`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div 
          className="fixed bottom-6 right-6 z-50 bg-slate-800 border-l-4 border-sky-500 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce font-medium text-xs max-w-sm"
          id="crm-toast"
        >
          <CheckCircle className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Panel */}
      <header className={`${isAdminLoggedIn ? 'bg-white border-b border-slate-200 text-slate-800' : 'bg-slate-950 border-b border-slate-800'} py-3 px-4 sm:px-6 flex justify-between items-center transition-colors duration-300 shadow-xs`}>
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-600 flex items-center justify-center text-white shadow-sm font-black shrink-0">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={`text-xs sm:text-base font-black tracking-wider uppercase transition-colors duration-300 ${isAdminLoggedIn ? 'text-slate-800' : 'text-white'}`}>
              enrol overseas
            </h1>
            <p className="text-[9px] sm:text-[11px] font-bold text-teal-600 uppercase tracking-widest mt-0.5">
              crm leads dashboard
            </p>
          </div>
        </div>

        {isAdminLoggedIn && (
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 capitalize">
                <span className={`w-2 h-2 rounded-full ${userRole === 'admin' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                {userName}
              </span>
              <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                userRole === 'admin' 
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {userRole === 'admin' ? 'Admin (Full Access)' : 'Counsellor (Masked View)'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-all cursor-pointer shadow-2xs"
              title="Sign out of CRM session"
              id="header-logout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </header>

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col justify-center">
        {!isAdminLoggedIn ? (
          <div className="p-6 md:p-8 w-full">
            <div className="max-w-md w-full mx-auto my-12" id="standalone-login-box">
              <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-teal-900 via-sky-900 to-slate-900 p-8 text-white text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-teal-500 text-white flex items-center justify-center mb-4 shadow-lg shadow-teal-900/40">
                    <GraduationCap className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-black tracking-tight uppercase">crm staff login</h3>
                  <p className="text-[11px] text-teal-200 mt-1.5 font-semibold">Authorized Advisor Portal</p>
                </div>
                
                <form onSubmit={handleLoginSubmit} className="p-8 space-y-5">
                  {loginError && (
                    <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-xs text-red-400 font-semibold flex items-center gap-2 animate-pulse" id="login-error-msg">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Employee Username</label>
                    <input 
                      type="text" 
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="e.g. enroloverseas"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 font-semibold transition-all"
                      id="login-username-input"
                    />
                  </div>
                  
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1.5">Access Password</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? 'text' : 'password'} 
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-4 pr-12 py-3.5 text-xs text-slate-100 outline-none focus:ring-2 focus:ring-sky-500/30 font-mono transition-all"
                        id="login-password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-200 font-bold text-[10px] uppercase select-none cursor-pointer"
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-extrabold text-xs py-4 rounded-xl transition-all cursor-pointer shadow-lg shadow-sky-500/10 hover:shadow-sky-500/20 active:scale-[0.99] mt-2 block uppercase tracking-wider text-center disabled:opacity-50"
                    id="login-submit-btn"
                  >
                    {isAuthenticating ? 'Authenticating...' : 'Enter CRM Dashboard'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full animate-in fade-in duration-300">
            {isLoadingLeads ? (
              <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
                <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-semibold mt-4 animate-pulse">Loading CRM Leads Database...</p>
              </div>
            ) : (
              <AdminLeads 
                leads={leads}
                onAddLead={handleAddLead}
                onBulkAddLeads={handleBulkAddLeads}
                onUpdateLeadStatus={handleUpdateLeadStatus}
                onUpdateLeadDetails={handleUpdateLeadDetails}
                onClearLeads={handleClearLeads}
                onSeedLeads={handleSeedLeadsManual}
                googleSheetUrl={googleSheetUrl}
                onSaveGoogleSheetUrl={handleSaveGoogleSheetUrl}
                onSyncAllLeads={handleSyncAllLeads}
                onDeleteLead={handleDeleteLead}
                userRole={userRole || 'counselor'}
                onRefresh={() => fetchLeads(true)}
                isRefreshing={isRefreshing}
              />
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={`${isAdminLoggedIn ? 'bg-white border-t border-slate-200 text-slate-400' : 'bg-slate-950 border-t border-slate-800 text-slate-500'} py-4 text-center text-[10px] font-medium tracking-wide transition-colors duration-300`}>
        &copy; {new Date().getFullYear()} Enrol Overseas. Internal Corporate Platform.
      </footer>
    </div>
  );
}
