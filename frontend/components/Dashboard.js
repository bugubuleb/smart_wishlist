"use client";

import { useEffect, useState } from "react";

import CreateWishlistForm from "@/components/CreateWishlistForm";
import { useLanguage } from "@/components/LanguageProvider";
import {
  acceptFriendRequest,
  getFriends,
  getMyWishlists,
  getActivityNotifications,
  getWishlistNotifications,
  getSharedWishlists,
  rejectFriendRequest,
  sendFriendRequest,
} from "@/lib/api";

function WishlistList({ items, t }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 8, width: "100%" }}>
      {items.map((wishlist) => (
        <li key={wishlist.id} style={{ width: "100%" }}>
          <a
            href={`/wishlist/${wishlist.slug}`}
            style={{
              display: "block",
              width: "100%",
              padding: "10px 12px",
              border: "1px solid var(--line)",
              borderRadius: 10,
              background: "var(--panel)",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <span>
                {wishlist.title}
                {wishlist.owner_username ? <small style={{ marginLeft: 8, color: "var(--muted)" }}>@{wishlist.owner_username}</small> : null}
              </span>
              <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                <small style={{ color: "var(--muted)" }}>{t("invested")}: {Number(wishlist.my_contributed_sum || 0)} ₽</small>
                {wishlist.is_responsible ? <small style={{ color: "#0b7a3e", fontWeight: 700 }}>{t("youResponsible")}</small> : null}
              </span>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard({ token, user }) {
  const [wishlists, setWishlists] = useState([]);
  const [sharedWishlists, setSharedWishlists] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activityNotifications, setActivityNotifications] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendUsername, setFriendUsername] = useState("");
  const [friendError, setFriendError] = useState("");
  const [activeTab, setActiveTab] = useState("wishlists");
  const { t } = useLanguage();

  async function refreshFriendsData() {
    const data = await getFriends(token);
    setFriends(data.friends || []);
    setIncomingRequests(data.incoming || []);
    setOutgoingRequests(data.outgoing || []);
  }

  async function refreshSharedWishlists() {
    const data = await getSharedWishlists(token);
    setSharedWishlists(data.wishlists || []);
  }

  async function refreshNotifications() {
    const data = await getWishlistNotifications(token);
    setNotifications(data.notifications || []);
  }

  async function refreshActivityNotifications() {
    const data = await getActivityNotifications(token);
    setActivityNotifications(data.notifications || []);
  }

  useEffect(() => {
    getMyWishlists(token)
      .then((data) => setWishlists(data.wishlists || []))
      .catch(() => setWishlists([]));

    refreshSharedWishlists().catch(() => setSharedWishlists([]));
    refreshNotifications().catch(() => setNotifications([]));
    refreshActivityNotifications().catch(() => setActivityNotifications([]));
    refreshFriendsData().catch(() => {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
    });
  }, [token]);

  function handleCreated(wishlist) {
    setWishlists((prev) => [wishlist, ...prev]);
    refreshNotifications().catch(() => {});
  }

  function renderActivityMessage(notification) {
    const item = notification.source_item_title || "Подарок";
    const wishlistTitle = notification.wishlist_title || "wishlist";
    const moved = Number(notification.moved_amount || 0);
    const refunded = Number(notification.refunded_amount || 0);

    if (moved > 0 && refunded > 0) {
      return t("redistributedAndRefundedNotice")
        .replace("{item}", item)
        .replace("{wishlist}", wishlistTitle)
        .replace("{moved}", String(moved))
        .replace("{refunded}", String(refunded));
    }

    if (moved > 0) {
      return t("redistributedOnlyNotice")
        .replace("{item}", item)
        .replace("{wishlist}", wishlistTitle)
        .replace("{moved}", String(moved));
    }

    return t("refundedOnlyNotice")
      .replace("{item}", item)
      .replace("{wishlist}", wishlistTitle)
      .replace("{refunded}", String(refunded));
  }

  async function handleSendRequest(event) {
    event.preventDefault();
    if (!friendUsername.trim()) return;

    setFriendError("");
    try {
      await sendFriendRequest(friendUsername.trim(), token);
      setFriendUsername("");

      await Promise.all([refreshFriendsData(), refreshSharedWishlists(), refreshNotifications()]);
    } catch (err) {
      setFriendError(err.message || "Failed to send friend request");
    }
  }

  return (
    <section className="dashboard-root" style={{ display: "grid", gap: 16, width: "min(90vw, 1240px)", maxWidth: "1240px", marginInline: "auto" }}>
      <div className="card" style={{ padding: 20, width: "100%" }}>
        <div>
          <h2 style={{ margin: 0 }}>{t("hello")}, {user.displayName}</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            {t("ownerMode")} <strong>@{user.username || "no_username"}</strong>
          </p>
        </div>
      </div>

      <section className="card dashboard-tabs" style={{ padding: 10, width: "100%", display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => setActiveTab("wishlists")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: activeTab === "wishlists" ? "var(--accent)" : "var(--field-bg)",
            color: activeTab === "wishlists" ? "white" : "var(--text)",
          }}
        >
          {t("wishlistsTab")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("friends")}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: activeTab === "friends" ? "var(--accent)" : "var(--field-bg)",
            color: activeTab === "friends" ? "white" : "var(--text)",
          }}
        >
          {t("friendsTab")}
        </button>
      </section>

      {activeTab === "wishlists" ? (
        <>
          <CreateWishlistForm token={token} onCreated={handleCreated} />

          <section className="card" style={{ padding: 20, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>{t("activityUpdates")}</h3>
            {activityNotifications.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>{t("noActivityUpdates")}</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
                {activityNotifications.map((notification) => (
                  <li key={notification.id}>
                    {renderActivityMessage(notification)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card" style={{ padding: 20, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>{t("newWishlists")}</h3>
            {notifications.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>{t("noNewWishlists")}</p>
            ) : (
              <WishlistList items={notifications} t={t} />
            )}
          </section>

          <section className="card" style={{ padding: 20, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>{t("myWishlists")}</h3>
            {wishlists.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>{t("emptyWishlists")}</p>
            ) : (
              <WishlistList items={wishlists} t={t} />
            )}
          </section>

          <section className="card" style={{ padding: 20, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>{t("sharedWishlists")}</h3>
            {sharedWishlists.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>{t("emptySharedWishlists")}</p>
            ) : (
              <WishlistList items={sharedWishlists} t={t} />
            )}
          </section>
        </>
      ) : (
        <section className="card" style={{ padding: 20, width: "100%", display: "grid", gap: 12 }}>
          <h3 style={{ marginTop: 0 }}>{t("friends")}</h3>

          <form className="friend-request-form" onSubmit={handleSendRequest} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: "1px solid var(--line)" }}
            />
            <button type="submit" style={{ padding: "10px 14px", borderRadius: 10, background: "var(--accent)", color: "white" }}>
              {t("sendRequest")}
            </button>
          </form>

          {friendError ? <small style={{ color: "#af2f1f" }}>{friendError}</small> : null}

          <div style={{ display: "grid", gap: 8 }}>
            <h4 style={{ margin: 0 }}>{t("incomingRequests")}</h4>
            {incomingRequests.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>{t("noIncomingRequests")}</p>
            ) : (
              incomingRequests.map((request) => (
                <div className="friend-request-row" key={request.id} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                  <span>@{request.username} ({request.display_name})</span>
                  <div className="friend-request-actions" style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        await acceptFriendRequest(request.id, token);
                        await Promise.all([refreshFriendsData(), refreshSharedWishlists()]);
                      }}
                      style={{ padding: "8px 12px", borderRadius: 8, background: "#2563eb", color: "white" }}
                    >
                      {t("accept")}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await rejectFriendRequest(request.id, token);
                        await refreshFriendsData();
                      }}
                      style={{ padding: "8px 12px", borderRadius: 8, background: "#334155", color: "white" }}
                    >
                      {t("reject")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <h4 style={{ margin: 0 }}>{t("outgoingRequests")}</h4>
            {outgoingRequests.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>{t("noOutgoingRequests")}</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                {outgoingRequests.map((request) => (
                  <li key={request.id}>@{request.username} ({request.display_name})</li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <h4 style={{ margin: 0 }}>{t("friends")}</h4>
            {friends.length === 0 ? (
              <p style={{ margin: 0, color: "var(--muted)" }}>{t("noFriends")}</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                {friends.map((friend) => (
                  <li key={friend.id}>@{friend.username} ({friend.display_name})</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
