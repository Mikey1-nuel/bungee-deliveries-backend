CREATE DATABASE bungee_deliveries;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  full_name TEXT NOT NULL,

  email TEXT UNIQUE,
  phone TEXT UNIQUE,

  password TEXT NOT NULL,

  role VARCHAR(20) NOT NULL DEFAULT 'customer'
    CHECK (
      role IN (
        'customer',
        'restaurant',
        'admin',
        'logistics',
        'rider'
      )
    ),

  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (
      status IN (
        'active',
        'suspended',
        'disabled'
      )
    ),

  approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
    CHECK (
      approval_status IN (
        'pending',
        'approved',
        'rejected'
      )
    ),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP;

CREATE INDEX idx_users_is_online ON users(is_online);

-- RESTAURANTS
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  owner_id UUID UNIQUE NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  name TEXT NOT NULL,

  rating NUMERIC(2,1) DEFAULT 0,

  location TEXT,
  image TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO restaurants (id, name, rating, location, owner_id)
VALUES
  (gen_random_uuid(), 'Mama Put', 4, enugu, (SELECT id FROM users LIMIT 1));

-- CATEGORIES
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT
);

INSERT INTO categories (id, name, icon)
VALUES
  (gen_random_uuid(), 'Main Meals', "https://res.cloudinary.com/dx0dibmdc/image/upload/v1778248117/categories/g20h9mktnten452lhjx6.png"),
  (gen_random_uuid(), 'Grills', "https://res.cloudinary.com/dx0dibmdc/image/upload/v1778247885/categories/yuc7ovsqwmemmuxaufjd.png");
  (gen_random_uuid(), 'Snacks & Pastries', "https://res.cloudinary.com/dx0dibmdc/image/upload/v1778248101/categories/ssjze57g8kdsagzmop2t.png");
  (gen_random_uuid(), 'Desserts', "https://res.cloudinary.com/dx0dibmdc/image/upload/v1778247973/categories/uszsjwsa3mtancdlduqb.png");
  (gen_random_uuid(), 'Drinks & Beverages', "https://res.cloudinary.com/dx0dibmdc/image/upload/v1778248084/categories/x35jfg66cyiz1h9kl8xo.png");

CREATE TABLE logistics_companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_phone TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID UNIQUE NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  logistics_company_id UUID
    REFERENCES logistics_companies(id)
    ON DELETE SET NULL,

  is_available BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- menuS (global definition)
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,

  description TEXT,

  image TEXT,

  category_id UUID
    REFERENCES categories(id)
    ON DELETE SET NULL,

  type VARCHAR(20) NOT NULL
    CHECK (
      type IN (
        'meal',
        'extra',
        'swallow'
      )
    )
);

-- RESTAURANT MENU (core table)
CREATE TABLE restaurant_menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  restaurant_id UUID NOT NULL
    REFERENCES restaurants(id)
    ON DELETE CASCADE,

  menu_id UUID NOT NULL
    REFERENCES menus(id)
    ON DELETE CASCADE,

  base_price NUMERIC NOT NULL
    CHECK (base_price >= 0),

  is_available BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (restaurant_id, menu_id)
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  restaurant_id UUID NOT NULL
    REFERENCES restaurants(id)
    ON DELETE CASCADE,

  rider_id UUID
    REFERENCES riders(id)
    ON DELETE SET NULL,

  logistics_company_id UUID
    REFERENCES logistics_companies(id)
    ON DELETE SET NULL,

  status VARCHAR(30) DEFAULT 'pending'
CHECK (
 status IN (
   'pending',
   'accepted',
   'rejected',
   'preparing',
   'ready_for_pickup',
   'picked_up',
   'delivered',
   'cancelled'
 )
)

  total NUMERIC NOT NULL,

  delivery_address TEXT NOT NULL,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders
DROP CONSTRAINT orders_status_check;

ALTER TABLE orders
ADD CONSTRAINT orders_status_check
CHECK (
  status IN (
    'pending',
    'accepted',
    'rejected',
    'preparing',
    'ready_for_pickup',
    'picked_up',
    'delivered',
    'cancelled'
  )
);

ALTER TABLE orders
ADD COLUMN assigned_at TIMESTAMP;

ALTER TABLE orders
ADD COLUMN accepted_at TIMESTAMP;

ALTER TABLE orders
ADD COLUMN prepared_at TIMESTAMP;

ALTER TABLE orders
ADD COLUMN picked_up_at TIMESTAMP;

ALTER TABLE orders
ADD COLUMN delivered_at TIMESTAMP;

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL
    REFERENCES orders(id)
    ON DELETE CASCADE,

  restaurant_menu_id UUID
    REFERENCES restaurant_menus(id)
    ON DELETE SET NULL,

  menu_name TEXT NOT NULL,

  menu_type VARCHAR(20) NOT NULL,

  unit_price NUMERIC NOT NULL,

  quantity INT NOT NULL
    CHECK (quantity > 0),

  total_price NUMERIC NOT NULL,

  menu_image TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL
    REFERENCES orders(id)
    ON DELETE CASCADE,

  status VARCHAR(30) NOT NULL,

  changed_by UUID
    REFERENCES users(id),

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  order_id UUID NOT NULL
    REFERENCES orders(id)
    ON DELETE CASCADE,

  amount NUMERIC NOT NULL
    CHECK (amount >= 0),

  status VARCHAR(20),

  method VARCHAR(50),

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL,

  title TEXT NOT NULL,

  message TEXT NOT NULL,

  read BOOLEAN DEFAULT FALSE,

  action_url TEXT,

  metadata JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS channel VARCHAR(50) DEFAULT 'in_app';

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS action_url TEXT;

ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

ALTER TABLE notifications
ADD COLUMN channel VARCHAR(20)
DEFAULT 'in_app';

CREATE INDEX idx_notifications_channel
ON notifications(channel);

CREATE TABLE notification_settings (
  user_id UUID PRIMARY KEY
    REFERENCES users(id)
    ON DELETE CASCADE,

  orders BOOLEAN DEFAULT TRUE,
  payments BOOLEAN DEFAULT TRUE,
  offers BOOLEAN DEFAULT TRUE,
  general BOOLEAN DEFAULT TRUE,

  push BOOLEAN DEFAULT TRUE,
  sound BOOLEAN DEFAULT TRUE,
  vibrate BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_notifications_user_id
ON notifications(user_id);

CREATE INDEX idx_notifications_read
ON notifications(read);

CREATE INDEX idx_notifications_created_at
ON notifications(created_at DESC);

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  token TEXT NOT NULL,

  device VARCHAR(50),

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, token)
);

CREATE TABLE delivery_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  name TEXT,

  address TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID
    REFERENCES users(id)
    ON DELETE SET NULL,

  action TEXT NOT NULL,

  entity TEXT NOT NULL,

  entity_id UUID,

  metadata JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE dispatch_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  slot VARCHAR(20) NOT NULL CHECK (slot IN ('morning', 'afternoon', 'evening')),
  scheduled_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dispatch_batch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES dispatch_batches(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  UNIQUE(batch_id, order_id)
);

CREATE INDEX idx_dispatch_batches_slot ON dispatch_batches(slot);
CREATE INDEX idx_dispatch_batches_scheduled_at ON dispatch_batches(scheduled_at);
