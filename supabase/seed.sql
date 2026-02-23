-- ============================================
-- Survivor Season 50 — Seed Data
-- ============================================

-- Episodes (13 episodes, Wednesdays at 8pm ET)
-- DST starts March 8, 2026: Episodes 1-2 are EST (-05:00), 3+ are EDT (-04:00)
INSERT INTO episodes (number, title, air_date) VALUES
  (1,  'Premiere',  '2026-02-25T20:00:00-05:00'),
  (2,  'Episode 2',  '2026-03-04T20:00:00-05:00'),
  (3,  'Episode 3',  '2026-03-11T20:00:00-04:00'),
  (4,  'Episode 4',  '2026-03-18T20:00:00-04:00'),
  (5,  'Episode 5',  '2026-03-25T20:00:00-04:00'),
  (6,  'Episode 6',  '2026-04-01T20:00:00-04:00'),
  (7,  'Episode 7',  '2026-04-08T20:00:00-04:00'),
  (8,  'Episode 8',  '2026-04-15T20:00:00-04:00'),
  (9,  'Episode 9',  '2026-04-22T20:00:00-04:00'),
  (10, 'Episode 10', '2026-04-29T20:00:00-04:00'),
  (11, 'Episode 11', '2026-05-06T20:00:00-04:00'),
  (12, 'Episode 12', '2026-05-13T20:00:00-04:00'),
  (13, 'Finale',     '2026-05-20T20:00:00-04:00');

-- Contestants — Vatu Tribe (Blue)
INSERT INTO contestants (name, tribe, tribe_color, season) VALUES
  ('Colby Donaldson',       'Vatu', 'blue',   50),
  ('Genevieve Mushaluk',    'Vatu', 'blue',   50),
  ('Rizo Velovic',          'Vatu', 'blue',   50),
  ('Angelina Keeley',       'Vatu', 'blue',   50),
  ('Q Burdette',            'Vatu', 'blue',   50),
  ('Stephenie LaGrossa',    'Vatu', 'blue',   50),
  ('Kyle Fraser',           'Vatu', 'blue',   50),
  ('Aubry Bracco',          'Vatu', 'blue',   50);

-- Contestants — Cila Tribe (Orange)
INSERT INTO contestants (name, tribe, tribe_color, season) VALUES
  ('Joe Hunter',            'Cila', 'orange', 50),
  ('Savannah Louie',        'Cila', 'orange', 50),
  ('Christian Hubicki',     'Cila', 'orange', 50),
  ('Cirie Fields',          'Cila', 'orange', 50),
  ('Ozzy Lusth',            'Cila', 'orange', 50),
  ('Emily Flippen',         'Cila', 'orange', 50),
  ('Rick Devens',           'Cila', 'orange', 50),
  ('Jenna Lewis-Dougherty', 'Cila', 'orange', 50);

-- Contestants — Kalo Tribe (Purple)
INSERT INTO contestants (name, tribe, tribe_color, season) VALUES
  ('Jonathan Young',        'Kalo', 'purple', 50),
  ('Dee Valladares',        'Kalo', 'purple', 50),
  ('Mike White',            'Kalo', 'purple', 50),
  ('Kamilla Karthigesu',    'Kalo', 'purple', 50),
  ('Charlie Davis',         'Kalo', 'purple', 50),
  ('Tiffany Ervin',         'Kalo', 'purple', 50),
  ('Coach Wade',            'Kalo', 'purple', 50),
  ('Chrissy Hofbeck',       'Kalo', 'purple', 50);
