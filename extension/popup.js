// ── DOM refs ──────────────────────────────────────────────────────────────
const loginView       = document.getElementById("login-view");
const mainView        = document.getElementById("main-view");
const userInfo        = document.getElementById("user-info");
const userEmailEl     = document.getElementById("user-email");
const logoutBtn       = document.getElementById("logout-btn");

const usernameInput   = document.getElementById("username");
const passwordInput   = document.getElementById("password");
const loginBtn        = document.getElementById("login-btn");
const loginError      = document.getElementById("login-error");

const emptyState      = document.getElementById("empty-state");
const resultArea      = document.getElementById("result-area");
const riskBadge       = document.getElementById("risk-badge");
const riskLabel       = document.getElementById("risk-label");
const riskScore       = document.getElementById("risk-score");
const metaBlock       = document.getElementById("meta-block");
const reasonsList     = document.getElementById("reasons-list");
const feedbackSection = document.getElementById("feedback-section");

const fbSafe          = document.getElementById("fb-safe");
const fbPhish         = document.getElementById("fb-phish");
const feedbackComment = document.getElementById("feedback-comment");
const feedbackStatus  = document.getElementById("feedback-status");
const rescanBtn       = document.getElementById("rescan-btn");

function sendToBackground(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { ok: false, error: "No response from background." });
      }
    });
  });
}

function showView(view) {
  loginView.classList.remove("active");
  mainView.classList.remove("active");
  view.classList.add("active");
}

function setLoginError(msg) {
  loginError.textContent = msg;
}

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

  // background.js handles the fetch and stores the token
  const response = await sendToBackground({
    action: "login",
    payload: { username, password },
  });

  loginBtn.disabled = false;
  loginBtn.textContent = "Sign in";

  if (!response.ok) {
    setLoginError(response.error || "Login failed.");
    return;
  }

  // Store the username for display (token already saved by background)
  await chrome.storage.local.set({ authUser: username });
  initMainView(username);
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

function initMainView(username) {
  userEmailEl.textContent = username;
  userInfo.style.display = "flex";
  showView(mainView);
  loadScanResult();
}

function loadScanResult() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url || !tab.url.includes("mail.google.com")) {
      showEmpty();
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "getResult" }, (result) => {
      if (chrome.runtime.lastError || !result) { showEmpty(); return; }
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

  riskBadge.className = `risk-badge ${level}`;
  riskLabel.textContent = level.toUpperCase();
  riskScore.textContent = `${(prob * 100).toFixed(1)}%`;

  metaBlock.innerHTML = "";
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

  reasonsList.innerHTML = "";
  (result.reasons || []).slice(0, 6).forEach(r => {
    const li = document.createElement("li");
    li.textContent = r;
    reasonsList.appendChild(li);
  });

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

  // Guard: check token exists before attempting
  const stored = await new Promise(res => chrome.storage.local.get(["authToken"], res));
  if (!stored.authToken) {
    feedbackStatus.textContent = "Not authenticated. Please log in again.";
    feedbackStatus.className = "error";
    logout();
    return;
  }

  fbSafe.disabled = true;
  fbPhish.disabled = true;
  feedbackStatus.textContent = "";

  const payload = {
    email_subject:        result.subject || "",
    email_from:           result.from    || "",
    risk_level:           result.risk_level,
    phishing_probability: result.phishing_probability,
    user_label:           userLabel,
    comment:              feedbackComment.value.trim() || undefined,
    scanned_at:           result.scannedAt,
  };

  // background.js handles the fetch with the stored token
  const response = await sendToBackground({ action: "feedback", payload });

  if (!response.ok) {
    if (response.error === "SESSION_EXPIRED") {
      feedbackStatus.textContent = "Session expired. Please log in again.";
      feedbackStatus.className = "error";
      logout();
      return;
    }
    feedbackStatus.textContent = `Error: ${response.error}`;
    feedbackStatus.className = "error";
    enableFeedbackBtns();
    return;
  }

  feedbackStatus.textContent = userLabel === "safe"
    ? "Marked as safe — thank you!"
    : "Reported as phishing — thank you!";
  feedbackStatus.className = "";
  feedbackComment.value = "";

  // Tell the content script to dismiss the banner
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "feedbackSubmitted", label: userLabel });
    }
  });
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

passwordInput.addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });
usernameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") passwordInput.focus(); });

// ── Bootstrap ─────────────────────────────────────────────────────────────
chrome.storage.local.get(["authToken", "authUser"], (stored) => {
  if (stored.authToken) {
    initMainView(stored.authUser || "");
  } else {
    showView(loginView);
  }
});