-- ─────────────────────────────────────────────────────────────────────────
-- ScreenRank — seed data
-- Mirrors the bundled demo dataset (src/lib/sample-data.ts).
-- Run after 0001_init.sql:  supabase db reset  (or paste into SQL editor).
-- Screens/DCPs link to parents via natural keys so no UUIDs are hard-coded.
-- ─────────────────────────────────────────────────────────────────────────

-- THEATRES ------------------------------------------------------------------
insert into theatres (name, location, city, lat, lng, amenities, description, website) values
  ('Aurora Cinemas — Marina', 'Marina Bay Promenade, Lower Parel', 'Mumbai', 19.0, 72.83,
   array['Recliners','Valet parking','Gourmet concessions','Dolby Atmos lobby'],
   'Aurora''s flagship — an IMAX with Laser auditorium and a Dolby Cinema under one roof.',
   'https://example.com/aurora'),
  ('Galaxy IMAX & Premiere', 'Outer Ring Road, Bellandur', 'Bengaluru', 12.93, 77.68,
   array['IMAX 70mm film','EPIQ auditorium','Lie-flat loungers','Filter coffee bar'],
   'Home to a rare IMAX 70mm film projector alongside a laser-lit EPIQ hall.',
   'https://example.com/galaxy'),
  ('The Roxy Dolby House', 'Connaught Place, Block A', 'New Delhi', 28.63, 77.22,
   array['Dolby Cinema','PXL hall','4DX motion seats','Art-deco bar'],
   'A restored art-deco single-screen reborn as a three-format premium house.',
   'https://example.com/roxy'),
  ('Northgate Multiplex', 'Northgate Mall, Aundh', 'Pune', 18.56, 73.81,
   array['Affordable matinees','Scope hall','Family seating'],
   'A dependable neighbourhood multiplex with a well-calibrated laser Scope screen.',
   'https://example.com/northgate')
on conflict do nothing;

-- SCREENS -------------------------------------------------------------------
insert into screens (theatre_id, name, screen_format, projection_system, sound_system, screen_spec, number_of_seats, three_d_system, user_rating, review_count)
select t.id, v.name, v.screen_format, v.projection_system, v.sound_system, v.screen_spec, v.number_of_seats, v.three_d_system, v.user_rating, v.review_count
from (values
  ('Aurora Cinemas — Marina','Screen 1 — IMAX with Laser','IMAX','4K RGB Laser','IMAX 12 Channel','88 x 47 feet curved silver screen',312,'IMAX 3D',4.8,1240),
  ('Aurora Cinemas — Marina','Screen 4 — Dolby Cinema','Dolby','4K Dual Laser','Dolby Atmos','62 x 28 feet',180,'Dolby 3D',4.6,870),
  ('Aurora Cinemas — Marina','Screen 6 — Scope','Scope','2K Laser','Dolby Surround 7.1','54 x 23 feet',220,null,4.1,410),
  ('Galaxy IMAX & Premiere','GT — IMAX 70mm','IMAX 70mm','IMAX 70mm Film + 4K Laser','IMAX 12 Channel','96 x 70 feet',540,'IMAX 3D',4.9,2010),
  ('Galaxy IMAX & Premiere','EPIQ','EPIQ','4K RGB Laser','Dolby Atmos','70 x 30 feet',240,'RealD',4.7,690),
  ('Galaxy IMAX & Premiere','Audi 3 — Flat','Flat','2K Xenon','Dolby Surround 5.1','40 x 21 feet',160,null,3.8,230),
  ('The Roxy Dolby House','Dolby Cinema','Dolby','4K Dual Laser','Dolby Atmos','64 x 27 feet',200,'Dolby 3D',4.7,980),
  ('The Roxy Dolby House','PXL','PXL','4K RGB Laser','Dolby Atmos','72 x 31 feet Imported STRONG MDI Silver Screen',260,'RealD',4.6,540),
  ('The Roxy Dolby House','4DX','4DX','4K Laser','Dolby Surround 7.1','45 x 20 feet',140,'RealD',4.3,600),
  ('Northgate Multiplex','Screen 2 — Scope','Scope','4K Laser','Dolby Atmos','58 x 24 feet',230,null,4.2,350),
  ('Northgate Multiplex','Screen 5 — Flat','Flat','2K Laser','Dolby Surround 5.1','38 x 20 feet',150,null,3.9,180)
) as v(theatre_name,name,screen_format,projection_system,sound_system,screen_spec,number_of_seats,three_d_system,user_rating,review_count)
join theatres t on t.name = v.theatre_name
on conflict do nothing;

