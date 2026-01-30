// @ts-nocheck
import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// TYPES
interface Property {
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

interface Payment {
  id: string;
  property_id: string;
  month_year: string;
  due_date: string;
  is_paid: boolean;
  created_at: string;
}

const supabaseUrl = 'https://pwnffmzmrclvzsrikbdc.supabase.co';
const supabaseKey = 'sb_publishable_JMQYVqglFtTZsHhUv-o-JQ_fCR-PFqk';
const supabase = createClient(supabaseUrl, supabaseKey);

const FREE_LIMIT = 2;

// --- YENİ EKLENEN ÖZELLİKLER İÇİN HOOK'LAR ---
const useDeviceType = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkDevice = () => setIsMobile(window.innerWidth < 768);
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);
  
  return { isMobile, isDesktop: !isMobile };
};

const useDarkMode = () => {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return { darkMode, toggleDarkMode: () => setDarkMode(!darkMode) };
};
// --- HOOK'LAR SONU ---

// --- YENİ EKLENEN FONKSİYONLAR ---
// TÜFE hesaplama fonksiyonu (simüle edilmiş)
const calculateTufeIncrease = (currentRent, startDate) => {
  const start = new Date(startDate);
  const now = new Date();
  const monthsDiff = Math.floor((now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
  
  if (monthsDiff < 12) return { increase: 0, percentage: 0, newRent: currentRent };
  
  const increaseCycles = Math.floor(monthsDiff / 12);
  // Simüle TÜFE oranları (gerçekte API'den çekilebilir)
  const tufeRates = [25.5, 35.0, 50.2, 45.8, 30.5];
  let totalIncrease = 0;
  
  for (let i = 0; i < Math.min(increaseCycles, tufeRates.length); i++) {
    totalIncrease += tufeRates[i];
  }
  
  const averageIncrease = totalIncrease / Math.min(increaseCycles, tufeRates.length);
  const newRent = Math.round(currentRent * (1 + averageIncrease / 100));
  const increaseAmount = newRent - currentRent;
  
  return {
    increase: increaseAmount,
    percentage: averageIncrease.toFixed(1),
    newRent: newRent,
    canIncrease: monthsDiff >= 12
  };
};

// Risk skoru hesaplama fonksiyonu
const calculateRiskScore = (property, payments) => {
  let score = 50; // Başlangıç puanı
  
  // Geç ödeme analizi
  const latePayments = payments.filter(p => !p.is_paid && new Date(p.due_date) < new Date());
  score -= latePayments.length * 15;
  
  // Ödeme düzeni (son 6 ay)
  const recentPayments = payments.slice(-6);
  const onTimePayments = recentPayments.filter(p => p.is_paid).length;
  score += (onTimePayments / 6) * 20;
  
  // İletişim bilgisi tamlığı
  if (property.tenant_phone && property.tenant_email) score += 10;
  else if (property.tenant_phone || property.tenant_email) score += 5;
  
  // Kira miktarına göre risk
  if (property.rent_amount > 10000) score -= 5;
  else if (property.rent_amount < 3000) score += 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
};

// Hatırlatıcı motoru
const generateReminders = (property, payments) => {
  const reminders = [];
  const today = new Date();
  
  // Ödeme hatırlatıcıları
  const upcomingPayment = payments.find(p => !p.is_paid && new Date(p.due_date) > today);
  if (upcomingPayment) {
    const daysUntilDue = Math.ceil((new Date(upcomingPayment.due_date) - today) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= 3) {
      reminders.push({
        type: 'payment',
        title: 'Ödeme Yaklaşıyor',
        message: `${property.property_name} için ${daysUntilDue} gün sonra ödeme var`,
        priority: daysUntilDue === 1 ? 'high' : 'medium',
        date: upcomingPayment.due_date
      });
    }
  }
  
  // Kira artışı hatırlatıcısı
  if (property.next_increase_date) {
    const increaseDate = new Date(property.next_increase_date);
    const daysUntilIncrease = Math.ceil((increaseDate - today) / (1000 * 60 * 60 * 24));
    if (daysUntilIncrease <= 30 && daysUntilIncrease > 0) {
      reminders.push({
        type: 'increase',
        title: 'Kira Artışı Yaklaşıyor',
        message: `${property.property_name} için ${daysUntilIncrease} gün sonra kira artışı yapılabilir`,
        priority: 'medium',
        date: property.next_increase_date
      });
    }
  }
  
  // Hukuki süreç hatırlatıcıları
  const lateDays = payments.filter(p => !p.is_paid && new Date(p.due_date) < today).length;
  if (lateDays >= 2) {
    reminders.push({
      type: 'legal',
      title: 'Hukuki İşlem Gerekiyor',
      message: `${property.property_name} için ${lateDays} aydır ödeme alınamıyor`,
      priority: 'high',
      date: today.toISOString().split('T')[0]
    });
  }
  
  return reminders;
};

// Hukuki zamanlayıcı fonksiyonları
const calculateLegalTimeline = (lastPaymentDate) => {
  const lastDate = new Date(lastPaymentDate);
  const today = new Date();
  const daysPassed = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
  
  const timeline = [
    { day: 0, action: 'Son Ödeme', status: 'completed' },
    { day: 7, action: 'İhtar Gönderimi', status: daysPassed >= 7 ? 'completed' : 'pending' },
    { day: 30, action: 'Tahliye Davası Açma', status: daysPassed >= 30 ? 'overdue' : 'pending' },
    { day: 90, action: 'Kesinleşmiş Karar', status: daysPassed >= 90 ? 'overdue' : 'pending' },
    { day: 120, action: 'Tahliye Uygulaması', status: daysPassed >= 120 ? 'overdue' : 'pending' }
  ];
  
  return { timeline, daysPassed };
};

// Akıllı belge oluşturma fonksiyonu
const generateSmartDocument = (property, documentType) => {
  const baseDocs = {
    KIRA_SOZLESMESI: "https://docs.google.com/document/d/1X_U9BqC9QvK6q6N0-D9F5K4A6-w7B-R9/export?format=pdf",
    TAHLIYE_TAAHHUDU: "https://docs.google.com/document/d/1vC9J7Z-O4Z8N0wJ6vV9YyS7uI8Z0_Kx4R1/export?format=pdf",
    IHTAR_MEKTUBU: "https://docs.google.com/document/d/1ABC123DEF456/export?format=pdf",
    CIKIS_TUTANAGI: "https://docs.google.com/document/d/1XYZ789UVW012/export?format=pdf"
  };
  
  const docUrl = baseDocs[documentType];
  if (!docUrl) return null;
  
  // Gerçek uygulamada burada PDF'ye otomatik veri doldurma işlemi yapılır
  const filledDocUrl = `${docUrl}&property_name=${encodeURIComponent(property.property_name)}&tenant_name=${encodeURIComponent(property.tenant_name)}&rent_amount=${property.rent_amount}&date=${new Date().toISOString().split('T')[0]}`;
  
  return {
    url: filledDocUrl,
    type: documentType,
    name: getDocumentName(documentType),
    properties: {
      property_name: property.property_name,
      tenant_name: property.tenant_name,
      rent_amount: property.rent_amount,
      address: property.full_address,
      date: new Date().toLocaleDateString('tr-TR')
    }
  };
};

const getDocumentName = (type) => {
  const names = {
    KIRA_SOZLESMESI: 'Kira Sözleşmesi',
    TAHLIYE_TAAHHUDU: 'Tahliye Taahhütnamesi',
    IHTAR_MEKTUBU: 'İhtar Mektubu',
    CIKIS_TUTANAGI: 'Çıkış Tutanağı'
  };
  return names[type] || type;
};
// --- YENİ FONKSİYONLAR SONU ---

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [properties, setProperties] = useState<Property[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeProperty, setActiveProperty] = useState<Property | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    property_name: '', tenant_name: '', rent_amount: '', 
    next_increase_date: '', tenant_phone: '', tenant_email: '', 
    full_address: '', payment_day: 1, contract_start_date: ''
  });
  
  // YENİ STATE'LER
  const [showLegalTimer, setShowLegalTimer] = useState<Property | null>(null);
  const [showIncreaseCalculator, setShowIncreaseCalculator] = useState<Property | null>(null);
  const [showDocumentGenerator, setShowDocumentGenerator] = useState<Property | null>(null);
  const [allReminders, setAllReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const { isMobile, isDesktop } = useDeviceType();
  const { darkMode, toggleDarkMode } = useDarkMode();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { 
    if (user) { 
      fetchProperties(); 
      fetchPayments(); 
    } 
  }, [user]);

  useEffect(() => {
    if (properties.length > 0 && payments.length > 0) {
      const newReminders = [];
      properties.forEach(property => {
        const propertyPayments = payments.filter(p => p.property_id === property.id);
        newReminders.push(...generateReminders(property, propertyPayments));
      });
      setAllReminders(newReminders);
    }
  }, [properties, payments]);

  async function fetchProperties() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('properties').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching properties:', error);
        setFormError('Veriler yüklenirken bir hata oluştu');
        return;
      }
      setProperties(data || []);
    } catch (err) {
      console.error('Error in fetchProperties:', err);
      setFormError('Veriler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPayments() {
    try {
      const { data } = await supabase.from('payments').select('*').order('due_date', { ascending: true });
      setPayments(data || []);
    } catch (err) {
      console.error('Error in fetchPayments:', err);
    }
  }

  const checkStatus = (propertyId: string) => {
    const today = new Date();
    const currentMonthStr = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    const property = properties.find(p => p.id === propertyId);
    const monthPayment = payments.find(pay => pay.property_id === propertyId && pay.month_year === currentMonthStr);

    if (monthPayment?.is_paid) return { label: 'Ödendi', color: '#10b981', bg: darkMode ? '#064e3b' : '#ecfdf5' };
    if (today.getDate() > (property?.payment_day || 1)) return { label: 'Gecikti', color: '#ef4444', bg: darkMode ? '#7f1d1d' : '#fef2f2' };
    return { label: 'Bekliyor', color: '#64748b', bg: darkMode ? '#334155' : '#f1f5f9' };
  };

  async function createPlan(propertyId: string, startDay: number) {
    try {
      const today = new Date();
      const plan = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, startDay);
        plan.push({
          property_id: propertyId,
          month_year: `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`,
          due_date: d.toISOString().split('T')[0],
          is_paid: false
        });
      }
      const { error } = await supabase.from('payments').insert(plan);
      if (error) {
        console.error('Error creating payment plan:', error);
        setFormError('Ödeme planı oluşturulurken bir hata oluştu');
      }
      fetchPayments();
    } catch (err) {
      console.error('Error in createPlan:', err);
      setFormError('Ödeme planı oluşturulurken bir hata oluştu');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFormError('');
    
    try {
      const payload = { 
        ...formData, 
        rent_amount: Number(formData.rent_amount), 
        payment_day: Number(formData.payment_day), 
        user_id: user.id 
      };
      
      console.log('Submitting payload:', payload);
      
      if (editingId) {
        // Güncelleme işlemi
        const { data, error } = await supabase
          .from('properties')
          .update(payload)
          .eq('id', editingId)
          .select();
        
        if (error) {
          console.error('Update error:', error);
          setFormError(`Güncelleme hatası: ${error.message}`);
          return;
        }
        
        console.log('Update successful:', data);
      } else {
        // Yeni kayıt işlemi
        const { data, error } = await supabase
          .from('properties')
          .insert([payload])
          .select();
        
        if (error) {
          console.error('Insert error:', error);
          setFormError(`Kayıt hatası: ${error.message}`);
          return;
        }
        
        console.log('Insert successful:', data);
        
        if (data && data[0]) {
          await createPlan(data[0].id, formData.payment_day);
        }
      }
      
      closeForm();
      fetchProperties();
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      setFormError(`İşlem hatası: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (window.confirm("Bu mülkü kalıcı olarak silmek istediğinize emin misiniz?")) {
      setLoading(true);
      try {
        // Önce bu mülke ait ödemeleri sil
        const { error: paymentsError } = await supabase
          .from('payments')
          .delete()
          .eq('property_id', editingId);
        
        if (paymentsError) {
          console.error('Error deleting payments:', paymentsError);
        }
        
        // Sonra mülkü sil
        const { error } = await supabase
          .from('properties')
          .delete()
          .eq('id', editingId);
        
        if (error) {
          console.error('Delete error:', error);
          setFormError(`Silme hatası: ${error.message}`);
          return;
        }
        
        closeForm();
        fetchProperties();
      } catch (err) {
        console.error('Error in handleDelete:', err);
        setFormError(`Silme işlemi hatası: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  }

  const openEditForm = (p: Property) => {
    setEditingId(p.id);
    setFormData({
      property_name: p.property_name || '', 
      tenant_name: p.tenant_name || '',
      rent_amount: p.rent_amount?.toString() || '', 
      next_increase_date: p.next_increase_date || '',
      tenant_phone: p.tenant_phone || '', 
      tenant_email: p.tenant_email || '',
      full_address: p.full_address || '', 
      payment_day: p.payment_day || 1,
      contract_start_date: p.contract_start_date || ''
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ 
      property_name: '', tenant_name: '', rent_amount: '', 
      next_increase_date: '', tenant_phone: '', tenant_email: '', 
      full_address: '', payment_day: 1, contract_start_date: ''
    });
    setFormError('');
  };

  // YENİ FONKSİYON: Risk skorunu getir
  const getRiskScoreData = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    if (!property) return { score: 50, level: 'medium', color: '#f59e0b' };
    
    const propertyPayments = payments.filter(p => p.property_id === propertyId);
    const score = calculateRiskScore(property, propertyPayments);
    
    let level = 'low';
    let color = '#10b981';
    
    if (score < 40) {
      level = 'high';
      color = '#ef4444';
    } else if (score < 70) {
      level = 'medium';
      color = '#f59e0b';
    }
    
    return { score, level, color };
  };

  // YENİ FONKSİYON: Hatırlatıcıları işaretle
  const markReminderAsDone = (reminderId: string) => {
    setAllReminders(prev => prev.filter(r => 
      `${r.propertyId}-${r.type}-${r.date}` !== reminderId
    ));
  };

  // Dinamik stil oluşturma
  const styles = useMemo(() => {
    const baseStyles = {
      layoutStyle: { 
        display: 'flex', 
        height: '100vh', 
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc', 
        fontFamily: 'system-ui',
        flexDirection: isMobile ? 'column' : 'row'
      },
      sidebarStyle: { 
        width: isMobile ? '100%' : '270px',
        height: isMobile ? 'auto' : '100vh',
        backgroundColor: darkMode ? '#1e293b' : '#0f172a', 
        display: 'flex', 
        flexDirection: isMobile ? 'row' : 'column',
        padding: isMobile ? '15px' : '30px', 
        justifyContent: 'space-between',
        alignItems: isMobile ? 'center' : 'flex-start',
        flexShrink: 0,
        zIndex: 1000
      },
      logoStyle: { 
        color: '#fff', 
        fontSize: isMobile ? '20px' : '24px', 
        fontWeight: '900',
        margin: isMobile ? '0' : '0 0 20px 0'
      },
      navItem: { 
        padding: isMobile ? '10px' : '15px', 
        color: '#94a3b8', 
        cursor: 'pointer', 
        borderRadius: '12px', 
        marginBottom: isMobile ? '0' : '8px',
        marginRight: isMobile ? '10px' : '0',
        fontSize: isMobile ? '14px' : 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      },
      navActive: { 
        padding: isMobile ? '10px' : '15px', 
        backgroundColor: darkMode ? '#334155' : '#1e293b', 
        color: '#fff', 
        cursor: 'pointer', 
        borderRadius: '12px', 
        marginBottom: isMobile ? '0' : '8px',
        marginRight: isMobile ? '10px' : '0',
        fontSize: isMobile ? '14px' : 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      },
      premBtn: { 
        padding: isMobile ? '10px' : '15px', 
        color: '#f59e0b', 
        fontWeight: 'bold', 
        cursor: 'pointer', 
        borderRadius: '12px', 
        marginBottom: isMobile ? '0' : '8px',
        marginRight: isMobile ? '10px' : '0',
        fontSize: isMobile ? '14px' : 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      },
      mainContent: { 
        flex: 1, 
        padding: isMobile ? '20px' : '50px', 
        overflowY: 'auto',
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc'
      },
      header: { 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'flex-start' : 'center', 
        marginBottom: '40px',
        gap: isMobile ? '20px' : '0'
      },
      statsGrid: { 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
        gap: '20px', 
        marginBottom: '30px' 
      },
      featuresGrid: {
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: '20px',
        marginBottom: '30px'
      },
      card: { 
        background: darkMode ? '#1e293b' : '#fff', 
        borderRadius: '24px', 
        padding: isMobile ? '20px' : '25px', 
        border: darkMode ? '1px solid #334155' : '1px solid #f1f5f9', 
        boxShadow: darkMode ? '0 4px 6px rgba(0,0,0,0.3)' : '0 4px 6px rgba(0,0,0,0.02)',
        color: darkMode ? '#e2e8f0' : '#1e293b'
      },
      labelStyle: { 
        color: darkMode ? '#94a3b8' : '#64748b', 
        fontSize: '11px', 
        fontWeight: '800' 
      },
      table: { 
        width: '100%', 
        borderCollapse: 'collapse', 
        textAlign: 'left', 
        fontSize: isMobile ? '12px' : '14px',
        overflowX: isMobile ? 'auto' : 'visible',
        display: 'block'
      },
      td: { 
        padding: isMobile ? '10px' : '15px',
        borderBottom: darkMode ? '1px solid #334155' : '1px solid #f1f5f9'
      },
      th: { 
        padding: isMobile ? '10px' : '15px', 
        color: darkMode ? '#94a3b8' : '#64748b', 
        fontSize:'11px', 
        fontWeight:800,
        borderBottom: darkMode ? '2px solid #334155' : '2px solid #f1f5f9'
      },
      primaryBtn: { 
        backgroundColor: '#2563eb', 
        color: '#fff', 
        border: 'none', 
        padding: isMobile ? '10px 20px' : '12px 25px', 
        borderRadius: '15px', 
        fontWeight: '700', 
        cursor: 'pointer',
        fontSize: isMobile ? '14px' : 'inherit'
      },
      actionBtn: { 
        background: darkMode ? '#334155' : '#f1f5f9', 
        border: 'none', 
        padding: isMobile ? '6px 12px' : '8px 15px', 
        borderRadius: '10px', 
        color: darkMode ? '#e2e8f0' : '#1e293b', 
        fontSize: isMobile ? '11px' : '12px', 
        fontWeight: 'bold', 
        marginRight: isMobile ? '3px' : '5px',
        marginBottom: isMobile ? '5px' : '0'
      },
      overlay: { 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: darkMode ? 'rgba(0,0,0,0.8)' : 'rgba(15,23,42,0.6)', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        zIndex: 1000, 
        backdropFilter:'blur(4px)'
      },
      modal: { 
        background: darkMode ? '#1e293b' : 'white', 
        padding: isMobile ? '25px' : '40px', 
        borderRadius: isMobile ? '20px' : '35px', 
        width: isMobile ? '90%' : '480px',
        maxWidth: isMobile ? '400px' : '480px',
        maxHeight: isMobile ? '80vh' : 'auto',
        overflowY: 'auto',
        color: darkMode ? '#e2e8f0' : '#1e293b'
      },
      input: { 
        padding: '12px', 
        borderRadius: '12px', 
        border: darkMode ? '1px solid #475569' : '1px solid #e2e8f0', 
        width: '100%', 
        boxSizing: 'border-box', 
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        color: darkMode ? '#e2e8f0' : '#1e293b'
      },
      payRow: { 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '15px', 
        borderBottom: darkMode ? '1px solid #334155' : '1px solid #f1f5f9', 
        alignItems:'center'
      },
      logoutBtn: { 
        background: 'none', 
        border: darkMode ? '1px solid #475569' : '1px solid #334155', 
        color: '#94a3b8', 
        padding: isMobile ? '8px 12px' : '10px', 
        borderRadius: '12px', 
        cursor: 'pointer',
        fontSize: isMobile ? '12px' : 'inherit'
      },
      riskIndicator: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 'bold'
      },
      reminderCard: {
        padding: '15px',
        borderRadius: '12px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        borderLeft: '4px solid'
      },
      timelineStep: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        padding: '10px 0',
        borderBottom: darkMode ? '1px solid #334155' : '1px solid #f1f5f9'
      }
    };

    return baseStyles;
  }, [darkMode, isMobile]);

  if (!user) return <AuthScreen darkMode={darkMode} isMobile={isMobile} />;

  const totalMonthly = properties.reduce((sum, p) => sum + Number(p.rent_amount || 0), 0);
  const chartData = properties.map(p => ({ 
    name: p.property_name?.substring(0,6) || 'Mülk', 
    miktar: Number(p.rent_amount || 0) 
  }));
  
  // Risk skoru verileri
  const riskData = properties.map(p => {
    const scoreData = getRiskScoreData(p.id);
    return {
      name: p.property_name?.substring(0,8) || 'Mülk',
      score: scoreData.score,
      level: scoreData.level,
      color: scoreData.color
    };
  });

  // Hatırlatıcı sayısı
  const highPriorityReminders = allReminders.filter(r => r.priority === 'high').length;

  return (
    <div style={styles.layoutStyle}>
      <aside style={styles.sidebarStyle}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'center' : 'flex-start', width: isMobile ? '100%' : 'auto' }}>
          {!isMobile && <h2 style={styles.logoStyle}>RentGuard<span>.pro</span></h2>}
          <nav style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-start' }}>
            {isMobile && <h2 style={{...styles.logoStyle, fontSize: '18px', margin: 0}}>RG.pro</h2>}
            <div onClick={() => setActiveTab('dashboard')} style={activeTab === 'dashboard' ? styles.navActive : styles.navItem}>
              {isMobile ? '🏠' : '🏠 Dashboard'}
            </div>
            <div onClick={() => setActiveTab('reminders')} style={activeTab === 'reminders' ? styles.navActive : styles.navItem}>
              {isMobile ? '🔔' : '🔔 Hatırlatıcılar'} 
              {highPriorityReminders > 0 && (
                <span style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  marginLeft: '5px'
                }}>
                  {highPriorityReminders}
                </span>
              )}
            </div>
            <div onClick={() => setActiveTab('docs')} style={activeTab === 'docs' ? styles.navActive : styles.navItem}>
              {isMobile ? '📄' : '📄 Belgeler'}
            </div>
            {!isPremium && (
              <div onClick={() => setShowPaywall(true)} style={styles.premBtn}>
                {isMobile ? '⭐' : '⭐ Premium'}
              </div>
            )}
            <div onClick={toggleDarkMode} style={styles.navItem}>
              {darkMode ? (isMobile ? '☀️' : '☀️ Aydınlık') : (isMobile ? '🌙' : '🌙 Koyu')}
            </div>
          </nav>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={styles.logoutBtn}>
          {isMobile ? 'Çıkış' : 'Çıkış Yap'}
        </button>
      </aside>

      <main style={styles.mainContent}>
        <header style={styles.header}>
          <div>
            <h1 style={{margin:0, fontSize: isMobile ? '24px' : '28px', fontWeight: 900, color: darkMode ? '#e2e8f0' : '#1e293b'}}>
              {activeTab === 'dashboard' ? 'Yönetim Paneli' : 
               activeTab === 'reminders' ? 'Hatırlatıcılar' : 'Belge Şablonları'}
            </h1>
            <small style={{color: darkMode ? '#94a3b8' : '#64748b'}}>
              {user.email} {isPremium ? '👑' : ''}
            </small>
          </div>
          {activeTab === 'dashboard' && (
            <button 
              onClick={() => (!isPremium && properties.length >= FREE_LIMIT) ? setShowPaywall(true) : setShowForm(true)} 
              style={styles.primaryBtn}
            >
              {isMobile ? '+ Ekle' : '+ Yeni Mülk Ekle'}
            </button>
          )}
        </header>

        {/* Hata gösterimi */}
        {formError && (
          <div style={{
            backgroundColor: darkMode ? '#7f1d1d' : '#fef2f2',
            border: '1px solid #ef4444',
            color: darkMode ? '#fecaca' : '#dc2626',
            padding: '15px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            ⚠️ {formError}
            <button 
              onClick={() => setFormError('')}
              style={{
                marginLeft: '10px',
                background: 'none',
                border: 'none',
                color: darkMode ? '#fecaca' : '#dc2626',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Kapat
            </button>
          </div>
        )}

        {/* Yükleme göstergesi */}
        {loading && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            marginBottom: '20px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #f3f3f3',
              borderTop: '3px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {activeTab === 'dashboard' ? (
          <>
            {/* Stats Grid */}
            <div style={styles.statsGrid}>
              <div style={styles.card}>
                <small style={styles.labelStyle}>AYLIK GELİR</small>
                <h3 style={{color: darkMode ? '#e2e8f0' : '#1e293b', fontSize: isMobile ? '24px' : 'inherit'}}>
                  {totalMonthly.toLocaleString()} ₺
                </h3>
              </div>
              <div style={styles.card}>
                <small style={styles.labelStyle}>GECİKEN</small>
                <h3 style={{color:'#ef4444', fontSize: isMobile ? '24px' : 'inherit'}}>
                  {properties.filter(p => checkStatus(p.id).label === 'Gecikti').length}
                </h3>
              </div>
              <div style={styles.card}>
                <small style={styles.labelStyle}>YÜKSEK RİSK</small>
                <h3 style={{color:'#ef4444', fontSize: isMobile ? '24px' : 'inherit'}}>
                  {riskData.filter(r => r.level === 'high').length}
                </h3>
              </div>
            </div>

            {/* Yeni Özellikler Grid */}
            <div style={styles.featuresGrid}>
              {/* Risk Skorları */}
              <div style={styles.card}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'}}>
                  <span style={{fontSize: '24px', color: darkMode ? '#f59e0b' : '#f59e0b'}}>⚠️</span>
                  <h4 style={{margin: 0, color: darkMode ? '#e2e8f0' : '#1e293b'}}>Kiracı Risk Skorları</h4>
                </div>
                <div style={{height: '200px'}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.score}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="score"
                      >
                        {riskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: darkMode ? '#1e293b' : '#fff',
                          border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                          color: darkMode ? '#e2e8f0' : '#1e293b'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Hatırlatıcılar */}
              <div style={styles.card}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'}}>
                  <span style={{fontSize: '24px', color: darkMode ? '#2563eb' : '#2563eb'}}>🔔</span>
                  <h4 style={{margin: 0, color: darkMode ? '#e2e8f0' : '#1e293b'}}>Aktif Hatırlatıcılar</h4>
                </div>
                <div style={{maxHeight: '200px', overflowY: 'auto'}}>
                  {allReminders.slice(0, 3).map((reminder, index) => (
                    <div 
                      key={index}
                      style={{
                        ...styles.reminderCard,
                        backgroundColor: reminder.priority === 'high' 
                          ? (darkMode ? '#7f1d1d' : '#fef2f2') 
                          : (darkMode ? '#334155' : '#f1f5f9'),
                        borderLeftColor: reminder.priority === 'high' ? '#ef4444' : 
                                        reminder.priority === 'medium' ? '#f59e0b' : '#2563eb'
                      }}
                    >
                      <div style={{flex: 1}}>
                        <div style={{fontWeight: 'bold', fontSize: '14px'}}>{reminder.title}</div>
                        <div style={{fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b'}}>
                          {reminder.message}
                        </div>
                      </div>
                      <button 
                        onClick={() => markReminderAsDone(`${reminder.propertyId}-${reminder.type}-${reminder.date}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: darkMode ? '#94a3b8' : '#64748b',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ✓
                      </button>
                    </div>
                  ))}
                  {allReminders.length === 0 && (
                    <div style={{textAlign: 'center', padding: '20px', color: darkMode ? '#94a3b8' : '#64748b'}}>
                      Aktif hatırlatıcı bulunmuyor
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Mülk Listesi */}
            <div style={{...styles.card, overflowX: isMobile ? 'auto' : 'visible', marginTop: '20px'}}>
              <h4 style={{marginBottom:'20px', color: darkMode ? '#e2e8f0' : '#1e293b'}}>Mülk Listesi</h4>
              {properties.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: darkMode ? '#94a3b8' : '#64748b',
                  backgroundColor: darkMode ? '#334155' : '#f8fafc',
                  borderRadius: '12px'
                }}>
                  📍 Henüz mülk eklenmemiş. Yeni mülk eklemek için "Yeni Mülk Ekle" butonuna tıklayın.
                </div>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>MÜLK / KİRACI</th>
                      <th style={styles.th}>RİSK</th>
                      {!isMobile && <th style={styles.th}>İLETİŞİM</th>}
                      <th style={styles.th}>KİRA</th>
                      <th style={styles.th}>İŞLEMLER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map(p => {
                      const status = checkStatus(p.id);
                      const riskScore = getRiskScoreData(p.id);
                      const tufeIncrease = p.contract_start_date ? calculateTufeIncrease(p.rent_amount, p.contract_start_date) : null;
                      
                      return (
                        <tr key={p.id}>
                          <td style={styles.td}>
                            <b style={{color: darkMode ? '#e2e8f0' : '#1e293b'}}>{p.property_name}</b>
                            <br/>
                            <small style={{color: darkMode ? '#94a3b8' : '#64748b'}}>
                              {p.tenant_name}
                            </small>
                          </td>
                          <td style={styles.td}>
                            <div style={{
                              ...styles.riskIndicator,
                              backgroundColor: riskScore.color + '20',
                              color: riskScore.color
                            }}>
                              <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: riskScore.color
                              }} />
                              {riskScore.score}/100
                            </div>
                          </td>
                          {!isMobile && (
                            <td style={styles.td}>
                              <div style={{fontSize:'12px', lineHeight:'1.5'}}>
                                📞 {p.tenant_phone || '-'}<br/>
                                <span 
                                  style={{
                                    cursor:'pointer', 
                                    color:'#2563eb', 
                                    fontWeight:'bold'
                                  }} 
                                  onClick={() => setSelectedAddress(p.full_address)}
                                >
                                  📍 Adres Gör
                                </span>
                              </div>
                            </td>
                          )}
                          <td style={styles.td}>
                            <b style={{color: darkMode ? '#e2e8f0' : '#1e293b'}}>
                              {Number(p.rent_amount || 0).toLocaleString()} ₺
                            </b>
                            {tufeIncrease?.canIncrease && (
                              <div style={{fontSize: '11px', color: '#f59e0b', fontWeight: 'bold'}}>
                                +{tufeIncrease.percentage}% TÜFE
                              </div>
                            )}
                          </td>
                          <td style={styles.td}>
                            <button onClick={() => setActiveProperty(p)} style={styles.actionBtn}>
                              {isMobile ? '💰' : '💰 Plan'}
                            </button>
                            <button onClick={() => openEditForm(p)} style={{...styles.actionBtn, color:'#2563eb'}}>
                              {isMobile ? '⚙️' : '⚙️ Düzenle'}
                            </button>
                            <button onClick={() => setShowIncreaseCalculator(p)} style={{...styles.actionBtn, color:'#10b981'}}>
                              {isMobile ? '🧮' : '🧮 Zam'}
                            </button>
                            <button onClick={() => setShowDocumentGenerator(p)} style={{...styles.actionBtn, color:'#8b5cf6'}}>
                              {isMobile ? '📄' : '📄 Belge'}
                            </button>
                            {isMobile && p.full_address && (
                              <button 
                                onClick={() => setSelectedAddress(p.full_address)} 
                                style={{...styles.actionBtn, color:'#2563eb'}}
                              >
                                📍
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Gelir Dağılımı */}
            <div style={{...styles.card, height: isMobile ? '250px' : '280px', marginTop:'20px'}}>
              <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b'}}>Gelir Dağılımı</h4>
              {properties.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={chartData}>
                    <XAxis 
                      dataKey="name" 
                      fontSize={10} 
                      axisLine={false} 
                      tickLine={false}
                      stroke={darkMode ? '#94a3b8' : '#666'}
                    />
                    <YAxis 
                      stroke={darkMode ? '#94a3b8' : '#666'}
                    />
                    <Tooltip 
                      cursor={{fill: darkMode ? '#334155' : '#f8fafc'}}
                      contentStyle={{
                        backgroundColor: darkMode ? '#1e293b' : '#fff',
                        border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                        color: darkMode ? '#e2e8f0' : '#1e293b'
                      }}
                    />
                    <Bar dataKey="miktar" fill="#2563eb" radius={[6,6,0,0]} barSize={isMobile ? 30 : 40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '80%',
                  color: darkMode ? '#94a3b8' : '#64748b'
                }}>
                  Grafik için veri bulunmuyor
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'reminders' ? (
          <div style={styles.card}>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px'}}>
              <span style={{fontSize: '28px', color: darkMode ? '#2563eb' : '#2563eb'}}>🔔</span>
              <h3 style={{margin: 0, color: darkMode ? '#e2e8f0' : '#1e293b'}}>Tüm Hatırlatıcılar</h3>
            </div>
            
            <div style={styles.featuresGrid}>
              <div>
                <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b', marginBottom: '20px'}}>Yüksek Öncelikli</h4>
                {allReminders.filter(r => r.priority === 'high').map((reminder, index) => (
                  <div 
                    key={index}
                    style={{
                      ...styles.reminderCard,
                      backgroundColor: darkMode ? '#7f1d1d' : '#fef2f2',
                      borderLeftColor: '#ef4444'
                    }}
                  >
                    <span style={{fontSize: '20px', color: '#ef4444'}}>⚠️</span>
                    <div style={{flex: 1}}>
                      <div style={{fontWeight: 'bold', fontSize: '14px'}}>{reminder.title}</div>
                      <div style={{fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b'}}>
                        {reminder.message}
                      </div>
                      <div style={{fontSize: '11px', color: darkMode ? '#94a3b8' : '#64748b', marginTop: '5px'}}>
                        Tarih: {new Date(reminder.date).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                    <button 
                      onClick={() => markReminderAsDone(`${reminder.propertyId}-${reminder.type}-${reminder.date}`)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: darkMode ? '#94a3b8' : '#64748b',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      ✓ Tamamlandı
                    </button>
                  </div>
                ))}
              </div>
              
              <div>
                <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b', marginBottom: '20px'}}>Orta Öncelikli</h4>
                {allReminders.filter(r => r.priority === 'medium').map((reminder, index) => (
                  <div 
                    key={index}
                    style={{
                      ...styles.reminderCard,
                      backgroundColor: darkMode ? '#334155' : '#f1f5f9',
                      borderLeftColor: '#f59e0b'
                    }}
                  >
                    <span style={{fontSize: '20px', color: '#f59e0b'}}>⏰</span>
                    <div style={{flex: 1}}>
                      <div style={{fontWeight: 'bold', fontSize: '14px'}}>{reminder.title}</div>
                      <div style={{fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b'}}>
                        {reminder.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={styles.card}>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px'}}>
              <span style={{fontSize: '28px', color: darkMode ? '#8b5cf6' : '#8b5cf6'}}>📄</span>
              <h3 style={{margin: 0, color: darkMode ? '#e2e8f0' : '#1e293b'}}>Akıllı Belge Oluşturucu</h3>
            </div>
            
            <div style={styles.statsGrid}>
              {properties.map(property => (
                <div key={property.id} style={{...styles.card, textAlign:'center', border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0'}}>
                  <div style={{fontSize:'30px', marginBottom:'10px'}}>🏠</div>
                  <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b'}}>{property.property_name}</h4>
                  <p style={{fontSize:'12px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom:'20px'}}>
                    {property.tenant_name}
                  </p>
                  
                  <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                    <button 
                      onClick={() => {
                        const doc = generateSmartDocument(property, 'KIRA_SOZLESMESI');
                        if (doc) window.open(doc.url, '_blank');
                      }}
                      style={{...styles.primaryBtn, fontSize: '14px', padding: '10px'}}
                    >
                      📄 Kira Sözleşmesi
                    </button>
                    <button 
                      onClick={() => {
                        const doc = generateSmartDocument(property, 'IHTAR_MEKTUBU');
                        if (doc) window.open(doc.url, '_blank');
                      }}
                      style={{...styles.primaryBtn, fontSize: '14px', padding: '10px', backgroundColor: '#f59e0b'}}
                    >
                      ⚠️ İhtar Mektubu
                    </button>
                    <button 
                      onClick={() => {
                        const doc = generateSmartDocument(property, 'TAHLIYE_TAAHHUDU');
                        if (doc) window.open(doc.url, '_blank');
                      }}
                      style={{...styles.primaryBtn, fontSize: '14px', padding: '10px', backgroundColor: '#8b5cf6'}}
                    >
                      📝 Tahliye Taahhüdü
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* --- ADRES MODAL --- */}
      {selectedAddress !== null && (
        <div style={styles.overlay} onClick={() => setSelectedAddress(null)}>
          <div style={{...styles.modal, width: isMobile ? '90%' : '400px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginTop:0, borderBottom: darkMode ? '1px solid #334155' : '1px solid #f1f5f9', paddingBottom:'10px', color: darkMode ? '#e2e8f0' : '#1e293b'}}>
              📍 Mülk Adresi
            </h3>
            <p style={{lineHeight:'1.7', color: darkMode ? '#cbd5e1' : '#1e293b', padding:'10px 0'}}>
              {selectedAddress || "Adres bilgisi girilmemiş."}
            </p>
            <button 
              style={{...styles.primaryBtn, width:'100%'}} 
              onClick={() => setSelectedAddress(null)}
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* --- ÖDEME PLANI MODAL --- */}
      {activeProperty && (
        <div style={styles.overlay} onClick={() => setActiveProperty(null)}>
          <div style={{...styles.modal, width: isMobile ? '95%' : '600px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom:'20px', borderBottom: darkMode ? '1px solid #334155' : '1px solid #eee', paddingBottom:'10px', color: darkMode ? '#e2e8f0' : '#1e293b'}}>
              {activeProperty.property_name} - Ödeme Takvimi
            </h3>
            <div style={{maxHeight:'350px', overflowY:'auto', marginBottom: '20px'}}>
              {payments.filter(pay => pay.property_id === activeProperty.id).map(pay => (
                <div key={pay.id} style={styles.payRow}>
                  <div>
                    <b style={{color: darkMode ? '#e2e8f0' : '#1e293b'}}>{pay.month_year}</b>
                    <div style={{fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b'}}>
                      {new Date(pay.due_date).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <small style={{fontWeight:700, color: pay.is_paid ? '#10b981' : '#ef4444'}}>
                      {pay.is_paid ? 'Ödendi' : 'Bekliyor'}
                    </small>
                    <input 
                      type="checkbox" 
                      checked={pay.is_paid} 
                      onChange={async () => {
                        const { error } = await supabase.from('payments').update({ is_paid: !pay.is_paid }).eq('id', pay.id);
                        if (!error) fetchPayments();
                      }} 
                      style={{
                        width:'20px', 
                        height:'20px', 
                        cursor:'pointer',
                        accentColor: '#2563eb'
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
            
            {/* Hukuki Zamanlayıcı */}
            <div style={{marginTop: '20px', paddingTop: '20px', borderTop: darkMode ? '1px solid #334155' : '1px solid #f1f5f9'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px'}}>
                <span style={{fontSize: '20px', color: darkMode ? '#8b5cf6' : '#8b5cf6'}}>⏳</span>
                <h4 style={{margin: 0, color: darkMode ? '#e2e8f0' : '#1e293b'}}>Hukuki Süreç Zamanlayıcı</h4>
              </div>
              <button 
                onClick={() => setShowLegalTimer(activeProperty)}
                style={{...styles.primaryBtn, width: '100%', backgroundColor: '#8b5cf6'}}
              >
                ⏳ Hukuki Süreci Görüntüle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TÜFE ZAM HESAPLAYICI MODAL --- */}
      {showIncreaseCalculator && (
        <div style={styles.overlay} onClick={() => setShowIncreaseCalculator(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'}}>
              <span style={{fontSize: '24px', color: '#10b981'}}>🧮</span>
              <h3 style={{margin: 0, color: darkMode ? '#e2e8f0' : '#1e293b'}}>
                TÜFE Zam Hesaplayıcı
              </h3>
            </div>
            
            {showIncreaseCalculator.contract_start_date ? (
              <>
                <div style={{marginBottom: '20px'}}>
                  <p style={{color: darkMode ? '#cbd5e1' : '#1e293b'}}>
                    <strong>{showIncreaseCalculator.property_name}</strong> için TÜFE zam analizi:
                  </p>
                  
                  {(() => {
                    const calculation = calculateTufeIncrease(
                      showIncreaseCalculator.rent_amount,
                      showIncreaseCalculator.contract_start_date
                    );
                    
                    return (
                      <div style={{
                        backgroundColor: darkMode ? '#334155' : '#f1f5f9',
                        padding: '20px',
                        borderRadius: '12px',
                        marginTop: '15px'
                      }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                          <span style={{color: darkMode ? '#94a3b8' : '#64748b'}}>Mevcut Kira:</span>
                          <span style={{fontWeight: 'bold', color: darkMode ? '#e2e8f0' : '#1e293b'}}>
                            {showIncreaseCalculator.rent_amount.toLocaleString()} ₺
                          </span>
                        </div>
                        
                        {calculation.canIncrease ? (
                          <>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                              <span style={{color: darkMode ? '#94a3b8' : '#64748b'}}>TÜFE Artış Oranı:</span>
                              <span style={{fontWeight: 'bold', color: '#f59e0b'}}>
                                %{calculation.percentage}
                              </span>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                              <span style={{color: darkMode ? '#94a3b8' : '#64748b'}}>Zam Miktarı:</span>
                              <span style={{fontWeight: 'bold', color: '#10b981'}}>
                                +{calculation.increase.toLocaleString()} ₺
                              </span>
                            </div>
                            <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '20px'}}>
                              <span style={{color: darkMode ? '#94a3b8' : '#64748b'}}>Yeni Kira:</span>
                              <span style={{fontWeight: 'bold', color: '#2563eb', fontSize: '18px'}}>
                                {calculation.newRent.toLocaleString()} ₺
                              </span>
                            </div>
                            
                            <button 
                              onClick={() => {
                                alert(`Kira ${calculation.newRent.toLocaleString()} ₺ olarak güncellenecek.`);
                                setShowIncreaseCalculator(null);
                              }}
                              style={{...styles.primaryBtn, width: '100%', backgroundColor: '#10b981'}}
                            >
                              💰 Kirayı Güncelle
                            </button>
                          </>
                        ) : (
                          <div style={{textAlign: 'center', padding: '20px', color: darkMode ? '#94a3b8' : '#64748b'}}>
                            <p>Kira artışı için henüz süre dolmadı.</p>
                            <p style={{fontSize: '12px', marginTop: '10px'}}>
                              (En az 12 ay gereklidir)
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </>
            ) : (
              <div style={{textAlign: 'center', padding: '20px', color: darkMode ? '#94a3b8' : '#64748b'}}>
                <p>Sözleşme başlangıç tarihi girilmemiş.</p>
                <p style={{fontSize: '12px', marginTop: '10px'}}>
                  Lütfen mülk bilgilerini düzenleyerek sözleşme başlangıç tarihini ekleyin.
                </p>
              </div>
            )}
            
            <button 
              onClick={() => setShowIncreaseCalculator(null)}
              style={{...styles.primaryBtn, width: '100%', marginTop: '20px', backgroundColor: darkMode ? '#475569' : '#64748b'}}
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* --- HUKUKİ ZAMANLAYICI MODAL --- */}
      {showLegalTimer && (
        <div style={styles.overlay} onClick={() => setShowLegalTimer(null)}>
          <div style={{...styles.modal, width: isMobile ? '95%' : '700px'}} onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'}}>
              <span style={{fontSize: '24px', color: '#8b5cf6'}}>⏳</span>
              <h3 style={{margin: 0, color: darkMode ? '#e2e8f0' : '#1e293b'}}>
                {showLegalTimer.property_name} - Hukuki Süreç Zamanlayıcı
              </h3>
            </div>
            
            <div style={{marginBottom: '30px'}}>
              <p style={{color: darkMode ? '#cbd5e1' : '#1e293b'}}>
                Bu zamanlayıcı, ödeme alınamadığı takdirde izlenmesi gereken hukuki süreçleri gösterir.
              </p>
            </div>
            
            <div>
              <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b', marginBottom: '20px'}}>Hukuki Süreç Adımları</h4>
              
              {(() => {
                // Son ödeme tarihini bul
                const propertyPayments = payments.filter(p => p.property_id === showLegalTimer.id);
                const lastPaidPayment = propertyPayments.filter(p => p.is_paid).pop();
                
                if (!lastPaidPayment) {
                  return (
                    <div style={{textAlign: 'center', padding: '20px', color: darkMode ? '#94a3b8' : '#64748b'}}>
                      Ödeme kaydı bulunamadı.
                    </div>
                  );
                }
                
                const timeline = calculateLegalTimeline(lastPaidPayment.due_date);
                
                return (
                  <div>
                    <div style={{
                      backgroundColor: darkMode ? '#334155' : '#f1f5f9',
                      padding: '15px',
                      borderRadius: '12px',
                      marginBottom: '20px'
                    }}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}>
                        <span style={{color: darkMode ? '#94a3b8' : '#64748b'}}>Son Ödeme Tarihi:</span>
                        <span style={{fontWeight: 'bold', color: darkMode ? '#e2e8f0' : '#1e293b'}}>
                          {new Date(lastPaidPayment.due_date).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '5px'}}>
                        <span style={{color: darkMode ? '#94a3b8' : '#64748b'}}>Geçen Süre:</span>
                        <span style={{fontWeight: 'bold', color: timeline.daysPassed > 30 ? '#ef4444' : '#f59e0b'}}>
                          {timeline.daysPassed} gün
                        </span>
                      </div>
                    </div>
                    
                    {timeline.timeline.map((step, index) => (
                      <div key={index} style={styles.timelineStep}>
                        <div style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: step.status === 'completed' ? '#10b981' : 
                                         step.status === 'overdue' ? '#ef4444' : 
                                         darkMode ? '#334155' : '#e2e8f0',
                          color: step.status === 'pending' ? (darkMode ? '#94a3b8' : '#64748b') : '#fff',
                          fontWeight: 'bold',
                          fontSize: '12px'
                        }}>
                          {step.status === 'completed' ? '✓' : 
                           step.status === 'overdue' ? '!' : index + 1}
                        </div>
                        <div style={{flex: 1}}>
                          <div style={{fontWeight: 'bold', color: darkMode ? '#e2e8f0' : '#1e293b'}}>
                            {step.action}
                          </div>
                          <div style={{fontSize: '12px', color: darkMode ? '#94a3b8' : '#64748b'}}>
                            {step.day}. gün
                          </div>
                        </div>
                        <div style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: step.status === 'completed' ? '#10b98120' : 
                                         step.status === 'overdue' ? '#ef444420' : 
                                         darkMode ? '#334155' : '#f1f5f9',
                          color: step.status === 'completed' ? '#10b981' : 
                                 step.status === 'overdue' ? '#ef4444' : 
                                 darkMode ? '#94a3b8' : '#64748b'
                        }}>
                          {step.status === 'completed' ? 'Tamamlandı' : 
                           step.status === 'overdue' ? 'Süre Doldu' : 'Bekliyor'}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <button 
              onClick={() => setShowLegalTimer(null)}
              style={{...styles.primaryBtn, width: '100%', marginTop: '30px'}}
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* --- AKILLI BELGE OLUŞTURUCU MODAL --- */}
      {showDocumentGenerator && (
        <div style={styles.overlay} onClick={() => setShowDocumentGenerator(null)}>
          <div style={{...styles.modal, width: isMobile ? '95%' : '600px'}} onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px'}}>
              <span style={{fontSize: '24px', color: '#8b5cf6'}}>📄</span>
              <h3 style={{margin: 0, color: darkMode ? '#e2e8f0' : '#1e293b'}}>
                {showDocumentGenerator.property_name} - Belge Oluştur
              </h3>
            </div>
            
            <div style={{marginBottom: '20px'}}>
              <p style={{color: darkMode ? '#cbd5e1' : '#1e293b'}}>
                Aşağıdaki belgeler otomatik olarak doldurulacak ve PDF olarak indirilecektir.
              </p>
            </div>
            
            <div style={{display: 'grid', gap: '15px'}}>
              <div style={{
                backgroundColor: darkMode ? '#334155' : '#f1f5f9',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #2563eb'
              }}>
                <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b', marginTop: 0}}>📄 Kira Sözleşmesi</h4>
                <p style={{fontSize: '14px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '20px'}}>
                  Güncel mevzuata uygun standart kira kontratı. Otomatik olarak kiracı ve mülk bilgileri doldurulacak.
                </p>
                <button 
                  onClick={() => {
                    const doc = generateSmartDocument(showDocumentGenerator, 'KIRA_SOZLESMESI');
                    if (doc) window.open(doc.url, '_blank');
                  }}
                  style={{...styles.primaryBtn, width: '100%'}}
                >
                  📥 PDF Olarak İndir
                </button>
              </div>
              
              <div style={{
                backgroundColor: darkMode ? '#334155' : '#f1f5f9',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #f59e0b'
              }}>
                <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b', marginTop: 0}}>⚠️ İhtar Mektubu</h4>
                <p style={{fontSize: '14px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '20px'}}>
                  Ödeme gecikmesi durumunda gönderilecek resmi ihtar mektubu şablonu.
                </p>
                <button 
                  onClick={() => {
                    const doc = generateSmartDocument(showDocumentGenerator, 'IHTAR_MEKTUBU');
                    if (doc) window.open(doc.url, '_blank');
                  }}
                  style={{...styles.primaryBtn, width: '100%', backgroundColor: '#f59e0b'}}
                >
                  📥 İhtar Mektubunu İndir
                </button>
              </div>
              
              <div style={{
                backgroundColor: darkMode ? '#334155' : '#f1f5f9',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #8b5cf6'
              }}>
                <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b', marginTop: 0}}>📝 Tahliye Taahhütnamesi</h4>
                <p style={{fontSize: '14px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom: '20px'}}>
                  Kiracının kendi rızasıyla çıkış yapması durumunda imzalanacak taahhütname.
                </p>
                <button 
                  onClick={() => {
                    const doc = generateSmartDocument(showDocumentGenerator, 'TAHLIYE_TAAHHUDU');
                    if (doc) window.open(doc.url, '_blank');
                  }}
                  style={{...styles.primaryBtn, width: '100%', backgroundColor: '#8b5cf6'}}
                >
                  📥 Tahliye Taahhüdünü İndir
                </button>
              </div>
            </div>
            
            <button 
              onClick={() => setShowDocumentGenerator(null)}
              style={{...styles.primaryBtn, width: '100%', marginTop: '20px', backgroundColor: darkMode ? '#475569' : '#64748b'}}
            >
              Kapat
            </button>
          </div>
        </div>
      )}

      {/* --- FORM MODAL --- */}
      {showForm && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{marginBottom:'20px', color: darkMode ? '#e2e8f0' : '#1e293b'}}>
              {editingId ? 'Bilgileri Düzenle' : 'Yeni Mülk Kaydı'}
            </h3>
            
            {formError && (
              <div style={{
                backgroundColor: darkMode ? '#7f1d1d' : '#fef2f2',
                border: '1px solid #ef4444',
                color: darkMode ? '#fecaca' : '#dc2626',
                padding: '10px',
                borderRadius: '8px',
                marginBottom: '15px',
                fontSize: '13px'
              }}>
                ⚠️ {formError}
              </div>
            )}
            
            <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
              <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'15px'}}>
                <input 
                  placeholder="Mülk Adı *" 
                  style={styles.input} 
                  value={formData.property_name} 
                  onChange={e => setFormData({...formData, property_name: e.target.value})} 
                  required 
                  disabled={loading}
                />
                <input 
                  placeholder="Kiracı *" 
                  style={styles.input} 
                  value={formData.tenant_name} 
                  onChange={e => setFormData({...formData, tenant_name: e.target.value})} 
                  required 
                  disabled={loading}
                />
              </div>
              <textarea 
                placeholder="Tam Adres" 
                style={{...styles.input, height:'60px', resize:'none'}} 
                value={formData.full_address} 
                onChange={e => setFormData({...formData, full_address: e.target.value})} 
                disabled={loading}
              />
              <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'15px'}}>
                <input 
                  placeholder="Telefon" 
                  style={styles.input} 
                  value={formData.tenant_phone} 
                  onChange={e => setFormData({...formData, tenant_phone: e.target.value})} 
                  disabled={loading}
                />
                <input 
                  placeholder="E-posta" 
                  style={styles.input} 
                  value={formData.tenant_email} 
                  onChange={e => setFormData({...formData, tenant_email: e.target.value})} 
                  disabled={loading}
                />
              </div>
              <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'15px'}}>
                <div>
                  <label style={{display:'block', fontSize:'12px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom:'5px'}}>Sözleşme Başlangıç Tarihi</label>
                  <input 
                    type="date" 
                    style={styles.input} 
                    value={formData.contract_start_date} 
                    onChange={e => setFormData({...formData, contract_start_date: e.target.value})} 
                    disabled={loading}
                  />
                </div>
                <div>
                  <label style={{display:'block', fontSize:'12px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom:'5px'}}>Bir Sonraki Zam Tarihi</label>
                  <input 
                    type="date" 
                    style={styles.input} 
                    value={formData.next_increase_date} 
                    onChange={e => setFormData({...formData, next_increase_date: e.target.value})} 
                    disabled={loading}
                  />
                </div>
              </div>
              <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'15px'}}>
                <div>
                  <label style={{display:'block', fontSize:'12px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom:'5px'}}>Ödeme Günü (1-31)</label>
                  <input 
                    type="number" 
                    placeholder="1-31" 
                    style={styles.input} 
                    value={formData.payment_day} 
                    onChange={e => setFormData({...formData, payment_day: e.target.value})} 
                    min="1" 
                    max="31" 
                    disabled={loading}
                  />
                </div>
                <div>
                  <label style={{display:'block', fontSize:'12px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom:'5px'}}>Kira Miktarı (₺) *</label>
                  <input 
                    type="number" 
                    placeholder="Kira" 
                    style={styles.input} 
                    value={formData.rent_amount} 
                    onChange={e => setFormData({...formData, rent_amount: e.target.value})} 
                    required 
                    disabled={loading}
                  />
                </div>
              </div>
              <button 
                type="submit" 
                style={{...styles.primaryBtn, opacity: loading ? 0.7 : 1}} 
                disabled={loading}
              >
                {loading ? 'İşleniyor...' : editingId ? 'Güncelle' : 'Kaydet'}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  onClick={handleDelete} 
                  style={{...styles.primaryBtn, backgroundColor: '#ef4444', opacity: loading ? 0.7 : 1}} 
                  disabled={loading}
                >
                  🗑️ Mülkü Sil
                </button>
              )}
              <button 
                type="button" 
                onClick={closeForm} 
                style={{background:'none', border:'none', color: darkMode ? '#94a3b8' : '#64748b', cursor:'pointer'}} 
                disabled={loading}
              >
                İptal
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PAYWALL */}
      {showPaywall && (
        <div style={styles.overlay}>
          <div style={{...styles.modal, textAlign:'center', border:'2px solid #f59e0b'}}>
            <div style={{fontSize:'40px'}}>👑</div>
            <h2 style={{color: darkMode ? '#e2e8f0' : '#1e293b'}}>Premium'a Geçin</h2>
            <p style={{color: darkMode ? '#94a3b8' : '#64748b'}}>2 mülk sınırına ulaştınız.</p>
            <button 
              onClick={() => {setIsPremium(true); setShowPaywall(false);}} 
              style={{...styles.primaryBtn, background:'#f59e0b', width:'100%'}}
            >
              Yükselt (199₺/Ay)
            </button>
            <button 
              onClick={() => setShowPaywall(false)} 
              style={{
                background:'none', 
                border:'none', 
                marginTop:'15px', 
                color: darkMode ? '#94a3b8' : '#64748b'
              }}
            >
              Daha Sonra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AuthScreen({ darkMode, isMobile }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setAuthError(error.message);
      }
    } catch (err) {
      setAuthError('Giriş işlemi sırasında bir hata oluştu');
    } finally {
      setAuthLoading(false);
    }
  };
  
  const authStyles = {
    container: {
      height: '100vh', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      backgroundColor: darkMode ? '#0f172a' : '#f8fafc'
    },
    card: {
      background: darkMode ? '#1e293b' : 'white', 
      padding: isMobile ? '30px' : '40px', 
      borderRadius: isMobile ? '20px' : '35px', 
      width: isMobile ? '90%' : '350px', 
      maxWidth: '400px',
      boxShadow: darkMode ? '0 25px 50px -12px rgba(0,0,0,0.5)' : '0 25px 50px -12px rgba(0,0,0,0.1)'
    },
    title: {
      textAlign: 'center', 
      fontWeight: '900', 
      marginBottom: '30px',
      color: darkMode ? '#e2e8f0' : '#1e293b'
    },
    input: {
      padding: '12px', 
      borderRadius: '12px', 
      border: darkMode ? '1px solid #475569' : '1px solid #e2e8f0', 
      width: '100%', 
      boxSizing: 'border-box', 
      backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
      color: darkMode ? '#e2e8f0' : '#1e293b',
      marginBottom: '15px'
    },
    primaryBtn: {
      backgroundColor: '#2563eb', 
      color: '#fff', 
      border: 'none', 
      padding: '12px 25px', 
      borderRadius: '15px', 
      fontWeight: '700', 
      cursor: 'pointer',
      width: '100%'
    }
  };

  return (
    <div style={authStyles.container}>
      <div style={authStyles.card}>
        <h2 style={authStyles.title}>
          RentGuard<span style={{color:'#2563eb'}}>.pro</span>
        </h2>
        
        {authError && (
          <div style={{
            backgroundColor: darkMode ? '#7f1d1d' : '#fef2f2',
            border: '1px solid #ef4444',
            color: darkMode ? '#fecaca' : '#dc2626',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '15px',
            fontSize: '13px'
          }}>
            ⚠️ {authError}
          </div>
        )}
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column' }}>
          <input 
            placeholder="E-posta" 
            style={authStyles.input} 
            onChange={e => setEmail(e.target.value)} 
            type="email"
            required
            disabled={authLoading}
          />
          <input 
            type="password" 
            placeholder="Şifre" 
            style={authStyles.input} 
            onChange={e => setPassword(e.target.value)} 
            required
            disabled={authLoading}
          />
          <button 
            style={{...authStyles.primaryBtn, opacity: authLoading ? 0.7 : 1}} 
            disabled={authLoading}
          >
            {authLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}