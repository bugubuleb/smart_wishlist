"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AddItemForm from "@/components/AddItemForm";
import { useLanguage } from "@/components/LanguageProvider";
import LiveEvents from "@/components/LiveEvents";
import WishlistItemCard from "@/components/WishlistItemCard";
import { contributeToItem, deleteWishlist, getWishlist, removeItem, setItemPriority, setItemResponsible, setWishlistVisibility, unsetItemResponsible } from "@/lib/api";
import { connectWishlistSocket } from "@/lib/realtime";
import { getToken } from "@/lib/session";

export default function WishlistPublicClient({ slug }) {
  const [wishlist, setWishlist] = useState(null);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const { t } = useLanguage();
  const router = useRouter();

  async function loadWishlist() {
    try {
      const token = getToken();
      const data = await getWishlist(slug, token || undefined);
      setWishlist(data);
      setError("");
      setAccessDenied(false);
    } catch (err) {
      if (err.status === 401 || err.code === "LOGIN_REQUIRED") {
        router.replace("/login");
        return;
      }

      if (err.status === 403 || err.code === "WISHLIST_ACCESS_DENIED") {
        setError(t("noAccessToWishlist"));
        setAccessDenied(true);
        return;
      }

      setError(err.message || "Failed to load wishlist");
      setAccessDenied(false);
    }
  }

  useEffect(() => {
    loadWishlist();
  }, [slug]);

  useEffect(() => {
    const socket = connectWishlistSocket(slug, () => {
      loadWishlist();
    });

    return () => socket.close();
  }, [slug]);

  const viewerRole = useMemo(() => wishlist?.viewer_role || "guest", [wishlist?.viewer_role]);
  const minContribution = wishlist?.min_contribution || 100;
  const dueAtText = wishlist?.due_at ? new Date(wishlist.due_at).toLocaleDateString() : "";

  if (error) {
    return (
      <main className="container wishlist-page">
        <section className="card wishlist-status-block">
          <p className="wishlist-status-text">{error}</p>
          {accessDenied ? (
            <a href="/" className="wishlist-status-back">
              {t("backToList")}
            </a>
          ) : null}
        </section>
      </main>
    );
  }

  if (!wishlist) {
    return <p>{t("loadingWishlist")}</p>;
  }

  return (
    <main
      className="container wishlist-page"
      style={{
        padding: "34px 0",
        display: "grid",
        gap: 18,
        width: "min(90vw, 1240px)",
        maxWidth: "1240px",
        justifyItems: "stretch",
        textAlign: "left",
      }}
    >
      <header className="card" style={{ padding: 18, width: "100%" }}>
        <h1 style={{ margin: 0 }}>{wishlist.title}</h1>
        <p style={{ marginBottom: 0, color: "var(--muted)" }}>
          {viewerRole === "owner" ? t("ownerHeader") : t("guestHeader")}
        </p>
        {dueAtText ? <small style={{ color: "var(--muted)" }}>{t("dueDate")}: {dueAtText}</small> : null}
      </header>

      <section className="card wishlist-toolbar" style={{ padding: 14, width: "100%", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid var(--line)",
            background: "var(--field-bg)",
          }}
        >
          {t("backToList")}
        </a>
        {viewerRole === "owner" ? (
          <>
            <button
              type="button"
              disabled={visibilityBusy}
              onClick={async () => {
                const token = getToken();
                if (!token) return;

                setVisibilityBusy(true);
                try {
                  await setWishlistVisibility(slug, !wishlist.is_public, token);
                  await loadWishlist();
                } catch (err) {
                  setError(err.message || "Failed to change visibility");
                } finally {
                  setVisibilityBusy(false);
                }
              }}
              style={{ padding: "10px 14px", borderRadius: 10, background: "var(--accent)", color: "white" }}
            >
              {wishlist.is_public ? t("makePrivate") : t("makePublic")}
            </button>
            {wishlist.can_delete ? (
              <button
                type="button"
                disabled={deleteBusy}
                onClick={async () => {
                  const token = getToken();
                  if (!token) return;
                  setDeleteBusy(true);
                  try {
                    await deleteWishlist(slug, token);
                    router.replace("/");
                  } catch (err) {
                    setError(err.message || "Failed to delete wishlist");
                  } finally {
                    setDeleteBusy(false);
                  }
                }}
                style={{ padding: "10px 14px", borderRadius: 10, background: "#9b1c1c", color: "white" }}
              >
                {t("deleteWishlist")}
              </button>
            ) : (
              <small style={{ color: "var(--muted)", alignSelf: "center" }}>{t("deleteAfterDueDate")}</small>
            )}
          </>
        ) : null}
      </section>

      {viewerRole === "owner" ? <AddItemForm slug={slug} token={getToken()} onCreated={loadWishlist} /> : null}

      <section className="wishlist-items-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, width: "100%" }}>
        {wishlist.items.length === 0 ? (
          <p>{t("wishlistEmpty")}</p>
        ) : (
          wishlist.items.map((item) => (
            <WishlistItemCard
              key={item.id}
              item={item}
              viewerRole={viewerRole}
              minContribution={minContribution}
              onContribute={async (itemId, amount) => {
                const result = await contributeToItem(itemId, amount, getToken() || undefined);
                await loadWishlist();
                return result;
              }}
              onSetResponsible={async (itemId) => {
                const token = getToken();
                if (!token) {
                  router.push("/login");
                  return;
                }

                await setItemResponsible(itemId, token);
                await loadWishlist();
              }}
              onUnsetResponsible={async (itemId) => {
                const token = getToken();
                if (!token) {
                  router.push("/login");
                  return;
                }

                await unsetItemResponsible(itemId, token);
                await loadWishlist();
              }}
              onRemove={async (itemId, reason) => {
                const token = getToken();
                if (!token) throw new Error("Authorization required");
                await removeItem(itemId, reason, token);
                await loadWishlist();
              }}
              onSetPriority={async (itemId, priority) => {
                const token = getToken();
                if (!token) throw new Error("Authorization required");
                await setItemPriority(itemId, priority, token);
                await loadWishlist();
              }}
            />
          ))
        )}
      </section>

      <LiveEvents slug={slug} />
    </main>
  );
}
