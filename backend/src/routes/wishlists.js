import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import { broadcast } from "../realtime/hub.js";
import { createNotificationIfEnabled } from "../services/notifications.js";
import { makeWishlistSlug } from "../services/slug.js";

const DEFAULT_MIN_CONTRIBUTION = 100;

const createItemSchema = z.object({
  title: z.string().min(1).max(200),
  productUrl: z.string().url(),
  imageUrl: z
    .string()
    .refine((value) => /^https?:\/\//i.test(value) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(value), {
      message: "Invalid image URL",
    })
    .nullable()
    .optional(),
  targetPrice: z.number().nonnegative().default(0),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});
const contributeSchema = z.object({
  alias: z.string().trim().min(1).max(80).optional(),
  amount: z.number().positive(),
});
const reserveSchema = z.object({
  alias: z.string().trim().min(1).max(80).optional(),
});
const removeItemSchema = z.object({
  reason: z.string().min(3).max(280).default("Товар больше недоступен"),
});
const visibilitySchema = z.object({
  isPublic: z.boolean(),
});
const itemPrioritySchema = z.object({
  priority: z.enum(["low", "medium", "high"]),
});

const createWishlistWithMinSchema = z.object({
  title: z.string().min(2).max(150),
  minContribution: z.number().int().min(1).max(1000000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recipientMode: z.enum(["self", "friend"]).optional(),
  recipientInput: z.string().trim().min(2).max(120).optional(),
  isPublic: z.boolean().optional(),
  hideFromRecipient: z.boolean().optional(),
  hiddenUserIds: z.array(z.number().int().positive()).optional(),
});

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function resolveDueAt(dueDate) {
  if (!dueDate) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  const parsed = new Date(`${dueDate}T23:59:59.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function canEditWishlist(wishlistRow, userId) {
  return (
    Number(wishlistRow.owner_id) === Number(userId)
    || (
      wishlistRow.recipient_mode === "friend"
      && wishlistRow.recipient_user_id
      && Number(wishlistRow.recipient_user_id) === Number(userId)
    )
  );
}

async function resolveActorAlias(req, fallbackAlias) {
  if (fallbackAlias?.trim()) return fallbackAlias.trim();
  if (!req.user?.userId) return "guest";

  const userResult = await pool.query(
    "SELECT display_name, username FROM users WHERE id = $1",
    [req.user.userId],
  );

  if (!userResult.rowCount) return "guest";

  return userResult.rows[0].display_name || userResult.rows[0].username || "guest";
}

async function resolveRecipientData(payload) {
  const recipientMode = payload.recipientMode || "self";
  if (recipientMode === "self") {
    return {
      recipientMode: "self",
      recipientUserId: null,
      recipientName: null,
      hideFromRecipient: false,
    };
  }

  const recipientInput = payload.recipientInput?.trim();
  if (!recipientInput) return null;

  // If input matches an existing username, treat as platform user and auto-hide from that recipient.
  if (/^[a-zA-Z0-9_]{3,60}$/.test(recipientInput)) {
    const lookup = await pool.query(
      "SELECT id, display_name, username FROM users WHERE LOWER(username) = $1",
      [recipientInput.toLowerCase()],
    );

    if (lookup.rowCount) {
      const row = lookup.rows[0];
      return {
        recipientMode: "friend",
        recipientUserId: row.id,
        recipientName: row.display_name || row.username,
        hideFromRecipient: Boolean(payload.hideFromRecipient),
      };
    }
  }

  return {
    recipientMode: "friend",
    recipientUserId: null,
    recipientName: recipientInput,
    hideFromRecipient: false,
  };
}

export const wishlistRouter = Router();

wishlistRouter.get("/wishlists/mine", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT w.id, w.title, w.slug, w.is_public, w.min_contribution, w.due_at, w.recipient_mode, w.recipient_user_id, w.recipient_name, w.hide_from_recipient, w.created_at,
            COALESCE((
              SELECT SUM(c.amount)
              FROM contributions c
              JOIN wishlist_items wi2 ON wi2.id = c.item_id
              WHERE wi2.wishlist_id = w.id AND c.contributor_user_id = $1
            ), 0) AS my_contributed_sum,
            EXISTS(
              SELECT 1
              FROM item_responsibles ir
              JOIN wishlist_items wi3 ON wi3.id = ir.item_id
              WHERE wi3.wishlist_id = w.id AND ir.user_id = $1
            ) AS is_responsible
     FROM wishlists w
     WHERE w.owner_id = $1
     ORDER BY w.created_at DESC`,
    [req.user.userId],
  );

  res.json({ wishlists: result.rows });
});


