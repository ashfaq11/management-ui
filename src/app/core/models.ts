export type Status = 'booked' | 'completed' | 'cancelled' | 'no_show';
export const STATUSES: Status[] = ['booked', 'completed', 'cancelled', 'no_show'];

export type Role = 'superadmin' | 'admin' | 'staff';
export interface Me { id: number; username: string; role: Role; spa_id: number | null; spa: number | null; spa_name: string | null; }
export interface Spa {
  id: number; name: string; is_active: boolean; created_at: string; admins: number; staff: number; customers: number;
  revenue_this_month: number;
}
export interface Customer {
  id: number; name: string; phone: string; email?: string; gender?: string; dob?: string;
  address?: string; notes?: string; created_at: string; appointments?: Appointment[];
}
export interface Therapist {
  id: number; name: string; phone?: string; fixed_salary: number; incentive_percent: number;
  is_active: boolean; joined_on?: string;
  email?: string; gender?: string; dob?: string; address?: string; specialities?: string; experience_years?: number;
  notes?: string; emergency_name?: string; emergency_phone?: string; id_proof_type?: string; id_proof_number?: string;
  bank_name?: string; bank_account_name?: string; bank_account_number?: string; bank_ifsc?: string; upi_id?: string;
}
export interface Service { id: number; name: string; price: number; duration_min: number; is_active: boolean; }
export interface Appointment {
  id: number; customer_id: number; therapist_id: number; service_id: number; start_at: string;
  duration_min: number; price: number; status: Status; notes?: string;
  customer?: string; phone?: string; therapist?: string; service?: string;
}
export interface Payslip {
  therapist_id: number; therapist: string; month: string; fixed_salary: number; services_count: number;
  service_revenue: number; incentive_percent: number; incentive: number; extra_incentive: number; net_pay: number;
}
export interface IncentiveReport { month: string; therapists: Payslip[]; total_incentive: number; total_payroll: number; }
export interface ServiceTotal { service: string; count: number; revenue: number; }
export interface Summary {
  month: string | null; from: string; to: string; therapist_id: number | null; revenue: number; services_count: number; new_customers: number;
  by_status: { status: string; count: number; amount: number }[];
  by_service: ServiceTotal[];
  /** Completed services per therapist, with a per-service breakdown. */
  by_therapist: { therapist_id: number; therapist: string; count: number; revenue: number; services: ServiceTotal[] }[];
  /** Every completed service in the month: the revenue, line by line. */
  lines: { id: number; start_at: string; price: number; customer: string; service: string; therapist_id: number; therapist: string }[];
}

export interface User { id: number; username: string; role: Role; is_active: boolean; spa_id: number | null; spa: string | null; }
