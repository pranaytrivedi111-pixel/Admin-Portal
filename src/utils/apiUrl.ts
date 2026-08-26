// Shared helper to build fully-qualified API URLs across the app
export const getApiUrl = (path: string): string => {
  const cleanPath = path.replace(/^\//, '');
  const apiBase = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';
  
  // If we are in production / live deployment, always use relative paths for perfect same-origin reliability.
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `/${cleanPath}`;
  }
  const base = apiBase.replace(/\/$/, '');
  return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
};
