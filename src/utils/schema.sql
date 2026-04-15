CREATE DATABASE bungee_deliveries;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'user',
  restaurant_id UUID,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rating NUMERIC DEFAULT 0,
  location TEXT,
  cuisine TEXT,
  image TEXT,
  owner_id UUID REFERENCES users(id)
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT
);

CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  description TEXT,
  image TEXT
);

CREATE TABLE restaurant_menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  meal_id UUID REFERENCES meals(id),
  base_price NUMERIC NOT NULL,
  is_available BOOLEAN DEFAULT true
);

CREATE TABLE extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

CREATE TABLE restaurant_extra_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_menu_id UUID REFERENCES restaurant_menu(id),
  extra_id UUID REFERENCES extras(id),
  price NUMERIC NOT NULL
);

CREATE TABLE swallows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

CREATE TABLE restaurant_swallow_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_menu_id UUID REFERENCES restaurant_menu(id),
  swallow_id UUID REFERENCES swallows(id),
  price NUMERIC NOT NULL
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  restaurant_id UUID REFERENCES restaurants(id),
  rider_id UUID,
  status VARCHAR(20) DEFAULT 'pending',
  total NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  restaurant_menu_id UUID REFERENCES restaurant_menu(id),
  quantity INT NOT NULL
);

CREATE TABLE order_item_extras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID REFERENCES order_items(id),
  extra_id UUID REFERENCES extras(id)
);

CREATE TABLE order_item_swallows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID REFERENCES order_items(id),
  swallow_id UUID REFERENCES swallows(id)
);

CREATE TABLE riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  is_available BOOLEAN DEFAULT true
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  amount NUMERIC,
  status VARCHAR(20),
  method VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  type VARCHAR(20),
  title TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notification_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id),

  orders BOOLEAN DEFAULT true,
  payments BOOLEAN DEFAULT true,
  offers BOOLEAN DEFAULT true,
  general BOOLEAN DEFAULT true,

  push BOOLEAN DEFAULT true,
  sound BOOLEAN DEFAULT true,
  vibrate BOOLEAN DEFAULT false
);

CREATE TABLE delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT,
  address TEXT
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT,
  entity TEXT,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SELECT m.*, COUNT(oi.id) as order_count
-- FROM meals m
-- LEFT JOIN restaurant_menu rm ON rm.meal_id = m.id
-- LEFT JOIN order_items oi ON oi.restaurant_menu_id = rm.id
-- GROUP BY m.id;

-- SELECT r.*, COUNT(o.id) as order_count
-- FROM restaurants r
-- LEFT JOIN orders o ON o.restaurant_id = r.id
-- GROUP BY r.id;
