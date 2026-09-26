export interface Contact {
  id: string;
  organization_id: string;
  source: string;
  name: string;
  email?: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  organization_id: string;
  contact_id: string;
  source: string;
  status: 'open' | 'closed' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  organization_id: string;
  contact_id: string;
  source: string;
  score: number;
  status: 'new' | 'contacted' | 'qualified' | 'lost' | 'won';
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  organization_id: string;
  name: string;
  source: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  budget?: number;
  spend?: number;
  created_at: string;
  updated_at: string;
}
