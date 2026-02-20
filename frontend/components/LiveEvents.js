"use client";

import { useEffect, useState } from "react";

import { useLanguage } from "@/components/LanguageProvider";
import { connectWishlistSocket } from "@/lib/realtime";

export default function LiveEvents({ slug }) {
  const [events, setEvents] = useState([]);
  const { t } = useLanguage();

  useEffect(() => {
    const socket = connectWishlistSocket(slug, (event) => {
      setEvents((prev) => [event, ...prev].slice(0, 10));
    });

    return () => socket.close();
  }, [slug]);

  return (
    <section className="card" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>{t("liveUpdates")}</h3>
      {events.length === 0 ? (
        <p style={{ margin: 0, color: "var(--muted)" }}>{t("noEvents")}</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {events.map((event, index) => (
            <li key={index}>{event.type || "event"}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
