// Supabase Client integration using ES Modules from CDN
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Read config dynamically from localStorage (No hardcoded credentials)
export let supabaseUrl = localStorage.getItem('supabase_url') || '';
export let supabaseKey = localStorage.getItem('supabase_key') || '';

// Create active client instance if configured, otherwise null
export let supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Re-initialize client dynamically when configuration updates
export function reinitializeSupabase(url, key) {
  supabaseUrl = (url || '').trim();
  supabaseKey = (key || '').trim();
  
  if (supabaseUrl && supabaseKey) {
    localStorage.setItem('supabase_url', supabaseUrl);
    localStorage.setItem('supabase_key', supabaseKey);
    supabase = createClient(supabaseUrl, supabaseKey);
  } else {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_key');
    supabase = null;
  }
  cachedColumns = null; // Clear schema columns cache for new project connection
}

// Cache the column names of the nutrition_entries table to detect user ID column dynamically
let cachedColumns = null;

async function getNutritionColumns() {
  if (!supabase) return [];
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
export async function fetchNutritionEntries(startDate, endDate, supabaseId) {
  if (!supabase) {
    console.warn("Supabase is not configured yet.");
    return [];
  }
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
  
  if (!supabase) {
    console.warn("Supabase is not configured. Loading profile from localStorage.");
    return getLocalProfile(supabaseId);
  }

  try {
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

  if (!supabase) {
    console.warn("Supabase is not configured. Profile stored locally.");
    return profile;
  }

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
