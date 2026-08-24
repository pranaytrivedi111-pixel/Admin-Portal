/**
 * Privacy and Data Masking utilities for Counselor Role
 * Masks sensitive contact information like Email and Phone Number
 */

export function maskEmail(email?: string): string {
  if (!email || !email.trim()) return 'N/A';
  const clean = email.trim();
  const atIndex = clean.indexOf('@');
  if (atIndex === -1) {
    // If not a standard email format
    if (clean.length <= 4) return '***';
    return `${clean.slice(0, 2)}***${clean.slice(-1)}`;
  }

  const user = clean.slice(0, atIndex);
  const domain = clean.slice(atIndex); // includes '@'

  if (user.length <= 2) {
    return `${user[0] || '*'}***${domain}`;
  }
  if (user.length <= 4) {
    return `${user.slice(0, 1)}***${user.slice(-1)}${domain}`;
  }
  return `${user.slice(0, 2)}*****${user.slice(-1)}${domain}`;
}

export function maskPhone(phone?: string): string {
  if (!phone || !phone.trim()) return 'N/A';
  const clean = phone.trim();
  
  // Extract all digits to determine length
  const digits = clean.replace(/\D/g, '');
  
  if (digits.length <= 4) {
    return '******';
  }

  // If formatted like "+91 98765 43210" or "+91 9876543210"
  if (clean.startsWith('+')) {
    const parts = clean.split(' ');
    if (parts.length > 1) {
      const countryCode = parts[0];
      const rest = parts.slice(1).join('');
      if (rest.length >= 6) {
        return `${countryCode} ${rest.slice(0, 2)}*****${rest.slice(-2)}`;
      }
      return `${countryCode} ******${rest.slice(-2)}`;
    }
  }

  // General format: show first 2 digits, asterisks, last 2 digits
  if (clean.length > 6) {
    return `${clean.slice(0, 3)}*****${clean.slice(-2)}`;
  }
  return `${clean.slice(0, 2)}****`;
}
