-- ============================================================================
-- categories — the service taxonomy (playbook S032)
--
-- Two levels: 12 parents, ~80 children. A professional selects a child; parents
-- exist for navigation and SEO landing pages.
--
-- Several parents carry a same-named "general" child (e.g. `pets` → `pets-service`).
-- That is deliberate, not duplication: parents are not selectable, so a
-- professional who does not fit a specific child still needs somewhere to sit.
-- ============================================================================

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,

  -- NULL means top-level. A slug reference rather than a UUID self-FK because
  -- the seed is written by hand and slugs are the stable identifier — a UUID
  -- self-reference would make this seed unreadable and re-orderable only by id.
  parent_slug TEXT REFERENCES public.categories(slug) ON DELETE RESTRICT,

  -- lucide-react icon name. Icons are a closed set (DESIGN.md §4); an unknown
  -- name renders nothing rather than breaking the grid.
  icon TEXT,

  -- A Tailwind semantic token name, never a hex value (DESIGN.md §1).
  color TEXT,

  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT category_slug_is_kebab CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT category_not_own_parent CHECK (parent_slug IS DISTINCT FROM slug),
  CONSTRAINT category_colour_is_token CHECK (color IS NULL OR color !~ '^#')
);

COMMENT ON TABLE public.categories IS
  'Two-level service taxonomy. Replaces V1''s deprecated trade_category enum entirely.';
COMMENT ON COLUMN public.categories.parent_slug IS
  'NULL = top level. Slug reference, not UUID, so the seed stays hand-editable.';
COMMENT ON COLUMN public.categories.color IS
  'Tailwind semantic token name. A literal hex is rejected by CHECK.';

CREATE INDEX categories_parent_slug_idx ON public.categories (parent_slug);
CREATE INDEX categories_active_order_idx ON public.categories (display_order)
  WHERE is_active = TRUE;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- The taxonomy is public data: the marketplace must be browsable while signed
-- out. Writes are admin-only, which in practice means migrations.

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.categories TO anon, authenticated;

CREATE POLICY categories_select_public ON public.categories
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

CREATE POLICY categories_select_admin ON public.categories
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY categories_write_admin ON public.categories
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Seed ────────────────────────────────────────────────────────────────────
-- Parents first: the parent_slug FK requires them to exist.

INSERT INTO public.categories (slug, name, parent_slug, icon, display_order) VALUES
  ('home-property',          'Home & Property',          NULL, 'house',        1),
  ('beauty-wellness',        'Beauty & Wellness',        NULL, 'sparkles',     2),
  ('creative-media',         'Creative & Media',         NULL, 'camera',       3),
  ('professional-services',  'Professional Services',    NULL, 'briefcase',    4),
  ('health-fitness',         'Health & Fitness',         NULL, 'heart-pulse',  5),
  ('events-entertainment',   'Events & Entertainment',   NULL, 'party-popper', 6),
  ('education-tutoring',     'Education & Tutoring',     NULL, 'graduation-cap', 7),
  ('technology',             'Technology',               NULL, 'laptop',       8),
  ('food-catering',          'Food & Catering',          NULL, 'chef-hat',     9),
  ('automotive-transport',   'Automotive & Transport',   NULL, 'car',         10),
  ('pets',                   'Pets',                     NULL, 'paw-print',   11),
  ('childhood-family-care',  'Childhood & Family Care',  NULL, 'baby',        12);

