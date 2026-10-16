import { pool } from "../../config/db";
import { GraphQLError } from "graphql";

//
// TYPES
//

export interface AuthUser {
  id: string;
  role: string;
}

export interface RestaurantMenuResult {
  __typename: "RestaurantMenu";

  id: string;

  base_price: number;

  is_available: boolean;

  created_at?: string;

  menu: {
    id: string;
    name: string;
    description?: string;
    image?: string;
    type: "meal" | "extra" | "swallow";
  };

  restaurant: {
    id: string;
    name: string;
    image?: string;
    location?: string;
  };
}

export interface GroupedMenuResult {
  __typename: "GroupedMenu";

  slug: string;

  name: string;

  description?: string;

  image?: string;

  type: "meal" | "extra" | "swallow";

  lowest_price: number;

  restaurants: {
    id: string;
    name: string;
  }[];
}

export type MenuResult = RestaurantMenuResult | GroupedMenuResult;

//
// CREATE MENU
//

interface CreateMenuInput {
  name: string;
  description?: string;
  categoryId: string;
  basePrice: number;
  image?: string;
  type: "meal" | "extra" | "swallow";
}

export const createMenu = async (input: CreateMenuInput, user: AuthUser) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    //
    // ONLY RESTAURANTS
    //

    if (user.role !== "restaurant") {
      throw new Error("Only restaurants can create menus");
    }

    //
    // FIND RESTAURANT
    //

    const restaurantResult = await client.query(
      `
          SELECT id
          FROM restaurants
          WHERE owner_id = $1
          LIMIT 1
        `,
      [user.id],
    );

    if (restaurantResult.rows.length === 0) {
      throw new GraphQLError(
        "You need to set up your restaurant profile before adding menu items.",
        { extensions: { code: "RESTAURANT_PROFILE_MISSING" } },
      );
    }

    const restaurantId = restaurantResult.rows[0].id;

    const { name, description, categoryId, basePrice, image, type } = input;

    //
    // VALIDATIONS
    //

    if (!name.trim() || !categoryId) {
      throw new Error("Missing required fields");
    }

    if (basePrice <= 0) {
      throw new Error("Price must be greater than 0");
    }

    //
    // CREATE MENU
    //

    const menuResult = await client.query(
      `
          INSERT INTO menus
          (
            name,
            description,
            category_id,
            image,
            type
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `,
      [name.trim(), description, categoryId, image, type],
    );

    const menuId = menuResult.rows[0].id;

    //
    // LINK MENU TO RESTAURANT
    //

    const restaurantMenuResult = await client.query(
      `
          INSERT INTO restaurant_menus
          (
            restaurant_id,
            menu_id,
            base_price
          )
          VALUES ($1, $2, $3)
          RETURNING id
        `,
      [restaurantId, menuId, basePrice],
    );

    await client.query("COMMIT");

    return {
      id: restaurantMenuResult.rows[0].id,

      menuId,

      message: "Menu created successfully",
    };
  } catch (error: any) {
    await client.query("ROLLBACK");

    console.error("CREATE MENU ERROR:", error.message);

    throw new Error(error.message);
  } finally {
    client.release();
  }
};

//
// GET RESTAURANT MENUS
//

export const getRestaurantMenus = async (
  user: AuthUser,
): Promise<MenuResult[]> => {
  //
  // CUSTOMER VIEW
  //

  if (user.role === "customer") {
    const result = await pool.query(
      `
          SELECT
            LOWER(TRIM(m.name)) AS slug,

            MIN(m.name) AS name,

            MIN(m.description)
              AS description,

            MIN(m.image)
              AS image,

            m.type,

            MIN(rm.base_price)
              AS lowest_price,

            json_agg(
              DISTINCT jsonb_build_object(
                'id', r.id,
                'name', r.name
              )
            ) AS restaurants

          FROM restaurant_menus rm

          JOIN menus m
            ON rm.menu_id = m.id

          JOIN restaurants r
            ON rm.restaurant_id = r.id

          WHERE rm.is_available = true

          GROUP BY
            LOWER(TRIM(m.name)),
            m.type

          ORDER BY MIN(m.name) ASC
        `,
    );

    return result.rows.map((menu) => ({
      __typename: "GroupedMenu",

      ...menu,
    }));
  }

  //
  // RESTAURANT OWNER VIEW
  //

  if (user.role === "restaurant") {
    const result = await pool.query(
      `
          SELECT
            rm.id,
            rm.base_price,
            rm.is_available,
            rm.created_at,

            json_build_object(
              'id', m.id,
              'name', m.name,
              'description', m.description,
              'image', m.image,
              'type', m.type
            ) AS menu,

            json_build_object(
              'id', r.id,
              'name', r.name,
              'image', r.image,
              'location', r.location
            ) AS restaurant

          FROM restaurant_menus rm

          JOIN menus m
            ON rm.menu_id = m.id

          JOIN restaurants r
            ON rm.restaurant_id = r.id

          WHERE r.owner_id = $1

          ORDER BY rm.created_at DESC
        `,
      [user.id],
    );

    return result.rows.map((menu) => ({
      __typename: "RestaurantMenu",

      ...menu,
    }));
  }

  return [];
};

//
// GET RESTAURANT MENUS BY SLUG
//

export const getRestaurantMenusBySlug = async (
  slug: string,
): Promise<RestaurantMenuResult[]> => {
  const result = await pool.query(
    `
        SELECT
          rm.id,
          rm.base_price,
          rm.is_available,
          rm.created_at,

          json_build_object(
            'id', m.id,
            'name', m.name,
            'description', m.description,
            'image', m.image,
            'type', m.type
          ) AS menu,

          json_build_object(
            'id', r.id,
            'name', r.name,
            'image', r.image,
            'location', r.location
          ) AS restaurant

        FROM restaurant_menus rm

        JOIN menus m
          ON rm.menu_id = m.id

        JOIN restaurants r
          ON rm.restaurant_id = r.id

        WHERE
          LOWER(TRIM(m.name))
          =
          LOWER(TRIM($1))

        AND rm.is_available = true

        ORDER BY rm.base_price ASC
      `,
    [slug],
  );

  return result.rows.map((menu) => ({
    __typename: "RestaurantMenu",

    ...menu,
  }));
};
