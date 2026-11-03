const PROD_API_BASE = "https://ai-disaster-intelligence-emergency.onrender.com";
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "0.0.0.0");

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (!isLocalhost || import.meta.env.PROD
    ? PROD_API_BASE
    : "http://localhost:8000");

export async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });

  if (!response.ok) {
    throw new Error((await response.text()) || `HTTP ${response.status}`);
  }
  return response.json();
}