wishlistRouter.get("/wishlists/shared", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT w.id, w.title, w.slug, w.owner_id, w.due_at, w.recipient_mode, w.recipient_name, w.created_at, u.username AS owner_username,
            COALESCE((
              SELECT SUM(c.amount)
              FROM contributions c
              JOIN wishlist_items wi2 ON wi2.id = c.item_id
              WHERE wi2.wishlist_id = w.id AND c.contributor_user_id = $1
            ), 0) AS my_contributed_sum,
            EXISTS(
              SELECT 1
              FROM item_responsibles ir
              JOIN wishlist_items wi3 ON wi3.id = ir.item_id
              WHERE wi3.wishlist_id = w.id AND ir.user_id = $1
            ) AS is_responsible
     FROM friendships f
     JOIN wishlists w ON w.owner_id = f.friend_user_id
     JOIN users u ON u.id = w.owner_id
     WHERE f.user_id = $1
       AND w.is_public = true
       AND NOT EXISTS (
         SELECT 1
         FROM wishlist_hidden_users whu
         WHERE whu.wishlist_id = w.id AND whu.user_id = $1
       )
       AND NOT (w.hide_from_recipient = true AND w.recipient_user_id = $1)
     ORDER BY w.created_at DESC
     LIMIT 50`,
    [req.user.userId],
  );

  res.json({ wishlists: result.rows });
});

wishlistRouter.get("/wishlists/notifications", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT w.id, w.title, w.slug, w.created_at, u.username AS owner_username,
            COALESCE((
              SELECT SUM(c.amount)
              FROM contributions c
              JOIN wishlist_items wi2 ON wi2.id = c.item_id
              WHERE wi2.wishlist_id = w.id AND c.contributor_user_id = $1
            ), 0) AS my_contributed_sum,
            EXISTS(
              SELECT 1
              FROM item_responsibles ir
              JOIN wishlist_items wi3 ON wi3.id = ir.item_id
              WHERE wi3.wishlist_id = w.id AND ir.user_id = $1
            ) AS is_responsible
     FROM friendships f
     JOIN wishlists w ON w.owner_id = f.friend_user_id
     JOIN users u ON u.id = w.owner_id
     WHERE f.user_id = $1
       AND w.is_public = true
       AND NOT EXISTS (
         SELECT 1
         FROM wishlist_hidden_users whu
         WHERE whu.wishlist_id = w.id AND whu.user_id = $1
       )
       AND NOT EXISTS (
         SELECT 1
         FROM contributions c2
         JOIN wishlist_items wi4 ON wi4.id = c2.item_id
         WHERE wi4.wishlist_id = w.id AND c2.contributor_user_id = $1
       )
       AND NOT (w.hide_from_recipient = true AND w.recipient_user_id = $1)
     ORDER BY w.created_at DESC
     LIMIT 5`,
    [req.user.userId],
  );

  res.json({ notifications: result.rows });
});

wishlistRouter.get("/activity/notifications", requireAuth, async (req, res) => {
  const notifications = await pool.query(
    `SELECT n.id, n.wishlist_id, n.source_item_title, n.moved_amount, n.refunded_amount, n.created_at, w.title AS wishlist_title
     FROM user_activity_notifications n
     LEFT JOIN wishlists w ON w.id = n.wishlist_id
     WHERE n.user_id = $1 AND n.is_read = false
     ORDER BY n.created_at DESC
     LIMIT 20`,
    [req.user.userId],
  );

  const ids = notifications.rows.map((row) => Number(row.id)).filter(Boolean);
  if (ids.length > 0) {
    await pool.query(
      `UPDATE user_activity_notifications
       SET is_read = true
       WHERE user_id = $1 AND id = ANY($2::int[])`,
      [req.user.userId, ids],
    );
  }

  return res.json({ notifications: notifications.rows });
});

