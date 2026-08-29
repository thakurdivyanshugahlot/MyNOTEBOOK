import { clerkMiddleware, getAuth } from "@clerk/express";

export const clerkAuth = clerkMiddleware();

// Rejects unauthenticated requests with a proper 401 JSON response,
// instead of redirecting (which only makes sense for browser-rendered apps).
export function requireUser(req, res, next) {
  const auth = getAuth(req);
  if (!auth.userId) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
}

export function currentUserId(req) {
  return getAuth(req).userId;
}