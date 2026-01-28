// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const supabaseUrl = 'https://pwnffmzmrclvzsrikbdc.supabase.co';
const supabaseKey = 'sb_publishable_JMQYVqglFtTZsHhUv-o-JQ_fCR-PFqk';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeProperty, setActiveProperty] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => {
      window.removeEventListener('resize', handleResize);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => { if (user) { fetchProperties(); fetchPayments(); } }, [user]);

  async function fetchProperties() {
    const { data } = await supabase.from('properties').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setProperties(data || []);
  }

  async function fetchPayments() {
    const { data } = await supabase.from('payments').select('*').order('due_date', { ascending: true });
    setPayments(data || []);
  }

  const checkStatus = (propertyId) => {
    const today = new Date();
    const currentMonthStr = `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    const property = properties.find(p => p.id === propertyId);
    const monthPayment = payments.find(pay => pay.property_id === propertyId && pay.month_year === currentMonthStr);
    if (monthPayment?.is_paid) return { label: 'Ödendi', color: '#10b981', bg: '#ecfdf5' };
    if (today.getDate() > (property?.payment_day || 1)) return { label: 'Gecikti', color: '#ef4444', bg: '#fef2f2' };
    return { label: 'Bekliyor', color: '#64748b', bg: '#f1f5f9' };
  };

  if (!user) return <AuthScreen />;

  const totalMonthly = properties.reduce((sum, p) => sum + Number(p.rent_amount), 0);

  return (
    <div style={{ ...layoutStyle, flexDirection: isMobile ? 'column' : 'row' }}>
      {/* SIDEBAR / MOBILE NAV */}
      <aside style={{ 
        ...sidebarStyle, 
        width: isMobile ? '100%' : '260px', 
        height: isMobile ? 'auto' : '100vh', 
        padding: isMobile ? '15px' : '30px',
        position: isMobile ? 'sticky' : 'relative',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={logoStyle}>RentGuard<span>.pro</span></h2>
          {isMobile && <button onClick={() => supabase.auth.signOut()} style={{background:'none', border:'none', color:'#fff'}}>🚪</button>}
        </div>
        <nav style={{ display: isMobile ? 'flex' : 'block', gap: '10px', marginTop: isMobile ? '15px' : '40px' }}>
          <div onClick={() => setActiveTab('dashboard')} style={activeTab === 'dashboard' ? navActive : navItem}>🏠 Dashboard</div>
          <div onClick={() => setActiveTab('docs')} style={activeTab === 'docs' ? navActive : navItem}>📄 Belgeler</div>
          {!isMobile && <button onClick={() => supabase.auth.signOut()} style={{...navItem, border:'none', background:'none', width:'100%', textAlign:'left', marginTop:'20px'}}>Çıkış</button>}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{ ...mainContent, padding: isMobile ? '15px' : '40px' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
          <h1 style={{ fontSize: isMobile ? '22px' : '32px', fontWeight: 800 }}>Genel Bakış</h1>
          <button onClick={() => setShowForm(true)} style={primaryBtn}>+ Yeni</button>
        </header>

        <div style={{ ...statsGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? '10px' : '20px' }}>
          <div style={card}><small style={labelStyle}>AYLIK GELİR</small><h3 style={{fontSize: '22px'}}>{totalMonthly.toLocaleString()} ₺</h3></div>
          <div style={card}><small style={labelStyle}>GECİKEN</small><h3 style={{fontSize: '22px', color:'#ef4444'}}>{properties.filter(p => checkStatus(p.id).label === 'Gecikti').length}</h3></div>
          <div style={card}><small style={labelStyle}>MÜLK</small><h3 style={{fontSize: '22px'}}>{properties.length} / 2</h3></div>
        </div>

        <div style={card}>
          <h4 style={{marginBottom:'20px'}}>Mülk Listesi</h4>
          {isMobile ? (
            // MOBİL KART GÖRÜNÜMÜ
            properties.map(p => (
              <div key={p.id} style={mobileCard}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                  <div style={{fontWeight:800, fontSize:'16px'}}>{p.property_name}</div>
                  <span style={{padding:'4px 8px', borderRadius:'6px', fontSize:'10px', fontWeight:700, color:checkStatus(p.id).color, backgroundColor:checkStatus(p.id).bg}}>
                    {checkStatus(p.id).label}
                  </span>
                </div>
                <div style={{fontSize:'14px', color:'#64748b', marginBottom:'12px'}}>👤 {p.tenant_name} • 💰 {p.rent_amount.toLocaleString()} ₺</div>
                <div style={{display:'flex', gap:'8px'}}>
                  <button onClick={() => setActiveProperty(p)} style={mobileActionBtn}>💰 Plan</button>
                  <button onClick={() => setSelectedAddress(p.full_address)} style={mobileActionBtn}>📍 Adres</button>
                </div>
              </div>
            ))
          ) : (
            // MASAÜSTÜ TABLO
            <table style={table}>
              <thead><tr><th style={th}>MÜLK</th><th style={th}>DURUM</th><th style={th}>KİRA</th><th style={th}>İŞLEM</th></tr></thead>
              <tbody>
                {properties.map(p => (
                  <tr key={p.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                    <td style={td}><b>{p.property_name}</b><br/><small>{p.tenant_name}</small></td>
                    <td style={td}><span style={{padding:'4px 10px', borderRadius:'8px', fontSize:'11px', fontWeight:700, color:checkStatus(p.id).color, backgroundColor:checkStatus(p.id).bg}}>{checkStatus(p.id).label}</span></td>
                    <td style={td}><b>{p.rent_amount.toLocaleString()} ₺</b></td>
                    <td style={td}><button onClick={() => setActiveProperty(p)} style={actionBtn}>💰 Plan</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

// STİLLER
const mobileCard = { padding: '15px', border: '1px solid #f1f5f9', borderRadius: '18px', marginBottom: '12px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' };
const mobileActionBtn = { flex: 1, padding: '12px', border: 'none', borderRadius: '12px', backgroundColor: '#f1f5f9', fontWeight: 800, fontSize: '13px', color: '#1e293b' };
const layoutStyle = { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui' };
const sidebarStyle = { backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column' };
const logoStyle = { color: '#fff', fontSize: '24px', fontWeight: '900' };
const navItem = { padding: '14px', color: '#94a3b8', cursor: 'pointer', borderRadius: '12px', fontSize: '14px', fontWeight: 600 };
const navActive = { ...navItem, backgroundColor: '#1e293b', color: '#fff' };
const mainContent = { flex: 1, overflowY: 'auto' };
const statsGrid = { display: 'grid', marginBottom: '30px' };
const card = { background: '#fff', borderRadius: '24px', padding: '20px', border: '1px solid #f1f5f9' };
const labelStyle = { color: '#64748b', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px' };
const primaryBtn = { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' };
const table = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const td = { padding: '15px' };
const th = { padding: '15px', color:'#64748b', fontSize:'11px', fontWeight:800 };
const actionBtn = { background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: 800, cursor: 'pointer' };

function AuthScreen() { return <div style={{padding:'50px', textAlign:'center', fontFamily:'system-ui'}}>Giriş Ekranı Yükleniyor...</div>; }