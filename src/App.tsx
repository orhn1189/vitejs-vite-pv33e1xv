// @ts-nocheck
import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ================= SUPABASE ================= */
const supabase = createClient(
  "https://pwnffmzmrclvzsrikbdc.supabase.co",
  "sb_publishable_JMQYVqglFtTZsHhUv-o-JQ_fCR-PFqk"
);

const FREE_LIMIT = 2;

/* ================= THEMES ================= */
const light = {
  bg: "#f8fafc",
  sidebar: "#0f172a",
  card: "#ffffff",
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  primary: "#2563eb",
  soft: "#f1f5f9",
};

const dark = {
  bg: "#020617",
  sidebar: "#020617",
  card: "#020617",
  text: "#e5e7eb",
  muted: "#94a3b8",
  border: "#1e293b",
  primary: "#3b82f6",
  soft: "#020617",
};

/* ================= APP ================= */
export default function App() {
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activeProperty, setActiveProperty] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [darkMode, setDarkMode] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  const theme = darkMode ? dark : light;
  const isMobile = window.innerWidth < 768;

  const [form, setForm] = useState({
    property_name: "",
    tenant_name: "",
    rent_amount: "",
    payment_day: 1,
  });

  /* ================= AUTH ================= */
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
      loadProperties();
      loadPayments();
    }
  }, [user]);

  async function loadProperties() {
    const { data } = await supabase
      .from("properties")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setProperties(data || []);
  }

  async function loadPayments() {
    const { data } = await supabase.from("payments").select("*");
    setPayments(data || []);
  }

  async function saveProperty(e) {
    e.preventDefault();
    const payload = {
      ...form,
      rent_amount: Number(form.rent_amount),
      payment_day: Number(form.payment_day),
      user_id: user.id,
    };

    if (editingId) {
      await supabase.from("properties").update(payload).eq("id", editingId);
    } else {
      await supabase.from("properties").insert(payload);
    }
    setShowForm(false);
    setEditingId(null);
    setForm({ property_name: "", tenant_name: "", rent_amount: "", payment_day: 1 });
    loadProperties();
  }

  if (!user) return <Auth theme={theme} />;

  const total = properties.reduce((a, b) => a + Number(b.rent_amount), 0);
  const chart = properties.map((p) => ({
    name: p.property_name.slice(0, 6),
    kira: Number(p.rent_amount),
  }));

  /* ================= STYLES ================= */
  const card = {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 20,
    padding: 20,
    color: theme.text,
  };

  const btn = {
    background: theme.primary,
    color: "#fff",
    border: "none",
    padding: "10px 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: theme.bg }}>
      {/* SIDEBAR */}
      {!isMobile && (
        <aside
          style={{
            width: 260,
            background: theme.sidebar,
            color: "#fff",
            padding: 30,
          }}
        >
          <h2>RentGuard.pro</h2>
          <button onClick={() => setDarkMode(!darkMode)} style={btn}>
            {darkMode ? "🌞" : "🌙"}
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ ...btn, marginTop: 20 }}
          >
            Çıkış
          </button>
        </aside>
      )}

      {/* CONTENT */}
      <main style={{ flex: 1, padding: isMobile ? 20 : 40 }}>
        <h1 style={{ color: theme.text }}>Dashboard</h1>
        <p style={{ color: theme.muted }}>{user.email}</p>

        {/* STATS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)",
            gap: 20,
          }}
        >
          <div style={card}>Aylık Gelir<br /><b>{total} ₺</b></div>
          <div style={card}>Mülk Sayısı<br /><b>{properties.length}</b></div>
          <div style={card}>
            <button
              style={btn}
              onClick={() =>
                properties.length >= FREE_LIMIT ? alert("Premium!") : setShowForm(true)
              }
            >
              + Yeni Mülk
            </button>
          </div>
        </div>

        {/* LIST */}
        <div style={{ marginTop: 30 }}>
          {isMobile ? (
            properties.map((p) => (
              <div key={p.id} style={{ ...card, marginBottom: 15 }}>
                <b>{p.property_name}</b>
                <p style={{ color: theme.muted }}>{p.tenant_name}</p>
                <p>{p.rent_amount} ₺</p>
              </div>
            ))
          ) : (
            <table width="100%" style={{ color: theme.text }}>
              <thead>
                <tr>
                  <th>Mülk</th>
                  <th>Kiracı</th>
                  <th>Kira</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr key={p.id}>
                    <td>{p.property_name}</td>
                    <td>{p.tenant_name}</td>
                    <td>{p.rent_amount} ₺</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* CHART */}
        <div style={{ ...card, marginTop: 30, height: 250 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <XAxis dataKey="name" />
              <Tooltip />
              <Bar dataKey="kira" fill={theme.primary} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </main>

      {/* FORM */}
      {showForm && (
        <div style={overlay}>
          <div style={{ ...card, width: isMobile ? "90%" : 400 }}>
            <h3>Mülk Ekle</h3>
            <form onSubmit={saveProperty}>
              <input placeholder="Mülk" style={input(theme)} onChange={e=>setForm({...form,property_name:e.target.value})}/>
              <input placeholder="Kiracı" style={input(theme)} onChange={e=>setForm({...form,tenant_name:e.target.value})}/>
              <input placeholder="Kira" type="number" style={input(theme)} onChange={e=>setForm({...form,rent_amount:e.target.value})}/>
              <button style={{ ...btn, width: "100%" }}>Kaydet</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= AUTH ================= */
function Auth({ theme }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center", background: theme.bg }}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await supabase.auth.signInWithPassword({ email, password });
        }}
        style={{
          background: theme.card,
          padding: 30,
          borderRadius: 20,
          width: 320,
          color: theme.text,
        }}
      >
        <h2>RentGuard.pro</h2>
        <input style={input(theme)} placeholder="Email" onChange={e=>setEmail(e.target.value)} />
        <input style={input(theme)} type="password" placeholder="Şifre" onChange={e=>setPassword(e.target.value)} />
        <button style={{ marginTop: 10, width: "100%", background: theme.primary, color: "#fff" }}>
          Giriş
        </button>
      </form>
    </div>
  );
}

/* ================= HELPERS ================= */
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.6)",
  display: "grid",
  placeItems: "center",
};

const input = (theme) => ({
  width: "100%",
  padding: 10,
  marginBottom: 10,
  borderRadius: 10,
  border: `1px solid ${theme.border}`,
  background: theme.soft,
  color: theme.text,
});