wishlistRouter.post("/wishlists", requireAuth, async (req, res) => {
  const parsed = createWishlistWithMinSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const slug = makeWishlistSlug(parsed.data.title);
  const minContribution = parsed.data.minContribution || DEFAULT_MIN_CONTRIBUTION;
  const dueAt = resolveDueAt(parsed.data.dueDate);
  if (!dueAt) return res.status(400).json({ message: "Invalid due date" });
  const recipientData = await resolveRecipientData(parsed.data);
  if (!recipientData) return res.status(400).json({ message: "Friend name or username is required" });
  if (recipientData.recipientUserId && recipientData.recipientUserId === req.user.userId) {
    return res.status(409).json({ message: "Choose self mode for your own wishlist" });
  }
  const result = await pool.query(
    `INSERT INTO wishlists (
        owner_id, title, slug, is_public, min_contribution, due_at,
        recipient_mode, recipient_user_id, recipient_name, hide_from_recipient
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, title, slug, min_contribution, due_at, recipient_mode, recipient_user_id, recipient_name, hide_from_recipient`,
    [
      req.user.userId,
      parsed.data.title,
      slug,
      parsed.data.isPublic !== false,
      minContribution,
      dueAt,
      recipientData.recipientMode,
      recipientData.recipientUserId,
      recipientData.recipientName,
      recipientData.hideFromRecipient,
    ],
  );

  const wishlistId = result.rows[0].id;
  const hiddenUserIds = new Set((parsed.data.hiddenUserIds || []).map((id) => Number(id)));
  hiddenUserIds.delete(req.user.userId);
  if (recipientData.recipientUserId && recipientData.hideFromRecipient) {
    hiddenUserIds.add(Number(recipientData.recipientUserId));
  }

  if (hiddenUserIds.size > 0) {
    await pool.query(
      `INSERT INTO wishlist_hidden_users (wishlist_id, user_id)
       SELECT $1, UNNEST($2::int[])
       ON CONFLICT (wishlist_id, user_id) DO NOTHING`,
      [wishlistId, Array.from(hiddenUserIds)],
    );
  }

  if (result.rows[0].slug && parsed.data.isPublic !== false) {
    const visibleFriends = await pool.query(
      `SELECT f.friend_user_id
       FROM friendships f
       LEFT JOIN wishlist_hidden_users whu
         ON whu.wishlist_id = $2 AND whu.user_id = f.friend_user_id
       WHERE f.user_id = $1
         AND whu.id IS NULL
         AND NOT ($3 = true AND $4 IS NOT NULL AND f.friend_user_id = $4)`,
      [
        req.user.userId,
        wishlistId,
        Boolean(result.rows[0].hide_from_recipient),
        result.rows[0].recipient_user_id ? Number(result.rows[0].recipient_user_id) : null,
      ],
    );

    for (const friend of visibleFriends.rows) {
      await createNotificationIfEnabled({
        userId: Number(friend.friend_user_id),
        preferenceColumn: "wishlist_shared_enabled",
        type: "wishlist.shared",
        title: "Новый вишлист от друга",
        body: `С тобой поделились списком: "${result.rows[0].title}"`,
        link: `/wishlist/${result.rows[0].slug}`,
        data: { wishlistId, slug: result.rows[0].slug },
      });
    }
  }

  res.status(201).json(result.rows[0]);
});

wishlistRouter.post("/wishlists/:slug/items", requireAuth, async (req, res) => {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const ownerCheck = await pool.query(
    "SELECT id, owner_id, recipient_mode, recipient_user_id FROM wishlists WHERE slug = $1",
    [req.params.slug],
  );
  if (!ownerCheck.rowCount) return res.status(404).json({ message: "Wishlist not found" });
  if (!canEditWishlist(ownerCheck.rows[0], req.user.userId)) return res.status(403).json({ message: "Forbidden" });

  const created = await pool.query(
    `INSERT INTO wishlist_items (wishlist_id, title, product_url, image_url, target_price, priority)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, product_url, image_url, target_price, priority, item_status`,
    [
      ownerCheck.rows[0].id,
      parsed.data.title,
      parsed.data.productUrl,
      parsed.data.imageUrl || null,
      parsed.data.targetPrice,
      parsed.data.priority,
    ],
  );

  broadcast(req.params.slug, { type: "item.created", itemId: created.rows[0].id });

  res.status(201).json(created.rows[0]);
});

wishlistRouter.patch("/wishlists/:slug/visibility", requireAuth, async (req, res) => {
  const parsed = visibilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const updated = await pool.query(
    `UPDATE wishlists
     SET is_public = $2
     WHERE slug = $1 AND owner_id = $3
     RETURNING id, slug, is_public`,
    [req.params.slug, parsed.data.isPublic, req.user.userId],
  );

  if (!updated.rowCount) return res.status(404).json({ message: "Wishlist not found" });

  broadcast(req.params.slug, { type: "wishlist.visibility", isPublic: updated.rows[0].is_public });

  res.json({
    id: updated.rows[0].id,
    slug: updated.rows[0].slug,
    is_public: updated.rows[0].is_public,
  });
});

