// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const supabaseUrl = 'https://pwnffmzmrclvzsrikbdc.supabase.co';
const supabaseKey = 'sb_publishable_JMQYVqglFtTZsHhUv-o-JQ_fCR-PFqk';
const supabase = createClient(supabaseUrl, supabaseKey);

const FREE_LIMIT = 2;

// BELGE ŞABLONLARI (Google Docs veya Doğrudan Yazdırma Linkleri)
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  async function fetchProperties() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching properties:', error);
        setError(error.message);
        return;
      }
      
      setProperties(data || []);
      setError(null);
    } catch (err) {
      console.error('Error in fetchProperties:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPayments() {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('due_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching payments:', error);
        return;
      }
      
      setPayments(data || []);
    } catch (err) {
      console.error('Error in fetchPayments:', err);
    }
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

  async function createPlan(propertyId, startDay) {
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
        return;
      }
      
      fetchPayments();
    } catch (err) {
      console.error('Error in createPlan:', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
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
          setError(`Güncelleme hatası: ${error.message}`);
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
          setError(`Kayıt hatası: ${error.message}`);
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
      setError(`İşlem hatası: ${err.message}`);
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
          setError(`Silme hatası: ${error.message}`);
          return;
        }
        
        closeForm();
        fetchProperties();
      } catch (err) {
        console.error('Error in handleDelete:', err);
        setError(`Silme işlemi hatası: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }
  }

  const openEditForm = (p) => {
    setEditingId(p.id);
    setFormData({
      property_name: p.property_name, 
      tenant_name: p.tenant_name,
      rent_amount: p.rent_amount, 
      next_increase_date: p.next_increase_date || '',
      tenant_phone: p.tenant_phone || '', 
      tenant_email: p.tenant_email || '',
      full_address: p.full_address || '', 
      payment_day: p.payment_day || 1
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ 
      property_name: '', 
      tenant_name: '', 
      rent_amount: '', 
      next_increase_date: '', 
      tenant_phone: '', 
      tenant_email: '', 
      full_address: '', 
      payment_day: 1 
    });
    setError(null);
  };

  if (!user) return <AuthScreen />;

  const totalMonthly = properties.reduce((sum, p) => sum + Number(p.rent_amount || 0), 0);
  const chartData = properties.map(p => ({ 
    name: p.property_name?.substring(0,6) || 'Mülk', 
    miktar: Number(p.rent_amount || 0) 
  }));

  return (
    <div style={layoutStyle}>
      <aside style={sidebarStyle}>
        <div>
          <h2 style={logoStyle}>RentGuard<span>.pro</span></h2>
          <nav>
            <div onClick={() => setActiveTab('dashboard')} style={activeTab === 'dashboard' ? navActive : navItem}>🏠 Dashboard</div>
            <div onClick={() => setActiveTab('docs')} style={activeTab === 'docs' ? navActive : navItem}>📄 Belgeler</div>
            {!isPremium && <div onClick={() => setShowPaywall(true)} style={premBtn}>⭐ Premium</div>}
          </nav>
        </div>
        <button onClick={() => supabase.auth.signOut()} style={logoutBtn}>Çıkış</button>
      </aside>

      <main style={mainContent}>
        <header style={header}>
          <div>
            <h1 style={{margin:0, fontSize: '28px', fontWeight: 900}}>Yönetim Paneli</h1>
            <small style={{color:'#64748b'}}>{user.email} {isPremium ? '👑' : ''}</small>
          </div>
          <button 
            onClick={() => (!isPremium && properties.length >= FREE_LIMIT) ? setShowPaywall(true) : setShowForm(true)} 
            style={primaryBtn}
          >
            + Yeni Mülk Ekle
          </button>
        </header>

        {error && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '15px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            ⚠️ {error}
            <button 
              onClick={() => setError(null)}
              style={{
                marginLeft: '10px',
                background: 'none',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Kapat
            </button>
          </div>
        )}

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
            <div style={statsGrid}>
              <div style={card}><small style={labelStyle}>AYLIK GELİR</small><h3>{totalMonthly.toLocaleString()} ₺</h3></div>
              <div style={card}><small style={labelStyle}>GECİKEN</small><h3 style={{color:'#ef4444'}}>{properties.filter(p => checkStatus(p.id).label === 'Gecikti').length}</h3></div>
              <div style={card}><small style={labelStyle}>PORTFÖY</small><h3>{properties.length} / {isPremium ? '∞' : FREE_LIMIT}</h3></div>
            </div>

            <div style={card}>
              <h4 style={{marginBottom:'20px'}}>Mülk Listesi</h4>
              {properties.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#64748b',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px'
                }}>
                  📍 Henüz mülk eklenmemiş. Yeni mülk eklemek için "Yeni Mülk Ekle" butonuna tıklayın.
                </div>
              ) : (
                <table style={table}>
                  <thead>
                    <tr style={{borderBottom:'2px solid #f1f5f9'}}>
                      <th style={th}>MÜLK / KİRACI</th>
                      <th style={th}>DURUM</th>
                      <th style={th}>İLETİŞİM</th>
                      <th style={th}>KİRA</th>
                      <th style={th}>İŞLEMLER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map(p => {
                      const status = checkStatus(p.id);
                      return (
                        <tr key={p.id} style={{borderBottom:'1px solid #f1f5f9'}}>
                          <td style={td}><b>{p.property_name}</b><br/><small style={{color:'#64748b'}}>{p.tenant_name}</small></td>
                          <td style={td}><span style={{padding:'4px 10px', borderRadius:'8px', fontSize:'11px', fontWeight:700, color:status.color, backgroundColor:status.bg}}>{status.label}</span></td>
                          <td style={td}>
                            <div style={{fontSize:'12px', lineHeight:'1.5'}}>
                              📞 {p.tenant_phone || '-'}<br/>
                              <span style={{cursor:'pointer', color:'#2563eb', fontWeight:'bold'}} onClick={() => setSelectedAddress(p.full_address)}>📍 Adres Gör</span>
                            </div>
                          </td>
                          <td style={td}><b>{Number(p.rent_amount || 0).toLocaleString()} ₺</b></td>
                          <td style={td}>
                            <button onClick={() => setActiveProperty(p)} style={actionBtn}>💰 Plan</button>
                            <button onClick={() => openEditForm(p)} style={{...actionBtn, color:'#2563eb'}}>⚙️ Düzenle</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{...card, height:'280px', marginTop:'20px'}}>
              <h4>Gelir Dağılımı</h4>
              {properties.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill:'#f8fafc'}} />
                    <Bar dataKey="miktar" fill="#2563eb" radius={[6,6,0,0]} barSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '80%',
                  color: '#64748b'
                }}>
                  Grafik için veri bulunmuyor
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={card}>
            <h3 style={{marginBottom:'30px'}}>Hukuki Belge Şablonları</h3>
            <div style={statsGrid}>
              <div style={{...card, textAlign:'center', border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:'40px', marginBottom:'10px'}}>📄</div>
                <h4>Kira Sözleşmesi</h4>
                <p style={{fontSize:'12px', color:'#64748b', marginBottom:'20px'}}>Güncel mevzuata uygun standart kira kontratı.</p>
                <a href={DOCS.KIRA_SOZLESMESI} target="_blank" rel="noopener noreferrer" style={{...primaryBtn, display:'inline-block', textDecoration:'none'}}>İndir (PDF)</a>
              </div>
              <div style={{...card, textAlign:'center', border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:'40px', marginBottom:'10px'}}>📝</div>
                <h4>Tahliye Taahhütnamesi</h4>
                <p style={{fontSize:'12px', color:'#64748b', marginBottom:'20px'}}>Noter onaylı veya yazılı tahliye taahhüdü şablonu.</p>
                <a href={DOCS.TAHLIYE_TAAHHUDU} target="_blank" rel="noopener noreferrer" style={{...primaryBtn, display:'inline-block', textDecoration:'none'}}>İndir (PDF)</a>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* --- ADRES MODAL --- */}
      {selectedAddress !== null && (
        <div style={overlay} onClick={() => setSelectedAddress(null)}>
          <div style={{...modal, width:'400px'}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginTop:0, borderBottom:'1px solid #f1f5f9', paddingBottom:'10px'}}>📍 Mülk Adresi</h3>
            <p style={{lineHeight:'1.7', color:'#1e293b', padding:'10px 0'}}>
              {selectedAddress || "Adres bilgisi girilmemiş."}
            </p>
            <button style={{...primaryBtn, width:'100%'}} onClick={() => setSelectedAddress(null)}>Kapat</button>
          </div>
        </div>
      )}

      {/* --- ÖDEME PLANI MODAL --- */}
      {activeProperty && (
        <div style={overlay} onClick={() => setActiveProperty(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom:'20px', borderBottom:'1px solid #eee', paddingBottom:'10px'}}>{activeProperty.property_name} Takvimi</h3>
            <div style={{maxHeight:'350px', overflowY:'auto'}}>
              {payments.filter(pay => pay.property_id === activeProperty.id).map(pay => (
                <div key={pay.id} style={payRow}>
                  <span><b>{pay.month_year}</b></span>
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <small style={{fontWeight:700, color: pay.is_paid ? '#10b981' : '#ef4444'}}>{pay.is_paid ? 'Ödendi' : 'Bekliyor'}</small>
                    <input type="checkbox" checked={pay.is_paid} onChange={async () => {
                      const { error } = await supabase.from('payments').update({ is_paid: !pay.is_paid }).eq('id', pay.id);
                      if (!error) fetchPayments();
                    }} style={{width:'20px', height:'20px', cursor:'pointer'}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- FORM MODAL --- */}
      {showForm && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{marginBottom:'20px'}}>{editingId ? 'Bilgileri Düzenle' : 'Yeni Mülk Kaydı'}</h3>
            
            {error && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '10px',
                borderRadius: '8px',
                marginBottom: '15px',
                fontSize: '13px'
              }}>
                ⚠️ {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:'15px'}}>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                <input 
                  placeholder="Mülk Adı *" 
                  style={input} 
                  value={formData.property_name} 
                  onChange={e => setFormData({...formData, property_name: e.target.value})} 
                  required 
                  disabled={loading}
                />
                <input 
                  placeholder="Kiracı *" 
                  style={input} 
                  value={formData.tenant_name} 
                  onChange={e => setFormData({...formData, tenant_name: e.target.value})} 
                  required 
                  disabled={loading}
                />
              </div>
              <textarea 
                placeholder="Tam Adres" 
                style={{...input, height:'60px', resize:'none'}} 
                value={formData.full_address} 
                onChange={e => setFormData({...formData, full_address: e.target.value})} 
                disabled={loading}
              />
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                <input 
                  placeholder="Telefon" 
                  style={input} 
                  value={formData.tenant_phone} 
                  onChange={e => setFormData({...formData, tenant_phone: e.target.value})} 
                  disabled={loading}
                />
                <input 
                  placeholder="E-posta" 
                  style={input} 
                  value={formData.tenant_email} 
                  onChange={e => setFormData({...formData, tenant_email: e.target.value})} 
                  disabled={loading}
                />
              </div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                <div>
                  <label style={{display:'block', fontSize:'12px', color:'#64748b', marginBottom:'5px'}}>Zam Tarihi</label>
                  <input 
                    type="date" 
                    style={input} 
                    value={formData.next_increase_date} 
                    onChange={e => setFormData({...formData, next_increase_date: e.target.value})} 
                    disabled={loading}
                  />
                </div>
                <div>
                  <label style={{display:'block', fontSize:'12px', color:'#64748b', marginBottom:'5px'}}>Ödeme Günü</label>
                  <input 
                    type="number" 
                    placeholder="1-31" 
                    style={input} 
                    value={formData.payment_day} 
                    onChange={e => setFormData({...formData, payment_day: e.target.value})} 
                    min="1" 
                    max="31" 
                    disabled={loading}
                  />
                </div>
              </div>
              <div>
                <label style={{display:'block', fontSize:'12px', color:'#64748b', marginBottom:'5px'}}>Kira Miktarı (₺) *</label>
                <input 
                  type="number" 
                  placeholder="Kira" 
                  style={input} 
                  value={formData.rent_amount} 
                  onChange={e => setFormData({...formData, rent_amount: e.target.value})} 
                  required 
                  disabled={loading}
                />
              </div>
              <button 
                type="submit" 
                style={{...primaryBtn, opacity: loading ? 0.7 : 1}} 
                disabled={loading}
              >
                {loading ? 'İşleniyor...' : editingId ? 'Güncelle' : 'Kaydet'}
              </button>
              {editingId && (
                <button 
                  type="button" 
                  onClick={handleDelete} 
                  style={{...primaryBtn, backgroundColor: '#ef4444', opacity: loading ? 0.7 : 1}} 
                  disabled={loading}
                >
                  🗑️ Mülkü Sil
                </button>
              )}
              <button 
                type="button" 
                onClick={closeForm} 
                style={{background:'none', border:'none', color:'#64748b', cursor:'pointer'}} 
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
        <div style={overlay}>
          <div style={{...modal, textAlign:'center', border:'2px solid #f59e0b'}}>
            <div style={{fontSize:'40px'}}>👑</div>
            <h2>Premium'a Geçin</h2>
            <p>2 mülk sınırına ulaştınız.</p>
            <button onClick={() => {setIsPremium(true); setShowPaywall(false);}} style={{...primaryBtn, background:'#f59e0b', width:'100%'}}>Yükselt (199₺/Ay)</button>
            <button onClick={() => setShowPaywall(false)} style={{background:'none', border:'none', marginTop:'15px', color:'#64748b'}}>Daha Sonra</button>
          </div>
        </div>
      )}
    </div>
  );
}

// STİLLER
const layoutStyle = { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui' };
const sidebarStyle = { width: '270px', backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column', padding: '30px', justifyContent: 'space-between' };
const logoStyle = { color: '#fff', fontSize: '24px', fontWeight: '900' };
const navItem = { padding: '15px', color: '#94a3b8', cursor: 'pointer', borderRadius: '12px', marginBottom: '8px' };
const navActive = { ...navItem, backgroundColor: '#1e293b', color: '#fff' };
const premBtn = { ...navItem, color: '#f59e0b', fontWeight: 'bold' };
const mainContent = { flex: 1, padding: '50px', overflowY: 'auto' };
const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' };
const card = { background: '#fff', borderRadius: '24px', padding: '25px', border: '1px solid #f1f5f9', boxShadow:'0 4px 6px rgba(0,0,0,0.02)' };
const labelStyle = { color: '#64748b', fontSize: '11px', fontWeight: '800' };
const table = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' };
const td = { padding: '15px' };
const th = { padding: '15px', color:'#64748b', fontSize:'11px', fontWeight:800 };
const primaryBtn = { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '15px', fontWeight: '700', cursor: 'pointer' };
const actionBtn = { background: '#f1f5f9', border: 'none', padding: '8px 15px', borderRadius: '10px', color: '#1e293b', fontSize: '12px', fontWeight: 'bold', marginRight: '5px' };
const overlay = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter:'blur(4px)' };
const modal = { background: 'white', padding: '40px', borderRadius: '35px', width: '480px' };
const input = { padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box', backgroundColor:'#f8fafc' };
const payRow = { display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #f1f5f9', alignItems:'center' };
const logoutBtn = { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '10px', borderRadius: '12px', cursor: 'pointer' };

function AuthScreen() {
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
  
  return (
    <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' }}>
      <div style={{ background: 'white', padding: '40px', borderRadius: '35px', width: '350px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', fontWeight: '900', marginBottom:'30px' }}>RentGuard<span style={{color:'#2563eb'}}>.pro</span></h2>
        
        {authError && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '10px',
            borderRadius: '8px',
            marginBottom: '15px',
            fontSize: '13px'
          }}>
            ⚠️ {authError}
          </div>
        )}
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <input 
            placeholder="E-posta" 
            style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }} 
            onChange={e => setEmail(e.target.value)} 
            type="email"
            required
            disabled={authLoading}
          />
          <input 
            type="password" 
            placeholder="Şifre" 
            style={{ padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', boxSizing: 'border-box' }} 
            onChange={e => setPassword(e.target.value)} 
            required
            disabled={authLoading}
          />
          <button 
            style={{backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: '15px', fontWeight: '700', cursor: 'pointer', width: '100%', opacity: authLoading ? 0.7 : 1}} 
            disabled={authLoading}
          >
            {authLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
}