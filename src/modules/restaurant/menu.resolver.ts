import {
  createMenu,
  getRestaurantMenus,
  getRestaurantMenusBySlug,
} from "./menu.service";

export const menuResolvers = {
  //
  // UNION RESOLVER
  //

  MenuResult: {
    __resolveType(obj: any) {
      //
      // RESTAURANT MENU
      //

      if (obj.base_price !== undefined) {
        return "RestaurantMenu";
      }

      //
      // GROUPED MENU
      //

      if (obj.lowest_price !== undefined) {
        return "GroupedMenu";
      }

      return null;
    },
  },

  //
  // QUERIES
  //

  Query: {
    getRestaurantMenus: async (_: unknown, __: unknown, context: any) => {
      if (!context.user) {
        throw new Error("Unauthorized");
      }

      return await getRestaurantMenus(context.user);
    },

    //
    // GET MENUS BY SLUG
    //

    getRestaurantMenusBySlug: async (
      _: unknown,
      {
        slug,
      }: {
        slug: string;
      },
    ) => {
      return await getRestaurantMenusBySlug(slug);
    },
  },

  //
  // MUTATIONS
  //

  Mutation: {
    createMenu: async (_: unknown, { input }: any, context: any) => {
      if (!context.user) {
        throw new Error("Unauthorized");
      }

      return await createMenu(input, context.user);
    },
  },
};