-- MOVIES --------------------------------------------------------------------
insert into movies (tmdb_id, title, synopsis, release_date, duration, genre, format, is_now_playing) values
  (693134,'Dune: Part Two','Paul Atreides unites with the Fremen to wage war against House Harkonnen.','2024-03-01',166,array['Science Fiction','Adventure'],array['IMAX','4K','HDR'],true),
  (872585,'Oppenheimer','The story of J. Robert Oppenheimer and the development of the atomic bomb.','2023-07-21',180,array['Drama','History'],array['IMAX 70mm','70mm'],true),
  (157336,'Interstellar (Re-release)','Explorers travel through a wormhole to ensure humanity''s survival.','2014-11-07',169,array['Science Fiction','Drama'],array['IMAX 70mm','HFR'],true),
  (786892,'Furiosa: A Mad Max Saga','The origin story of renegade warrior Furiosa.','2024-05-24',148,array['Action','Adventure'],array['4K','HDR','Atmos'],true),
  (823464,'Godzilla x Kong: The New Empire','Two ancient titans clash in a spectacular battle.','2024-03-29',115,array['Action','Science Fiction'],array['IMAX','4DX','3D'],true),
  (1184918,'The Wild Robot','A shipwrecked robot adapts to the wilderness and bonds with the animals.','2024-09-27',102,array['Animation','Family'],array['4K','HDR'],true)
on conflict (tmdb_id) do nothing;

