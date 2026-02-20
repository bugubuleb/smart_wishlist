import { verifyAccessToken } from "../services/auth.js";

export function optionalAuth(req, _res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    req.user = verifyAccessToken(token);
  } catch {
    req.user = null;
  }

  return next();
}
