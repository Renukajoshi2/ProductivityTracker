const BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("pt_token");
}

export function getSession() {
  if (typeof window === "undefined") return {};
  return {
    token: localStorage.getItem("pt_token"),
    role: localStorage.getItem("pt_role"),
    name: localStorage.getItem("pt_name"),
  };
}

export function logout() {
  localStorage.clear();
  window.location.href = "/login";
}

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = new URLSearchParams(form);
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (body) {
    payload = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (res.status === 401) {
    logout();
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `Request failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}