wishlistRouter.post("/items/:itemId/remove", requireAuth, async (req, res) => {
  const parsed = removeItemSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const item = await pool.query(
    `SELECT wi.id, wi.wishlist_id, wi.item_status, wi.title, wi.target_price, w.title AS wishlist_title,
            w.owner_id, w.recipient_mode, w.recipient_user_id, w.slug,
            COALESCE((SELECT SUM(amount) FROM contributions c WHERE c.item_id = wi.id), 0) AS collected
     FROM wishlist_items wi
     JOIN wishlists w ON w.id = wi.wishlist_id
     WHERE wi.id = $1`,
    [req.params.itemId],
  );

  if (!item.rowCount) return res.status(404).json({ message: "Item not found" });
  const row = item.rows[0];
  if (!canEditWishlist(row, req.user.userId)) return res.status(403).json({ message: "Forbidden" });

  const collected = Number(row.collected || 0);
  const targetPrice = Number(row.target_price || 0);
  if (targetPrice > 0 && collected >= targetPrice) {
    return res.status(409).json({ message: "Fully funded gift cannot be deleted" });
  }

  if (collected > 0) {
    // If item is removed before full funding, every contributor's invested
    // amount should decrease by their contribution on this item.
    const perUserRefunds = await pool.query(
      `SELECT contributor_user_id AS user_id, SUM(amount) AS refunded_amount
       FROM contributions
       WHERE item_id = $1 AND contributor_user_id IS NOT NULL
       GROUP BY contributor_user_id`,
      [req.params.itemId],
    );

    for (const refund of perUserRefunds.rows) {
      const userId = Number(refund.user_id);
      const refundedAmount = roundMoney(Number(refund.refunded_amount || 0));
      if (!userId || refundedAmount <= 0) continue;

      await pool.query(
        `INSERT INTO user_activity_notifications (user_id, wishlist_id, source_item_title, moved_amount, refunded_amount)
         VALUES ($1, $2, $3, 0, $4)`,
        [userId, row.wishlist_id, row.title, refundedAmount],
      );
    }
  }

  // Item is always deleted from wishlist view. Related contributions are
  // deleted via cascade, so invested sum is reduced for contributors.
  await pool.query("DELETE FROM wishlist_items WHERE id = $1", [req.params.itemId]);

  broadcast(row.slug, { type: "item.removed", itemId: Number(req.params.itemId) });

  res.json({ ok: true, mode: collected > 0 ? "deleted_with_refund" : "deleted" });
});

