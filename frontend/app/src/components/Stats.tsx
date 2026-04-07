import { useState, useEffect } from "react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { API } from "../api";

const COLORS = {
  phishing: "#e53935",
  safe: "#43a047",
  bar1: "#e53935",
  bar2: "#f5a623",
};

// ── Helpers ────────────────────────────────────────────────────────────────
function shortDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatCard({ title, children, loading }) {
  return (
    <div className="stat-card">
      <div className="stat-card-title">{title}</div>
      {loading
        ? <div className="stat-loading">Loading…</div>
        : children}
    </div>
  );
}

export function Stats({ token, currentUser }) {
  const [users, setUsers]       = useState([]);
  const [userId, setUserId]     = useState("all");
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const isAdmin = currentUser?.role === "admin";

  // Fetch user list for dropdown
  useEffect(() => {
    if (!currentUser) {
      return;
    }

    if (isAdmin) {
      fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.ok ? r.json() : [])
        .then((data) => {
          setUsers(data);
          setUserId("all");
        })
        .catch(() => {});
      return;
    }

    setUsers([currentUser]);
    setUserId(String(currentUser.id));
  }, [token, currentUser, isAdmin]);

  // Fetch stats whenever user filter changes
  useEffect(() => {
    setLoading(true);
    setError("");
    const qs = userId !== "all" ? `?user_id=${userId}` : "";
    fetch(`${API}/stats${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then((data) => { setStats(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [token, userId]);

  const pieData = stats
    ? [
        { name: "Phishing", value: stats.pie.phishing },
        { name: "Safe",     value: stats.pie.safe },
      ]
    : [];

  const barPhishingData = (stats?.bar_phishing ?? []).map((d) => ({
    ...d,
    label: shortDate(d.date),
  }));

  const barIncorrectData = (stats?.bar_incorrect ?? []).map((d) => ({
    ...d,
    label: shortDate(d.date),
  }));

  return (
    <>
      <div className="stats-page-content">
        <div className="stats-header">
          <div>
            <h2 className="stats-title">Analytics</h2>
            <p className="stats-sub">Email threat overview</p>
          </div>
          {isAdmin ? (
            <select
              className="user-select"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              <option value="all">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name && u.last_name
                    ? `${u.first_name} ${u.last_name}`
                    : u.username}
                </option>
              ))}
            </select>
          ) : (
            <div className="user-pill">
              <span>{currentUser?.first_name && currentUser?.last_name ? `${currentUser.first_name} ${currentUser.last_name}` : currentUser?.username}</span>
              <span className="badge">your stats</span>
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-error" style={{ margin: "0 0 20px" }}>{error}</div>
        )}

        <div className="charts-grid">

          <StatCard title="Phishing vs Safe — last 30 days" loading={loading}>
            {pieData.every((d) => d.value === 0) ? (
              <div className="stat-empty">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    <Cell fill={COLORS.phishing} />
                    <Cell fill={COLORS.safe} />
                  </Pie>
                  <Tooltip formatter={(v) => [`${v} emails`]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </StatCard>

          <StatCard title="Phishing emails — last 7 days" loading={loading}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barPhishingData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  formatter={(v) => [`${v} emails`, "Phishing"]}
                />
                <Bar dataKey="count" fill={COLORS.bar1} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </StatCard>

          <StatCard title="Incorrect predictions — last 7 days" loading={loading}>
            <p className="stat-card-desc">
              Emails flagged as medium/high risk but marked safe by the user
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barIncorrectData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  formatter={(v) => [`${v} emails`, "Incorrect"]}
                />
                <Bar dataKey="count" fill={COLORS.bar2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </StatCard>

        </div>
      </div>
    </>
  );
}