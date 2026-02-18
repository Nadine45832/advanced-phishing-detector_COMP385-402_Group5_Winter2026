const CONFIG = {
  targetDomain: "mail.google.com",
  contentSelector: ".ii",
  apiUrl: "http://localhost:8000/predict",
  debounceMs: 700
};

function isGmail() {
  return window.location.hostname.includes(CONFIG.targetDomain);
}

function getEmailBodyElement() {
  return document.querySelector(CONFIG.contentSelector);
}

function extractLinksFromBody(bodyEl) {
  const links = [];
  bodyEl.querySelectorAll("a[href]").forEach(a => {
    const href = a.getAttribute("href") || "";
    const text = (a.innerText || "").trim();


    const suspiciousFlags = [];
    if (/^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(href)) suspiciousFlags.push("ip_address_url");
    if (href.includes("xn--")) suspiciousFlags.push("punycode_domain");
    if (/bit\.ly|tinyurl\.com|t\.co|goo\.gl/i.test(href)) suspiciousFlags.push("shortened_url");

    links.push({ href, text, suspiciousFlags });
  });
  return links;
}

function readEmailContent() {
  const bodyEl = getEmailBodyElement();
  if (!bodyEl) return null;

  const bodyText = bodyEl.textContent.trim();
  const links = extractLinksFromBody(bodyEl);



  const subjectEl = document.querySelector("h2.hP");
  const fromEl = document.querySelector(".gD"); 
  const fromEmailEl = document.querySelector(".gD span[email]"); 

  const subject = subjectEl ? subjectEl.textContent.trim() : "";
  const from = fromEmailEl?.getAttribute("email") || fromEl?.getAttribute("email") || fromEl?.textContent?.trim() || "";

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
    max-width: 420px;
    font-family: Arial, sans-serif;
  `;

  const reasonsHtml = (reasons || []).slice(0, 4).map(r => `<li>${r}</li>`).join("");

  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
      <div>
        <div style="font-weight:700;margin-bottom:6px;">
          Phishing Risk: ${String(risk_level).toUpperCase()}
        </div>
        <div style="font-size:13px;margin-bottom:8px;">
          Score: ${(phishing_probability * 100).toFixed(1)}%
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

  document.getElementById("phish-close").addEventListener("click", () => banner.remove());


  document.getElementById("phish-mark-safe").addEventListener("click", () => {
    console.log("User marked safe");
    banner.remove();
  });

  document.getElementById("phish-report").addEventListener("click", () => {
    console.log("User reported phishing");
    banner.remove();
  });
}

async function callPredictApi(payload) {
  const res = await fetch(CONFIG.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

let lastFingerprint = "";

async function runDetection() {
  if (!isGmail()) return;

  const email = readEmailContent();
  if (!email) return;

  // Fingerprint to avoid spamming API on every DOM twitch
  const fingerprint = `${email.subject}|${email.from}|${email.bodyText.slice(0, 300)}`;
  if (fingerprint === lastFingerprint) return;
  lastFingerprint = fingerprint;

  try {
    const result = await callPredictApi(email);
    showRiskBanner(result);
  } catch (err) {
    console.log("Predict API not reachable, showing demo banner.", err);


    showRiskBanner({
      phishing_probability: Math.min(0.95, 0.2 + (email.links.length * 0.15)),
      risk_level: email.links.length >= 2 ? "medium" : "low",
      reasons: [
        email.links.length ? `Contains ${email.links.length} link(s)` : "No links detected",
        "Demo mode (API offline)"
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

