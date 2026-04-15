export const typeDefs = `#graphql
  type User {
  id: ID!
  fullName: String!
  email: String
  phone: String
  role: String!
	}

	type Restaurant {
		id: ID!
		name: String!
		rating: Float
		location: String
		cuisine: String
		image: String
	}

	type Meal {
		id: ID!
		name: String!
		description: String
		image: String
	}

	type RestaurantMenu {
		id: ID!
		meal: Meal!
		basePrice: Float!
		isAvailable: Boolean!
	}

	type Order {
		id: ID!
		status: String!
		total: Float
		createdAt: String
		items: [OrderItem]
	}

	type OrderItem {
		id: ID!
		quantity: Int!
	}

	type Notification {
		id: ID!
		type: String!
		title: String!
		message: String!
		read: Boolean!
		createdAt: String!
	}

  type AuthResponse {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  type Query {
    me: User
		getRestaurants: [Restaurant!]!
  }

  type Mutation {
    signup(
    name: String!
    email: String!
    password: String!
    role: String
  ): AuthResponse

  login(
    email: String!
    password: String!
  ): AuthResponse

  refreshToken(token: String!): String
  logout: Boolean

  deleteUser(userId: ID!): String
  banUser(userId: ID!): String
  }

  type AdminStats {
  totalUsers: Int
  totalOrders: Int
  totalRevenue: Float
	}

	type Query {
		adminStats: AdminStats
	}
`;
