const container = document.getElementById("result-container");
const statusEl = document.getElementById("status");

function renderResult(result) {
  if (!result) {
    container.innerHTML = '<div class="empty" id="empty-state">Open an email to scan it.</div>';
    return;
  }

  const { risk_level, phishing_probability, reasons, subject, from, scannedAt } = result;
  const pct = ((phishing_probability || 0) * 100).toFixed(1);
  const badgeClass = `risk-${risk_level || "low"}`;
  const reasonsHtml = (reasons || []).slice(0, 5).map(r => `<li>${r}</li>`).join("");
  const time = scannedAt ? new Date(scannedAt).toLocaleTimeString() : "";

  container.innerHTML = `
    <div class="meta">
      ${subject ? `<div><strong>Subject:</strong> ${subject}</div>` : ""}
      ${from ? `<div><strong>From:</strong> ${from}</div>` : ""}
      ${time ? `<div><strong>Scanned:</strong> ${time}</div>` : ""}
    </div>
    <span class="risk-badge ${badgeClass}">${(risk_level || "unknown").toUpperCase()}</span>
    <div class="score">Phishing score: ${pct}%</div>
    ${reasonsHtml ? `<ul class="reasons">${reasonsHtml}</ul>` : ""}
    <div class="actions">
      <button id="btn-rescan" class="primary">Re-scan</button>
      <button id="btn-safe">Mark safe</button>
      <button id="btn-report">Report</button>
    </div>
  `;

  document.getElementById("btn-rescan").addEventListener("click", rescan);
  document.getElementById("btn-safe").addEventListener("click", () => {
    console.log("User marked safe (TODO: POST /feedback)");
    statusEl.textContent = "Marked as safe";
    statusEl.className = "status active";
  });
  document.getElementById("btn-report").addEventListener("click", () => {
    console.log("User reported phishing (TODO: POST /feedback)");
    statusEl.textContent = "Reported as phishing";
    statusEl.className = "status inactive";
  });
}

function rescan() {
  statusEl.textContent = "Scanning…";
  statusEl.className = "status";

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "rescan" }, (result) => {
      if (chrome.runtime.lastError) {
        statusEl.textContent = "Could not reach content script";
        statusEl.className = "status inactive";
        return;
      }
      renderResult(result);
      statusEl.textContent = "Scan complete";
      statusEl.className = "status active";
    });
  });
}

// On popup open: load the last stored result
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  const isMonitored = tab.url && tab.url.includes("mail.google.com");

  if (isMonitored) {
    statusEl.textContent = "Monitoring this page";
    statusEl.className = "status active";

    chrome.tabs.sendMessage(tab.id, { action: "getResult" }, (result) => {
      if (chrome.runtime.lastError || !result) {
        // Fallback: try storage directly
        chrome.storage.local.get("lastScanResult", (data) => {
          renderResult(data.lastScanResult || null);
        });
        return;
      }
      renderResult(result);
    });
  } else {
    statusEl.textContent = "Not on a supported email page";
    statusEl.className = "status inactive";
  }
});
