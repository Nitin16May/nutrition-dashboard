# 🏋️‍♂️ FitMetrics - Conversational Nutrition & Hydration Dashboard

**FitMetrics** is a premium, glassmorphic Single Page Web App (and PWA/Native app) designed to track, analyze, and visualize daily macros and 40+ micronutrients synced to a Supabase database. 

It is designed to work in tandem with **ChatGPT** acting as your personal, conversational food logger. You talk to ChatGPT, ChatGPT estimates the complete scientific nutrition profile and pushes it to Supabase, and FitMetrics visualizes it in real-time.

🌍 **Live Web App URL:** [https://nitin16may.github.io/nutrition-dashboard/](https://nitin16may.github.io/nutrition-dashboard/)

---

## 🛠️ Step 1: Set Up Your Supabase Database

To store your entries, you need a free Supabase account. Follow these steps to provision your project:

1. **Create a Supabase Project:**
   - Go to [supabase.com](https://supabase.com/) and create a new project.
   - Note down your **Project URL** and **API Public/Anon Key** from your Project Settings -> API.

2. **Create the Database Table:**
   - In your Supabase Dashboard, navigate to the **SQL Editor** on the left menu.
   - Click **New Query** and copy-paste the SQL script below to create the single necessary table (`nutrition_entries`) and enable Row Level Security (RLS) policies.
   - *Note: User biometrics (name, age, weight, goals) are stored safely on each device via `localStorage`.*

```sql
-- 1. Create the nutrition entries table (holds logged food and supplement entries)
CREATE TABLE IF NOT EXISTS public.nutrition_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    quantity_unit TEXT NOT NULL,
    product_brand TEXT,
    product_name TEXT,
    entry_date DATE DEFAULT CURRENT_DATE NOT NULL,
    
    -- Macros & Lipids
    calories_kcal NUMERIC DEFAULT 0,
    protein_g NUMERIC DEFAULT 0,
    carbohydrates_g NUMERIC DEFAULT 0,
    fat_g NUMERIC DEFAULT 0,
    monounsaturated_fat_g NUMERIC DEFAULT 0,
    polyunsaturated_fat_g NUMERIC DEFAULT 0,
    saturated_fat_g NUMERIC DEFAULT 0,
    trans_fat_g NUMERIC DEFAULT 0,
    cholesterol_mg NUMERIC DEFAULT 0,
    
    -- Hydration & Fiber
    water_ml NUMERIC DEFAULT 0,
    dietary_fiber_g NUMERIC DEFAULT 0,
    
    -- Sugars
    added_sugars_g NUMERIC DEFAULT 0,
    total_sugars_g NUMERIC DEFAULT 0,
    
    -- Minerals
    calcium_mg NUMERIC DEFAULT 0,
    iron_mg NUMERIC DEFAULT 0,
    sodium_mg NUMERIC DEFAULT 0,
    potassium_mg NUMERIC DEFAULT 0,
    magnesium_mg NUMERIC DEFAULT 0,
    zinc_mg NUMERIC DEFAULT 0,
    phosphorus_mg NUMERIC DEFAULT 0,
    selenium_ug NUMERIC DEFAULT 0,
    copper_mg NUMERIC DEFAULT 0,
    manganese_mg NUMERIC DEFAULT 0,
    iodine_ug NUMERIC DEFAULT 0,
    chromium_ug NUMERIC DEFAULT 0,
    molybdenum_ug NUMERIC DEFAULT 0,
    
    -- Vitamins
    vitamin_a_ug NUMERIC DEFAULT 0,
    vitamin_c_mg NUMERIC DEFAULT 0,
    vitamin_d_ug NUMERIC DEFAULT 0,
    vitamin_e_mg NUMERIC DEFAULT 0,
    vitamin_k_ug NUMERIC DEFAULT 0,
    vitamin_b1_mg NUMERIC DEFAULT 0,
    vitamin_b2_mg NUMERIC DEFAULT 0,
    vitamin_b3_mg NUMERIC DEFAULT 0,
    vitamin_b5_mg NUMERIC DEFAULT 0,
    vitamin_b6_mg NUMERIC DEFAULT 0,
    biotin_b7_ug NUMERIC DEFAULT 0,
    folate_b9_ug NUMERIC DEFAULT 0,
    vitamin_b12_ug NUMERIC DEFAULT 0,
    choline_mg NUMERIC DEFAULT 0,
    
    -- Audited items
    omega3_mg NUMERIC DEFAULT 0, -- Matches active database column name
    epa_mg NUMERIC DEFAULT 0,
    dha_mg NUMERIC DEFAULT 0,
    alcohol_g NUMERIC DEFAULT 0,
    caffeine_mg NUMERIC DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- Note: If you want to use the database with multiple profiles/users,
-- you can optionally add a user_id column to filter rows by user:
-- ALTER TABLE public.nutrition_entries ADD COLUMN user_id TEXT;

-- 2. Enable Row Level Security (RLS) on the table
ALTER TABLE public.nutrition_entries ENABLE ROW LEVEL SECURITY;

-- 3. Enable public read/write access policies (makes database accessible to client-side API)
CREATE POLICY "Allow public read of entries" ON public.nutrition_entries FOR SELECT USING (true);
CREATE POLICY "Allow public insert of entries" ON public.nutrition_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update of entries" ON public.nutrition_entries FOR UPDATE USING (true) WITH CHECK (true);
```

---

## 🤖 Step 2: Set Up ChatGPT Project Instructions

To make ChatGPT act as your logging assistant and write directly into your Supabase database, create a new **ChatGPT Project** (or Custom GPT) and configure it:

1. **Connect ChatGPT to your Supabase API:** Set up a ChatGPT Action/Plugin mapping the POST and GET methods of your Supabase `nutrition_entries` table.
2. **Add Custom Instructions:** Paste the following instructions into the ChatGPT Project instructions:

```text
DAILY NUTRITION DATABASE

Supabase = MASTER SOURCE OF TRUTH.

Whenever the user reports food, drink or supplements:
1. Immediately INSERT into Supabase nutrition_entries table (mapping user_id to user's id).
2. Verify the entry.
3. Query the current day's totals.
4. Report calories, protein, carbs, fat, fiber + relevant micros.
5. Never rely on memory/old totals.
6. Corrections UPDATE the original entry; never duplicate.
7. Excel/Google Sheets are only reporting/backup layers.

ESTIMATION:
- Try your best to estimate ALL reasonable macros and micronutrients.
- Prefer exact label > manufacturer > reliable nutrition database > standard reference data.
- Use Exact / Calculated / Estimated.
- For photos, estimate portion using visible size references (eggs, containers, utensils, packaging) and choose a conservative realistic estimate.
- Never assume a large portion.
- Never turn unknown into zero.
- If a nutrient cannot reasonably be estimated, leave it blank and explain.
- When better product information is provided later, replace the estimate with the exact data.

TRACK:
Calories, protein, carbs, total/added sugar, fiber, total/saturated/trans/mono/polyunsaturated fat, cholesterol;
A, B1, B2, B3, B5, B6, B7, B9, B12, C, D, E, K;
calcium, iron, magnesium, zinc, potassium, sodium, phosphorus, selenium, copper, manganese, iodine, chromium, molybdenum;
choline, omega-3, EPA, DHA, alcohol, caffeine, water;
and relevant supplement actives/amino acids when reliable data exists.

DEFAULT — SUPPLEMENTS:
MuscleBlaze Biozyme 5-in-1 Multivitamin — 3 tablets:
A 1000µg, B1 1.4mg, B2 2mg, B3 14mg, B5 5mg, B6 1.9mg, B7 40µg, B9 176.47µg, B12 2.2µg, C 80mg, D2 15µg, E 10mg, K1 55µg, Ca 140mg, Fe 19mg, Mg 30mg, Zn 17mg, P 70mg, K 50mg, Na 14.21mg, Mn 4mg, Cu 1.7mg, iodine 140µg, Mo 45µg, Se 40µg. Also glucosamine, hyaluronic acid, enzyme/herbal blends.

Tata 1mg Triple Strength Omega-3 — 1 capsule:
Fish oil 1250mg, omega-3 1000mg, EPA 560mg, DHA 400mg, vitamin E 5mg.

Tata 1mg Magnesium Glycinate — 1 tablet:
Elemental Mg 220mg.

DEFAULT — USUAL BREAKFAST:
Sid's Farm High Protein Milk — 250ml:
158.24 kcal, protein 25g, carbs 13.66g, fat <0.5g, added sugar 0g, Ca 600mg, Na 78.7mg.

Yoga Bar High Protein Oats Dark Chocolate — 75g:
305.25 kcal, protein 23.25g, carbs 28.5g, fat 11.25g, fiber 5.175g, sugar 2.25g, Na 128.55mg.

DEFAULT — WHEY:
1 scoop = 36g:
141.98 kcal, protein 25g, carbs 5.83g, total sugar 3g, added sugar 0g, fat 1.98g, saturated 1.37g, MUFA 0.49g, PUFA 0.12g, trans <0.004g, cholesterol 140.77mg, sodium 50.15mg, MB EnzymePro 189mg.
EAAs 11.75g, BCAAs 5.51g, SEAAs 3.80g, NEAAs 9.45g, glutamic acid 4.38g.
These are Exact from the user's uploaded label.
Different whey/product = do not reuse.

USER TARGETS:
75kg, 168cm, 23M, moderate activity, muscle gain + fat loss.
Starting target: 2450 kcal, 150g protein, 281g carbs, 75g fat, 34g fiber.
Micronutrient targets: use standard adult male RDAs/AIs; sodium ≤2300mg.
Do not treat exceeding an RDA as harmful; use recognized ULs for safety warnings.

```

---

## 🔌 Step 2.1: Supabase Integration inside ChatGPT

To connect your Supabase project database directly to ChatGPT without writing any APIs:

1. **Search in Plugins/GPTs:** In the ChatGPT Sidebar, go to **Explore GPTs** or the **Plugins Store**.
2. **Install Supabase:** Search for the official **Supabase** app and click **Install / Connect**.
3. **Login & Authorize:** Follow the prompt to log into your Supabase account, select your database project, and click **Authorize**. 

*That's it! ChatGPT is now fully authorized to write food entries to your database.*

---


## 📈 Step 3: Access Your Dashboard

1. Open your hosted dashboard URL:
   👉 **[https://nitin16may.github.io/nutrition-dashboard/](https://nitin16may.github.io/nutrition-dashboard/)**
2. On your first load, enter:
   - Your **Supabase User/Profile ID** (e.g. `nitin`).
   - Your **Supabase Project URL**.
   - Your **Supabase Anon API Key**.
3. Tap **Connect**. The app will link to your project and cache credentials locally.
4. **Auto-Login Link:** You can bypass entering credentials on new devices by using URL query parameters:
   `https://nitin16may.github.io/nutrition-dashboard/?id=YOUR_ID&url=YOUR_URL&key=YOUR_KEY`

---

## 🌟 App Features

- **Interactive Food Breakdowns:** Tap any macro progress ring or micronutrient progress row to open a slide-up sheet displaying the itemized breakdown of contributing foods sorted by highest impact.
- **Scientific Toxicity Warnings:** Eliminates arbitrary warning thresholds. Values remain green (safe) once RDA targets are met, and only trigger Red warnings when exceeding medical **Tolerable Upper Limits (UL)**.
- **Active-Day Averages:** Historical averages (weekly/monthly trends) filter out blank logging days automatically so averages are never diluted.
- **Theme Engine:** Sun/Moon toggle switches between slate dark gradients and sleek light gray styles.
- **PWA Capabilities:** Tap "Add to Home Screen" on iOS Safari or Android Chrome to launch FitMetrics standalone as a fullscreen app.
