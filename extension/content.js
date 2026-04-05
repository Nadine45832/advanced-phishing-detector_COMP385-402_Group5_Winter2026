const CONFIG = {
  targetDomain: "mail.google.com",
  bodySelectors: [".a3s.aiL", ".ii"],
  apiUrl: "http://localhost:8000/predict",
  feedbackUrl: "http://localhost:8000/feedback",
  debounceMs: 800,
  fetchTimeoutMs: 4000
};

function isGmail() {
  return window.location.hostname.includes(CONFIG.targetDomain);
}

function getEmailBodyElement() {
  for (const sel of CONFIG.bodySelectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function cleanBodyText(raw) {
  if (!raw) return "";
  let text = raw.replace(/\s+/g, " ").trim();
  text = text.replace(/-----Original Message-----.*$/i, "");
  text = text.replace(/From:.*$/i, "");
  return text;
}

function extractLinksFromBody(bodyEl) {
  const links = [];
  bodyEl.querySelectorAll("a[href]").forEach(a => {
    const href = a.getAttribute("href") || "";
    const text = (a.innerText || "").trim();

    const suspiciousFlags = [];
    if (/^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(href)) suspiciousFlags.push("ip_address_url");
    if (href.includes("xn--")) suspiciousFlags.push("punycode_domain");
    if (/bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd/i.test(href)) suspiciousFlags.push("shortened_url");

    try {
      const hrefDomain = new URL(href).hostname.replace(/^www\./, "");
      const textUrlMatch = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
      if (textUrlMatch) {
        const t = textUrlMatch[0].replace(/^www\./, "");
        if (hrefDomain && !t.includes(hrefDomain)) suspiciousFlags.push("visible_domain_mismatch");
      }
    } catch (_) {}

    links.push({ href, text, suspiciousFlags });
  });

  const seen = new Set();
  return links.filter(l => {
    const key = `${l.href}|${l.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readEmailContent() {
  const bodyEl = getEmailBodyElement();
  if (!bodyEl) return null;

  const clone = bodyEl.cloneNode(true);
  clone.querySelectorAll("blockquote, .gmail_quote").forEach(n => n.remove());

  const bodyText = cleanBodyText(clone.textContent || "");
  const links = extractLinksFromBody(bodyEl);

  const subjectEl  = document.querySelector("h2.hP");
  const fromNameEl = document.querySelector(".gD");
  const fromEmailEl= document.querySelector(".gD[email], .gD span[email]");

  const subject = subjectEl ? subjectEl.textContent.trim() : "";
  const from =
    (fromEmailEl && (fromEmailEl.getAttribute("email") || fromEmailEl.getAttribute("data-hovercard-id"))) ||
    (fromNameEl  && (fromNameEl.getAttribute("email")  || fromNameEl.textContent.trim())) ||
    "";

  return { subject, from, bodyText, links };
}

// ── Banner ────────────────────────────────────────────────────────────────

/**
 * Posts feedback to the API using the stored auth token.
 * Returns true on success, false on failure.
 */
async function postFeedback(result, userLabel) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["authToken"], async (stored) => {
      const token = stored.authToken;
      if (!token) {
        console.warn("PhishGuard: no auth token, skipping feedback.");
        resolve(false);
        return;
      }

      const payload = {
        email_subject:        result.subject || "",
        email_from:           result.from    || "",
        risk_level:           result.risk_level,
        phishing_probability: result.phishing_probability,
        user_label:           userLabel,
        scanned_at:           result.scannedAt,
      };

      try {
        const res = await fetch(CONFIG.feedbackUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.status === 401) {
          // Token expired – clear it so popup forces re-login
          chrome.storage.local.remove("authToken");
          console.warn("PhishGuard: auth token expired.");
          resolve(false);
          return;
        }

        resolve(res.ok);
      } catch (err) {
        console.error("PhishGuard: feedback error", err);
        resolve(false);
      }
    });
  });
}

function showRiskBanner(result) {
  const existing = document.getElementById("phish-risk-banner");
  if (existing) existing.remove();

  const { risk_level, phishing_probability, reasons } = result;

  const banner = document.createElement("div");
  banner.id = "phish-risk-banner";

  const color =
    risk_level === "high"   ? "#ffdddd" :
    risk_level === "medium" ? "#fff4cc" :
    "#ddffdd";

  const border =
    risk_level === "high"   ? "#e53935" :
    risk_level === "medium" ? "#f9a825" :
    "#43a047";

  banner.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${color};
    border: 2px solid ${border};
    border-radius: 10px;
    padding: 14px 16px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 440px;
    font-family: Arial, sans-serif;
  `;

  const reasonsHtml = (reasons || []).slice(0, 5).map(r => `<li>${r}</li>`).join("");

  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
      <div>
        <div style="font-weight:700;margin-bottom:6px;">
          Phishing Risk: ${String(risk_level).toUpperCase()}
        </div>
        <div style="font-size:13px;margin-bottom:8px;">
          Score: ${((phishing_probability || 0) * 100).toFixed(1)}%
        </div>
        ${reasonsHtml ? `<ul style="margin:0 0 8px 18px;font-size:13px;">${reasonsHtml}</ul>` : ""}
        <div id="phish-banner-status" style="font-size:12px;min-height:16px;margin-bottom:6px;"></div>
        <div style="display:flex;gap:8px;">
          <button id="phish-mark-safe"   style="padding:6px 10px;cursor:pointer;">Mark safe</button>
          <button id="phish-report"      style="padding:6px 10px;cursor:pointer;">Report phishing</button>
        </div>
      </div>
      <button id="phish-close" style="background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
    </div>
  `;

  document.body.appendChild(banner);

  // Helper: update status text inside banner
  function setBannerStatus(msg, color = "#555") {
    const el = document.getElementById("phish-banner-status");
    if (el) { el.textContent = msg; el.style.color = color; }
  }

  function disableBannerBtns() {
    const safe   = document.getElementById("phish-mark-safe");
    const report = document.getElementById("phish-report");
    if (safe)   safe.disabled   = true;
    if (report) report.disabled = true;
  }

  document.getElementById("phish-close")?.addEventListener("click", () => banner.remove());

  document.getElementById("phish-mark-safe")?.addEventListener("click", async () => {
    disableBannerBtns();
    setBannerStatus("Submitting…");
    const ok = await postFeedback(result, "safe");
    if (ok) {
      setBannerStatus("✓ Marked as safe. Thank you!", "#43a047");
      setTimeout(() => banner.remove(), 1800);
    } else {
      setBannerStatus("Could not submit — open extension to re-login.", "#e53935");
    }
  });

  document.getElementById("phish-report")?.addEventListener("click", async () => {
    disableBannerBtns();
    setBannerStatus("Submitting…");
    const ok = await postFeedback(result, "phishing");
    if (ok) {
      setBannerStatus("⚑ Reported as phishing. Thank you!", "#e53935");
      setTimeout(() => banner.remove(), 1800);
    } else {
      setBannerStatus("Could not submit — open extension to re-login.", "#e53935");
    }
  });

  setTimeout(() => {
    const b = document.getElementById("phish-risk-banner");
    if (b) b.remove();
  }, 10000);
}

// ── API call ──────────────────────────────────────────────────────────────
async function callPredictApi(payload) {
  // Attach token if available
  const stored = await new Promise(res => chrome.storage.local.get(["authToken"], res));
  const token = stored.authToken;

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.fetchTimeoutMs);

  try {
    const res = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

let lastFingerprint = "";

async function runDetection() {
  if (!isGmail()) return;

  const email = readEmailContent();

  if (!email || !email.bodyText) {
    const existing = document.getElementById("phish-risk-banner");
    if (existing) existing.remove();
    return;
  }

  const fingerprint = `${email.subject}|${email.from}|${email.bodyText.slice(0, 250)}|${email.links.length}`;
  if (fingerprint === lastFingerprint) return;
  lastFingerprint = fingerprint;

  try {
    const result = await callPredictApi(email);
    storeResult({ ...result, subject: email.subject, from: email.from, scannedAt: new Date().toISOString() });
    showRiskBanner(result);
  } catch (err) {
    console.log("Predict API not reachable, showing demo banner.", err);

    const fallback = {
      phishing_probability: Math.min(0.95, 0.2 + (email.links.length * 0.18)),
      risk_level: email.links.length >= 2 ? "medium" : "low",
      reasons: [
        email.links.length ? `Contains ${email.links.length} link(s)` : "No links detected"
      ],
      action: "warn"
    };
    storeResult({ ...fallback, subject: email.subject, from: email.from, scannedAt: new Date().toISOString() });
    showRiskBanner(fallback);
  }
}

function storeResult(result) {
  chrome.storage.local.set({ lastScanResult: result });
}

// ── Message listener ──────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "rescan") {
    lastFingerprint = "";
    runDetection().then(() => {
      chrome.storage.local.get("lastScanResult", (data) => {
        sendResponse(data.lastScanResult || null);
      });
    });
    return true;
  }
  if (msg.action === "getResult") {
    chrome.storage.local.get("lastScanResult", (data) => {
      sendResponse(data.lastScanResult || null);
    });
    return true;
  }
  if (msg.action === "feedbackSubmitted") {
    // Popup submitted feedback — remove the banner on the page
    const banner = document.getElementById("phish-risk-banner");
    if (banner) banner.remove();
  }
});

// ── Scheduling ────────────────────────────────────────────────────────────
let debounceTimer = null;
function scheduleRun() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runDetection, CONFIG.debounceMs);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", scheduleRun);
} else {
  scheduleRun();
}

new MutationObserver(() => scheduleRun()).observe(document, { subtree: true, childList: true });

let lastUrl = location.href;
setInterval(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    scheduleRun();
  }
}, 800);