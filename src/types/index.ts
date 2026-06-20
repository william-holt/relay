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

export interface ContactLog {
  id: string;
  customer_id: string;
  business_id: string;
  user_id: string | null;
  type: LogType;
  subject: string | null;
  body: string | null;
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
