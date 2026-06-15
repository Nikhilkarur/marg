-- Marg — Supabase schema. Run this in the Supabase SQL Editor. Idempotent:
-- re-running leaves exactly the seeded N zones (no duplicates) and is safe on an
-- already-applied database (uses IF NOT EXISTS / DROP-then-ADD throughout).

-- pgcrypto provides gen_random_uuid(). PostGIS was dropped — zones are plain
-- lat/lng, nothing uses geometry types (TASK 5B #8).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END; $$;

-- PROFILES ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  phone        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_self ON public.profiles;
CREATE POLICY profiles_self ON public.profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP TRIGGER IF EXISTS trg_profiles_touch ON public.profiles;
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- EMERGENCY CONTACTS -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_name   TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  relationship   TEXT DEFAULT 'Emergency Contact',
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ec_self ON public.emergency_contacts;
CREATE POLICY ec_self ON public.emergency_contacts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP TRIGGER IF EXISTS trg_ec_touch ON public.emergency_contacts;
CREATE TRIGGER trg_ec_touch BEFORE UPDATE ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- New-user trigger: create the profile AND (if signup metadata carries one) the
-- emergency contact in the SAME step. Doing the contact write here — after the
-- profile row exists in this function — removes the FK race the client had
-- (TASK 5B #6) and UPSERTs because user_id is UNIQUE (TASK 5B #5).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.phone)
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    updated_at = NOW();

  IF NULLIF(new.raw_user_meta_data->>'contact_number', '') IS NOT NULL THEN
    INSERT INTO public.emergency_contacts (user_id, contact_name, contact_number, relationship)
    VALUES (
      new.id,
      COALESCE(NULLIF(new.raw_user_meta_data->>'contact_name', ''), 'Emergency Contact'),
      new.raw_user_meta_data->>'contact_number',
      'Emergency Contact'
    )
    ON CONFLICT (user_id) DO UPDATE SET
      contact_name = EXCLUDED.contact_name,
      contact_number = EXCLUDED.contact_number,
      updated_at = NOW();
  END IF;
  RETURN new;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- HEATMAP ZONES ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.heatmap_zones (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city         TEXT NOT NULL DEFAULT 'chennai',
  area_name    TEXT NOT NULL,
  latitude     DOUBLE PRECISION NOT NULL,
  longitude    DOUBLE PRECISION NOT NULL,
  radius_m     INTEGER NOT NULL DEFAULT 500,
  risk_level   TEXT NOT NULL CHECK (risk_level IN ('high','medium','low')),
  risk_score   INTEGER NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  reason       TEXT,
  active_hours TEXT DEFAULT 'night',
  source       TEXT
);
ALTER TABLE public.heatmap_zones ENABLE ROW LEVEL SECURITY;
-- Public read only; writes are admin (service_role) via the seed.
DROP POLICY IF EXISTS hz_read ON public.heatmap_zones;
CREATE POLICY hz_read ON public.heatmap_zones FOR SELECT TO anon, authenticated USING (true);

-- Idempotent upgrades for an already-applied DB:
-- 1) dedupe (the old ON CONFLICT DO NOTHING keyed on the random UUID PK, so it
--    never conflicted and re-running duplicated every row — TASK 5B #4),
DELETE FROM public.heatmap_zones a
  USING public.heatmap_zones b
  WHERE a.ctid < b.ctid AND a.city = b.city AND a.area_name = b.area_name;
-- 2) add the source column (TASK 5B #7 / TASK 2),
ALTER TABLE public.heatmap_zones ADD COLUMN IF NOT EXISTS source TEXT;
-- 3) constrain active_hours (TASK 5B #7),
ALTER TABLE public.heatmap_zones DROP CONSTRAINT IF EXISTS heatmap_zones_active_hours_chk;
ALTER TABLE public.heatmap_zones ADD CONSTRAINT heatmap_zones_active_hours_chk
  CHECK (active_hours IN ('all','night','day'));
-- 4) the UNIQUE key the upsert needs (TASK 5B #4).
ALTER TABLE public.heatmap_zones DROP CONSTRAINT IF EXISTS heatmap_zones_city_area_uniq;
ALTER TABLE public.heatmap_zones ADD CONSTRAINT heatmap_zones_city_area_uniq UNIQUE (city, area_name);

-- TRIPS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.trips (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  from_name  TEXT,
  from_lat   DOUBLE PRECISION,
  from_lng   DOUBLE PRECISION,
  to_name    TEXT,
  to_lat     DOUBLE PRECISION,
  to_lng     DOUBLE PRECISION,
  route_data JSONB,
  safe_mode  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trips_self ON public.trips;
CREATE POLICY trips_self ON public.trips FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- INCIDENTS --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  latitude     DOUBLE PRECISION,
  longitude    DOUBLE PRECISION,
  status       TEXT DEFAULT 'open',
  source       TEXT DEFAULT 'sos',
  display_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inc_self ON public.incidents;
CREATE POLICY inc_self ON public.incidents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- SEED: Chennai women-safety heatmap zones -------------------------------
-- Curated from public reporting (Safecity.in, NCRB, local news) — see
-- SOURCES.md. Generated from backend/data/zones.js by scripts/seedZones.js.
-- ON CONFLICT (city, area_name) DO UPDATE → re-running refreshes in place, never
-- duplicates (TASK 5B #4).
INSERT INTO public.heatmap_zones
  (area_name, city, latitude, longitude, radius_m, risk_level, risk_score, reason, active_hours, source) VALUES
('Tambaram Bus Stand', 'chennai', 12.9249, 80.1, 600, 'high', 85, 'High harassment reports after 8pm, poor lighting near exit', 'night', 'Safecity.in crowdsourced reports, 2021–2024'),
('Vadapalani Signal', 'chennai', 13.053, 80.212, 500, 'high', 78, 'Isolated stretch near flyover, known harassment zone', 'night', 'Safecity.in; local news reports, 2022–2024'),
('Koyambedu Bus Terminal', 'chennai', 13.0694, 80.1948, 700, 'medium', 62, 'Crowded but incidents reported late night', 'night', 'NCRB city data; news reports, 2022'),
('Guindy Industrial Area', 'chennai', 13.0067, 80.2206, 800, 'high', 82, 'Low pedestrian activity after 7pm, isolated roads', 'night', 'Area characteristic; Safecity.in, 2023'),
('Perambur North', 'chennai', 13.1161, 80.2438, 500, 'medium', 58, 'Eve teasing reported near residential lanes', 'night', 'Safecity.in crowdsourced reports, 2021–2023'),
('Washermanpet', 'chennai', 13.1124, 80.2881, 600, 'high', 80, 'High crime density, poor street lighting', 'all', 'NCRB city data; news reports, 2022–2024'),
('Royapuram Fish Market Area', 'chennai', 13.1145, 80.2926, 400, 'medium', 65, 'Deserted after market hours', 'night', 'Area characteristic; local reports, 2023'),
('Ambattur Industrial Estate', 'chennai', 13.1145, 80.1489, 700, 'medium', 60, 'Isolated late night, limited public transport', 'night', 'Area characteristic, 2023'),
('Saidapet Bridge', 'chennai', 13.0213, 80.2218, 350, 'high', 75, 'Underbridge area, frequent incidents reported', 'night', 'Safecity.in; news reports, 2022–2024'),
('Villivakkam Night Bazaar Area', 'chennai', 13.1001, 80.2085, 400, 'medium', 55, 'Rowdy activity reported post 10pm', 'night', 'Safecity.in crowdsourced reports, 2022'),
('Poonamallee Highway Stretch', 'chennai', 13.0456, 80.0935, 900, 'high', 88, 'Long isolated stretch, highway harassment', 'night', 'News reports (The Hindu/TOI), 2022–2024'),
('Thiruvottiyur North', 'chennai', 13.1644, 80.3073, 600, 'medium', 62, 'Low police presence, incidents near bus stops', 'night', 'NCRB city data; local reports, 2022'),
('Alandur Metro Exit B', 'chennai', 13.0035, 80.2006, 300, 'medium', 58, 'Isolated exit towards residential side streets', 'night', 'Area characteristic, 2023'),
('Broadway Bus Terminus', 'chennai', 13.0882, 80.283, 500, 'high', 72, 'Overcrowded, pickpocketing and harassment zone', 'all', 'NCRB city data; news reports, 2022–2024'),
('Pallavaram Market', 'chennai', 12.9675, 80.1498, 450, 'medium', 60, 'Market area deserted after 9pm', 'night', 'Safecity.in; local reports, 2023'),
('Egmore Station Surrounds', 'chennai', 13.0732, 80.2609, 500, 'medium', 60, 'Crowded station precinct; pickpocketing and late-night harassment reports', 'night', 'News reports; Safecity.in, 2022–2024'),
('Chennai Central Surrounds', 'chennai', 13.0827, 80.2755, 600, 'medium', 64, 'Major hub; theft and harassment reports amid heavy crowds', 'all', 'NCRB city data; news reports, 2022–2024'),
('Parry''s Corner / George Town', 'chennai', 13.0918, 80.287, 600, 'medium', 63, 'Congested wholesale market, deserted and dim after business hours', 'night', 'Area characteristic; local reports, 2023'),
('Triplicane (Wallajah Road)', 'chennai', 13.056, 80.276, 450, 'medium', 57, 'Narrow lanes; eve-teasing reports near Wallajah Road', 'night', 'Safecity.in crowdsourced reports, 2021–2023'),
('Marina Beach Service Road', 'chennai', 13.05, 80.282, 700, 'medium', 66, 'Isolated shoreline stretches after dark', 'night', 'News reports; police advisory, 2022–2024'),
('Mylapore Tank Area', 'chennai', 13.0339, 80.2698, 350, 'low', 42, 'Generally safe; minor late-night reports near temple tank', 'night', 'Safecity.in, 2022'),
('Adyar Signal', 'chennai', 13.0063, 80.257, 400, 'medium', 52, 'Busy junction; reports near bus stop late night', 'night', 'Safecity.in; local reports, 2023'),
('Besant Nagar Beach', 'chennai', 12.9986, 80.2669, 500, 'medium', 55, 'Beachfront isolated after 10pm', 'night', 'Area characteristic; news reports, 2023'),
('Thiruvanmiyur Bus Depot', 'chennai', 12.983, 80.259, 400, 'medium', 56, 'Depot surrounds quiet and dim late night', 'night', 'Area characteristic, 2023'),
('Taramani OMR Stretch', 'chennai', 12.987, 80.241, 700, 'medium', 58, 'IT corridor; long isolated service lanes at night', 'night', 'Area characteristic; news reports, 2023'),
('Sholinganallur OMR Junction', 'chennai', 12.901, 80.2279, 700, 'medium', 60, 'OMR junction with poorly lit service roads', 'night', 'Area characteristic; news reports, 2023–2024'),
('Velachery MRTS Surrounds', 'chennai', 12.9786, 80.221, 450, 'medium', 57, 'Station precinct deserted late night', 'night', 'Safecity.in; local reports, 2023'),
('Pallikaranai Marsh Road', 'chennai', 12.935, 80.21, 800, 'high', 70, 'Isolated marsh-side road, very poor lighting', 'night', 'Area characteristic; news reports, 2022–2024'),
('Medavakkam Junction', 'chennai', 12.918, 80.192, 500, 'medium', 59, 'Busy junction with limited night transport', 'night', 'Area characteristic, 2023'),
('Porur Junction', 'chennai', 13.038, 80.156, 600, 'medium', 61, 'Highway junction; heavy traffic and isolated lanes', 'night', 'Area characteristic; news reports, 2023'),
('Maduravoyal', 'chennai', 13.066, 80.162, 500, 'medium', 58, 'Highway-side, isolated after dark', 'night', 'Area characteristic, 2023'),
('Avadi Bus Stand', 'chennai', 13.115, 80.098, 600, 'medium', 60, 'Outer suburb with sparse night transport', 'night', 'NCRB district data; local reports, 2022'),
('Manali Industrial Zone', 'chennai', 13.166, 80.26, 800, 'high', 74, 'Heavy industrial belt, deserted at night', 'night', 'Area characteristic, 2023'),
('Ennore Outskirts', 'chennai', 13.216, 80.324, 800, 'high', 72, 'Port/industrial outskirts, isolated and dim', 'night', 'Area characteristic; news reports, 2023'),
('Tondiarpet', 'chennai', 13.129, 80.29, 500, 'medium', 63, 'Dense north Chennai; chain-snatching reports', 'night', 'NCRB city data; news reports, 2022–2024'),
('Royapettah', 'chennai', 13.054, 80.264, 450, 'medium', 54, 'Busy commercial area; minor late-night reports', 'night', 'Safecity.in, 2022–2023'),
('Nungambakkam Lanes', 'chennai', 13.06, 80.241, 400, 'low', 45, 'Generally safe; isolated side lanes off main road at night', 'night', 'Safecity.in, 2022'),
('Kodambakkam Railway Gate', 'chennai', 13.052, 80.227, 400, 'medium', 56, 'Level-crossing area, congested and dim', 'night', 'Area characteristic; local reports, 2023'),
('K. K. Nagar', 'chennai', 13.041, 80.199, 400, 'low', 44, 'Residential; only minor late-night reports', 'night', 'Safecity.in, 2022'),
('Porur Lake Road', 'chennai', 13.03, 80.162, 600, 'high', 68, 'Lake-side road, poorly lit and isolated', 'night', 'Area characteristic; news reports, 2023'),
('Ambattur OT', 'chennai', 13.108, 80.162, 600, 'medium', 60, 'Industrial estate, sparse at night', 'night', 'Area characteristic, 2023'),
('Padi Flyover Underpass', 'chennai', 13.098, 80.19, 400, 'medium', 58, 'Flyover underpass isolated after dark', 'night', 'Area characteristic, 2023'),
('Aminjikarai Market', 'chennai', 13.072, 80.223, 400, 'medium', 53, 'Market area deserted late at night', 'night', 'Safecity.in; local reports, 2023'),
('Kathipara / Guindy Cloverleaf', 'chennai', 13.009, 80.22, 500, 'medium', 64, 'Pedestrian-unfriendly interchange, isolated walkways', 'night', 'Area characteristic; news reports, 2023'),
('T. Nagar Ranganathan Street', 'chennai', 13.041, 80.234, 350, 'medium', 55, 'Extremely crowded shopping street; groping/pickpocketing reports', 'day', 'Safecity.in; news reports, 2022–2024'),
('Saidapet Market & Bus Stand', 'chennai', 13.022, 80.223, 450, 'medium', 60, 'Market and bus stand; congested/isolated mix late night', 'night', 'Safecity.in; local reports, 2023')
ON CONFLICT (city, area_name) DO UPDATE SET
  latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, radius_m = EXCLUDED.radius_m,
  risk_level = EXCLUDED.risk_level, risk_score = EXCLUDED.risk_score, reason = EXCLUDED.reason,
  active_hours = EXCLUDED.active_hours, source = EXCLUDED.source;
