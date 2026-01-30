// src/types.ts
export interface Property {
  id: string;
  user_id: string;
  property_name: string;
  tenant_name: string;
  rent_amount: number;
  next_increase_date: string | null;
  tenant_phone: string | null;
  tenant_email: string | null;
  full_address: string | null;
  payment_day: number;
  contract_start_date: string | null;
  created_at: string;
}

// Eğer Payment interface'ine de ihtiyacınız varsa:
export interface Payment {
  id: string;
  property_id: string;
  month_year: string;
  due_date: string;
  is_paid: boolean;
  created_at: string;
}

// Sadece Property ve Payment yeterli, photo ile ilgili interface'ler kaldırıldı