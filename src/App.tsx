// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const supabaseUrl = 'https://pwnffmzmrclvzsrikbdc.supabase.co';
const supabaseKey = 'sb_publishable_JMQYVqglFtTZsHhUv-o-JQ_fCR-PFqk';
const supabase = createClient(supabaseUrl, supabaseKey);

const FREE_LIMIT = 2;

const DOCS = {
  KIRA_SOZLESMESI: "https://docs.google.com/document/d/1Xy1p0O9p3zJ8zS8qXG0yXzI8Z0_Kx4R0/export?format=pdf",
  TAHLIYE_TAAHHUDU: "https://docs.google.com/document/d/1W5u7X_H_8N0wJ6vV9YyS7uI8Z0_Kx4R1/export?format=pdf"
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
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [formData, setFormData] = useState({ 
    property_name: '', tenant_name: '', rent_amount: '', 
    next_increase_date: '', tenant_phone: '', tenant_email: '', 
    full_address: '', payment_day: 1
  });

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

    if (monthPayment?.is_paid) return { label: 'Ödendi', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
    if (today.getDate() > (property?.payment_day || 1)) return { label: 'Gecikti', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' };
    return { label: 'Bekliyor', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
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

  if (!user) return <AuthScreen />;

  const totalMonthly = properties.reduce((sum, p) => sum + Number(p.rent_amount), 0);
  const chartData = properties.map(p => ({ name: p.property_name.substring(0,6), miktar: Number(p.rent_amount) }));

  return (
    <div style={{...layoutStyle, flexDirection: isMobile ? 'column' : 'row'}}>
      <aside style={{...sidebarStyle, width: isMobile ? '100%' : '260px', height: isMobile ? 'auto' : '100vh'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h2 style={logoStyle}>RentGuard<span style={{color:'#3b82f6'}}>.pro</span></h2>
          {isMobile && <button onClick={() => supabase.auth.signOut()} style={{background:'none', border:'none', color:'#fff', fontSize:'20px'}}>🚪</button>}
        </div>
        <nav style={{display: isMobile ? 'flex' : 'block', gap: '10px', marginTop: isMobile ? '15px' : '40px'}}>
          <div onClick={() => setActiveTab('dashboard')} style={activeTab === 'dashboard' ? navActive : navItem}>🏠 Dashboard</div>
          <div onClick={() => setActiveTab('docs')} style={activeTab === 'docs' ? navActive : navItem}>📄 Belgeler</div>
          {!isMobile && <button onClick={() => supabase.auth.signOut()} style={logoutBtn}>Güvenli Çıkış</button>}
        </nav>
      </aside>

      <main style={{...mainContent, padding: isMobile ? '15px' : '40px'}}>
        <header style={{...header, flexDirection: isMobile ? 'column' : 'row', gap: '15px'}}>
          <div>
            <h1 style={{margin:0, fontSize: isMobile ? '22px' : '30px', fontWeight: 900}}>Yönetim Paneli</h1>
            <small style={{color:'#94a3b8'}}>{user.email} {isPremium ? '👑' : ''}</small>
          </div>
          <button onClick={() => (!isPremium && properties.length >= FREE_LIMIT) ? setShowPaywall(true) : setShowForm(true)} style={{...primaryBtn, width: isMobile ? '100%' : 'auto'}}>+ Yeni Mülk Ekle</button>
        </header>

        {activeTab === 'dashboard' ? (
          <>
            <div style={{...statsGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)'}}>
              <div style={card}><small style={labelStyle}>AYLIK GELİR</small><h3 style={statVal}>{totalMonthly.toLocaleString()} ₺</h3></div>
              <div style={card}><small style={labelStyle}>GECİKEN</small><h3 style={{...statVal, color:'#ef4444'}}>{properties.filter(p => checkStatus(p.id).label === 'Gecikti').length}</h3></div>
              <div style={card}><small style={labelStyle}>PORTFÖY</small><h3 style={statVal}>{properties.length} / {isPremium ? '∞' : FREE_LIMIT}</h3></div>
            </div>

            <div style={card}>
              <h4 style={{marginBottom:'20px'}}>Mülk Listesi</h4>
              {isMobile ? (
                // MOBİL KART GÖRÜNÜMÜ
                properties.map(p => {
                   const status = checkStatus(p.id);
                   return (
                     <div key={p.id} style={mobileCard}>
                       <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                         <b>{p.property_name}</b>
                         <span style={{padding:'4px 8px', borderRadius:'6px', fontSize:'10px', fontWeight:700, color:status.color, backgroundColor:status.bg}}>{status.label}</span>
                       </div>
                       <div style={{fontSize:'13px', color:'#94a3b8', marginBottom:'15px'}}>👤 {p.tenant_name} • 💰 {p.rent_amount.toLocaleString()} ₺</div>
                       <div style={{display:'flex', gap:'10px'}}>
                         <button onClick={() => setActiveProperty(p)} style={mobileActionBtn}>Plan</button>
                         <button onClick={() => openEditForm(p)} style={mobileActionBtn}>Düzenle</button>
                         <button onClick={() => setSelectedAddress(p.full_address)} style={mobileActionBtn}>📍</button>
                       </div>
                     </div>
                   )
                })
              ) : (
                // MASAÜSTÜ TABLO
                <table style={table}>
                  <thead>
                    <tr style={{borderBottom:'1px solid #334155'}}>
                      <th style={th}>MÜLK / KİRACI</th>
                      <th style={th}>DURUM</th>
                      <th style={th}>KİRA</th>
                      <th style={th}>İŞLEMLER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map(p => {
                      const status = checkStatus(p.id);
                      return (
                        <tr key={p.id} style={{borderBottom:'1px solid #1e293b'}}>
                          <td style={td}><b>{p.property_name}</b><br/><small style={{color:'#94a3b8'}}>{p.tenant_name}</small></td>
                          <td style={td}><span style={{padding:'4px 10px', borderRadius:'8px', fontSize:'11px', fontWeight:700, color:status.color, backgroundColor:status.bg}}>{status.label}</span></td>
                          <td style={td}><b>{p.rent_amount.toLocaleString()} ₺</b></td>
                          <td style={td}>
                            <button onClick={() => setActiveProperty(p)} style={actionBtn}>💰 Plan</button>
                            <button onClick={() => openEditForm(p)} style={{...actionBtn, color:'#3b82f6'}}>⚙️ Düzenle</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {!isMobile && (
              <div style={{...card, height:'280px', marginTop:'20px'}}>
                <h4>Gelir Dağılımı</h4>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{fill:'#94a3b8'}} />
                    <Tooltip contentStyle={{backgroundColor:'#1e293b', border:'none', borderRadius:'10px', color:'#fff'}} />
                    <Bar dataKey="miktar" fill="#3b82f6" radius={[6,6,0,0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <div style={card}>
            <h3 style={{marginBottom:'30px'}}>Hukuki Belge Şablonları</h3>
            <div style={{...statsGrid, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)'}}>
              <div style={{...card, textAlign:'center', backgroundColor: '#1e293b'}}>
                <div style={{fontSize:'40px', marginBottom:'10px'}}>📄</div>
                <h4>Kira Sözleşmesi</h4>
                <a href={DOCS.KIRA_SOZLESMESI} target="_blank" style={{...primaryBtn, display:'inline-block', marginTop:'15px', textDecoration:'none', width:'100%'}}>İndir (PDF)</a>
              </div>
              <div style={{...card, textAlign:'center', backgroundColor: '#1e293b'}}>
                <div style={{fontSize:'40px', marginBottom:'10px'}}>📝</div>
                <h4>Tahliye Taahhüdü</h4>
                <a href={DOCS.TAHLIYE_TAAHHUDU} target="_blank" style={{...primaryBtn, display:'inline-block', marginTop:'15px', textDecoration:'none', width:'100%'}}>İndir (PDF)</a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALLAR */}
      {(selectedAddress || activeProperty || showForm) && (
        <div style={overlay} onClick={() => {setSelectedAddress(null); setActiveProperty(null); closeForm();}}>
          <div style={{...modal, width: isMobile ? '90%' : '450px'}} onClick={e => e.stopPropagation()}>
            {selectedAddress && (
               <>
                <h3 style={{marginTop:0}}>📍 Mülk Adresi</h3>
                <p style={{lineHeight:'1.7', color:'#94a3b8', padding:'20px 0'}}>{selectedAddress || "Adres bilgisi yok."}</p>
                <button style={{...primaryBtn, width:'100%'}} onClick={() => setSelectedAddress(null)}>Kapat</button>
               </>
            )}
            {activeProperty && (
               <>
                <h3 style={{marginBottom:'20px'}}>{activeProperty.property_name} Takvimi</h3>
                <div style={{maxHeight:'350px', overflowY:'auto'}}>
                  {payments.filter(pay => pay.property_id === activeProperty.id).map(pay => (
                    <div key={pay.id} style={payRow}>
                      <span><b>{pay.month_year}</b></span>
                      <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                        <small style={{fontWeight:700, color: pay.is_paid ? '#10b981' : '#ef4444'}}>{pay.is_paid ? 'Ödendi' : 'Bekliyor'}</small>
                        <input type="checkbox" checked={pay.is_paid} onChange={async () => {
                          await supabase.from('payments').update({ is_paid: !pay.is_paid }).eq('id', pay.id);
                          fetchPayments();
                        }} style={{width:'22px', height:'22px'}} />
                      </div>
                    </div>
                  ))}
                </div>
               </>
            )}
            {showForm && (
              <>
                <h3 style={{marginBottom:'20px'}}>{editingId ? 'Bilgileri Düzenle' : 'Yeni Mülk Kaydı'}</h3>
                <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                  <input placeholder="Mülk Adı" style={input} value={formData.property_name} onChange={e => setFormData({...formData, property_name: e.target.value})} required />
                  <input placeholder="Kiracı" style={input} value={formData.tenant_name} onChange={e => setFormData({...formData, tenant_name: e.target.value})} required />
                  <textarea placeholder="Tam Adres" style={{...input, height:'60px'}} value={formData.full_address} onChange={e => setFormData({...formData, full_address: e.target.value})} />
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                    <input placeholder="Telefon" style={input} value={formData.tenant_phone} onChange={e => setFormData({...formData, tenant_phone: e.target.value})} />
                    <input type="number" placeholder="Ödeme Günü" style={input} value={formData.payment_day} onChange={e => setFormData({...formData, payment_day: e.target.value})} min="1" max="31" />
                  </div>
                  <input type="number" placeholder="Kira Tutarı" style={input} value={formData.rent_amount} onChange={e => setFormData({...formData, rent_amount: e.target.value})} required />
                  <button style={primaryBtn}>{editingId ? 'Güncelle' : 'Kaydet'}</button>
                  {editingId && <button type="button" onClick={handleDelete} style={{...primaryBtn, backgroundColor: '#ef4444'}}>Mülkü Sil</button>}
                  <button type="button" onClick={closeForm} style={{color:'#94a3b8', background:'none', border:'none', marginTop:'10px'}}>Vazgeç</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// KOYU TEMA STİLLERİ
const layoutStyle = { display: 'flex', minHeight: '100vh', backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui' };
const sidebarStyle = { backgroundColor: '#1e293b', display: 'flex', flexDirection: 'column', padding: '25px', justifyContent: 'space-between', borderRight:'1px solid #334155' };
const logoStyle = { color: '#fff', fontSize: '22px', fontWeight: '900' };
const navItem = { padding: '12px 16px', color: '#94a3b8', cursor: 'pointer', borderRadius: '12px', marginBottom: '8px', fontSize:'14px', fontWeight:600 };
const navActive = { ...navItem, backgroundColor: '#3b82f6', color: '#fff' };
const mainContent = { flex: 1, overflowY: 'auto' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const statsGrid = { display: 'grid', gap: '15px', marginBottom: '30px' };
const card = { background: '#1e293b', borderRadius: '20px', padding: '20px', border: '1px solid #334155' };
const statVal = { fontSize: '24px', margin: '8px 0 0 0', fontWeight: '800' };
const labelStyle = { color: '#94a3b8', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' };
const table = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' };
const td = { padding: '15px' };
const th = { padding: '15px', color:'#94a3b8', fontSize:'11px', fontWeight:800 };
const primaryBtn = { backgroundColor: '#3b82f6', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' };
const actionBtn = { background: '#0f172a', border: '1px solid #334155', padding: '8px 12px', borderRadius: '8px', color: '#f8fafc', fontSize: '12px', fontWeight: 'bold', marginRight: '5px' };
const overlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter:'blur(8px)' };
const modal = { background: '#1e293b', padding: '30px', borderRadius: '25px', border: '1px solid #334155', color:'#fff' };
const input = { padding: '12px', borderRadius: '10px', border: '1px solid #334155', width: '100%', boxSizing: 'border-box', backgroundColor:'#0f172a', color:'#fff', outline:'none' };
const payRow = { display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #334155', alignItems:'center' };
const logoutBtn = { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontSize:'12px' };
const mobileCard = { background:'#1e293b', padding:'15px', borderRadius:'15px', border:'1px solid #334155', marginBottom:'12px' };
const mobileActionBtn = { flex:1, background:'#0f172a', border:'1px solid #334155', color:'#fff', padding:'10px', borderRadius:'10px', fontSize:'12px', fontWeight:700 };

function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
      <div style={{ background: '#1e293b', padding: '40px', borderRadius: '30px', width: '340px', border:'1px solid #334155' }}>
        <h2 style={{ textAlign: 'center', fontWeight: '900', marginBottom:'30px', color:'#fff' }}>RentGuard<span style={{color:'#3b82f6'}}>.pro</span></h2>
        <form onSubmit={async (e) => { e.preventDefault(); await supabase.auth.signInWithPassword({ email, password }); }} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input placeholder="E-posta" style={input} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Şifre" style={input} onChange={e => setPassword(e.target.value)} />
          <button style={{...primaryBtn, width:'100%', marginTop:'10px'}}>Giriş Yap</button>
        </form>
      </div>
    </div>
  );
}