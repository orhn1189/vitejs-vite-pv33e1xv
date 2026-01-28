// src/types.ts

// Temel Property tipi (zaten kullanıyorsanız güncelleyin)
export interface Property {
    id: string;
    name: string;
    address: string;
    contract_start_date?: string | null;
    next_increase_date?: string | null;
    payment_day: number;
    rent_amount: number;
    // Diğer alanlarınız varsa buraya ekleyin
    owner_id?: string;
    created_at?: string;
    updated_at?: string;
  }
  
  // YENİ: Fotoğraf tipi
  export interface PropertyPhoto {
    id: string;
    property_id: string;
    photo_url: string;
    photo_type: 'check_in' | 'check_out' | 'damage' | 'general';
    description?: string;
    taken_at: string;
    uploaded_by?: string;
    created_at: string;
  }
  
  // YENİ: Karşılaştırma tipi
  export interface PhotoComparison {
    id: string;
    property_id: string;
    check_in_photo_id: string;
    check_out_photo_id: string;
    has_damage: boolean;
    damage_description?: string;
    estimated_cost?: number;
    status: 'pending' | 'reviewed' | 'resolved';
    compared_by?: string;
    compared_at: string;
  }
  
  // Property tipini genişlet (fotoğraf bilgilerini de içerecek şekilde)
  export interface PropertyWithPhotos extends Property {
    photos?: PropertyPhoto[];
    has_check_in_photos?: boolean;
    has_check_out_photos?: boolean;
    latest_comparison?: PhotoComparison;
  }
  
  // Kullanıcı tipi (varsa)
  export interface User {
    id: string;
    email: string;
    name?: string;
    role?: 'admin' | 'owner' | 'tenant';
  }