-- SQL Script to set up user profiles in Supabase
-- Run this in your Supabase SQL Editor

-- 1. Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_id TEXT UNIQUE NOT NULL, -- The custom identifier entered in the app
    name TEXT, -- User's display name
    age INTEGER NOT NULL,
    height NUMERIC NOT NULL, -- in cm
    weight NUMERIC NOT NULL, -- in kg
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    activity_level TEXT NOT NULL CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active')),
    goal TEXT NOT NULL CHECK (goal IN ('lose', 'maintain', 'gain')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create policies to allow public anonymous read/write based on the supabase_id
CREATE POLICY "Allow public read of profiles by supabase_id" 
    ON public.user_profiles 
    FOR SELECT 
    USING (true);

CREATE POLICY "Allow public insert of profiles" 
    ON public.user_profiles 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow public update of profiles" 
    ON public.user_profiles 
    FOR UPDATE 
    USING (true)
    WITH CHECK (true);

-- 4. Enable a trigger to auto-update the updated_at column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_modtime
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE PROCEDURE update_modified_column();
