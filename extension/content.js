const CONFIG = {
  targetDomain: "mail.google.com",
  bodySelectors: [".a3s.aiL", ".ii"],
  debounceMs: 800,
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

  const subjectEl   = document.querySelector("h2.hP");
  const fromNameEl  = document.querySelector(".gD");
  const fromEmailEl = document.querySelector(".gD[email], .gD span[email]");

  const subject = subjectEl ? subjectEl.textContent.trim() : "";
  const from =
    (fromEmailEl && (fromEmailEl.getAttribute("email") || fromEmailEl.getAttribute("data-hovercard-id"))) ||
    (fromNameEl  && (fromNameEl.getAttribute("email")  || fromNameEl.textContent.trim())) ||
    "";

  return { subject, from, bodyText, links };
}

function sendToBackground(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (response) => {
      if (chrome.runtime.lastError) {
        const raw = chrome.runtime.lastError.message || "Unknown runtime error";
        const normalized = /Extension context invalidated|Receiving end does not exist|message port closed/i.test(raw)
          ? "Extension was reloaded. Refresh the Gmail tab and scan again."
          : raw;
        resolve({ ok: false, error: normalized });
      } else {
        resolve(response || { ok: false, error: "No response from background." });
      }
    });
  });
}

async function callPredictApi(payload) {
  const response = await sendToBackground({ action: "predict", payload });
  if (!response.ok) {
      if (response.error === "auth") {
         return undefined;
      }

      throw new Error(response.error || "Predict failed");
  }
  return response.data;
}

async function postFeedback(result, userLabel) {
  const payload = {
    email_subject: result.subject || "",
    email_from: result.from || "",
    risk_level: result.risk_level,
    phishing_probability: result.phishing_probability,
    user_label: userLabel,
    scanned_at: result.scannedAt,
  };

  const response = await sendToBackground({ action: "feedback", payload });

  if (!response.ok && response.error === "SESSION_EXPIRED") {
    console.warn("session expired.");
    return "expired";
  }

  return response.ok;
}

function showErrorBanner(message) {
  document.getElementById("phish-risk-banner")?.remove();

  const banner = document.createElement("div");
  banner.id = "phish-risk-banner";
  banner.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #fff4cc;
    border: 2px solid #f9a825;
    border-radius: 10px;
    padding: 14px 16px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 440px;
    font-family: Arial, sans-serif;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  `;
  banner.innerHTML = `
    <div style="font-size:13px;">
      <div style="font-weight:700;margin-bottom:4px;">Scan failed</div>
      <div style="color:#555;">${message || "Could not reach the prediction API."}</div>
    </div>
    <button id="phish-close" style="background:none;border:none;font-size:20px;cursor:pointer;flex-shrink:0;">&times;</button>
  `;

  document.body.appendChild(banner);
  document.getElementById("phish-close")?.addEventListener("click", () => banner.remove());
  setTimeout(() => document.getElementById("phish-risk-banner")?.remove(), 8000);
}

function showRiskBanner(result) {
  document.getElementById("phish-risk-banner")?.remove();

  const { risk_level, phishing_probability, reasons } = result;

  const color =
    risk_level === "high"   ? "#ffdddd" :
    risk_level === "medium" ? "#fff4cc" :
    "#ddffdd";

  const border =
    risk_level === "high"   ? "#e53935" :
    risk_level === "medium" ? "#f9a825" :
    "#43a047";

  const banner = document.createElement("div");
  banner.id = "phish-risk-banner";
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
          <button id="phish-mark-safe" style="padding:6px 10px;cursor:pointer;">Mark safe</button>
          <button id="phish-report" style="padding:6px 10px;cursor:pointer;">Report phishing</button>
        </div>
      </div>
      <button id="phish-close" style="background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
    </div>
  `;

  document.body.appendChild(banner);

  function setBannerStatus(msg, col = "#555") {
    const el = document.getElementById("phish-banner-status");
    if (el) { el.textContent = msg; el.style.color = col; }
  }

  function disableBannerBtns() {
    document.getElementById("phish-mark-safe")?.setAttribute("disabled", true);
    document.getElementById("phish-report")?.setAttribute("disabled", true);
  }

  document.getElementById("phish-close")?.addEventListener("click", () => banner.remove());

  document.getElementById("phish-mark-safe")?.addEventListener("click", async () => {
    disableBannerBtns();
    setBannerStatus("Submitting…");
    const ok = await postFeedback(result, "safe");
    if (ok === "expired") {
      setBannerStatus("Session expired — open extension to re-login.", "#e53935");
    } else if (ok) {
      setBannerStatus("✓ Marked as safe. Thank you!", "#43a047");
      setTimeout(() => banner.remove(), 1800);
    } else {
      setBannerStatus("Could not submit — try again later.", "#e53935");
    }
  });

  document.getElementById("phish-report")?.addEventListener("click", async () => {
    disableBannerBtns();
    setBannerStatus("Submitting…");
    const ok = await postFeedback(result, "phishing");
    if (ok === "expired") {
      setBannerStatus("Session expired — open extension to re-login.", "#e53935");
    } else if (ok) {
      setBannerStatus("Reported as phishing. Thank you!", "#e53935");
      setTimeout(() => banner.remove(), 1800);
    } else {
      setBannerStatus("Could not submit — try again later.", "#e53935");
    }
  });

  setTimeout(() => {
    document.getElementById("phish-risk-banner")?.remove();
  }, 10000);
}

// ── Detection ─────────────────────────────────────────────────────────────
let lastFingerprint = "";

async function runDetection() {
  if (!isGmail()) return;

  const email = readEmailContent();

  if (!email || !email.bodyText) {
    document.getElementById("phish-risk-banner")?.remove();
    return;
  }

  const fingerprint = `${email.subject}|${email.from}|${email.bodyText.slice(0, 250)}|${email.links.length}`;
  if (fingerprint === lastFingerprint) return;
  lastFingerprint = fingerprint;

  try {
    const result = await callPredictApi(email);

    if (!result) {
      return;
    }


    storeResult({ ...result, subject: email.subject, from: email.from, scannedAt: new Date().toISOString() });
    showRiskBanner({ ...result, subject: email.subject, from: email.from, scannedAt: new Date().toISOString() });
  } catch (err) {
    showErrorBanner(err.message);
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
    document.getElementById("phish-risk-banner")?.remove();
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
  if (url !== lastUrl) { lastUrl = url; scheduleRun(); }
}, 800);