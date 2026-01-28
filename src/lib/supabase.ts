// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase anahtarlarınız eksik! .env dosyanızı kontrol edin.');
  console.log('.env dosyanızda şunlar olmalı:');
  console.log('VITE_SUPABASE_URL=https://xxxxx.supabase.co');
  console.log('VITE_SUPABASE_ANON_KEY=eyJhbGci...');
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!);