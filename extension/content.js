const CONFIG = {
  targetDomain: "mail.google.com",
  bodySelectors: [".a3s.aiL", ".ii"],
  apiUrl: "http://localhost:8000/predict",
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
        // if text has a domain-like thing and doesn't include the href domain, flag mismatch
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

  const subjectEl = document.querySelector("h2.hP");
  const fromNameEl = document.querySelector(".gD");
  const fromEmailEl = document.querySelector(".gD[email], .gD span[email]");

  const subject = subjectEl ? subjectEl.textContent.trim() : "";
  const from =
    (fromEmailEl && (fromEmailEl.getAttribute("email") || fromEmailEl.getAttribute("data-hovercard-id"))) ||
    (fromNameEl && (fromNameEl.getAttribute("email") || fromNameEl.textContent.trim())) ||
    "";

  return { subject, from, bodyText, links };
}

function showRiskBanner(result) {
  const existing = document.getElementById("phish-risk-banner");
  if (existing) existing.remove();

  const { risk_level, phishing_probability, reasons } = result;

  const banner = document.createElement("div");
  banner.id = "phish-risk-banner";

  const color =
    risk_level === "high" ? "#ffdddd" :
    risk_level === "medium" ? "#fff4cc" :
    "#ddffdd";

  const border =
    risk_level === "high" ? "#e53935" :
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
        <div style="display:flex;gap:8px;">
          <button id="phish-mark-safe" style="padding:6px 10px;cursor:pointer;">Mark safe</button>
          <button id="phish-report" style="padding:6px 10px;cursor:pointer;">Report phishing</button>
        </div>
      </div>
      <button id="phish-close" style="background:none;border:none;font-size:20px;cursor:pointer;">&times;</button>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById("phish-close")?.addEventListener("click", () => banner.remove());

  document.getElementById("phish-mark-safe")?.addEventListener("click", () => {
    console.log("User marked safe (TODO: POST /feedback)");
    banner.remove();
  });

  document.getElementById("phish-report")?.addEventListener("click", () => {
    console.log("User reported phishing (TODO: POST /feedback)");
    banner.remove();
  });

  setTimeout(() => {
    const b = document.getElementById("phish-risk-banner");
    if (b) b.remove();
  }, 10000);
}

async function callPredictApi(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.fetchTimeoutMs);

  try {
    const res = await fetch(CONFIG.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    showRiskBanner(result);
  } catch (err) {
    console.log("Predict API not reachable, showing demo banner.", err);

    showRiskBanner({
      phishing_probability: Math.min(0.95, 0.2 + (email.links.length * 0.18)),
      risk_level: email.links.length >= 2 ? "medium" : "low",
      reasons: [
        email.links.length ? `Contains ${email.links.length} link(s)` : "No links detected",
        "Demo mode (API offline/timeout)"
      ],
      action: "warn"
    });
  }
}

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


