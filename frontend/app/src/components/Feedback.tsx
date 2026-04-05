
export function FeedbackDialog({ feedback, onClose }) {
 
  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }
 
  return (
    <div className="dialog-backdrop" onClick={handleBackdropClick}>
      <div className="dialog">
        <div className="dialog-header">
          <div>
            <div className="dialog-title">Feedback</div>
            <div className="dialog-sub">{feedback.email_subject ?? "—"}</div>
          </div>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>
 
        <div className="dialog-body">
          <div className="field">
            <label>Sender</label>
            <div className="field-static">{feedback.email_sender ?? "—"}</div>
          </div>
 
          <div className="field">
            <label>Comment</label>
            <textarea
              rows={4}
              value={feedback.content}
              disabled={true}
              placeholder="Add a comment…"
            />
          </div>
 
          <div className="field">
            <label>Verdict</label>
            <div className="toggle-row">
                {feedback.is_safe ? "Safe" : "Phishing"}
            </div>
          </div>
        </div>
 
        <div className="dialog-footer">
          <button className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}