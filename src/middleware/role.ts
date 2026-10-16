export const requireAuth = (user: any) => {
  if (!user) {
    throw new Error("Unauthorized");
  }
};

export const requireRole = (
  user: any,
  allowedRoles: string[]
) => {

  requireAuth(user);

  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden");
  }
};
