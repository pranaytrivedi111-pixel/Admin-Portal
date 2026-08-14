import React, { useState, useEffect } from 'react';
import { 
  Lock, AlertCircle, LogOut, CheckCircle, Database 
} from 'lucide-react';
import { Lead } from './types';
import logoImg from './assets/images/enrol_logo_1784056705876.jpg';
import AdminLeads from './components/AdminLeads';

// Configurable API base URL to allow separate hosting of the admin portal
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function App() {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'counselor' | null>('admin');
  const [userName, setUserName] = useState<string>('enroloverseas');
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
        setLeads(data.leads || []);
        setGoogleSheetUrl(data.googleSheetUrl || '');
        localStorage.setItem('enrol_leads_offline', JSON.stringify(data.leads || []));
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

    if (!adminUsername.trim() || !adminPassword.trim()) {
      setLoginError('Please enter both employee username and access password.');
      setIsAuthenticating(false);
      return;
    }

    try {
      const response = await fetch(getApiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
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
        // Safe offline validation fallback if server is down/unreachable, but ONLY with correct credentials
        if (adminUsername === 'enroloverseas' && adminPassword === 'enroloverseas123') {
          setUserRole('admin');
          setUserName('enroloverseas');
          setIsAdminLoggedIn(true);
          sessionStorage.setItem('crm_admin_user', 'enroloverseas');
          sessionStorage.setItem('crm_admin_role', 'admin');
          showToast('Welcome back, enroloverseas! (Offline mode active)');
        } else if (adminUsername === 'counselor' && adminPassword === 'counselor123') {
          setUserRole('counselor');
          setUserName('counselor');
          setIsAdminLoggedIn(true);
          sessionStorage.setItem('crm_admin_user', 'counselor');
          sessionStorage.setItem('crm_admin_role', 'counselor');
          showToast('Welcome back, counselor! (Offline mode active)');
        } else {
          setLoginError('Invalid username or password.');
        }
      }
    } catch (err) {
      console.warn('Authentication API error. Doing safe offline credential validation:', err);
      // Safe offline validation fallback
      if (adminUsername === 'enroloverseas' && adminPassword === 'enroloverseas123') {
        setUserRole('admin');
        setUserName('enroloverseas');
        setIsAdminLoggedIn(true);
        sessionStorage.setItem('crm_admin_user', 'enroloverseas');
        sessionStorage.setItem('crm_admin_role', 'admin');
        showToast('Welcome back, enroloverseas! (Offline fallback active)');
      } else if (adminUsername === 'counselor' && adminPassword === 'counselor123') {
        setUserRole('counselor');
        setUserName('counselor');
        setIsAdminLoggedIn(true);
        sessionStorage.setItem('crm_admin_user', 'counselor');
        sessionStorage.setItem('crm_admin_role', 'counselor');
        showToast('Welcome back, counselor! (Offline fallback active)');
      } else {
        setLoginError('Invalid username or password.');
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

  // API operations matching App.tsx perfectly
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
          localStorage.setItem('enrol_leads_offline', JSON.stringify(freshData.leads));
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
            localStorage.setItem('enrol_leads_offline', JSON.stringify(freshData.leads));
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
      <header className={`${isAdminLoggedIn ? 'bg-white border-b border-slate-200 text-slate-800' : 'bg-slate-950 border-b border-slate-800'} py-4 px-6 flex justify-between items-center transition-colors duration-300 shadow-sm`}>
        <div className="flex items-center gap-4">
          <img 
            src={logoImg} 
            alt="Enrol Overseas" 
            className="h-14 sm:h-20 md:h-24 w-auto rounded-xl object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="border-l border-slate-200 dark:border-slate-800 h-10 mx-1"></div>
          <div>
            <h1 className={`text-sm sm:text-base font-black tracking-wider uppercase transition-colors duration-300 ${isAdminLoggedIn ? 'text-slate-800' : 'text-white'}`}>enrol overseas</h1>
            <p className="text-[10px] sm:text-[11px] font-bold text-sky-500 uppercase tracking-widest mt-0.5">crm leads dashboard</p>
          </div>
        </div>

        {isAdminLoggedIn && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold text-slate-700 capitalize">{userName}</span>
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mt-0.5">{userRole} account</span>
            </div>
          </div>
        )}
      </header>

      {/* Main View Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col justify-center">
        {!isAdminLoggedIn ? (
          <div className="p-6 md:p-8 w-full">
            <div className="max-w-md w-full mx-auto my-12" id="standalone-login-box">
              <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-sky-800 to-sky-600 p-8 text-white text-center flex flex-col items-center">
                  <img 
                    src={logoImg} 
                    alt="Enrol Overseas Logo" 
                    className="max-w-[260px] sm:max-w-[300px] w-full h-auto object-contain rounded-2xl shadow-xl mb-4"
                    referrerPolicy="no-referrer"
                  />
                  <h3 className="text-xl font-black tracking-tight uppercase">crm staff login</h3>
                  <p className="text-[11px] text-sky-100 mt-1.5 font-semibold">Authorized Advisor Portal</p>
                </div>
                
                <form onSubmit={handleLoginSubmit} className="p-8 space-y-5">
                  {loginError && (
                    <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-xs text-red-400 font-semibold flex items-center gap-2 animate-pulse" id="login-error-msg">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}
                  
                  <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-[11px] text-slate-300 font-medium leading-relaxed" id="api-endpoint-badge">
                    <div className="flex items-center gap-1.5 mb-1 text-slate-200">
                      <Database className="w-3.5 h-3.5 text-sky-400" />
                      <span className="font-bold text-slate-100">Database Connection Target:</span>
                    </div>
                    <code className="text-[10px] font-mono text-sky-300 break-all bg-slate-950 px-2 py-1 rounded block mt-1">
                      {API_BASE_URL || 'Local / Current Site Domain (Relative Routing)'}
                    </code>
                  </div>

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
