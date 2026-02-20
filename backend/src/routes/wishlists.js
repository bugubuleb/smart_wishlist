import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";
import { optionalAuth } from "../middleware/optional-auth.js";
import { broadcast } from "../realtime/hub.js";
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

  res.status(201).json(result.rows[0]);
});

wishlistRouter.post("/wishlists/:slug/items", requireAuth, async (req, res) => {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const ownerCheck = await pool.query("SELECT id, owner_id FROM wishlists WHERE slug = $1", [req.params.slug]);
  if (!ownerCheck.rowCount) return res.status(404).json({ message: "Wishlist not found" });
  if (ownerCheck.rows[0].owner_id !== req.user.userId) return res.status(403).json({ message: "Forbidden" });

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
    `SELECT wi.id, wi.wishlist_id, wi.item_status, wi.title, wi.target_price, w.title AS wishlist_title, w.owner_id, w.slug,
            COALESCE((SELECT SUM(amount) FROM contributions c WHERE c.item_id = wi.id), 0) AS collected
     FROM wishlist_items wi
     JOIN wishlists w ON w.id = wi.wishlist_id
     WHERE wi.id = $1`,
    [req.params.itemId],
  );

  if (!item.rowCount) return res.status(404).json({ message: "Item not found" });
  const row = item.rows[0];
  if (row.owner_id !== req.user.userId) return res.status(403).json({ message: "Forbidden" });

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
    `SELECT wi.id, w.owner_id, w.slug
     FROM wishlist_items wi
     JOIN wishlists w ON w.id = wi.wishlist_id
     WHERE wi.id = $1`,
    [req.params.itemId],
  );

  if (!item.rowCount) return res.status(404).json({ message: "Item not found" });
  if (Number(item.rows[0].owner_id) !== Number(req.user.userId)) {
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

  const minContribution = Number(item.rows[0].min_contribution || DEFAULT_MIN_CONTRIBUTION);
  if (Number(parsed.data.amount) < minContribution) {
    return res.status(400).json({ message: `Contribution should be at least ${minContribution}` });
  }

  const targetPrice = Number(item.rows[0].target_price || 0);
  const collected = Number(item.rows[0].collected || 0);
  const incomingAmount = Number(parsed.data.amount);
  const nextCollected = collected + incomingAmount;

  if (targetPrice > 0 && collected >= targetPrice) {
    return res.status(409).json({ message: "Gift is already fully funded" });
  }

  let acceptedAmount = incomingAmount;
  let refundedAmount = 0;

  if (targetPrice > 0 && nextCollected > targetPrice) {
    const ratio = targetPrice / nextCollected;
    acceptedAmount = roundMoney(incomingAmount * ratio);
    refundedAmount = roundMoney(incomingAmount - acceptedAmount);
  }

  let creditUsedAmount = 0;
  let chargedAmount = acceptedAmount;
  let droppedCreditAmount = 0;

  if (req.user?.userId && acceptedAmount > 0) {
    const credits = await pool.query(
      `SELECT id, amount
       FROM contribution_credits
       WHERE user_id = $1 AND wishlist_id = $2 AND status = 'available' AND amount > 0
       ORDER BY id ASC`,
      [req.user.userId, item.rows[0].wishlist_id],
    );

    let remainingToCover = acceptedAmount;
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

    chargedAmount = roundMoney(Math.max(0, acceptedAmount - creditUsedAmount));

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

  if (acceptedAmount <= 0) {
    return res.status(409).json({ message: "Gift is already fully funded" });
  }

  await pool.query(
    "INSERT INTO contributions (item_id, contributor_user_id, contributor_alias, amount) VALUES ($1, $2, $3, $4)",
    [req.params.itemId, req.user?.userId || null, actorAlias, acceptedAmount],
  );

  broadcast(item.rows[0].slug, { type: "contribution.updated", itemId: Number(req.params.itemId) });

  res.status(201).json({
    ok: true,
    acceptedAmount: roundMoney(acceptedAmount),
    refundedAmount: roundMoney(refundedAmount),
    creditUsedAmount: roundMoney(creditUsedAmount),
    chargedAmount: roundMoney(chargedAmount),
    droppedCreditAmount: roundMoney(droppedCreditAmount),
    distribution: targetPrice > 0 && nextCollected > targetPrice ? "proportional" : "none",
  });
});
