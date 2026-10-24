export const typeDefs = `#graphql

#
# ENUMS
#

enum Role {
  customer
  restaurant
  admin
  logistics
  rider
}

enum ApprovalStatus {
  pending
  approved
  rejected
}

enum MenuType {
  meal
  extra
  swallow
}

enum OrderStatus {
  pending
  accepted
  rejected
  preparing
  ready_for_pickup
  picked_up
  delivered
  cancelled
}

#
# USER
#

type User {
  id: ID!

  fullName: String!

  email: String

  phone: String

  role: Role!

  status: String!

  approvalStatus: ApprovalStatus!

  isOnline: Boolean!

  lastSeen: String

  createdAt: String!
}

#
# AUTH
#

type AuthResponse {
  accessToken: String!

  refreshToken: String!

  user: User!
}

type RefreshTokenResponse {
  accessToken: String!
  refreshToken: String!
}

#
# RESTAURANT
#

type Restaurant {
  id: ID!

  owner_id: ID!

  name: String!

  location: String

  image: String

  rating: Float
}

#
# CATEGORY
#

type Category {
  id: ID!

  name: String!

  icon: String
}

#
# MENU
#

type Menu {
  id: ID!

  name: String!

  description: String

  image: String

  type: MenuType!
}

#
# RESTAURANT MENU
#

type RestaurantMenu {
  id: ID!

  base_price: Float!

  is_available: Boolean!

  created_at: String

  menu: Menu!

  restaurant: Restaurant!
}

#
# GROUPED MENUS
#

type MenuRestaurant {
  id: ID!

  name: String!
}

type GroupedMenu {
  slug: String!

  name: String!

  description: String

  image: String

  type: MenuType!

  lowest_price: Float!

  restaurants: [MenuRestaurant!]!
}

union MenuResult =
    RestaurantMenu
  | GroupedMenu

#
# ORDER MENU SNAPSHOT
#

type OrderMenu {
  id: ID
  name: String!
  image: String
  type: MenuType!
}

#
# ORDER ITEM
#

type OrderItem {
  id: ID!

  restaurantMenuId: ID!

  menuName: String!

  menuType: String!

  unitPrice: Float!

  quantity: Int!

  totalPrice: Float!

  menuImage: String

  menu: OrderMenu
}

type Customer {
  id: ID!
  fullName: String!
  phone: String
  email: String
}

#
# ORDER
#

type Rider {
  id: ID!
  fullName: String!
  phone: String
}

type LogisticsCompany {
  id: ID!
  name: String!
  contact_phone: String
}

type Payment {
  id: ID!
  amount: Float!
  status: String!
  method: String
  created_at: String!
}

type OrderStatusHistory {
  id: ID!
  status: OrderStatus!
  changedBy: ID
  created_at: String!
}

type Order {
  id: ID!
  status: OrderStatus!
  total: Float!
  deliveryAddress: String!
  createdAt: String!

  restaurant: Restaurant!
  customer: Customer
  items: [OrderItem!]!
  logisticsCompany: LogisticsCompany
  rider: Rider
  payment: Payment
  statusHistory: [OrderStatusHistory!]!

  acceptedAt: String
  preparedAt: String
  pickedUpAt: String
  deliveredAt: String
}

type RestaurantOrderStats {
  pending: Int!
  accepted: Int!
  preparing: Int!
  readyForPickup: Int!
  pickedUp: Int!
  deliveredToday: Int!
  revenueToday: Float!
}

#
# NOTIFICATIONS
#

type Notification {
  id: ID!
  type: String!
  title: String!
  message: String!
  read: Boolean!
  action_url: String
  created_at: String!
}

#
# SESSIONS
#

type Session {
  id: ID!

  device: String

  ip: String

  createdAt: String
}

#
# ADMIN
#

type AdminStats {
  totalUsers: Int

  totalOrders: Int

  totalRevenue: Float
}

#
# VALIDATE SESSION
#

type ValidateSessionResponse {
  authenticated: Boolean!

  user: User
}

type NotificationStats {
  unreadCount: Int!
}

#
# INPUTS
#

input SignupInput {
  fullName: String!
  email: String!
  phone: String!
  password: String!
  role: String!
  restaurantName: String
  restaurantLocation: String
  restaurantImage: String
}

input LoginInput {
  identifier: String!

  password: String!
}

input CreateRestaurantInput {
  name: String!

  location: String

  image: String
}

input CreateMenuInput {
  name: String!

  description: String

  categoryId: ID!

  basePrice: Float!

  image: String

  type: MenuType!
}

input CreateOrderItemInput {
  restaurantMenuId: ID!
  quantity: Int!
}
  input CheckoutCartItemInput {
  restaurantMenuId: ID!
  quantity: Int!
}

input CreateOrderInput {
  restaurantId: ID!
  deliveryAddress: String!
  items: [CreateOrderItemInput!]!
}

input CheckoutCartInput {
  deliveryAddress: String!
  items: [CheckoutCartItemInput!]!
}

type CheckoutResult {
  orders: [Order!]!
  orderCount: Int!
  subtotal: Float!
  total: Float!
}

#
# RESPONSES
#

type CreateRestaurantResponse {
  id: ID!

  name: String!

  location: String

  image: String

  rating: Float

  owner_id: ID!

  message: String
}

type CreateMenuResponse {
  id: ID!

  menuId: ID!

  message: String!
}

type RestaurantOrdersResponse {
  orders: [Order!]!
  total: Int!
  page: Int!
  totalPages: Int!
}

#
# LOGISTICS ET RIDER
#

type RiderDelivery {
  id: ID!
  status: OrderStatus!
  total: Float!
  deliveryAddress: String!
  createdAt: String!
  pickedUpAt: String
  deliveredAt: String
  restaurant: Restaurant!
  customer: Customer!
  items: [OrderItem!]!
}

type RiderBatchOrderItem {
  name: String!
  type: String!
  image: String
  quantity: Int!
}

type RiderBatchOrder {
  id: ID!
  status: OrderStatus!
  total: Float!
  deliveryAddress: String!
  restaurant: String!
  customer: String!
  items: [RiderBatchOrderItem!]!
}

type RiderBatch {
  id: ID!
  slot: DispatchSlot!
  status: String!
  scheduledAt: String!
  createdAt: String!
  orderCount: Int!
  orders: [RiderBatchOrder!]!
}

type RiderEarnings {
  totalDeliveries: Int!
  totalEarnings: Float!
  todayDeliveries: Int!
  todayEarnings: Float!
}

type RiderProfile {
  id: ID!
  fullName: String!
  phone: String
  email: String
  isAvailable: Boolean!
  logisticsCompany: LogisticsCompanyInfo
}

type LogisticsCompanyInfo {
  id: ID!
  name: String!
  contactPhone: String
}

type RiderWithStats {
  id: ID!
  fullName: String!
  phone: String
  email: String
  isAvailable: Boolean!
    isOnline: Boolean!
  lastSeen: String
  totalDeliveries: Int!
}

type LogisticsOverview {
  totalRiders: Int!
  onlineRiders: Int!
  availableRiders: Int!
  busyRiders: Int!
  totalDeliveries: Int!
  pendingAssignments: Int!
}

#
# ADMIN
#

type AdminUser {
  id: ID!
  fullName: String!
  email: String
  phone: String
  role: Role!
  status: String!
  approvalStatus: ApprovalStatus!
  createdAt: String!
}

type AdminRestaurant {
  id: ID!
  name: String!
  location: String
  image: String
  rating: Float
  ownerId: ID!
  ownerName: String!
  ownerEmail: String
  approvalStatus: ApprovalStatus!
  createdAt: String!
}

type AdminOrder {
  id: ID!
  status: OrderStatus!
  total: Float!
  deliveryAddress: String!
  createdAt: String!
  restaurant: Restaurant!
  customer: Customer!
  items: [OrderItem!]!
  rider: Rider
}

type AdminRider {
  id: ID!
  fullName: String!
  phone: String
  email: String
  isAvailable: Boolean!
  isOnline: Boolean!
  lastSeen: String
  totalDeliveries: Int!
  logisticsCompany: LogisticsCompanyInfo
}

type AdminStats {
  totalUsers: Int!
  totalRestaurants: Int!
  totalOrders: Int!
  totalRevenue: Float!
  pendingOrders: Int!
  deliveredToday: Int!
  newUsersToday: Int!
}

type PaginationInfo {
    page: Int!
    limit: Int!
    total: Int!
    totalPages: Int!
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
}

type AdminUsersResponse {
    users: [User!]!
    pagination: PaginationInfo!
}

type AdminRestaurantsResponse {
  restaurants: [AdminRestaurant!]!
  pagination: PaginationInfo!
}

type AdminOrdersResponse {
  orders: [AdminOrder!]!
  pagination: PaginationInfo!
}

type AdminRidersResponse {
  riders: [AdminRider!]!
  pagination: PaginationInfo!
}

type MutationResponse {
    success: Boolean!
    message: String!
}

#
# LOGISTICS ADMIN VIEW
#

type AdminLogisticsCompany {
  id: ID!
  name: String!
  contactPhone: String
  createdAt: String!
  totalRiders: Int!
  onlineRiders: Int!
  availableRiders: Int!
  busyRiders: Int!
}

type AdminLogisticsResponse {
  logistics: [AdminLogisticsCompany!]!
  pagination: PaginationInfo!
}

#
# DISPATCH
#

enum DispatchSlot {
  morning
  afternoon
  evening
}

type DispatchBatch {
  id: ID!
  slot: DispatchSlot!
  scheduledAt: String!
  status: String!
  createdAt: String!
  riderName: String!
  riderPhone: String
  orderCount: Int!
}

type DispatchBatchesResponse {
  batches: [DispatchBatch!]!
  pagination: PaginationInfo!
}

type CreateDispatchResponse {
  success: Boolean!
  message: String!
  batchId: ID!
  scheduledAt: String!
}

type CreateUserResponse {
  success: Boolean!
  message: String!
  userId: ID!
}

#
# QUERY
#

type Query {
  me: User

  validateSession: ValidateSessionResponse!

  getRestaurants: [Restaurant!]!

  getMenus(
    type: MenuType
  ): [Menu!]!

  getRestaurantMenus:
    [MenuResult!]!

  categories: [Category!]!

  adminStats: AdminStats

  mySessions: [Session!]!

  getRestaurantMenusByMenu(
    menuId: ID!
  ): [RestaurantMenu!]!

  getRestaurantMenusBySlug(
    slug: String!
  ): [RestaurantMenu!]!

  getRestaurantMenusByRestaurant(
    restaurantId: ID!
  ): [RestaurantMenu!]!

  getMyOrders: [Order!]!

    getRestaurantOrders(
    page: Int
    limit: Int
    search: String
    status: OrderStatus
  ): RestaurantOrdersResponse!

  getRestaurantOrderStats: RestaurantOrderStats!

  getMyNotifications(
  limit: Int
  offset: Int
): [Notification!]!

  notificationStats: NotificationStats!

  getMyDeliveries: [RiderDelivery!]!
  getMyDispatchBatches: [RiderBatch!]!
  getMyEarnings: RiderEarnings!
  getMyRiderProfile: RiderProfile!
  getLogisticsRiders: [RiderWithStats!]!
  getLogisticsOrders(page: Int, limit: Int, status: OrderStatus): RestaurantOrdersResponse!
  getLogisticsOverview: LogisticsOverview!

    getAdminStats: AdminStats!
  getAdminUsers(page: Int, limit: Int, search: String, role: String, approvalStatus: ApprovalStatus): AdminUsersResponse!
  getAdminRestaurants(
    page: Int
    limit: Int
    search: String
    approvalStatus: ApprovalStatus
  ): AdminRestaurantsResponse!
  getAdminOrders(page: Int, limit: Int, search: String, status: OrderStatus): AdminOrdersResponse!
  getAdminRiders(page: Int, limit: Int, search: String): AdminRidersResponse!

  getAdminLogistics(page: Int, limit: Int, search: String): AdminLogisticsResponse!
  getDispatchBatches(page: Int, limit: Int, slot: DispatchSlot, date: String): DispatchBatchesResponse!
}

#
# MUTATION
#

type Mutation {
  signup(
    input: SignupInput!
  ): AuthResponse

  login(
    input: LoginInput!
  ): AuthResponse

  refreshToken(
    token: String!
  ): RefreshTokenResponse!

  logout: Boolean!

  createRestaurant(
    input: CreateRestaurantInput!
  ): CreateRestaurantResponse

  createMenu(
    input: CreateMenuInput!
  ): CreateMenuResponse!

  createOrder(
    input: CreateOrderInput!
  ): Order!

  checkoutCart(
    input: CheckoutCartInput!
  ): CheckoutResult!

  updateOrderStatus(
    orderId: ID!

    status: OrderStatus!
  ): Order!

  markNotificationAsRead(
    notificationId: ID!
  ): Boolean!

  markAllNotificationsAsRead: Boolean!

  registerPushToken(
    token: String!
    device: String
  ): Boolean!

  updateRiderAvailability(isAvailable: Boolean!): Boolean!
  assignRiderToOrder(orderId: ID!, riderId: ID!): Order!

    banUser(userId: ID!): MutationResponse!
  unbanUser(userId: ID!): MutationResponse!
  deleteUser(userId: ID!): MutationResponse!
  approveRestaurant(restaurantId: ID!): MutationResponse!
  rejectRestaurant(restaurantId: ID!): MutationResponse!
  approveUser(userId: ID!): MutationResponse!
rejectUser(userId: ID!): MutationResponse!

  adminCreateUser(
    fullName: String!
    email: String!
    phone: String!
    password: String!
    role: String!
    restaurantName: String
    restaurantLocation: String
    logisticsCompanyId: ID
    companyName: String
    companyPhone: String
  ): CreateUserResponse!

  createDispatchBatch(
    riderId: ID!
    orderIds: [ID!]!
    slot: DispatchSlot!
    scheduledDate: String!
  ): CreateDispatchResponse!

acceptDispatchBatch(batchId: ID!): Boolean!
rejectDispatchBatch(batchId: ID!, reason: String): Boolean!
}
`;
