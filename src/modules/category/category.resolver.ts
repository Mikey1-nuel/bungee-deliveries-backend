import { getAllCategories } from "./category.service";

export const categoryResolvers = {
  Query: {
    categories: async () => {
      return await getAllCategories();
    },
  },
};
