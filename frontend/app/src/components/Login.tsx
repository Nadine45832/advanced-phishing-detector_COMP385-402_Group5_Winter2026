import { useState } from 'react'
import { API } from '../api';

export function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
 
  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
 
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      onLogin(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <div className="page-content">
        <div className="card">
        <h2>Sign in</h2>
        <p>Enter your credentials to continue</p>
    
        {error && <div className="alert alert-error">{error}</div>}
    
        <form onSubmit={submit}>
            <div className="field">
            <label>Username</label>
            <input type="text" placeholder="username" value={form.username} onChange={update("username")} required autoFocus />
            </div>
            <div className="field">
            <label>Password</label>
            <input type="password" placeholder="••••••••" value={form.password} onChange={update("password")} required />
            </div>
            <button className="btn" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
            </button>
        </form>
        </div>
    </div>
  );
}