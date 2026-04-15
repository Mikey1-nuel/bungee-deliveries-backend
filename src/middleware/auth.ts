import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET!;

export const getUserFromToken = (req: any) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return null;

  const token = authHeader.split(" ")[1];

  try {
    return jwt.verify(token, ACCESS_SECRET);
  } catch {
    return null;
  }
};
