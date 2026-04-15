import { authResolvers } from "./auth.resolver";
import { restaurantResolvers } from "./restaurant.resolver";
import { adminResolvers } from "../../modules/admin/admin.resolver";

export const resolvers = [
  authResolvers,
  restaurantResolvers,
  adminResolvers,
];