-- DCPS ----------------------------------------------------------------------
insert into dcps (screen_id, movie_id, runtime, resolution, format, aspect_ratio_container, audio_mix, verified, source)
select s.id, m.id, v.runtime, v.resolution, v.format, v.aspect, v.audio, v.verified, v.source
from (values
  ('Screen 1 — IMAX with Laser','Dune: Part Two',166,'4K 4096x2160',array['IMAX','HDR'],'IMAX(1.90:1)','IMAX 12 Channel',true,'Theatre confirmation'),
  ('GT — IMAX 70mm','Dune: Part Two',166,'4K 4096x2160',array['IMAX','HDR'],'IMAX(1.43:1)','IMAX 12 Channel',true,'Theatre confirmation'),
  ('Screen 4 — Dolby Cinema','Dune: Part Two',166,'4K 4096x2160',array['HDR','Dolby Vision'],'Scope(2.39:1)','Dolby Atmos',true,'Theatre confirmation'),
  ('PXL','Dune: Part Two',166,'4K 4096x2160',array['HDR'],'Scope(2.39:1)','Dolby Atmos',true,'Theatre confirmation'),
  ('Screen 2 — Scope','Dune: Part Two',166,'2K 2048x858',array[]::text[],'Scope(2.39:1)','Dolby Atmos',false,'User report'),
  ('GT — IMAX 70mm','Oppenheimer',180,'4K 4096x2160',array['IMAX','70mm'],'IMAX(1.43:1)','IMAX 12 Channel',true,'Studio spec sheet'),
  ('Screen 1 — IMAX with Laser','Oppenheimer',180,'4K 4096x2160',array['IMAX'],'IMAX(1.90:1)','IMAX 12 Channel',true,'Theatre confirmation'),
  ('Dolby Cinema','Oppenheimer',180,'4K 4096x2160',array['HDR'],'Flat(1.85:1)','Dolby Atmos',true,'Theatre confirmation'),
  ('GT — IMAX 70mm','Interstellar (Re-release)',169,'4K 4096x2160',array['IMAX 70mm','70mm'],'IMAX(1.43:1)','IMAX 12 Channel',true,'Studio spec sheet'),
  ('Screen 1 — IMAX with Laser','Interstellar (Re-release)',169,'4K 4096x2160',array['IMAX'],'IMAX(1.90:1)','IMAX 12 Channel',true,'Theatre confirmation'),
  ('EPIQ','Interstellar (Re-release)',169,'4K 4096x2160',array['HDR'],'Scope(2.39:1)','Dolby Atmos',true,'Theatre confirmation'),
  ('Screen 4 — Dolby Cinema','Furiosa: A Mad Max Saga',148,'4K 4096x2160',array['HDR','Dolby Vision'],'Scope(2.39:1)','Dolby Atmos',true,'Theatre confirmation'),
  ('PXL','Furiosa: A Mad Max Saga',148,'4K 4096x2160',array['HDR'],'Scope(2.39:1)','Dolby Atmos',true,'Theatre confirmation'),
  ('EPIQ','Furiosa: A Mad Max Saga',148,'4K 4096x2160',array['HDR'],'Scope(2.39:1)','Dolby Atmos',true,'Theatre confirmation'),
  ('Screen 1 — IMAX with Laser','Godzilla x Kong: The New Empire',115,'4K 4096x2160',array['IMAX','3D'],'IMAX(1.90:1)','IMAX 12 Channel',true,'Theatre confirmation'),
  ('4DX','Godzilla x Kong: The New Empire',115,'4K 4096x2160',array['3D','4DX'],'Scope(2.39:1)','Dolby Surround 7.1',true,'Theatre confirmation'),
  ('EPIQ','Godzilla x Kong: The New Empire',115,'4K 4096x2160',array['HDR','3D'],'Scope(2.39:1)','Dolby Atmos',true,'Theatre confirmation'),
  ('Dolby Cinema','The Wild Robot',102,'4K 4096x2160',array['HDR','Dolby Vision'],'Scope(2.39:1)','Dolby Atmos',true,'Theatre confirmation'),
  ('EPIQ','The Wild Robot',102,'4K 4096x2160',array['HDR'],'Scope(2.39:1)','Dolby Atmos',true,'Theatre confirmation'),
  ('Screen 2 — Scope','The Wild Robot',102,'4K 4096x2160',array['HDR'],'Scope(2.39:1)','Dolby Atmos',true,'Theatre confirmation')
) as v(screen_name,movie_title,runtime,resolution,format,aspect,audio,verified,source)
join screens s on s.name = v.screen_name
join movies m on m.title = v.movie_title
on conflict do nothing;

