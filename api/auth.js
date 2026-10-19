import jwt from "jsonwebtoken";

export function requireAdmin(req, res, next) {
  const authorization = req.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Admin sign-in is required." });
  }
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: "Your admin session has expired. Please sign in again." });
  }
}

export function createAdminToken(username) {
  return jwt.sign({ sub: username, role: "admin" }, process.env.JWT_SECRET, { expiresIn: "8h" });
}
