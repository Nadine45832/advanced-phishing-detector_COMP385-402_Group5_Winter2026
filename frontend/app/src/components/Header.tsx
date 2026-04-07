export function Header({ currentUser, page, onNav, onLogout }) {
  const isAdmin = currentUser?.role === "admin";
  const displayRole = currentUser?.role
    ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)
    : "";

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
          <button className={`nav-link ${page === "stats" ? "active" : ""}`} onClick={() => onNav("stats") }>
            Statistics
          </button>
          {isAdmin && (
            <button className={`nav-link ${page === "create" ? "active" : ""}`} onClick={() => onNav("create") }>
              Create User
            </button>
          )}
        </nav>
      </div>
      <div className="header-right">
        <div className="user-pill">
          <span>{currentUser.username}</span>
          <span className="badge">{displayRole}</span>
        </div>
        <button className="sign-out-btn" onClick={onLogout}>Sign out</button>
      </div>
    </div>
  );
}
 