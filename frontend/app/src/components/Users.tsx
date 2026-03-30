import { useEffect, useState } from "react";
import { API } from "../api";

export function Users({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
 
  useEffect(() => {
    fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setUsers(data); setLoading(false); })
      .catch(() => { setError("Failed to load users."); setLoading(false); });
  }, [token]);
 
  return (
    <div className="page-content">
      <div className="users-card">
        <div className="users-card-header">
          <h2>All Users</h2>
          {!loading && <span className="users-count">{users.length} user{users.length !== 1 ? "s" : ""}</span>}
        </div>
        {loading && <div className="loading">Loading…</div>}
        {error && <div className="alert alert-error" style={{margin:"16px"}}>{error}</div>}
        {!loading && !error && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="td-muted">{u.id}</td>
                  <td>{u.first_name} {u.last_name}</td>
                  <td className="td-muted">{u.username}</td>
                  <td><span className="badge">{u.role}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}