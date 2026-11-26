export type Status = 'booked' | 'completed' | 'cancelled' | 'no_show';
export const STATUSES: Status[] = ['booked', 'completed', 'cancelled', 'no_show'];

export interface Me { id: number; username: string; role: 'admin' | 'staff'; }
export interface Customer {
  id: number; name: string; phone: string; email?: string; gender?: string; dob?: string;
  address?: string; notes?: string; created_at: string; appointments?: Appointment[];
}
export interface Therapist {
  id: number; name: string; phone?: string; fixed_salary: number; incentive_percent: number;
  is_active: number; joined_on?: string;
}
export interface Service { id: number; name: string; price: number; duration_min: number; is_active: number; }
export interface Appointment {
  id: number; customer_id: number; therapist_id: number; service_id: number; start_at: string;
  duration_min: number; price: number; status: Status; notes?: string;
  customer?: string; phone?: string; therapist?: string; service?: string;
}
export interface Payslip {
  therapist_id: number; therapist: string; month: string; fixed_salary: number; services_count: number;
  service_revenue: number; incentive_percent: number; incentive: number; net_pay: number;
}
export interface IncentiveReport { month: string; therapists: Payslip[]; total_incentive: number; total_payroll: number; }
export interface Summary {
  month: string; revenue: number; new_customers: number;
  by_status: { status: string; count: number; amount: number }[];
  by_service: { service: string; count: number; revenue: number }[];
}
