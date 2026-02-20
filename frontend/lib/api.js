const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    cache: "no-store",
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
    error.code = payload.code;
    throw error;
  }

  return response.json();
}

export function register(payload) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMe(token) {
  return request("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function setLanguagePreference(language, token) {
  return request("/auth/language", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ language }),
  });
}

export function getAvailableCurrencies() {
  return request("/auth/currencies");
}

export function setCurrencyPreference(currency, token) {
  return request("/auth/currency", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currency }),
  });
}

export function lookupUserByUsername(username, token) {
  return request(`/auth/lookup-user?username=${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getFriends(token) {
  return request("/friends", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function sendFriendRequest(username, token) {
  return request("/friends/request", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ username }),
  });
}

export function acceptFriendRequest(requestId, token) {
  return request(`/friends/requests/${requestId}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function rejectFriendRequest(requestId, token) {
  return request(`/friends/requests/${requestId}/reject`, {
    method: "POST",
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

export function getWishlistNotifications(token) {
  return request("/wishlists/notifications", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getActivityNotifications(token) {
  return request("/activity/notifications", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function setWishlistVisibility(slug, isPublic, token) {
  return request(`/wishlists/${slug}/visibility`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ isPublic }),
  });
}

export function deleteWishlist(slug, token) {
  return request(`/wishlists/${slug}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createItem(slug, payload, token) {
  return request(`/wishlists/${slug}/items`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function removeItem(itemId, reason, token) {
  return request(`/items/${itemId}/remove`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ reason }),
  });
}

export function getWishlist(slug, token) {
  return request(`/wishlists/${slug}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export function contributeToItem(itemId, amount, token) {
  return request(`/items/${itemId}/contribute`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify({ amount }),
  });
}

export function setItemResponsible(itemId, token) {
  return request(`/items/${itemId}/responsible`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
}

export function unsetItemResponsible(itemId, token) {
  return request(`/items/${itemId}/responsible`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function setItemPriority(itemId, priority, token) {
  return request(`/items/${itemId}/priority`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ priority }),
  });
}

export function autofillByUrl(url, targetCurrency) {
  return request(`/products/preview`, {
    method: "POST",
    body: JSON.stringify({ url, targetCurrency }),
  });
}
