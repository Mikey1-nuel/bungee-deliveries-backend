export const restaurantResolvers = {
  Query: {
    getRestaurants: async () => {
      return [
        { id: "1", name: "KFC" },
        { id: "2", name: "Dominos" },
      ];
    },
  },
};
