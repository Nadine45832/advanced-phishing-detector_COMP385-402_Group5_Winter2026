import { useEffect, useState } from "react";
import { API } from "../api";

export function Users({ token, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isAdmin = currentUser?.role === "admin";
  const formatRole = (role) => role ? role.charAt(0).toUpperCase() + role.slice(1) : "";
 
  useEffect(() => {
    fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setUsers(data); setLoading(false); })
      .catch(() => { setError("Failed to load users."); setLoading(false); });
  }, [token]);
 
  // --- Delete Handler ---
  const handleDelete = async (userId) => {
    // 1. Confirm with the admin before deleting
    if (!window.confirm("Are you sure you want to delete this user? Their reported emails and feedback will also be removed.")) {
      return;
    }

    setError(""); // Clear any previous errors

    try {
      // 2. Call the new FastAPI DELETE endpoint
      const response = await fetch(`${API}/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        // If it fails (e.g. they try to delete themselves), catch the detail message
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to delete user");
      }

      // 3. Success! Remove the user from the UI instantly
      setUsers((prevUsers) => prevUsers.filter((u) => u.id !== userId));
      
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page-content">
      <div className="users-card">
        <div className="users-card-header">
          <h2>All Users</h2>
          {!loading && <span className="users-count">{users.length} user{users.length !== 1 ? "s" : ""}</span>}
        </div>
        
        {loading && <div className="loading">Loading…</div>}
        {error && <div className="alert alert-error" style={{margin:"16px"}}>{error}</div>}
        
        {/* FIXED: Removed '!error &&' so the table stays visible even if a delete fails */}
        {!loading && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="td-muted">{u.id}</td>
                  <td>{u.first_name} {u.last_name}</td>
                  <td className="td-muted">{u.username}</td>
                  <td><span className="badge">{formatRole(u.role)}</span></td>
                  {isAdmin && (
                    <td>
                      <button 
                        onClick={() => handleDelete(u.id)}
                        style={{
                          backgroundColor: "#ef4444", 
                          color: "white", 
                          border: "none", 
                          padding: "4px 8px", 
                          borderRadius: "4px", 
                          cursor: "pointer"
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}