INSERT INTO public.categories (slug, name, parent_slug, display_order) VALUES
  -- Home & Property
  ('plumber',            'Plumber',              'home-property',  1),
  ('electrician',        'Electrician',          'home-property',  2),
  ('painter',            'Painter',              'home-property',  3),
  ('carpenter',          'Carpenter',            'home-property',  4),
  ('landscaper',         'Landscaper',           'home-property',  5),
  ('ac-technician',      'AC Technician',        'home-property',  6),
  ('mason',              'Mason',                'home-property',  7),
  ('tiler',              'Tiler',                'home-property',  8),
  ('cleaner',            'Cleaner',              'home-property',  9),
  ('security-installer', 'Security Installer',   'home-property', 10),

  -- Beauty & Wellness
  ('nail-tech',          'Nail Tech',            'beauty-wellness', 1),
  ('hairstylist',        'Hairstylist',          'beauty-wellness', 2),
  ('barber',             'Barber',               'beauty-wellness', 3),
  ('makeup-artist',      'Makeup Artist',        'beauty-wellness', 4),
  ('aesthetician',       'Aesthetician',         'beauty-wellness', 5),
  ('massage-therapist',  'Massage Therapist',    'beauty-wellness', 6),
  ('lash-tech',          'Lash Tech',            'beauty-wellness', 7),
  ('brow-tech',          'Brow Tech',            'beauty-wellness', 8),

  -- Creative & Media
  ('photographer',       'Photographer',         'creative-media', 1),
  ('videographer',       'Videographer',         'creative-media', 2),
  ('graphic-designer',   'Graphic Designer',     'creative-media', 3),
  ('web-designer',       'Web Designer',         'creative-media', 4),
  ('content-creator',    'Content Creator',      'creative-media', 5),
  ('dj',                 'DJ',                   'creative-media', 6),
  ('musician',           'Musician',             'creative-media', 7),
  ('copywriter',         'Copywriter',           'creative-media', 8),

  -- Professional Services
  ('accountant',         'Accountant',           'professional-services', 1),
  ('attorney',           'Attorney',             'professional-services', 2),
  ('insurance-agent',    'Insurance Agent',      'professional-services', 3),
  ('real-estate-agent',  'Real Estate Agent',    'professional-services', 4),
  ('hr-consultant',      'HR Consultant',        'professional-services', 5),
  ('financial-advisor',  'Financial Advisor',    'professional-services', 6),
  ('business-consultant','Business Consultant',  'professional-services', 7),

  -- Health & Fitness
  ('personal-trainer',   'Personal Trainer',     'health-fitness', 1),
  ('nutritionist',       'Nutritionist',         'health-fitness', 2),
  ('physiotherapist',    'Physiotherapist',      'health-fitness', 3),
  ('yoga-instructor',    'Yoga Instructor',      'health-fitness', 4),
  ('sports-coach',       'Sports Coach',         'health-fitness', 5),

  -- Events & Entertainment
  -- `caterer` lives here, not under Food & Catering. V1 seeded it in both; the
  -- slug is UNIQUE so only the first insert ever took effect. Kept where it
  -- originally landed so existing links and SEO paths stay valid.
  ('event-planner',      'Event Planner',        'events-entertainment', 1),
  ('caterer',            'Caterer',              'events-entertainment', 2),
  ('decorator',          'Decorator',            'events-entertainment', 3),
  ('mc-host',            'MC / Host',            'events-entertainment', 4),
  ('bartender',          'Bartender',            'events-entertainment', 5),
  ('bouncy-castle',      'Bouncy Castle Rental', 'events-entertainment', 6),

  -- Education & Tutoring
  ('education-and-tutoring', 'Education / Tutoring', 'education-tutoring', 1),
  ('tutor',              'Tutor',                'education-tutoring', 2),
  ('music-teacher',      'Music Teacher',        'education-tutoring', 3),
  ('driving-instructor', 'Driving Instructor',   'education-tutoring', 4),
  ('language-teacher',   'Language Teacher',     'education-tutoring', 5),
  ('art-teacher',        'Art Teacher',          'education-tutoring', 6),

  -- Technology
  ('it-support',         'IT Support',           'technology', 1),
  ('web-developer',      'Web Developer',        'technology', 2),
  ('mobile-developer',   'Mobile Developer',     'technology', 3),
  ('data-analyst',       'Data Analyst',         'technology', 4),
  ('cybersecurity',      'Cybersecurity',        'technology', 5),
  ('network-engineer',   'Network Engineer',     'technology', 6),

  -- Food & Catering
  ('food-catering-service', 'Food / Catering',   'food-catering', 1),
  ('private-chef',       'Private Chef',         'food-catering', 2),
  ('meal-prep',          'Meal Prep Service',    'food-catering', 3),

  -- Automotive & Transport
  ('automotive-transport-service', 'Automotive / Transport', 'automotive-transport', 1),
  ('mechanic',           'Mechanic',             'automotive-transport', 2),
  ('auto-detailing',     'Auto Detailing',       'automotive-transport', 3),
  ('tow-service',        'Tow Service',          'automotive-transport', 4),
  ('driver-chauffeur',   'Driver / Chauffeur',   'automotive-transport', 5),

  -- Pets
  ('pets-service',       'Pets',                 'pets', 1),
  ('pet-groomer',        'Pet Groomer',          'pets', 2),
  ('pet-sitter',         'Pet Sitter',           'pets', 3),
  ('dog-walker',         'Dog Walker',           'pets', 4),
  ('pet-trainer',        'Pet Trainer',          'pets', 5),

  -- Childhood & Family Care
  ('childhood-family-care-service', 'Childhood / Family Care', 'childhood-family-care', 1),
  ('babysitter',         'Babysitter',           'childhood-family-care', 2),
  ('nanny',              'Nanny',                'childhood-family-care', 3),
  ('daycare-assistant',  'Daycare Assistant',    'childhood-family-care', 4),
  ('elderly-caregiver',  'Elderly Caregiver',    'childhood-family-care', 5);
