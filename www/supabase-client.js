// Supabase Client integration using ES Modules from CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Default credentials (fallback)
const DEFAULT_URL = 'https://bprkehilaayfrhcxyrtc.supabase.co';
const DEFAULT_KEY = 'sb_publishable_8_tyzFQcB5j1FChrcSmRLg_CWPw8TwF';

// Read config dynamically from localStorage or fall back to defaults
export let supabaseUrl = localStorage.getItem('supabase_url') || DEFAULT_URL;
export let supabaseKey = localStorage.getItem('supabase_key') || DEFAULT_KEY;

// Create active client instance
export let supabase = createClient(supabaseUrl, supabaseKey);

// Re-initialize client dynamically when configuration updates
export function reinitializeSupabase(url, key) {
  supabaseUrl = url || DEFAULT_URL;
  supabaseKey = key || DEFAULT_KEY;
  
  localStorage.setItem('supabase_url', supabaseUrl);
  localStorage.setItem('supabase_key', supabaseKey);
  
  supabase = createClient(supabaseUrl, supabaseKey);
  cachedColumns = null; // Clear schema columns cache for new project connection
}

// Cache the column names of the nutrition_entries table to detect user ID column dynamically
let cachedColumns = null;

async function getNutritionColumns() {
  if (cachedColumns) return cachedColumns;
  try {
    const { data, error } = await supabase
      .from('nutrition_entries')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    if (data && data.length > 0) {
      cachedColumns = Object.keys(data[0]);
      return cachedColumns;
    }
    return [];
  } catch (err) {
    console.error("Error inspecting nutrition_entries schema:", err);
    return [];
  }
}

// Fetch nutrition entries for a date range (ISO strings YYYY-MM-DD)
// If supabaseId is provided, we filter by a user_id or supabase_id column if present.
export async function fetchNutritionEntries(startDate, endDate, supabaseId) {
  try {
    const columns = await getNutritionColumns();
    let query = supabase
      .from('nutrition_entries')
      .select('*')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    // Dynamic filtering: if table has user_id/supabase_id column, filter by it
    if (supabaseId) {
      if (columns.includes('user_id')) {
        query = query.eq('user_id', supabaseId);
      } else if (columns.includes('supabase_id')) {
        query = query.eq('supabase_id', supabaseId);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Error fetching nutrition entries:", err);
    throw err;
  }
}

// Fetch user profile from Supabase (falling back to localStorage)
export async function fetchUserProfile(supabaseId) {
  if (!supabaseId) return null;
  
  try {
    // Attempt to fetch from database
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('supabase_id', supabaseId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST205' || error.message.includes('relation "public.user_profiles" does not exist')) {
        console.warn("user_profiles table not found, falling back to localStorage.");
        return getLocalProfile(supabaseId);
      }
      throw error;
    }

    if (data) {
      return data;
    } else {
      return getLocalProfile(supabaseId);
    }
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return getLocalProfile(supabaseId);
  }
}

// Save user profile to Supabase (and localStorage)
export async function saveUserProfile(profile) {
  const { supabase_id } = profile;
  
  // Always save to localStorage first as a reliable backup
  saveLocalProfile(profile);

  try {
    // Check if profile exists in db
    const { data: existing, error: checkError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('supabase_id', supabase_id)
      .maybeSingle();

    if (checkError) throw checkError;

    let result;
    if (existing) {
      // Update
      const { id, created_at, updated_at, ...profileData } = profile;
      result = await supabase
        .from('user_profiles')
        .update(profileData)
        .eq('supabase_id', supabase_id)
        .select();
    } else {
      // Insert
      result = await supabase
        .from('user_profiles')
        .insert([profile])
        .select();
    }

    if (result.error) throw result.error;
    return result.data[0];
  } catch (err) {
    console.error("Could not sync profile to database (storing locally only):", err);
    return profile;
  }
}

// Local Storage Fallbacks
function getLocalProfile(supabaseId) {
  const localData = localStorage.getItem(`profile_${supabaseId}`);
  if (localData) {
    try {
      return JSON.parse(localData);
    } catch (e) {
      // Ignore parse error
    }
  }
  // Return default profile settings if nothing exists
  return {
    supabase_id: supabaseId,
    name: supabaseId, // Default name to user ID
    age: 30,
    height: 175,
    weight: 70,
    gender: 'male',
    activity_level: 'moderately_active',
    goal: 'maintain'
  };
}

function saveLocalProfile(profile) {
  localStorage.setItem(`profile_${profile.supabase_id}`, JSON.stringify(profile));
}
