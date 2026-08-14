export interface College {
  id: string;
  name: string;
  location: string;
  logo: string;
  stream: string;
  degree: string;
  naacGrade: string;
  nirfRanking: number;
  avgFee: string; // e.g. "₹1.5 Lakhs/year"
  highestPackage: string; // e.g. "₹44 LPA"
  established: number;
  rating: number;
  description: string;
  highlights: string[];
  requirements: string;
}

export type StreamType = 'Engineering' | 'Management' | 'Computer Applications' | 'Medicine' | 'Law' | 'Design' | 'Arts & Science';

export interface LeadDocument {
  id: string;
  name: string;
  size: number; // in bytes
  type: string; // file mime type or extension
  dataUrl: string; // Base64 data URL for preview/download
  uploadedAt: string;
  category?: 'Passport' | 'Academic Marksheet' | 'Degree Transcript' | 'Language Test' | 'SOP & Resume' | 'Financial & Bank' | 'Offer Letter / Visa' | 'General';
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  academicLevel: string;
  streamOfInterest: string;
  degreeOfInterest: string;
  score: string; // e.g. "85%"
  budget: string; // fee per year
  locationPreference: string;
  source: 'direct_apply' | 'eligibility_calculator' | 'ai_chat' | 'callback' | 'contact' | 'engagement_hub';
  timestamp: string;
  status: 'New' | 'Contacted' | 'In Progress' | 'Enrolled' | 'Rejected';
  notes?: string;
  remarks?: string;
  followUpDate?: string;
  disposition?: string;
  subDisposition?: string;
  priority?: number;
  collegeId?: string;
  collegeName?: string;
  counsellor?: string;
  documents?: LeadDocument[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

export interface EligibilityResult {
  score: number; // 0 to 100
  percentage: number;
  stream: string;
  eligibleColleges: College[];
  scholarshipChance: string;
  message: string;
}
