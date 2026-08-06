-- ENUMS
CREATE TYPE license_tier AS ENUM ('Trial', 'Pro');
CREATE TYPE user_role AS ENUM ('owner', 'karyawan');
CREATE TYPE user_status AS ENUM ('aktif', 'nonaktif');
CREATE TYPE license_status AS ENUM ('aktif', 'revoked', 'pending_transfer');
CREATE TYPE unit_status AS ENUM ('ready', 'disewa', 'maintenance');
CREATE TYPE booking_status AS ENUM (
    'Booking Dibuat',
    'Pembayaran DP',
    'Dipacking',
    'Diantar',
    'Sedang Dipakai',
    'Dijemput',
    'Pengecekan Barang',
    'Selesai',
    'Dibatalkan'
);
CREATE TYPE booking_source AS ENUM ('owner_app', 'customer_web');
CREATE TYPE verification_status AS ENUM ('verified', 'pending_verification', 'rejected', 'expired');
CREATE TYPE timeline_stage AS ENUM (
    'Booking Dibuat',
    'Pembayaran DP',
    'Dipacking',
    'Diantar',
    'Sedang Dipakai',
    'Dijemput',
    'Pengecekan Barang',
    'Selesai'
);
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE transaction_category AS ENUM ('rental', 'delivery', 'bbm', 'service', 'lainnya');
CREATE TYPE denda_type AS ENUM ('telat', 'rusak', 'hilang');

-- TABLES
CREATE TABLE business (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    whatsapp_number TEXT,
    logo_url TEXT,
    invoice_note TEXT,
    license_tier license_tier DEFAULT 'Trial',
    bank_account_info TEXT,
    operational_hours JSONB,
    min_dp_policy TEXT,
    verification_grace_period_hours INT DEFAULT 2
);

CREATE TABLE "user" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    whatsapp_number TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role DEFAULT 'karyawan',
    status user_status DEFAULT 'aktif'
);

CREATE TABLE device_license (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business(id) ON DELETE CASCADE UNIQUE,
    license_key TEXT UNIQUE NOT NULL,
    device_fingerprint TEXT,
    status license_status DEFAULT 'aktif',
    activated_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE unit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    package_items JSONB,
    photo_url TEXT,
    description TEXT,
    status unit_status DEFAULT 'ready',
    maintenance_note TEXT,
    UNIQUE (business_id, code)
);

CREATE TABLE unit_price_tier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID REFERENCES unit(id) ON DELETE CASCADE,
    duration_hours INT NOT NULL,
    price DECIMAL NOT NULL
);

CREATE TABLE customer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    whatsapp_number TEXT NOT NULL,
    ktp_photo_url TEXT
);

CREATE TABLE booking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business(id) ON DELETE CASCADE,
    booking_code TEXT NOT NULL,
    unit_id UUID REFERENCES unit(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES customer(id) ON DELETE RESTRICT,
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_hours INT NOT NULL,
    delivery_required BOOLEAN DEFAULT false,
    delivery_address TEXT,
    delivery_fee DECIMAL DEFAULT 0,
    rental_price DECIMAL NOT NULL,
    dp_amount DECIMAL DEFAULT 0,
    deposit_amount DECIMAL DEFAULT 0,
    denda_total DECIMAL DEFAULT 0,
    status booking_status DEFAULT 'Booking Dibuat',
    source booking_source DEFAULT 'owner_app',
    verification_status verification_status DEFAULT 'verified',
    payment_proof_url TEXT,
    verification_expires_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE booking_timeline_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES booking(id) ON DELETE CASCADE,
    stage timeline_stage NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
    notes TEXT
);

CREATE TABLE return_check (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES booking(id) ON DELETE CASCADE UNIQUE,
    checklist JSONB,
    condition_rating INT CHECK (condition_rating >= 1 AND condition_rating <= 5),
    condition_label TEXT,
    notes TEXT,
    photos JSONB,
    checked_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE invoice (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES booking(id) ON DELETE CASCADE UNIQUE,
    invoice_number TEXT NOT NULL,
    line_items JSONB,
    total DECIMAL NOT NULL,
    paid_amount DECIMAL NOT NULL,
    remaining_amount DECIMAL NOT NULL,
    pdf_url TEXT,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE transaction (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    category transaction_category NOT NULL,
    amount DECIMAL NOT NULL,
    related_booking_id UUID REFERENCES booking(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_by UUID REFERENCES "user"(id) ON DELETE SET NULL
);

CREATE TABLE denda_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business(id) ON DELETE CASCADE,
    type denda_type NOT NULL,
    unit_amount DECIMAL NOT NULL
);
