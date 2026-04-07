import { useEffect, useState } from "react";
import { API } from "../api";

export function Users({ token, currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    role: "user",
    password_hash: "",
  });
  const isAdmin = currentUser?.role === "admin";
  const formatRole = (role) => role ? role.charAt(0).toUpperCase() + role.slice(1) : "";
  const title = isAdmin ? "All Users" : "My Profile";
 
  useEffect(() => {
    fetch(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setUsers(data); setLoading(false); })
      .catch(() => { setError("Failed to load users."); setLoading(false); });
  }, [token]);

  const canEditUser = (userId) => isAdmin || userId === currentUser?.id;

  const openEditor = (user) => {
    setError("");
    setSuccess("");
    setEditingUserId(user.id);
    setEditForm({
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      password_hash: "",
    });
  };

  const closeEditor = () => {
    setEditingUserId(null);
    setEditForm({
      username: "",
      first_name: "",
      last_name: "",
      role: "user",
      password_hash: "",
    });
  };

  const updateEdit = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = async (userId) => {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const payload = {
        username: editForm.username,
        first_name: editForm.first_name,
        last_name: editForm.last_name,
      };

      const requestBody: Record<string, string> = { ...payload };

      if (isAdmin) {
        requestBody.role = editForm.role;
      }

      if (editForm.password_hash.trim()) {
        requestBody.password_hash = editForm.password_hash;
      }

      const response = await fetch(`${API}/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Failed to update user");
      }

      setUsers((prevUsers) => prevUsers.map((u) => (u.id === userId ? data : u)));
      setSuccess("Profile updated successfully.");
      closeEditor();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
 
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
          <h2>{title}</h2>
          {!loading && <span className="users-count">{users.length} user{users.length !== 1 ? "s" : ""}</span>}
        </div>
        
        {loading && <div className="loading">Loading…</div>}
        {error && <div className="alert alert-error" style={{margin:"16px"}}>{error}</div>}
        {success && <div className="alert alert-success" style={{margin:"16px"}}>{success}</div>}
        
        {/* FIXED: Removed '!error &&' so the table stays visible even if a delete fails */}
        {!loading && (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="td-muted">{u.id}</td>
                  <td>{u.first_name} {u.last_name}</td>
                  <td className="td-muted">{u.username}</td>
                  <td><span className="badge">{formatRole(u.role)}</span></td>
                  <td>
                    {canEditUser(u.id) && (
                      <button
                        onClick={() => openEditor(u)}
                        style={{
                          backgroundColor: "#2563eb",
                          color: "white",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          marginRight: isAdmin ? "8px" : "0",
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {isAdmin && (
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
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {editingUserId !== null && (
          <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb" }}>
            <h3 style={{ marginTop: 0 }}>Edit User</h3>
            <div className="field">
              <label>First Name</label>
              <input value={editForm.first_name} onChange={updateEdit("first_name")} />
            </div>
            <div className="field">
              <label>Last Name</label>
              <input value={editForm.last_name} onChange={updateEdit("last_name")} />
            </div>
            <div className="field">
              <label>Username</label>
              <input value={editForm.username} onChange={updateEdit("username")} />
            </div>
            {isAdmin && (
              <div className="field">
                <label>Role</label>
                <select value={editForm.role} onChange={updateEdit("role")}>
                  <option value="user">User</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            )}
            <div className="field">
              <label>New Password (optional)</label>
              <input
                type="password"
                placeholder="Leave blank to keep current password"
                value={editForm.password_hash}
                onChange={updateEdit("password_hash")}
              />
            </div>
            <div>
              <button
                className="btn"
                disabled={saving}
                onClick={() => handleSave(editingUserId)}
                style={{ marginRight: "8px" }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button className="btn" onClick={closeEditor} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}