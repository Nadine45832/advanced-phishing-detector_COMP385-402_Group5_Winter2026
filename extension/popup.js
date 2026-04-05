const API = "http://localhost:8000";

const loginView      = document.getElementById("login-view");
const mainView       = document.getElementById("main-view");
const userInfo       = document.getElementById("user-info");
const userEmailEl    = document.getElementById("user-email");
const logoutBtn      = document.getElementById("logout-btn");

const usernameInput  = document.getElementById("username");
const passwordInput  = document.getElementById("password");
const loginBtn       = document.getElementById("login-btn");
const loginError     = document.getElementById("login-error");

const emptyState     = document.getElementById("empty-state");
const resultArea     = document.getElementById("result-area");
const riskBadge      = document.getElementById("risk-badge");
const riskLabel      = document.getElementById("risk-label");
const riskScore      = document.getElementById("risk-score");
const metaBlock      = document.getElementById("meta-block");
const reasonsList    = document.getElementById("reasons-list");
const feedbackSection= document.getElementById("feedback-section");

const fbSafe         = document.getElementById("fb-safe");
const fbPhish        = document.getElementById("fb-phish");
const feedbackComment= document.getElementById("feedback-comment");
const feedbackStatus = document.getElementById("feedback-status");

const rescanBtn      = document.getElementById("rescan-btn");

function showView(view) {
  loginView.classList.remove("active");
  mainView.classList.remove("active");
  view.classList.add("active");
}

function setLoginError(msg) {
  loginError.textContent = msg;
}

// ── Auth ──────────────────────────────────────────────────────────────────
async function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    setLoginError("Please enter username and password.");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="spinner"></span>';
  setLoginError("");

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setLoginError(data?.detail || data?.message || "Invalid credentials.");
      return;
    }

    const token = data.token || data.access_token;
    if (!token) {
      setLoginError("No token received from server.");
      return;
    }

    await chrome.storage.local.set({ authToken: token, authUser: username });
    initMainView(username);

  } catch (err) {
    setLoginError("Could not reach server. Check your connection.");
    console.error("Login error:", err);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Sign in";
  }
}

function logout() {
  chrome.storage.local.remove(["authToken", "authUser"], () => {
    userInfo.style.display = "none";
    usernameInput.value = "";
    passwordInput.value = "";
    setLoginError("");
    showView(loginView);
  });
}

// ── Main view init ────────────────────────────────────────────────────────
function initMainView(username) {
  userEmailEl.textContent = username;
  userInfo.style.display = "flex";
  showView(mainView);
  loadScanResult();
}

// ── Scan result rendering ─────────────────────────────────────────────────
function loadScanResult() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url || !tab.url.includes("mail.google.com")) {
      showEmpty();
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "getResult" }, (result) => {
      if (chrome.runtime.lastError || !result) {
        showEmpty();
        return;
      }
      renderResult(result);
    });
  });
}

function showEmpty() {
  emptyState.style.display = "block";
  resultArea.style.display = "none";
  feedbackSection.style.display = "none";
}

function renderResult(result) {
  emptyState.style.display = "none";
  resultArea.style.display = "block";
  feedbackSection.style.display = "block";
  feedbackStatus.textContent = "";
  feedbackStatus.className = "";
  enableFeedbackBtns();

  const level = (result.risk_level || "low").toLowerCase();
  const prob  = result.phishing_probability || 0;

  // Badge
  riskBadge.className = `risk-badge ${level}`;
  riskLabel.textContent = level.toUpperCase();
  riskScore.textContent = `${(prob * 100).toFixed(1)}%`;

  // Meta
  metaBlock.innerHTML = "";
  if (result.subject || result.from) {
    if (result.from) {
      metaBlock.innerHTML += `
        <div class="meta-row">
          <span class="meta-key">From</span>
          <span class="meta-val" title="${result.from}">${result.from}</span>
        </div>`;
    }
    if (result.subject) {
      metaBlock.innerHTML += `
        <div class="meta-row">
          <span class="meta-key">Subject</span>
          <span class="meta-val" title="${result.subject}">${result.subject}</span>
        </div>`;
    }
    if (result.scannedAt) {
      const t = new Date(result.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      metaBlock.innerHTML += `
        <div class="meta-row">
          <span class="meta-key">Scanned</span>
          <span class="meta-val">${t}</span>
        </div>`;
    }
  }

  // Reasons
  reasonsList.innerHTML = "";
  const reasons = result.reasons || [];
  reasons.slice(0, 6).forEach(r => {
    const li = document.createElement("li");
    li.textContent = r;
    reasonsList.appendChild(li);
  });

  // Store result reference for feedback
  window._currentResult = result;
}

// ── Feedback ──────────────────────────────────────────────────────────────
function enableFeedbackBtns() {
  fbSafe.disabled = false;
  fbPhish.disabled = false;
}

async function submitFeedback(userLabel) {
  const result = window._currentResult;
  if (!result) return;

  const comment = feedbackComment.value.trim();

  // Get token
  const stored = await new Promise(res => chrome.storage.local.get(["authToken", "authUser"], res));
  const token = stored.authToken;
  if (!token) {
    feedbackStatus.textContent = "Not authenticated. Please log in again.";
    feedbackStatus.className = "error";
    logout();
    return;
  }

  fbSafe.disabled = true;
  fbPhish.disabled = true;
  feedbackStatus.textContent = "";

  const payload = {
    email_subject: result.subject || "",
    email_from:    result.from    || "",
    risk_level:    result.risk_level,
    phishing_probability: result.phishing_probability,
    user_label:    userLabel,   // "safe" | "phishing"
    comment:       comment || undefined,
    scanned_at:    result.scannedAt,
  };

  try {
    const res = await fetch(`${API}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      feedbackStatus.textContent = "Session expired. Please log in again.";
      feedbackStatus.className = "error";
      logout();
      return;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.detail || `Server error ${res.status}`);
    }

    feedbackStatus.textContent = userLabel === "safe"
      ? "Marked as safe — thank you!"
      : "Reported as phishing — thank you!";
    feedbackStatus.className = "";
    feedbackComment.value = "";

    // Also notify content script so it can remove the banner
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "feedbackSubmitted", label: userLabel });
      }
    });

  } catch (err) {
    feedbackStatus.textContent = `Error: ${err.message}`;
    feedbackStatus.className = "error";
    enableFeedbackBtns();
    console.error("Feedback error:", err);
  }
}

// ── Re-scan ───────────────────────────────────────────────────────────────
function rescan() {
  rescanBtn.disabled = true;
  rescanBtn.textContent = "Scanning…";
  feedbackStatus.textContent = "";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { action: "rescan" }, (result) => {
      rescanBtn.disabled = false;
      rescanBtn.textContent = "Re-scan";
      if (result) renderResult(result);
      else showEmpty();
    });
  });
}

// ── Event listeners ───────────────────────────────────────────────────────
loginBtn.addEventListener("click", login);
logoutBtn.addEventListener("click", logout);
fbSafe.addEventListener("click",  () => submitFeedback("safe"));
fbPhish.addEventListener("click", () => submitFeedback("phishing"));
rescanBtn.addEventListener("click", rescan);

// Allow pressing Enter in login form
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});
usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") passwordInput.focus();
});

// ── Bootstrap ─────────────────────────────────────────────────────────────
chrome.storage.local.get(["authToken", "authUser"], (stored) => {
  if (stored.authToken) {
    initMainView(stored.authUser || "");
  } else {
    showView(loginView);
  }
});