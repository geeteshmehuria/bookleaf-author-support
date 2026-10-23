const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1"
const TOKEN_KEY = "bookleaf_token"

/** localStorage can throw (private mode, blocked storage), so every access is guarded. */
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* session then lasts only until reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* nothing to clear */
    }
  },
}

/** Error with the API's { error: { code, message, details } } fields attached. */
export class ApiError extends Error {
  constructor(message, { status = 0, code = "ERROR", details = null } = {}) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.details = details
  }
}

/** Fired when the server rejects our token (expired or invalid). AuthProvider listens and logs out. */
export const AUTH_EXPIRED_EVENT = "auth:expired"

export async function apiRequest(endpoint, options = {}) {
  const token = tokenStore.get()
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  let response
  try {
    response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers })
  } catch {
    // fetch only throws when the request never got an answer: server down, offline, or CORS
    throw new ApiError("Can't reach the server. Check your connection and try again.", {
      code: "NETWORK_ERROR",
    })
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const err = data?.error
    if (response.status === 401 && token) {
      tokenStore.clear()
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }
    throw new ApiError(err?.message || response.statusText || "Request failed", {
      status: response.status,
      code: err?.code,
      details: err?.details,
    })
  }

  return data
}

export const api = {
  get: (url) => apiRequest(url, { method: "GET" }),
  post: (url, body) => apiRequest(url, { method: "POST", body: JSON.stringify(body) }),
  patch: (url, body) => apiRequest(url, { method: "PATCH", body: JSON.stringify(body) }),
}
