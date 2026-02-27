const API_URL = process.env.SMARTWISHLIST_API_URL || "https://smartwishlist-production.up.railway.app/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.message || "Request failed");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export function login(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function register(payload) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMe(token) {
  return request("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getMyWishlists(token) {
  return request("/wishlists/mine", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getSharedWishlists(token) {
  return request("/wishlists/shared", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createWishlist(payload, token) {
  return request("/wishlists", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function getWishlist(slug, token) {
  return request(`/wishlists/${slug}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