wishlistRouter.patch("/items/:itemId/priority", requireAuth, async (req, res) => {
  const parsed = itemPrioritySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const item = await pool.query(
    `SELECT wi.id, w.owner_id, w.recipient_mode, w.recipient_user_id, w.slug
     FROM wishlist_items wi
     JOIN wishlists w ON w.id = wi.wishlist_id
     WHERE wi.id = $1`,
    [req.params.itemId],
  );

  if (!item.rowCount) return res.status(404).json({ message: "Item not found" });
  if (!canEditWishlist(item.rows[0], req.user.userId)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const updated = await pool.query(
    `UPDATE wishlist_items
     SET priority = $2
     WHERE id = $1
     RETURNING id, priority`,
    [req.params.itemId, parsed.data.priority],
  );

  broadcast(item.rows[0].slug, { type: "item.priority.updated", itemId: Number(req.params.itemId) });
  return res.json(updated.rows[0]);
});

wishlistRouter.post("/items/:itemId/reserve", optionalAuth, async (req, res) => {
  const parsed = reserveSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const actorAlias = await resolveActorAlias(req, parsed.data.alias);
  const item = await pool.query(
    `SELECT wi.id, wi.item_status, wi.title, w.slug, w.owner_id
     FROM wishlist_items wi
     JOIN wishlists w ON w.id = wi.wishlist_id
     WHERE wi.id = $1`,
    [req.params.itemId],
  );

  if (!item.rowCount) return res.status(404).json({ message: "Item not found" });
  if (item.rows[0].item_status !== "active") {
    return res.status(409).json({ message: "Item is unavailable" });
  }

  const existing = await pool.query(
    `SELECT id, reserver_user_id, reserver_alias
     FROM reservations
     WHERE item_id = $1 AND status = 'reserved'
     ORDER BY id DESC
     LIMIT 1`,
    [req.params.itemId],
  );

  if (existing.rowCount) {
    const row = existing.rows[0];
    const isSameUser = req.user?.userId && Number(row.reserver_user_id) === Number(req.user.userId);
    const isSameAlias = !req.user?.userId && row.reserver_alias?.toLowerCase?.() === actorAlias.toLowerCase();
    if (isSameUser || isSameAlias) {
      return res.json({ ok: true, mode: "already_reserved" });
    }
    return res.status(409).json({ message: "Gift is already reserved" });
  }

  await pool.query(
    `INSERT INTO reservations (item_id, reserver_user_id, reserver_alias, status)
     VALUES ($1, $2, $3, 'reserved')`,
    [req.params.itemId, req.user?.userId || null, actorAlias],
  );

  broadcast(item.rows[0].slug, { type: "reservation.updated", itemId: Number(req.params.itemId) });

  if (Number(item.rows[0].owner_id) !== Number(req.user?.userId || 0)) {
    await createNotificationIfEnabled({
      userId: Number(item.rows[0].owner_id),
      preferenceColumn: "reservation_enabled",
      type: "item.reserved",
      title: "Подарок зарезервирован",
      body: `Кто-то забронировал подарок "${item.rows[0].title}"`,
      link: `/wishlist/${item.rows[0].slug}`,
      data: { itemId: Number(req.params.itemId) },
    });
  }

  return res.status(201).json({ ok: true, mode: "reserved" });
});

wishlistRouter.delete("/items/:itemId/reserve", optionalAuth, async (req, res) => {
  const parsed = reserveSchema.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const item = await pool.query(
    `SELECT wi.id, wi.item_status, w.slug
     FROM wishlist_items wi
     JOIN wishlists w ON w.id = wi.wishlist_id
     WHERE wi.id = $1`,
    [req.params.itemId],
  );
  if (!item.rowCount) return res.status(404).json({ message: "Item not found" });

  const existing = await pool.query(
    `SELECT id, reserver_user_id, reserver_alias
     FROM reservations
     WHERE item_id = $1 AND status = 'reserved'
     ORDER BY id DESC
     LIMIT 1`,
    [req.params.itemId],
  );
  if (!existing.rowCount) return res.json({ ok: true, mode: "already_unreserved" });

  const row = existing.rows[0];
  const fallbackAlias = parsed.data.alias?.trim() || "";
  const isSameUser = req.user?.userId && Number(row.reserver_user_id) === Number(req.user.userId);
  const isSameAlias = !req.user?.userId && fallbackAlias && row.reserver_alias?.toLowerCase?.() === fallbackAlias.toLowerCase();
  if (!isSameUser && !isSameAlias) {
    return res.status(403).json({ message: "Only current reserver can cancel reservation" });
  }

  await pool.query("DELETE FROM reservations WHERE id = $1", [row.id]);
  broadcast(item.rows[0].slug, { type: "reservation.updated", itemId: Number(req.params.itemId) });
  return res.json({ ok: true, mode: "unreserved" });
});

wishlistRouter.get("/wishlists/:slug", optionalAuth, async (req, res) => {
  const wishlistResult = await pool.query(
    `SELECT id, owner_id, title, slug, is_public, min_contribution, due_at,
            recipient_mode, recipient_user_id, recipient_name, hide_from_recipient
     FROM wishlists WHERE slug = $1`,
    [req.params.slug],
  );

  if (!wishlistResult.rowCount) return res.status(404).json({ message: "Wishlist not found" });

  const wishlist = wishlistResult.rows[0];
  const isOwner = req.user?.userId === wishlist.owner_id;
  const isRecipientEditor = Boolean(
    req.user?.userId
    && wishlist.recipient_mode === "friend"
    && wishlist.recipient_user_id
    && Number(req.user.userId) === Number(wishlist.recipient_user_id),
  );
  const canEdit = isOwner || isRecipientEditor;
  const canContribute = !isRecipientEditor;

  if (!wishlist.is_public && !isOwner) {
    if (!req.user) {
      return res.status(401).json({ message: "Войдите для просмотра", code: "LOGIN_REQUIRED" });
    }

    return res.status(403).json({ message: "У вас нет доступа к данному списку", code: "WISHLIST_ACCESS_DENIED" });
  }

  if (!isOwner && wishlist.hide_from_recipient && req.user?.userId === wishlist.recipient_user_id) {
    return res.status(403).json({ message: "У вас нет доступа к данному списку", code: "WISHLIST_ACCESS_DENIED" });
  }

  if (!isOwner && req.user?.userId) {
    const hiddenCheck = await pool.query(
      `SELECT 1 FROM wishlist_hidden_users
       WHERE wishlist_id = $1 AND user_id = $2
       LIMIT 1`,
      [wishlist.id, req.user.userId],
    );
    if (hiddenCheck.rowCount) {
      return res.status(403).json({ message: "У вас нет доступа к данному списку", code: "WISHLIST_ACCESS_DENIED" });
    }
  }

  const itemsResult = await pool.query(
    `SELECT wi.id, wi.title, wi.product_url, wi.image_url, wi.target_price, wi.priority, wi.item_status, wi.removed_reason,
            COALESCE((SELECT SUM(c.amount) FROM contributions c WHERE c.item_id = wi.id), 0) AS collected,
            COALESCE((SELECT COUNT(1) FROM contributions c WHERE c.item_id = wi.id), 0) AS contributors_count,
            EXISTS(SELECT 1 FROM reservations r WHERE r.item_id = wi.id AND r.status = 'reserved') AS is_reserved,
            (SELECT r.reserver_user_id FROM reservations r WHERE r.item_id = wi.id AND r.status = 'reserved' ORDER BY r.id DESC LIMIT 1) AS reserved_user_id,
            ir.user_id AS responsible_user_id
     FROM wishlist_items wi
     LEFT JOIN item_responsibles ir ON ir.item_id = wi.id
     WHERE wi.wishlist_id = $1
     ORDER BY
       CASE wi.priority
         WHEN 'high' THEN 3
         WHEN 'medium' THEN 2
         ELSE 1
       END DESC,
       wi.id DESC`,
    [wishlist.id],
  );

  const items = itemsResult.rows.map((item) => {
    const targetPrice = Number(item.target_price || 0);
    const collectedRaw = Number(item.collected || 0);
    const collectedEffective = targetPrice > 0 ? Math.min(collectedRaw, targetPrice) : collectedRaw;

    return {
      id: item.id,
      title: item.title,
      product_url: item.product_url,
      image_url: item.image_url,
      target_price: targetPrice,
      priority: item.priority || "medium",
      collected: collectedEffective,
      contributors_count: Number(item.contributors_count || 0),
      is_reserved: Boolean(item.is_reserved),
      is_reserved_me: Boolean(req.user?.userId && Number(item.reserved_user_id) === Number(req.user.userId)),
      responsible_user_id: item.responsible_user_id,
      is_responsible_me: Boolean(req.user?.userId && Number(item.responsible_user_id) === Number(req.user.userId)),
      item_status: item.item_status,
      removed_reason: item.removed_reason,
      is_fully_funded: targetPrice > 0 && collectedEffective >= targetPrice,
    };
  });

  res.json({
    id: wishlist.id,
    title: wishlist.title,
    slug: wishlist.slug,
    is_public: wishlist.is_public,
    due_at: wishlist.due_at,
    can_delete: Boolean(isOwner && wishlist.due_at && new Date(wishlist.due_at).getTime() <= Date.now()),
    viewer_role: isOwner ? "owner" : "guest",
    can_edit: canEdit,
    can_contribute: canContribute,
    recipient_mode: wishlist.recipient_mode,
    recipient_name: wishlist.recipient_name,
    hide_from_recipient: wishlist.hide_from_recipient,
    min_contribution: Number(wishlist.min_contribution || DEFAULT_MIN_CONTRIBUTION),
    items,
  });
});

wishlistRouter.delete("/wishlists/:slug", requireAuth, async (req, res) => {
  const row = await pool.query(
    "SELECT id, owner_id, due_at FROM wishlists WHERE slug = $1",
    [req.params.slug],
  );

  if (!row.rowCount) return res.status(404).json({ message: "Wishlist not found" });

  const wishlist = row.rows[0];
  if (wishlist.owner_id !== req.user.userId) {
    return res.status(403).json({ message: "Forbidden" });
  }

  if (!wishlist.due_at || new Date(wishlist.due_at).getTime() > Date.now()) {
    return res.status(409).json({ message: "Wishlist can be deleted only after due date" });
  }

  await pool.query("DELETE FROM wishlists WHERE id = $1", [wishlist.id]);
  broadcast(req.params.slug, { type: "wishlist.deleted" });
  return res.json({ ok: true });
});

wishlistRouter.post("/items/:itemId/responsible", requireAuth, async (req, res) => {
  const item = await pool.query(
    `SELECT wi.id, wi.item_status, wi.target_price, w.slug
     FROM wishlist_items wi
     JOIN wishlists w ON w.id = wi.wishlist_id
     WHERE wi.id = $1`,
    [req.params.itemId],
  );
  if (!item.rowCount) return res.status(404).json({ message: "Item not found" });

  if (item.rows[0].item_status !== "active") {
    return res.status(409).json({ message: "Item is unavailable" });
  }

  await pool.query(
    `INSERT INTO item_responsibles (item_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (item_id) DO UPDATE
     SET user_id = EXCLUDED.user_id`,
    [req.params.itemId, req.user.userId],
  );

  broadcast(item.rows[0].slug, { type: "responsible.updated", itemId: Number(req.params.itemId) });
  return res.status(201).json({ ok: true, userId: req.user.userId });
});

wishlistRouter.delete("/items/:itemId/responsible", requireAuth, async (req, res) => {
  const item = await pool.query(
    `SELECT wi.id, wi.item_status, w.slug
     FROM wishlist_items wi
     JOIN wishlists w ON w.id = wi.wishlist_id
     WHERE wi.id = $1`,
    [req.params.itemId],
  );
  if (!item.rowCount) return res.status(404).json({ message: "Item not found" });

  await pool.query(
    `DELETE FROM item_responsibles
     WHERE item_id = $1 AND user_id = $2`,
    [req.params.itemId, req.user.userId],
  );

  broadcast(item.rows[0].slug, { type: "responsible.updated", itemId: Number(req.params.itemId) });
  return res.json({ ok: true });
});

wishlistRouter.post("/items/:itemId/contribute", optionalAuth, async (req, res) => {
  const parsed = contributeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });
  const actorAlias = await resolveActorAlias(req, parsed.data.alias);

  const item = await pool.query(
    `SELECT wi.id, wi.item_status, wi.target_price, w.slug, w.id AS wishlist_id, w.min_contribution,
            w.recipient_mode, w.recipient_user_id,
            COALESCE((SELECT SUM(amount) FROM contributions c WHERE c.item_id = wi.id), 0) AS collected
     FROM wishlist_items wi
     JOIN wishlists w ON w.id = wi.wishlist_id
     WHERE wi.id = $1`,
    [req.params.itemId],
  );
  if (!item.rowCount) return res.status(404).json({ message: "Item not found" });

  if (item.rows[0].item_status !== "active") {
    return res.status(409).json({ message: "Item is unavailable" });
  }

  if (
    req.user?.userId
    && item.rows[0].recipient_mode === "friend"
    && item.rows[0].recipient_user_id
    && Number(item.rows[0].recipient_user_id) === Number(req.user.userId)
  ) {
    return res.status(403).json({ message: "Recipient cannot contribute to this wishlist" });
  }

  const minContribution = Number(item.rows[0].min_contribution || DEFAULT_MIN_CONTRIBUTION);
  if (Number(parsed.data.amount) < minContribution) {
    return res.status(400).json({ message: `Contribution should be at least ${minContribution}` });
  }

  const targetPrice = Number(item.rows[0].target_price || 0);
  const collected = Number(item.rows[0].collected || 0);
  const incomingAmount = roundMoney(Number(parsed.data.amount));

  if (targetPrice > 0 && collected >= targetPrice) {
    return res.status(409).json({ message: "Gift is already fully funded" });
  }

  const allocations = [];
  const itemFundingSnapshots = new Map();
  let remainingAmount = incomingAmount;

  const currentNeed = targetPrice > 0 ? roundMoney(Math.max(0, targetPrice - collected)) : remainingAmount;
  const currentAccepted = roundMoney(Math.min(remainingAmount, currentNeed));
  if (currentAccepted > 0) {
    allocations.push({ itemId: Number(req.params.itemId), amount: currentAccepted, isPrimary: true });
    itemFundingSnapshots.set(Number(req.params.itemId), {
      target: targetPrice,
      collectedBefore: collected,
    });
    remainingAmount = roundMoney(remainingAmount - currentAccepted);
  }

  if (remainingAmount > 0) {
    const candidates = await pool.query(
      `SELECT wi.id, wi.target_price,
              COALESCE((SELECT SUM(c.amount) FROM contributions c WHERE c.item_id = wi.id), 0) AS collected
       FROM wishlist_items wi
       WHERE wi.wishlist_id = $1
         AND wi.id <> $2
         AND wi.item_status = 'active'
       ORDER BY
         CASE wi.priority
           WHEN 'high' THEN 3
           WHEN 'medium' THEN 2
           ELSE 1
         END DESC,
         wi.id DESC`,
      [item.rows[0].wishlist_id, Number(req.params.itemId)],
    );

    for (const candidate of candidates.rows) {
      if (remainingAmount <= 0) break;
      const candidateTarget = Number(candidate.target_price || 0);
      if (candidateTarget <= 0) continue;

      const candidateCollected = Number(candidate.collected || 0);
      const candidateNeed = roundMoney(Math.max(0, candidateTarget - candidateCollected));
      if (candidateNeed <= 0) continue;

      const transferred = roundMoney(Math.min(remainingAmount, candidateNeed));
      if (transferred <= 0) continue;

      allocations.push({ itemId: Number(candidate.id), amount: transferred, isPrimary: false });
      itemFundingSnapshots.set(Number(candidate.id), {
        target: candidateTarget,
        collectedBefore: candidateCollected,
      });
      remainingAmount = roundMoney(remainingAmount - transferred);
    }
  }

  const totalAcceptedAmount = roundMoney(
    allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0),
  );
  const transferredAmount = roundMoney(
    allocations
      .filter((allocation) => !allocation.isPrimary)
      .reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0),
  );
  const refundedAmount = roundMoney(Math.max(0, remainingAmount));

  let creditUsedAmount = 0;
  let chargedAmount = totalAcceptedAmount;
  let droppedCreditAmount = 0;

  if (req.user?.userId && totalAcceptedAmount > 0) {
    const credits = await pool.query(
      `SELECT id, amount
       FROM contribution_credits
       WHERE user_id = $1 AND wishlist_id = $2 AND status = 'available' AND amount > 0
       ORDER BY id ASC`,
      [req.user.userId, item.rows[0].wishlist_id],
    );

    let remainingToCover = totalAcceptedAmount;
    for (const credit of credits.rows) {
      if (remainingToCover <= 0) break;

      const creditAmount = Number(credit.amount || 0);
      const useAmount = roundMoney(Math.min(creditAmount, remainingToCover));
      const leftAmount = roundMoney(creditAmount - useAmount);
      remainingToCover = roundMoney(remainingToCover - useAmount);
      creditUsedAmount = roundMoney(creditUsedAmount + useAmount);

      if (leftAmount <= 0) {
        await pool.query(
          `UPDATE contribution_credits
           SET amount = 0, status = 'used', updated_at = NOW()
           WHERE id = $1`,
          [credit.id],
        );
      } else {
        await pool.query(
          `UPDATE contribution_credits
           SET amount = $2, updated_at = NOW()
           WHERE id = $1`,
          [credit.id, leftAmount],
        );
      }
    }

    chargedAmount = roundMoney(Math.max(0, totalAcceptedAmount - creditUsedAmount));

    if (creditUsedAmount > 0) {
      const remainingCredits = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS remaining
         FROM contribution_credits
         WHERE user_id = $1 AND wishlist_id = $2 AND status = 'available' AND amount > 0`,
        [req.user.userId, item.rows[0].wishlist_id],
      );

      const remainingAmount = Number(remainingCredits.rows[0]?.remaining || 0);
      if (remainingAmount > 0) {
        droppedCreditAmount = roundMoney(remainingAmount);
        await pool.query(
          `UPDATE contribution_credits
           SET amount = 0, status = 'dropped', updated_at = NOW()
           WHERE user_id = $1 AND wishlist_id = $2 AND status = 'available' AND amount > 0`,
          [req.user.userId, item.rows[0].wishlist_id],
        );
      }
    }
  }

  if (totalAcceptedAmount <= 0) {
    return res.status(409).json({ message: "No available items for contribution" });
  }

  for (const allocation of allocations) {
    await pool.query(
      "INSERT INTO contributions (item_id, contributor_user_id, contributor_alias, amount) VALUES ($1, $2, $3, $4)",
      [allocation.itemId, req.user?.userId || null, actorAlias, allocation.amount],
    );
    broadcast(item.rows[0].slug, { type: "contribution.updated", itemId: allocation.itemId });

    const snapshot = itemFundingSnapshots.get(allocation.itemId);
    if (!snapshot || snapshot.target <= 0) continue;
    const wasFunded = snapshot.collectedBefore >= snapshot.target;
    const nowFunded = roundMoney(snapshot.collectedBefore + allocation.amount) >= snapshot.target;
    if (!wasFunded && nowFunded) {
      const itemInfo = await pool.query(
        `SELECT wi.title, w.slug, w.owner_id, ir.user_id AS responsible_user_id
         FROM wishlist_items wi
         JOIN wishlists w ON w.id = wi.wishlist_id
         LEFT JOIN item_responsibles ir ON ir.item_id = wi.id
         WHERE wi.id = $1`,
        [allocation.itemId],
      );
      if (itemInfo.rowCount) {
        const row = itemInfo.rows[0];
        await createNotificationIfEnabled({
          userId: Number(row.owner_id),
          preferenceColumn: "funded_enabled",
          type: "item.funded.owner",
          title: "Подарок полностью профинансирован",
          body: `Подарок "${row.title}" полностью профинансирован.`,
          link: `/wishlist/${row.slug}`,
          data: { itemId: allocation.itemId },
        });
        if (row.responsible_user_id) {
          await createNotificationIfEnabled({
            userId: Number(row.responsible_user_id),
            preferenceColumn: "funded_enabled",
            type: "item.funded.responsible",
            title: "Сумма собрана, пора купить подарок",
            body: `Подарок "${row.title}" собран. Можно покупать.`,
            link: `/wishlist/${row.slug}`,
            data: { itemId: allocation.itemId },
          });
        }
      }
    }
  }

  res.status(201).json({
    ok: true,
    acceptedAmount: roundMoney(totalAcceptedAmount),
    refundedAmount: roundMoney(refundedAmount),
    transferredAmount: roundMoney(transferredAmount),
    creditUsedAmount: roundMoney(creditUsedAmount),
    chargedAmount: roundMoney(chargedAmount),
    droppedCreditAmount: roundMoney(droppedCreditAmount),
    distribution: transferredAmount > 0 ? "priority_transfer" : refundedAmount > 0 ? "refund_only" : "none",
  });
});
