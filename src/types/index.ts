import type { CustomerStatus } from "@/lib/status";

export interface Business {
  id: string;
  name: string;
  owner_id: string;
  role?: string;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  status: CustomerStatus;
  source: string | null;
  value: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LogType = "note" | "call" | "email" | "meeting" | "status_change";
export type LogDirection = "outbound" | "inbound";

export interface ContactLog {
  id: string;
  customer_id: string;
  business_id: string;
  user_id: string | null;
  type: LogType;
  direction: LogDirection;
  subject: string | null;
  body: string | null;
  created_at: string;
}

export interface BusinessProfile {
  id?: string;
  business_id: string;
  industry: string;
  description: string;
  value_proposition: string;
  icp: string;
  target_titles: string;
  locations: string;
  website: string;
}

export interface Prospect {
  company: string;
  website: string | null;
  why_fit: string;
  owner_name: string | null;
  owner_title: string | null;
  phone: string | null;
  email: string | null;
  source_urls: string[];
  confidence: "low" | "medium" | "high";
  notes: string | null;
}

export interface EmailTemplate {
  id: string;
  business_id: string;
  name: string;
  subject: string;
  body: string;
}

export interface Attachment {
  id: string;
  business_id: string;
  customer_id: string;
  file_id: string;
  name: string;
  size: number;
  mime: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  business_id: string;
  customer_id: string | null;
  user_id: string | null;
  title: string;
  due_at: string | null;
  done: boolean;
  created_at: string;
}
