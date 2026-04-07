import { useState } from 'react'
import { API } from '../api';

export function CreateUser({ token, currentUser }) {
  const blank = { username: "", password_hash: "", role: "user", first_name: "", last_name: "" };
  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const isAdmin = currentUser?.role === "admin";

  if (!isAdmin) {
    return null;
  }
 
  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
 
  const submit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to create user");
      setSuccess(`User "${data.username}" created successfully.`);
      setForm(blank);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <div className="page-content">
      <div className="card">
        <h2>Create User</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={submit}>
            <div className="field">
                <label>First Name</label>
                <input placeholder="first name" value={form.first_name} onChange={update("first_name")} required />
            </div>
            <div className="field">
                <label>Last Name</label>
                <input placeholder="last name" value={form.last_name} onChange={update("last_name")} required />
            </div>
          <div className="field">
                <label>Username</label>
                <input placeholder="email" value={form.username} onChange={update("username")} required />
          </div>
          <div className="field">
                <label>Password</label>
                <input type="password" placeholder="••••••••" value={form.password_hash} onChange={update("password_hash")} required />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={form.role} onChange={update("role")}>
              <option value="user">User</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create User"}
          </button>
        </form>
      </div>
    </div>
  );
}