// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

/* ================= ENV ================= */
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const isMobile = window.innerWidth < 768;

/* ================= SUPABASE ================= */
const supabaseUrl = 'https://pwnffmzmrclvzsrikbdc.supabase.co';
const supabaseKey = 'sb_publishable_JMQYVqglFtTZsHhUv-o-JQ_fCR-PFqk';
const supabase = createClient(supabaseUrl, supabaseKey);

const FREE_LIMIT = 2;

export default function App() {
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeProperty, setActiveProperty] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    property_name: '',
    tenant_name: '',
    rent_amount: '',
    payment_day: 1
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) =>
      setUser(s?.user ?? null)
    );
    return () => data.subscription.unsubscribe();
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
    const { data } = await supabase.from('payments').select('*');
    setPayments(data || []);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...formData,
      rent_amount: Number(formData.rent_amount),
      payment_day: Number(formData.payment_day),
      user_id: user.id
    };

    if (editingId) {
      await supabase.from('properties').update(payload).eq('id', editingId);
    } else {
      await supabase.from('properties').insert(payload);
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({ property_name: '', tenant_name: '', rent_amount: '', payment_day: 1 });
    fetchProperties();
  }

  if (!user) return <AuthScreen />;

  const totalMonthly = properties.reduce((s, p) => s + Number(p.rent_amount), 0);
  const chartData = properties.map(p => ({
    name: p.property_name.substring(0, 6),
    miktar: Number(p.rent_amount)
  }));

  return (
    <div style={layoutStyle}>
      {!isMobile && (
        <aside style={sidebarStyle}>
          <div>
            <h2 style={logoStyle}>RentGuard<span>.pro</span></h2>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={logoutBtn}>Çıkış</button>
        </aside>
      )}

      <main style={mainContent}>
        <header style={header}>
          <div>
            <h1 style={{ margin: 0 }}>Yönetim Paneli</h1>
            <small style={{ color: muted }}>{user.email}</small>
          </div>
          <button onClick={() => setShowForm(true)} style={primaryBtn}>
            + Yeni Mülk
          </button>
        </header>

        <div style={statsGrid}>
          <div style={card}><small>AYLIK GELİR</small><h3>{totalMonthly} ₺</h3></div>
          <div style={card}><small>PORTFÖY</small><h3>{properties.length}</h3></div>
          <div style={card}><small>PLAN</small><h3>Aktif</h3></div>
        </div>

        <div style={card}>
          {!isMobile ? (
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>MÜLK</th>
                  <th style={th}>KİRACI</th>
                  <th style={th}>KİRA</th>
                </tr>
              </thead>
              <tbody>
                {properties.map(p => (
                  <tr key={p.id}>
                    <td style={td}>{p.property_name}</td>
                    <td style={td}>{p.tenant_name}</td>
                    <td style={td}>{p.rent_amount} ₺</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            properties.map(p => (
              <div key={p.id} style={{ ...card, marginBottom: 15 }}>
                <b>{p.property_name}</b>
                <p style={{ color: muted }}>{p.tenant_name}</p>
                <p>{p.rent_amount} ₺</p>
              </div>
            ))
          )}
        </div>

        <div style={{ ...card, height: 260, marginTop: 20 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke={muted} />
              <Tooltip />
              <Bar dataKey="miktar" fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </main>

      {showForm && (
        <div style={overlay}>
          <div style={modal}>
            <h3>Yeni Mülk</h3>
            <form onSubmit={handleSubmit}>
              <input style={input} placeholder="Mülk" onChange={e => setFormData({ ...formData, property_name: e.target.value })} />
              <input style={input} placeholder="Kiracı" onChange={e => setFormData({ ...formData, tenant_name: e.target.value })} />
              <input style={input} type="number" placeholder="Kira" onChange={e => setFormData({ ...formData, rent_amount: e.target.value })} />
              <button style={primaryBtn}>Kaydet</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= AUTH ================= */
function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <div style={authWrap}>
      <form onSubmit={async e => {
        e.preventDefault();
        await supabase.auth.signInWithPassword({ email, password });
      }} style={authBox}>
        <h2>RentGuard.pro</h2>
        <input style={input} placeholder="E-posta" onChange={e => setEmail(e.target.value)} />
        <input style={input} type="password" placeholder="Şifre" onChange={e => setPassword(e.target.value)} />
        <button style={primaryBtn}>Giriş</button>
      </form>
    </div>
  );
}

/* ================= STYLES ================= */
const bg = isDark ? '#020617' : '#f8fafc';
const text = isDark ? '#e5e7eb' : '#0f172a';
const muted = isDark ? '#94a3b8' : '#64748b';
const border = isDark ? '#1e293b' : '#e2e8f0';

const layoutStyle = { display: 'flex', height: '100vh', backgroundColor: bg, color: text };
const sidebarStyle = { width: '270px', backgroundColor: isDark ? '#020617' : '#0f172a', padding: '30px', color: '#fff' };
const logoStyle = { fontSize: '24px', fontWeight: 900 };
const mainContent = { flex: 1, padding: isMobile ? '20px' : '50px' };
const header = { display: 'flex', justifyContent: 'space-between', marginBottom: '30px' };
const statsGrid = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: '20px' };
const card = { background: bg, border: `1px solid ${border}`, borderRadius: '24px', padding: '25px' };
const table = { width: '100%', borderCollapse: 'collapse' };
const th = { padding: '15px', color: muted, fontSize: '11px', fontWeight: 800 };
const td = { padding: '15px', color: text };
const primaryBtn = { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '12px', cursor: 'pointer' };
const input = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '12px', border: `1px solid ${border}`, background: bg, color: text };
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center' };
const modal = { background: bg, padding: '30px', borderRadius: '24px', width: isMobile ? '90%' : '420px' };
const logoutBtn = { background: 'none', border: '1px solid #334155', color: '#94a3b8', padding: '10px', borderRadius: '12px' };
const authWrap = { height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: bg };
const authBox = { background: bg, padding: '40px', borderRadius: '24px', width: '340px', border: `1px solid ${border}` };