-- ═══════════════════════════════════════════════════════════════
-- Aura Cleaners — Datos iniciales (catálogo de servicios + cleaners)
-- Ejecutar después de schema.sql
-- Tarifa base: $35 CAD/hora
-- ═══════════════════════════════════════════════════════════════

-- ── Cleaners de prueba ─────────────────────────────────────────
insert into public.cleaners (name, email, phone, status, hire_date)
values
  ('Angel González', 'angel@auracleaners.ca', '+1 514 000 0001', 'active', '2024-01-15'),
  ('Cleaner Prueba 2', 'cleaner2@auracleaners.ca', '+1 514 000 0002', 'active', '2024-06-01'),
  ('Cleaner Prueba 3', 'cleaner3@auracleaners.ca', '+1 514 000 0003', 'active', '2024-06-01')
on conflict do nothing;

-- ── Catálogo de servicios ──────────────────────────────────────
-- Limpiamos e insertamos de forma idempotente por 'code'
insert into public.services
  (type, category, code, name_en, name_fr, name_es, estimated_hours, price_per_hour, flat_price, is_request_quote, sort_order)
values
  -- STANDARD CLEANING
  ('standard','bedrooms','std_bedroom','Bedroom','Chambre','Habitación',0.5,35,null,false,10),
  ('standard','bathrooms','std_full_bath','Full bathroom','Salle de bain complète','Baño completo',1,35,null,false,11),
  ('standard','bathrooms','std_half_bath','Half bathroom','Demi-salle de bain','Medio baño',0.5,35,null,false,12),
  ('standard','kitchen','std_kitchen','Kitchen','Cuisine','Cocina',1,35,null,false,13),
  ('standard','living','std_living_dining','Living / Dining','Salon / Salle à manger','Sala / Comedor',0.5,35,null,false,14),
  ('standard','windows','std_window_interior','Interior windows','Fenêtres intérieures','Ventanas interiores',0,35,35,false,15),
  ('standard','outdoor','std_patio','Patio','Patio','Patio',1,35,null,false,16),
  ('standard','outdoor','std_basement','Basement','Sous-sol','Sótano',1,35,null,false,17),

  -- DEEP CLEANING
  ('deep','bedrooms','deep_bedroom','Bedroom','Chambre','Habitación',1,35,null,false,20),
  ('deep','bathrooms','deep_full_bath','Full bathroom','Salle de bain complète','Baño completo',1,35,null,false,21),
  ('deep','kitchen','deep_kitchen_premium','Kitchen (premium)','Cuisine (premium)','Cocina (premium)',1.5,35,null,false,22),
  ('deep','living','deep_living_dining','Living / Dining','Salon / Salle à manger','Sala / Comedor',0.75,35,null,false,23),
  ('deep','outdoor','deep_attic','Attic','Grenier','Ático',1.5,35,null,false,24),
  ('deep','outdoor','deep_patio','Patio','Patio','Patio',1,35,null,false,25),
  ('deep','outdoor','deep_basement','Basement','Sous-sol','Sótano',1,35,null,false,26),
  ('deep','windows','deep_window_interior','Interior windows','Fenêtres intérieures','Ventanas interiores',0,35,35,false,27),
  ('deep','special','deep_post_renovation','Post-renovation','Post-rénovation','Post-renovación',0,35,null,true,28),

  -- MOVE IN / OUT
  ('move_in_out','bedrooms','move_per_bedroom','Per bedroom','Par chambre','Por habitación',0.75,35,null,false,30),

  -- GENERAL
  ('general','packages','gen_appliance_package','Appliance Cleaning Package','Forfait nettoyage électroménagers','Paquete limpieza electrodomésticos',2,35,null,false,40),

  -- ADD-ONS
  ('addons','addon','addon_balcony_patio','Balcony / Patio','Balcon / Patio','Balcón / Patio',1,35,null,false,50),
  ('addons','addon','addon_closet_org','Closet Organization','Organisation de placard','Organización de clóset',3,35,null,false,51),
  ('addons','addon','addon_clothing_folding','Clothing Folding','Pliage de vêtements','Doblado de ropa',0.5,35,null,false,52),
  ('addons','addon','addon_dog_walking','Dog Walking','Promenade de chien','Paseo de perro',0.75,35,null,false,53),
  ('addons','addon','addon_exterior_windows','Exterior Windows','Fenêtres extérieures','Ventanas exteriores',1,35,null,false,54),
  ('addons','addon','addon_inside_cabinets','Inside Cabinets','Intérieur des armoires','Interior de gabinetes',1,35,null,false,55),
  ('addons','addon','addon_interior_fridge','Interior Fridge','Intérieur du réfrigérateur','Interior del refrigerador',1,35,null,false,56),
  ('addons','addon','addon_ironing','Ironing','Repassage','Planchado',1,35,null,false,57),
  ('addons','addon','addon_laundry','Laundry','Lessive','Lavandería',0.5,35,null,false,58),
  ('addons','addon','addon_microwave','Microwave','Micro-ondes','Microondas',0.25,35,null,false,59),
  ('addons','addon','addon_organization','Organization','Organisation','Organización',1,35,null,false,60),
  ('addons','addon','addon_oven','Oven','Four','Horno',1,35,null,false,61),
  ('addons','addon','addon_spring_seasonal','Spring / Seasonal','Printemps / Saisonnier','Primavera / Temporada',3,35,null,false,62),
  ('addons','addon','addon_car_wash','Car Wash','Lavage de voiture','Lavado de auto',3,35,null,false,63),
  ('addons','addon','addon_car_waxing','Car Waxing','Cirage de voiture','Encerado de auto',2,35,null,false,64),
  ('addons','addon','addon_cleaning_supplies','Cleaning Supplies','Produits de nettoyage','Insumos de limpieza',0,35,35,false,65),
  ('addons','addon','addon_snow_removal','Driveway Snow Removal','Déneigement d''entrée','Remoción de nieve',0,35,null,true,66),
  ('addons','addon','addon_meal_prep','Meal Prep','Préparation de repas','Preparación de comidas',0,35,null,true,67),
  ('addons','addon','addon_plant_watering','Plant Watering','Arrosage des plantes','Riego de plantas',0,35,null,true,68),
  ('addons','addon','addon_pool_cleaning','Pool Cleaning','Nettoyage de piscine','Limpieza de piscina',0,35,null,true,69)
on conflict (code) do update set
  name_en = excluded.name_en,
  name_fr = excluded.name_fr,
  name_es = excluded.name_es,
  estimated_hours = excluded.estimated_hours,
  price_per_hour = excluded.price_per_hour,
  flat_price = excluded.flat_price,
  is_request_quote = excluded.is_request_quote,
  category = excluded.category,
  type = excluded.type,
  sort_order = excluded.sort_order;
