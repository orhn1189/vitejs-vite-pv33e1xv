// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const supabaseUrl = 'https://pwnffmzmrclvzsrikbdc.supabase.co';
const supabaseKey = 'sb_publishable_JMQYVqglFtTZsHhUv-o-JQ_fCR-PFqk';
const supabase = createClient(supabaseUrl, supabaseKey);

const FREE_LIMIT = 2;

/* =====================
   🔥 CİHAZ & KOYU MOD ALGILAMA (EK)
===================== */
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
const isDark =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

/* =====================
   🎨 RENK DEĞERLERİ (EK)
===================== */
const COLORS = {
  bg: isDark ? '#020617' : '#f8fafc',
  card: isDark ? '#020617' : '#ffffff',
  text: isDark ? '#e5e7eb' : '#0f172a',
  muted: isDark ? '#94a3b8' : '#64748b',
  border: isDark ? '#1e293b' : '#f1f5f9'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeProperty, setActiveProperty] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    property_name: '',
    tenant_name: '',
    rent_amount: '',
    next_increase_date: '',
    tenant_phone: '',
    tenant_email: '',
    full_address: '',
    payment_day: 1
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) =>
      setUser(session?.user ?? null)
    );
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_e, s) =>
        setUser(s?.user ?? null)
      );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchProperties();
      fetchPayments();
    }
  }, [user]);

  async function fetchProperties() {
    const { data } = await supabase
      .from('properties')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setProperties(data || []);
  }

  async function fetchPayments() {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .order('due_date', { ascending: true });
    setPayments(data || []);
  }

  const checkStatus = (propertyId) => {
    const today = new Date();
    const currentMonthStr = `${String(
      today.getMonth() + 1
    ).padStart(2, '0')}-${today.getFullYear()}`;
    const property = properties.find((p) => p.id === propertyId);
    const monthPayment = payments.find(
      (pay) =>
        pay.property_id === propertyId &&
        pay.month_year === currentMonthStr
    );

    if (monthPayment?.is_paid)
      return { label: 'Ödendi', color: '#10b981', bg: '#ecfdf5' };
    if (today.getDate() > (property?.payment_day || 1))
      return { label: 'Gecikti', color: '#ef4444', bg: '#fef2f2' };
    return { label: 'Bekliyor', color: COLORS.muted, bg: COLORS.border };
  };

  if (!user) return <AuthScreen />;

  const totalMonthly = properties.reduce(
    (sum, p) => sum + Number(p.rent_amount),
    0
  );

  const chartData = properties.map((p) => ({
    name: p.property_name.substring(0, 6),
    miktar: Number(p.rent_amount)
  }));

  return (
    <div style={layoutStyle}>
      <aside style={sidebarStyle}>
        <div>
          <h2 style={logoStyle}>RentGuard<span>.pro</span></h2>
          <nav>
            <div
              onClick={() => setActiveTab('dashboard')}
              style={activeTab === 'dashboard' ? navActive : navItem}
            >
              🏠 Dashboard
            </div>
            <div
              onClick={() => setActiveTab('docs')}
              style={activeTab === 'docs' ? navActive : navItem}
            >
              📄 Belgeler
            </div>
            {!isPremium && (
              <div onClick={() => setShowPaywall(true)} style={premBtn}>
                ⭐ Premium
              </div>
            )}
          </nav>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          style={logoutBtn}
        >
          Çıkış
        </button>
      </aside>

      <main style={mainContent}>
        <header style={header}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
              Yönetim Paneli
            </h1>
            <small style={{ color: COLORS.muted }}>
              {user.email} {isPremium ? '👑' : ''}
            </small>
          </div>
        </header>

        <div style={statsGrid}>
          <div style={card}>
            <small style={labelStyle}>AYLIK GELİR</small>
            <h3>{totalMonthly.toLocaleString()} ₺</h3>
          </div>
          <div style={card}>
            <small style={labelStyle}>PORTFÖY</small>
            <h3>{properties.length}</h3>
          </div>
        </div>

        <div style={{ ...card, height: 280 }}>
          <h4>Gelir Dağılımı</h4>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" fontSize={10} />
              <Tooltip />
              <Bar dataKey="miktar" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </main>
    </div>
  );
}

/* =====================
   🎨 STİLLER (DOKUNMADAN + KOŞULLU)
===================== */
const layoutStyle = {
  display: 'flex',
  height: '100vh',
  backgroundColor: COLORS.bg,
  fontFamily: 'system-ui',
  color: COLORS.text
};

const sidebarStyle = {
  width: '270px',
  backgroundColor: '#0f172a',
  display: isMobile ? 'none' : 'flex',
  flexDirection: 'column',
  padding: '30px',
  justifyContent: 'space-between'
};

const logoStyle = { color: '#fff', fontSize: '24px', fontWeight: '900' };
const navItem = {
  padding: '15px',
  color: '#94a3b8',
  cursor: 'pointer',
  borderRadius: '12px',
  marginBottom: '8px'
};
const navActive = { ...navItem, backgroundColor: '#1e293b', color: '#fff' };
const premBtn = { ...navItem, color: '#f59e0b', fontWeight: 'bold' };

const mainContent = {
  flex: 1,
  padding: isMobile ? '20px' : '50px',
  overflowY: 'auto'
};

const header = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: isMobile ? 'flex-start' : 'center',
  flexDirection: isMobile ? 'column' : 'row',
  gap: '20px',
  marginBottom: '40px'
};

const statsGrid = {
  display: 'grid',
  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
  gap: '20px',
  marginBottom: '30px'
};

const card = {
  background: COLORS.card,
  borderRadius: '24px',
  padding: '25px',
  border: `1px solid ${COLORS.border}`,
  boxShadow: isDark ? 'none' : '0 4px 6px rgba(0,0,0,0.02)'
};

const labelStyle = { color: COLORS.muted, fontSize: '11px', fontWeight: '800' };
const logoutBtn = {
  background: 'none',
  border: '1px solid #334155',
  color: '#94a3b8',
  padding: '10px',
  borderRadius: '12px',
  cursor: 'pointer'
};

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bg
      }}
    >
      <div
        style={{
          background: COLORS.card,
          padding: '40px',
          borderRadius: '35px',
          width: '350px'
        }}
      >
        <h2 style={{ textAlign: 'center', fontWeight: 900 }}>
          RentGuard<span style={{ color: '#2563eb' }}>.pro</span>
        </h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await supabase.auth.signInWithPassword({ email, password });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}
        >
          <input
            placeholder="E-posta"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Şifre"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button>Giriş Yap</button>
        </form>
      </div>
    </div>
  );
}