export const requireAuth = (user: any) => {
  if (!user) throw new Error("Unauthorized");
};

export const requireRole = (user: any, roles: string[]) => {
  if (!user || !roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
};
