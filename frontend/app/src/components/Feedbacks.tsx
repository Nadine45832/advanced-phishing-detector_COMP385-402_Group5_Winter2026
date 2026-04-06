import { useEffect, useState } from "react";
import { API } from "../api";
import { FeedbackDialog } from "./Feedback";

export function Feedbacks({ token }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [selected, setSelected]   = useState(null);
 
  useEffect(() => {
    fetch(`${API}/feedback`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then((data) => { setFeedbacks(data); setLoading(false); })
      .catch(() => { setError("Failed to load feedback."); setLoading(false); });
  }, [token]);

 
  return (
    <> 
      <div className="page-content">
        <div className="users-card users-card--extended">
          <div className="users-card-header">
            <h2>Feedback</h2>
            {!loading && (
              <span className="users-count">
                {feedbacks.length} entr{feedbacks.length !== 1 ? "ies" : "y"}
              </span>
            )}
          </div>
 
          {loading && <div className="loading">Loading…</div>}
          {error   && <div className="alert alert-error" style={{ margin: "16px" }}>{error}</div>}
 
          {!loading && !error && (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Subject</th>
                  <th>Sender</th>
                  <th>Verdict</th>
                  <th>Comment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {feedbacks.map((f) => (
                  <tr key={f.id}>
                    <td className="td-muted">{f.id}</td>
                    <td>
                      <button
                        className="link-btn"
                        onClick={() => setSelected(f)}
                        title="Click to open"
                      >
                        {f.email_subject ?? "—"}
                      </button>
                    </td>
                    <td className="td-muted">{f.email_sender ?? "—"}</td>
                    <td>
                      <span className={`badge ${f.is_safe ? "badge-safe" : "badge-phish"}`}>
                        {f.is_safe ? "Safe" : "Phishing"}
                      </span>
                    </td>
                    <td className="td-muted td-truncate" title={f.content}>
                      {f.content ? (f.content.substring(0, 20) + "...") : <em>No comment</em>}
                    </td>
                    <td className="td-muted">
                      {f.created_at
                        ? new Date(f.created_at).toLocaleDateString(undefined, {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
 
      {selected && (
        <FeedbackDialog
          feedback={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}