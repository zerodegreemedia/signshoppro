-- Import 65 clients from zdm-clients.csv into signshop-pro
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

DO $$
DECLARE
  admin_id uuid;
BEGIN
  -- Get the first admin user to use as created_by
  SELECT id INTO admin_id FROM auth.users LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found. Please create a user first.';
  END IF;

  -- Insert clients (skip duplicates by checking contact_name + business_name)
  INSERT INTO clients (business_name, contact_name, email, phone, address, city, state, zip, notes, created_by, created_at)
  VALUES
    ('Black Diamonds', 'Adrian Estevez', 'Aestevez@dtcc.edu', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('AEM', 'AEM', 'maucricioterron@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Out Of The Ashes LLC', 'Ahmarr Melton', 'outoftheashes2015@yahoo.com', '3025074623', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Chip Design Systems', 'Alexis Deputy', 'alexis.deputy95@gmail.com', '3023736685', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('New Creations Barbershop', 'Bebe Santiago', 'bebesantiago78@hotmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Client', 'c.sheila1019@gmail.com', 'c.sheila1019@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Chris Painting', 'Chris Painting', NULL, '3024161091', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Delaware Creative Hardscaping', 'Christian Alvarez', NULL, '3023998916', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Client', 'Cleancutpaintllc@gmail.com', 'Cleancutpaintllc@gmail.com', '3027845581', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('D&S Mobile', 'D&S Mobile', 'dsmobiletire@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('DANIELS TREE SERVICE', 'DANIELS TREE SERVICE', 'Tetoguifarro1994@gmail.com', '5164458179', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('DNI Construction LLC', 'Diego Ortiz', 'diego@d-iconstructionllc.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('All Pro Window Tint', 'Dorian Coleman', 'onsco77@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Buggies Bouncers', 'Duane Buggert', 'buggiesbouncer@gmail.com', NULL, '44 Brace Rd', 'Summertown', 'TN', '38483', NULL, admin_id, '2026-03-09'),
    ('ProForest Landscaping', 'Enrique Cas', 'proforestlandscaping14@gmail.com', '3029817790', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Mosqueda Landscaping', 'Estefany Mosqueda', 'mosquedalandscaping06@gmail.com', '4847874462', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('EMAC Construction', 'Everardo Ayon', 'emacconstruction@hotmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('ADONAI HOME REMODELING', 'Felix Jaramillo', 'felix.jaramillo.fj@gmail.com', NULL, '16 N Woodward Ave', 'Wilmington', 'DE', '19805', NULL, admin_id, '2026-03-09'),
    ('Ultimate Fire Protection', 'Fidel Maxwell', 'ultimatefireprotection1@gmail.com', '3023845745', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('G&G Construction', 'G&G Construction', NULL, '3025441672', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('G&G Cleaning Services', 'Gloria Cruz', 'gloriacruz034@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('DreamaTorium Vison', 'Gloria Lara', 'dream@dreamartstudio.vision', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Greenery Landscaping', 'Greenery Landscaping', 'greenerylandscaping2@gmail.com', '3022872572', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('MT BARBERSHOP', 'Gustavo Olmedo', 'info@mtbarbershop.com', '3029980900', '73 Marrows Rd', 'Newark', 'DE', '19713', NULL, admin_id, '2026-03-09'),
    ('Client', 'Isamary Sanchez', 'lacamarona.de@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Coria Co', 'Jaime Coria', 'info@coriaco.com', '4846108276', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Sweet Venom LLC', 'James May', 'sweetvenomeffect@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Diamond Materials', 'Jorge Campos', 'Jcampos@diamondmaterials.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Client', 'Jorge Ramirez', 'Ramirezbasiliojorge@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Gold Star Painting', 'Julio Villacana', 'goldstarpainting06@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Juniors Landscaping', 'Juniors Landscaping', 'tom1978@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Bilingual Child Pedagogy', 'Kelly Gomez Manzano', 'bilingualpedagogyllc@gmail.com', '3025432207', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('K&R Construction', 'Kevin Chavez', 'dropzgetbizzy123@gmail.com', '2604180897', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('REVIVAL TREES', 'Kevin Robledo', NULL, '9012061793', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Lake Forest Construction', 'Lake Forest Construction', 'lakeforestconstruction1@gmail.com', '6104708088', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('MyGlutenFreeHelp', 'Lisa Blanchette', 'lisa.e.blanchette@gmail.com', '3023887312', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Sublime Painting LC', 'Lucio Hernandez', 'luciohernan1993@gmail.com', '3022450326', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Luis Construction', 'Luis Construction', 'luisvilchis238@gmail.com', '3024827363', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Magic Stump Grinder', 'Magic Stump Grinder', 'magicstumpllc@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Mane All in One', 'Mane All in One', NULL, '2095136359', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('AMI Injury', 'Marc Ippoliti', 'marc@amiinjury.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Dorcas', 'Maria Ortiz', 'yworrymaria@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Client', 'maria.ritzy.jafet@gmail.com', 'maria.ritzy.jafet@gmail.com', '9292271599', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Laser Storm Breaker', 'Mariano Gomez', 'laserstormbreaker@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Client', 'michel.alcantara28@yahoo.com', 'michel.alcantara28@yahoo.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('DULCE MONARCA LLC', 'Miguel Barriga', 'migueleagle7@gmail.com', '3028971557', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('1-2 Tree Gone', 'Miguel Valdez', '12treegonede@gmail.com', '3024689385', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Milanh Painting LLC', 'Milanh Painting LLC', NULL, '3022444363', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Koda Bear Ink', 'Oscar Diaz', 'oscar@kodabearink.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Over and Out Trucking', 'Over and Out Trucking', 'overandout2019@gmail.com', NULL, '132 Springfield Cir', 'Middletown', 'DE', '19709', NULL, admin_id, '2026-03-09'),
    ('PSS Construction LLC', 'Pedro Sanchez', NULL, '3023323848', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Client', 'rivasironworks51@yahoo.com', 'rivasironworks51@yahoo.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Marble Landscaping', 'Rogelio', 'MarbleLh01@gmail.com', '3024421781', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Sam Your Taxes', 'Sam Perez', 'samyourtaxes@hotmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Client', 'Saul Lopez', 'Saullopez3010@gmail.com', '3027236958', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Green Flowers LLC', 'Shari Hernandez', 'info@greenflowersllc.com', '3022563578', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Stella All Cleaning Service', 'Stella All Cleaning Service', 'hjmogzy@hotmail.com', '3022990998', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Kings Detailing', 'Stephen King', 'loco77maq@hotmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('La Tonalteca', 'Thelma Cedeno', NULL, '3029833720', '700 Lantana Dr', 'Hockessin', 'DE', '19707', NULL, admin_id, '2026-03-09'),
    ('Icon Paving', 'Tony Harrison', 'iconpaving@icloud.com', '4439521926', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Client', 'Trujillo.gabino99@gmail.com', 'Trujillo.gabino99@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Serranos Tree', 'Vicente Serrano', 'Serranostree@gmail.com', '6105792308', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Serranos Landscaping LLC', 'Vicente Serrano', 'info@vserranoslandscapingllc.com', '2158342327', NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('West Chester Fence', 'West Chester Fence', 'westchesterfence@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09'),
    ('Client', 'winministries04@gmail.com', 'winministries04@gmail.com', NULL, NULL, NULL, NULL, NULL, NULL, admin_id, '2026-03-09')
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Imported % clients', 65;
END $$;
