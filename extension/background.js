const API = "http://localhost:8000";

async function apiFetch(endpoint, { method = "POST", body, useToken = false, timeout = 4000 } = {}) {
  const stored = await chrome.storage.local.get(["authToken"]);
  const token = stored.authToken;

  const headers = { "Content-Type": "application/json" };
  if (useToken && token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.action === "login") {
    apiFetch("/auth/login", { body: msg.payload })
      .then(({ ok, status, data, error }) => {
        if (error) return sendResponse({ ok: false, error });

        if (!ok) {
          return sendResponse({
            ok: false,
            error: data?.detail || data?.message || `Server error ${status}`,
          });
        }

        const token = data.token || data.access_token;
        if (!token) return sendResponse({ ok: false, error: "No token in response." });

        chrome.storage.local.set({ authToken: token }, () => {
          sendResponse({ ok: true, token });
        });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true; 
  }


  if (msg.action === "predict") {
    apiFetch("/predict-model", { body: msg.payload, useToken: true })
      .then(({ ok, status, data, error }) => {
        if (error)  return sendResponse({ ok: false, error });
        if (!ok)    return sendResponse({ ok: false, error: `API error ${status}` });
        sendResponse({ ok: true, data });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true;
  }


  if (msg.action === "feedback") {
    apiFetch("/feedback", { body: msg.payload, useToken: true })
      .then(({ ok, status, data, error }) => {
        if (error) return sendResponse({ ok: false, error });
        if (status === 401) {
          chrome.storage.local.remove("authToken");
          return sendResponse({ ok: false, error: "SESSION_EXPIRED" });
        }
        if (!ok) {
          return sendResponse({
            ok: false,
            error: data?.detail || `Server error ${status}`,
          });
        }
        sendResponse({ ok: true });
      })
      .catch(err => sendResponse({ ok: false, error: err.message }));

    return true;
  }
});