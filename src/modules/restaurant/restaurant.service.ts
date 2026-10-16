import { pool } from "../../config/db";

interface CreateRestaurantInput {
  name: string;
  location?: string;
  image?: string;
}

export const createRestaurant = async (
  input: CreateRestaurantInput,
  userId: string
) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (!userId) {
      throw new Error("Unauthorized: user not found");
    }

    const name = input.name?.trim();
    const location = input.location?.trim() || null;
    const image = input.image || null;

    if (!name) {
      throw new Error("Restaurant name is required");
    }

    const result = await client.query(
      `
      INSERT INTO restaurants (name, location, image, owner_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [name, location, image, userId]
    );

    if (!result.rows.length) {
      throw new Error("Restaurant creation failed");
    }

    await client.query("COMMIT");

    return {
      ...result.rows[0],
      message: "Restaurant created successfully",
    };
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("🔥 CREATE RESTAURANT ERROR:", err);
    throw new Error(err.message || "Internal server error");
  } finally {
    client.release();
  }
};

export const getRestaurants = async () => {
  try {
    const result = await pool.query(
      `
      SELECT
        id,
        owner_id,
        name,
        rating,
        location,
        image,
        created_at
      FROM restaurants
      ORDER BY created_at DESC
      `
    );

    return result.rows;

  } catch (err) {
    console.error("GET RESTAURANTS ERROR:", err);
    throw new Error("Failed to fetch restaurants");
  }
};

export const getRestaurantMenusByRestaurant = async (
  restaurantId: string,
) => {

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

      WHERE r.id = $1
      AND rm.is_available = true

      ORDER BY rm.created_at DESC
    `,
    [restaurantId],
  );

  return result.rows.map((menu) => ({
    __typename: "RestaurantMenu",
    ...menu,
  }));
};
