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

export function setLanguagePreference(language, token) {
  return request("/auth/language", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ language }),
  });
}

export function setCurrencyPreference(currency, token) {
  return request("/auth/currency", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currency }),
  });
}

export function getAvailableCurrencies() {
  return request("/auth/currencies");
}

export function lookupUserByUsername(username, token) {
  return request(`/auth/lookup-user?username=${encodeURIComponent(username)}`, {
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

export function deleteWishlist(slug, token) {
  return request(`/wishlists/${slug}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getWishlist(slug, token) {
  return request(`/wishlists/${slug}`, {
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

export function contributeToItem(itemId, amount, token) {
  return request(`/items/${itemId}/contribute`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ amount }),
  });
}

export function reserveItem(itemId, token) {
  return request(`/items/${itemId}/reserve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
}

export function unreserveItem(itemId, token) {
  return request(`/items/${itemId}/reserve`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
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
  return request("/products/preview", {
    method: "POST",
    body: JSON.stringify({ url, targetCurrency }),
  });
}

export function getFriends(token) {
  return request("/friends", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function sendFriendRequest(username, visibleWishlistIds, token) {
  return request("/friends/request", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ username, visibleWishlistIds }),
  });
}

export function acceptFriendRequest(requestId, visibleWishlistIds, token) {
  return request(`/friends/requests/${requestId}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ visibleWishlistIds }),
  });
}

export function rejectFriendRequest(requestId, token) {
  return request(`/friends/requests/${requestId}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getNotifications(token) {
  return request("/notifications", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function markAllNotificationsRead(token) {
  return request("/notifications/read-all", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
}

export function markNotificationRead(notificationId, token) {
  return request(`/notifications/${notificationId}/read`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  });
}
