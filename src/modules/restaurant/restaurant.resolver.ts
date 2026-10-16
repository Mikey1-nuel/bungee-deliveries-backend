import {
  createRestaurant,
  getRestaurants,
  getRestaurantMenusByRestaurant,
} from "./restaurant.service";
import { requireRole } from "../../middleware/role";

export const restaurantResolvers = {
  Query: {
    getRestaurants: async (_: unknown, __: unknown, context: any) => {
      if (!context.user) {
        throw new Error("Unauthorized");
      }

      //
      // CUSTOMER
      //

      if (context.user.role === "customer") {
        return await getRestaurants();
      }

      //
      // RESTAURANT OWNER
      //

      if (context.user.role === "restaurant") {
        const restaurants = await getRestaurants();

        return restaurants.filter(
          (restaurant: any) => restaurant.owner_id === context.user.id,
        );
      }

      //
      // BLOCK OTHERS
      //

      return [];
    },

    getRestaurantMenusByRestaurant: async (
      _: unknown,
      {
        restaurantId,
      }: {
        restaurantId: string;
      },
    ) => {
      return await getRestaurantMenusByRestaurant(restaurantId);
    },
  },

  Mutation: {
    createRestaurant: async (_: any, { input }: any, context: any) => {
      try {
        const userId = context?.user?.id;

        if (!userId) {
          throw new Error("Unauthorized user");
        }

        requireRole(context.user, ["restaurant", "admin"]);

        const result = await createRestaurant(input, userId);

        return result;
      } catch (err: any) {
        console.error("CREATE RESTAURANT RESOLVER ERROR:", err);

        throw new Error(err.message || "Restaurant creation failed");
      }
    },
  },
};
