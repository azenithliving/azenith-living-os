/**
 * Database Types for Progress + Payment System
 * Table: requests
 */

export type StageNumber = 1 | 2 | 3 | 4;

export interface RequestRecord {
  id: string;
  
  // Client Information
  client_name: string;
  client_email: string;
  client_phone: string;
  
  // Financial
  total_price: number;
  payment_1: number; // 50%
  payment_2: number; // 20%
  payment_3: number; // 20%
  payment_4: number; // 10%
  
  // Progress (Admin Controlled)
  current_stage: StageNumber;
  current_step: number;
  progress_percentage: number;
  
  // Tracking
  company_id: string;
  room_type: string | null;
  service_type: string | null;
  status: string;
  
  // Notification tracking (prevent duplicates)
  last_notification_sent_at: string | null;
  last_notification_type: 'stage_complete' | 'pre_payment' | null;
  last_notified_stage: StageNumber | null;
  last_notified_step: number | null;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface RequestInsert {
  client_name: string;
  client_email: string;
  client_phone: string;
  total_price: number;
  payment_1: number;
  payment_2: number;
  payment_3: number;
  payment_4: number;
  current_stage: StageNumber;
  current_step: number;
  progress_percentage: number;
  company_id: string;
  room_type?: string | null;
  service_type?: string | null;
  status?: string;
}

export interface RequestUpdate {
  current_stage?: StageNumber;
  current_step?: number;
  progress_percentage?: number;
  total_price?: number;
  payment_1?: number;
  payment_2?: number;
  payment_3?: number;
  payment_4?: number;
  last_notification_sent_at?: string | null;
  last_notification_type?: 'stage_complete' | 'pre_payment' | null;
  last_notified_stage?: StageNumber | null;
  last_notified_step?: number | null;
  updated_at?: string;
}
