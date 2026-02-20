import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/auth.js";

const usernameSchema = z.object({
  username: z.string().trim().min(3).max(60).regex(/^[a-zA-Z0-9_]+$/),
});

const requestIdSchema = z.object({
  requestId: z.coerce.number().int().positive(),
});

export const friendRouter = Router();

friendRouter.get("/friends", requireAuth, async (req, res) => {
  const [friendsResult, incomingResult, outgoingResult] = await Promise.all([
    pool.query(
      `SELECT u.id, u.username, u.display_name
       FROM friendships f
       JOIN users u ON u.id = f.friend_user_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.userId],
    ),
    pool.query(
      `SELECT fr.id, fr.from_user_id, fr.created_at, u.username, u.display_name
       FROM friend_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.user.userId],
    ),
    pool.query(
      `SELECT fr.id, fr.to_user_id, fr.created_at, u.username, u.display_name
       FROM friend_requests fr
       JOIN users u ON u.id = fr.to_user_id
       WHERE fr.from_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.user.userId],
    ),
  ]);

  res.json({
    friends: friendsResult.rows,
    incoming: incomingResult.rows,
    outgoing: outgoingResult.rows,
  });
});

friendRouter.post("/friends/request", requireAuth, async (req, res) => {
  const parsed = usernameSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid username" });
  }

  const username = parsed.data.username.toLowerCase();

  const target = await pool.query(
    "SELECT id, username, display_name FROM users WHERE LOWER(username) = $1",
    [username],
  );

  if (!target.rowCount) return res.status(404).json({ message: "User not found" });

  const targetUser = target.rows[0];
  if (targetUser.id === req.user.userId) {
    return res.status(409).json({ message: "Cannot add yourself" });
  }

  const existingFriendship = await pool.query(
    "SELECT 1 FROM friendships WHERE user_id = $1 AND friend_user_id = $2 LIMIT 1",
    [req.user.userId, targetUser.id],
  );
  if (existingFriendship.rowCount) {
    return res.status(409).json({ message: "Already in friends" });
  }

  const reversePending = await pool.query(
    `SELECT id FROM friend_requests
     WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
     LIMIT 1`,
    [targetUser.id, req.user.userId],
  );

  if (reversePending.rowCount) {
    await pool.query(
      "UPDATE friend_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1",
      [reversePending.rows[0].id],
    );

    await pool.query(
      `INSERT INTO friendships (user_id, friend_user_id)
       VALUES ($1, $2), ($2, $1)
       ON CONFLICT (user_id, friend_user_id) DO NOTHING`,
      [req.user.userId, targetUser.id],
    );

    return res.status(201).json({
      autoAccepted: true,
      friend: {
        id: targetUser.id,
        username: targetUser.username,
        display_name: targetUser.display_name,
      },
    });
  }

  const pendingAlready = await pool.query(
    `SELECT id FROM friend_requests
     WHERE from_user_id = $1 AND to_user_id = $2 AND status = 'pending'
     LIMIT 1`,
    [req.user.userId, targetUser.id],
  );

  if (pendingAlready.rowCount) {
    return res.status(409).json({ message: "Request already sent" });
  }

  const inserted = await pool.query(
    `INSERT INTO friend_requests (from_user_id, to_user_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING id`,
    [req.user.userId, targetUser.id],
  );

  res.status(201).json({
    request: {
      id: inserted.rows[0].id,
      to_user_id: targetUser.id,
      username: targetUser.username,
      display_name: targetUser.display_name,
    },
  });
});

friendRouter.post("/friends/requests/:requestId/accept", requireAuth, async (req, res) => {
  const parsed = requestIdSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ message: "Invalid request id" });

  const requestResult = await pool.query(
    `SELECT id, from_user_id, to_user_id
     FROM friend_requests
     WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
    [parsed.data.requestId, req.user.userId],
  );

  if (!requestResult.rowCount) return res.status(404).json({ message: "Request not found" });

  const friendRequest = requestResult.rows[0];

  await pool.query(
    "UPDATE friend_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1",
    [friendRequest.id],
  );

  await pool.query(
    `INSERT INTO friendships (user_id, friend_user_id)
     VALUES ($1, $2), ($2, $1)
     ON CONFLICT (user_id, friend_user_id) DO NOTHING`,
    [friendRequest.from_user_id, friendRequest.to_user_id],
  );

  res.json({ ok: true });
});

friendRouter.post("/friends/requests/:requestId/reject", requireAuth, async (req, res) => {
  const parsed = requestIdSchema.safeParse(req.params);
  if (!parsed.success) return res.status(400).json({ message: "Invalid request id" });

  const updated = await pool.query(
    `UPDATE friend_requests
     SET status = 'rejected', updated_at = NOW()
     WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
     RETURNING id`,
    [parsed.data.requestId, req.user.userId],
  );

  if (!updated.rowCount) return res.status(404).json({ message: "Request not found" });

  res.json({ ok: true });
});
