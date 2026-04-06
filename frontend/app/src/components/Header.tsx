export function Header({ currentUser, page, onNav, onLogout }) {
  return (
    <div className="header">
      <div className="header-left">
        <span className="logo">Advanced Phishing Detector</span>
        <nav className="nav">
          <button className={`nav-link ${page === "users" ? "active" : ""}`} onClick={() => onNav("users")}>
            All Users
          </button>
          <button className={`nav-link ${page === "feedback" ? "active" : ""}`} onClick={() => onNav("feedback")}>
            Feedbacks
          </button>
          <button className={`nav-link ${page === "create" ? "active" : ""}`} onClick={() => onNav("stats")}>
            Statistics
          </button>
          <button className={`nav-link ${page === "create" ? "active" : ""}`} onClick={() => onNav("create")}>
            Create User
          </button>
        </nav>
      </div>
      <div className="header-right">
        <div className="user-pill">
          <span>{currentUser.username}</span>
          <span className="badge">{currentUser.role}</span>
        </div>
        <button className="sign-out-btn" onClick={onLogout}>Sign out</button>
      </div>
    </div>
  );
}
 