-- TECH TERMS ----------------------------------------------------------------
insert into tech_terms (slug,title,category,short_desc,full_desc,specs,icon,color,related_terms,is_popular) values
  ('dcp','DCP — Digital Cinema Package','Post-Production','The ''master file'' a cinema actually plays — like a Blu-ray, but for projectors.','A DCP is the standardised set of files a movie is delivered in. It carries the encrypted picture (JPEG 2000), the audio, and the subtitles. Two cinemas with identical hardware can still look different because they received different DCPs.','{"Picture":"JPEG 2000, up to 4K","Audio":"Up to 16 channels","Security":"AES-128 encrypted, KDM-keyed"}','Package','amber',array['resolution','aspect-ratio','hdr'],true),
  ('resolution','Resolution (2K vs 4K)','Projection','How many pixels make up the picture. 4K has four times the detail of 2K.','Digital cinema resolution is measured by width. 2K is 2048 pixels wide; 4K is 4096. A 4K DCP on a 4K projector is the gold standard.','{"2K":"2048 × 1080","4K":"4096 × 2160","8K":"8192 × 4320 (rare)"}','ScanLine','cyan',array['dcp','laser-projection'],true),
  ('aspect-ratio','Aspect Ratio (Flat vs Scope)','Format','The shape of the picture. Scope is wider and more cinematic than Flat.','Aspect ratio is the width-to-height shape of the image. Flat (1.85:1) is mildly wide; Scope (2.39:1) is the wide, letterboxed look. IMAX can go taller still.','{"Flat":"1.85:1","Scope":"2.39:1","IMAX Digital":"1.90:1","IMAX Film":"1.43:1"}','RectangleHorizontal','violet',array['dcp','imax'],true),
  ('dolby-atmos','Dolby Atmos','Audio','Object-based sound that moves around — and above — you in 3D space.','Atmos treats each sound as an ''object'' placed precisely in the room, including overhead speakers. It needs both an Atmos DCP and an Atmos-equipped auditorium.','{"Speakers":"Up to 64 independent","Layout":"Surround + overhead array","Best with":"Atmos DCP"}','Speaker','violet',array['dts-x','imax-sound'],true),
  ('laser-projection','Laser Projection','Projection','Lasers instead of a lamp — brighter, deeper blacks, colours that don''t fade.','Laser light engines are brighter, more consistent, and hit a far wider colour range than Xenon bulbs. RGB laser is the top tier.','{"Xenon":"Lamp-based, dims with age","Laser Phosphor":"Single laser, blue-based","RGB Laser":"Three lasers, widest colour"}','Zap','cyan',array['resolution','hdr'],false),
  ('imax','IMAX','Format','The largest screens and tallest images — engineered as a complete system.','IMAX is a calibrated system of screen, dual projectors, and 12-channel sound. Digital IMAX with Laser uses dual 4K laser projectors at 1.90:1; IMAX 70mm film fills the giant 1.43:1 image.','{"Digital IMAX":"Dual 4K laser, 1.90:1","IMAX 70mm":"15/70 film, 1.43:1","Sound":"12-channel"}','Maximize','cyan',array['aspect-ratio','imax-sound','laser-projection'],true),
  ('hdr','HDR (High Dynamic Range)','Projection','A wider gap between the darkest and brightest parts of the picture.','HDR expands contrast — brighter highlights and deeper shadows at once — and a wider range of colours, on a capable laser screen with an HDR DCP.','{"Standard":"~48 nits target","HDR (Dolby Vision)":"Higher peak luminance","Needs":"HDR DCP + laser"}','Sun','amber',array['laser-projection','dcp'],false),
  ('dts-x','DTS:X','Audio','Object-based immersive sound — DTS''s answer to Atmos.','Like Atmos, DTS:X places sounds as objects in 3D space, including height, and is speaker-layout agnostic.','{"Type":"Object-based","Height":"Yes","Best with":"DTS:X DCP"}','Waves','emerald',array['dolby-atmos','imax-sound'],false),
  ('imax-sound','IMAX 12-Channel Sound','Audio','IMAX''s purpose-built sound system with overhead and side channels.','IMAX''s latest sound design uses 12 discrete channels, including overhead and side-surround speakers, tuned per-room by IMAX.','{"Channels":"12 discrete","Overhead":"Yes","Calibration":"Per-auditorium by IMAX"}','AudioLines','cyan',array['imax','dolby-atmos'],false),
  ('silver-screen','Silver Screen (3D)','Screen','A reflective screen that preserves polarised light for brighter 3D.','Polarised 3D systems need the screen to keep light polarised as it bounces back. A silver screen is coated to do exactly that.','{"Gain":"High (1.8–2.4)","Best for":"Polarised 3D","Material":"Aluminised coating"}','Projector','slate',array['imax','laser-projection'],false),
  ('epiq','EPIQ','Format','A premium large-format brand pairing a giant screen with laser + Atmos.','EPIQ is a premium large-format concept: an oversized wall-to-wall screen, 4K RGB laser projection and Dolby Atmos sound.','{"Projection":"4K RGB laser","Sound":"Dolby Atmos","Screen":"Wall-to-wall PLF"}','Sparkles','emerald',array['imax','laser-projection','dolby-atmos'],false),
  ('hfr','HFR (High Frame Rate)','Format','More frames per second for ultra-smooth, judder-free motion.','Cinema traditionally runs at 24 fps. HFR doubles or more that rate (48–120 fps), eliminating strobing and judder in fast pans.','{"Standard":"24 fps","HFR":"48–120 fps","Needs":"HFR DCP + capable projector"}','Gauge','rose',array['dcp','resolution'],false)
on conflict (slug) do nothing;
