// @ts-nocheck
import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const supabaseUrl = 'https://pwnffmzmrclvzsrikbdc.supabase.co';
const supabaseKey = 'sb_publishable_JMQYVqglFtTZsHhUv-o-JQ_fCR-PFqk';
const supabase = createClient(supabaseUrl, supabaseKey);

const FREE_LIMIT = 2;

// --- YENİ EKLENEN ÖZELLİKLER ---
// Cihaz boyutu kontrolü için hook
const useDeviceType = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);
  
  return { isMobile, isDesktop: !isMobile };
};

// Dark mode kontrolü
const useDarkMode = () => {
  const [darkMode, setDarkMode] = useState(() => {
    // Sistem tercihini kontrol et
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
// --- YENİ EKLENEN ÖZELLİKLER SONU ---

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
    property_name: '', tenant_name: '', rent_amount: '', 
    next_increase_date: '', tenant_phone: '', tenant_email: '', 
    full_address: '', payment_day: 1
  });

  // Yeni hook'ları kullanma
  const { isMobile, isDesktop } = useDeviceType();
  const { darkMode, toggleDarkMode } = useDarkMode();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) { fetchProperties(); fetchPayments(); } }, [user]);

  async function fetchProperties() {
    const { data, error } = await supabase.from('properties').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    if (!error) setProperties(data || []);
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

    if (monthPayment?.is_paid) return { label: 'Ödendi', color: '#10b981', bg: darkMode ? '#064e3b' : '#ecfdf5' };
    if (today.getDate() > (property?.payment_day || 1)) return { label: 'Gecikti', color: '#ef4444', bg: darkMode ? '#7f1d1d' : '#fef2f2' };
    return { label: 'Bekliyor', color: '#64748b', bg: darkMode ? '#334155' : '#f1f5f9' };
  };

  async function createPlan(propertyId, startDay) {
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
    await supabase.from('payments').insert(plan);
    fetchPayments();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...formData, rent_amount: Number(formData.rent_amount), payment_day: Number(formData.payment_day), user_id: user.id };
    if (editingId) {
      await supabase.from('properties').update(payload).eq('id', editingId);
    } else {
      const { data } = await supabase.from('properties').insert([payload]).select();
      if (data) await createPlan(data[0].id, formData.payment_day);
    }
    closeForm();
    fetchProperties();
  }

  async function handleDelete() {
    if (window.confirm("Bu mülkü kalıcı olarak silmek istediğinize emin misiniz?")) {
      const { error } = await supabase.from('properties').delete().eq('id', editingId);
      if (!error) { closeForm(); fetchProperties(); }
    }
  }

  const openEditForm = (p) => {
    setEditingId(p.id);
    setFormData({
      property_name: p.property_name, tenant_name: p.tenant_name,
      rent_amount: p.rent_amount, next_increase_date: p.next_increase_date || '',
      tenant_phone: p.tenant_phone || '', tenant_email: p.tenant_email || '',
      full_address: p.full_address || '', payment_day: p.payment_day || 1
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ property_name: '', tenant_name: '', rent_amount: '', next_increase_date: '', tenant_phone: '', tenant_email: '', full_address: '', payment_day: 1 });
  };

  // Dinamik stil oluşturma (dark mode ve responsive için)
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
      }
    };

    return baseStyles;
  }, [darkMode, isMobile]);

  if (!user) return <AuthScreen darkMode={darkMode} isMobile={isMobile} />;

  const totalMonthly = properties.reduce((sum, p) => sum + Number(p.rent_amount), 0);
  const chartData = properties.map(p => ({ name: p.property_name.substring(0,6), miktar: Number(p.rent_amount) }));

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
            <div onClick={() => setActiveTab('docs')} style={activeTab === 'docs' ? styles.navActive : styles.navItem}>
              {isMobile ? '📄' : '📄 Belgeler'}
            </div>
            {!isPremium && (
              <div onClick={() => setShowPaywall(true)} style={styles.premBtn}>
                {isMobile ? '⭐' : '⭐ Premium'}
              </div>
            )}
            {/* Dark mode toggle butonu */}
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
              Yönetim Paneli
            </h1>
            <small style={{color: darkMode ? '#94a3b8' : '#64748b'}}>
              {user.email} {isPremium ? '👑' : ''}
            </small>
          </div>
          <button 
            onClick={() => (!isPremium && properties.length >= FREE_LIMIT) ? setShowPaywall(true) : setShowForm(true)} 
            style={styles.primaryBtn}
          >
            {isMobile ? '+ Ekle' : '+ Yeni Mülk Ekle'}
          </button>
        </header>

        {activeTab === 'dashboard' ? (
          <>
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
                <small style={styles.labelStyle}>PORTFÖY</small>
                <h3 style={{color: darkMode ? '#e2e8f0' : '#1e293b', fontSize: isMobile ? '24px' : 'inherit'}}>
                  {properties.length} / {isPremium ? '∞' : FREE_LIMIT}
                </h3>
              </div>
            </div>

            <div style={{...styles.card, overflowX: isMobile ? 'auto' : 'visible'}}>
              <h4 style={{marginBottom:'20px', color: darkMode ? '#e2e8f0' : '#1e293b'}}>Mülk Listesi</h4>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>MÜLK / KİRACI</th>
                    <th style={styles.th}>DURUM</th>
                    {!isMobile && <th style={styles.th}>İLETİŞİM</th>}
                    <th style={styles.th}>KİRA</th>
                    <th style={styles.th}>İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map(p => {
                    const status = checkStatus(p.id);
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
                          <span style={{
                            padding:'4px 10px', 
                            borderRadius:'8px', 
                            fontSize:'11px', 
                            fontWeight:700, 
                            color:status.color, 
                            backgroundColor:status.bg
                          }}>
                            {status.label}
                          </span>
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
                            {p.rent_amount.toLocaleString()} ₺
                          </b>
                        </td>
                        <td style={styles.td}>
                          <button onClick={() => setActiveProperty(p)} style={styles.actionBtn}>
                            {isMobile ? '💰' : '💰 Plan'}
                          </button>
                          <button onClick={() => openEditForm(p)} style={{...styles.actionBtn, color:'#2563eb'}}>
                            {isMobile ? '⚙️' : '⚙️ Düzenle'}
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
            </div>

            <div style={{...styles.card, height: isMobile ? '250px' : '280px', marginTop:'20px'}}>
              <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b'}}>Gelir Dağılımı</h4>
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
            </div>
          </>
        ) : (
          <div style={styles.card}>
            <h3 style={{marginBottom:'30px', color: darkMode ? '#e2e8f0' : '#1e293b'}}>Hukuki Belge Şablonları</h3>
            <div style={styles.statsGrid}>
              <div style={{...styles.card, textAlign:'center', border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0'}}>
                <div style={{fontSize:'40px', marginBottom:'10px'}}>📄</div>
                <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b'}}>Kira Sözleşmesi</h4>
                <p style={{fontSize:'12px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom:'20px'}}>
                  Güncel mevzuata uygun standart kira kontratı.
                </p>
                <a 
                  href="https://docs.google.com/document/d/1X_U9BqC9QvK6q6N0-D9F5K4A6-w7B-R9/export?format=pdf" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{...styles.primaryBtn, display:'inline-block', textDecoration:'none'}}
                >
                  {isMobile ? 'İndir' : 'İndir (PDF)'}
                </a>
              </div>
              <div style={{...styles.card, textAlign:'center', border: darkMode ? '1px solid #334155' : '1px solid #e2e8f0'}}>
                <div style={{fontSize:'40px', marginBottom:'10px'}}>📝</div>
                <h4 style={{color: darkMode ? '#e2e8f0' : '#1e293b'}}>Tahliye Taahhütnamesi</h4>
                <p style={{fontSize:'12px', color: darkMode ? '#94a3b8' : '#64748b', marginBottom:'20px'}}>
                  Noter onaylı veya yazılı tahliye taahhüdü şablonu.
                </p>
                <a 
                  href="https://docs.google.com/document/d/1vC9J7Z-O4Z8N0wJ6vV9YyS7uI8Z0_Kx4R1/export?format=pdf" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{...styles.primaryBtn, display:'inline-block', textDecoration:'none'}}
                >
                  {isMobile ? 'İndir' : 'İndir (PDF)'}
                </a>
              </div>
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
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom:'20px', borderBottom: darkMode ? '1px solid #334155' : '1px solid #eee', paddingBottom:'10px', color: darkMode ? '#e2e8f0' : '#1e293b'}}>
              {activeProperty.property_name} Takvimi
            </h3>
            <div style={{maxHeight:'350px', overflowY:'auto'}}>
              {payments.filter(pay => pay.property_id === activeProperty.id).map(pay => (
                <div key={pay.id} style={styles.payRow}>
                  <span><b style={{color: darkMode ? '#e2e8f0' : '#1e293b'}}>{pay.month_year}</b></span>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <small style={{fontWeight:700, color: pay.is_paid ? '#10b981' : '#ef4444'}}>
                      {pay.is_paid ? 'Ödendi' : 'Bekliyor'}
                    </small>
                    <input 
                      type="checkbox" 
                      checked={pay.is_paid} 
                      onChange={async () => {
                        await supabase.from('payments').update({ is_paid: !pay.is_paid }).eq('id', pay.id);
                        fetchPayments();
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
            <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
              <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'15px'}}>
                <input 
                  placeholder="Mülk Adı" 
                  style={styles.input} 
                  value={formData.property_name} 
                  onChange={e => setFormData({...formData, property_name: e.target.value})} 
                  required 
                />
                <input 
                  placeholder="Kiracı" 
                  style={styles.input} 
                  value={formData.tenant_name} 
                  onChange={e => setFormData({...formData, tenant_name: e.target.value})} 
                  required 
                />
              </div>
              <textarea 
                placeholder="Tam Adres" 
                style={{...styles.input, height:'60px', resize:'none'}} 
                value={formData.full_address} 
                onChange={e => setFormData({...formData, full_address: e.target.value})} 
              />
              <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'15px'}}>
                <input 
                  placeholder="Telefon" 
                  style={styles.input} 
                  value={formData.tenant_phone} 
                  onChange={e => setFormData({...formData, tenant_phone: e.target.value})} 
                />
                <input 
                  placeholder="E-posta" 
                  style={styles.input} 
                  value={formData.tenant_email} 
                  onChange={e => setFormData({...formData, tenant_email: e.target.value})} 
                />
              </div>
              <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'15px'}}>
                <input 
                  type="date" 
                  style={styles.input} 
                  value={formData.next_increase_date} 
                  onChange={e => setFormData({...formData, next_increase_date: e.target.value})} 
                />
                <input 
                  type="number" 
                  placeholder="Ödeme Günü" 
                  style={styles.input} 
                  value={formData.payment_day} 
                  onChange={e => setFormData({...formData, payment_day: e.target.value})} 
                  min="1" 
                  max="31" 
                />
              </div>
              <input 
                type="number" 
                placeholder="Kira" 
                style={styles.input} 
                value={formData.rent_amount} 
                onChange={e => setFormData({...formData, rent_amount: e.target.value})} 
                required 
              />
              <button style={styles.primaryBtn}>
                {editingId ? 'Güncelle' : 'Kaydet'}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  onClick={handleDelete} 
                  style={{...styles.primaryBtn, backgroundColor: '#ef4444'}}
                >
                  🗑️ Mülkü Sil
                </button>
              )}
              <button 
                type="button" 
                onClick={closeForm} 
                style={{
                  background:'none', 
                  border:'none', 
                  color: darkMode ? '#94a3b8' : '#64748b', 
                  cursor:'pointer'
                }}
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
        <form onSubmit={async (e) => { 
          e.preventDefault(); 
          await supabase.auth.signInWithPassword({ email, password }); 
        }} style={{ display: 'flex', flexDirection: 'column' }}>
          <input 
            placeholder="E-posta" 
            style={authStyles.input} 
            onChange={e => setEmail(e.target.value)} 
          />
          <input 
            type="password" 
            placeholder="Şifre" 
            style={authStyles.input} 
            onChange={e => setPassword(e.target.value)} 
          />
          <button style={authStyles.primaryBtn}>Giriş Yap</button>
        </form>
      </div>
    </div>
  );
}