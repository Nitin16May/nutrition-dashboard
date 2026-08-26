// Main application orchestrator for Nutrition & Hydration Dashboard
import { supabase, fetchNutritionEntries, fetchUserProfile, saveUserProfile, reinitializeSupabase, supabaseUrl, supabaseKey } from './supabase-client.js';
import { calculateTargets, getColorCode, nutrientMetadata } from './calculations.js';
import { renderNutritionChart, destroyChart } from './charts.js';

// Helpers
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getRelativeDateString = (dateStr) => {
  const today = getLocalDateString();
  const dateObj = new Date(dateStr);
  
  if (dateStr === today) return 'Today';
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === getLocalDateString(yesterday)) return 'Yesterday';
  
  return dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
};

// Global App State
const state = {
  supabaseId: localStorage.getItem('supabase_id') || '',
  profile: null,
  targets: {},
  currentView: 'daily', // 'daily', 'history', 'profile'
  historySubView: 'weekly', // 'weekly', 'monthly'
  selectedDate: getLocalDateString(),
  dailyEntries: [],
  historyEntries: [],
  selectedChartNutrient: 'calories_kcal',
  loading: false,
  theme: localStorage.getItem('theme') || 'dark'
};

// Toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Check connection and login state
async function initApp() {
  if (isInitialized) return;
  isInitialized = true;

  // Apply initial theme class
  if (state.theme === 'light') {
    document.documentElement.classList.add('light-mode');
  } else {
    document.documentElement.classList.remove('light-mode');
  }

  bindGlobalEvents();
  
  if (state.supabaseId) {
    state.loading = true;
    render();
    try {
      await loadUserData();
      navigateTo('daily');
    } catch (err) {
      console.error("Initialization error:", err);
      showToast("Error loading profile or entries.");
    } finally {
      state.loading = false;
      render();
    }
  } else {
    render();
  }
}

// Load profile and daily entries from database
async function loadUserData() {
  if (!state.supabaseId) return;
  
  // Load profile
  const profile = await fetchUserProfile(state.supabaseId);
  state.profile = profile;
  state.targets = calculateTargets(profile);
  
  // Load daily entries for current selected date
  await refreshDailyData();
}

async function refreshDailyData() {
  if (!state.supabaseId) return;
  try {
    const entries = await fetchNutritionEntries(state.selectedDate, state.selectedDate, state.supabaseId);
    state.dailyEntries = entries;
  } catch (err) {
    showToast("Failed to fetch entries from Supabase.");
  }
}

// Load data for charts (weekly/monthly ranges)
async function refreshHistoryData() {
  if (!state.supabaseId) return;
  state.loading = true;
  render();
  
  const end = new Date(state.selectedDate);
  const start = new Date(state.selectedDate);
  
  if (state.historySubView === 'weekly') {
    start.setDate(start.getDate() - 6);
  } else {
    start.setDate(start.getDate() - 29);
  }

  const startDateStr = getLocalDateString(start);
  const endDateStr = getLocalDateString(end);

  try {
    const entries = await fetchNutritionEntries(startDateStr, endDateStr, state.supabaseId);
    state.historyEntries = entries;
  } catch (err) {
    showToast("Failed to load historical data.");
  } finally {
    state.loading = false;
    render();
    updateChart(startDateStr, endDateStr);
  }
}

// Navigate to tab
function navigateTo(view) {
  state.currentView = view;
  destroyChart();
  
  if (view === 'daily') {
    state.loading = true;
    render();
    refreshDailyData().finally(() => {
      state.loading = false;
      render();
    });
  } else if (view === 'history') {
    refreshHistoryData();
  } else {
    render();
  }
}

// Trigger Chart.js rendering
function updateChart(startDateStr, endDateStr) {
  const canvas = document.getElementById('history-chart');
  if (!canvas) return;

  const key = state.selectedChartNutrient;
  const meta = nutrientMetadata[key] || { label: key, unit: '', group: '' };
  const targetVal = state.targets[key] || 0;

  renderNutritionChart(
    'history-chart',
    state.historyEntries,
    startDateStr,
    endDateStr,
    key,
    meta.label,
    meta.unit,
    targetVal
  );
}

// FOOD BREAKDOWN DIALOG
function showNutrientBreakdown(nutrientKey) {
  const meta = nutrientMetadata[nutrientKey] || { label: nutrientKey, unit: '', group: '' };
  
  const contributingEntries = state.dailyEntries.filter(entry => {
    const val = parseFloat(entry[nutrientKey]);
    return !isNaN(val) && val > 0;
  });

  contributingEntries.sort((a, b) => {
    const valA = parseFloat(a[nutrientKey]) || 0;
    const valB = parseFloat(b[nutrientKey]) || 0;
    return valB - valA;
  });

  const modalContainer = document.getElementById('modal-container');
  if (!modalContainer) return;

  let listHtml = '';
  if (contributingEntries.length === 0) {
    listHtml = `
      <div class="empty-state">
        <i data-lucide="minus-circle" style="color: var(--text-muted); margin-bottom: 8px;"></i>
        <p style="color: var(--text-secondary); font-size: 14px;">No items logged today contributed to this nutrient.</p>
      </div>
    `;
  } else {
    listHtml = `
      <div class="breakdown-list">
        ${contributingEntries.map(entry => {
          const val = parseFloat(entry[nutrientKey]) || 0;
          const formattedVal = val.toFixed(1).replace(/\.0$/, '');
          const brandText = entry.product_brand ? ` • ${entry.product_brand}` : '';
          return `
            <div class="breakdown-row">
              <div>
                <div class="breakdown-item-name">${entry.item}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                  Portion: ${entry.quantity} ${entry.quantity_unit}${brandText}
                </div>
              </div>
              <div class="breakdown-item-val">${formattedVal} ${meta.unit}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  modalContainer.innerHTML = `
    <div class="modal-overlay">
      <div class="modal-content">
        <div class="modal-header">
          <span class="modal-title">${meta.label} Breakdown</span>
          <button id="close-modal-btn" class="modal-close-btn" title="Close">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          ${listHtml}
        </div>
      </div>
    </div>
  `;
  modalContainer.style.display = 'flex';

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function closeModal() {
  const modalContainer = document.getElementById('modal-container');
  if (modalContainer) {
    modalContainer.style.display = 'none';
    modalContainer.innerHTML = '';
  }
}

// Event Bindings
function bindGlobalEvents() {
  // Login form submission
  document.addEventListener('submit', async (e) => {
    if (e.target.id === 'login-form') {
      e.preventDefault();
      const input = document.getElementById('supabase-id-input');
      const val = input.value.trim();
      if (!val) return;
      
      state.supabaseId = val;
      localStorage.setItem('supabase_id', val);
      state.loading = true;
      render();
      try {
        await loadUserData();
        navigateTo('daily');
        showToast("Connected to Supabase!");
      } catch (err) {
        showToast("Failed to login.");
      } finally {
        state.loading = false;
        render();
      }
    }

    // Profile form submission
    if (e.target.id === 'profile-form') {
      e.preventDefault();
      const name = document.getElementById('profile-name').value.trim();
      const age = parseInt(document.getElementById('profile-age').value);
      const height = parseFloat(document.getElementById('profile-height').value);
      const weight = parseFloat(document.getElementById('profile-weight').value);
      const gender = document.getElementById('profile-gender').value;
      const activity_level = document.getElementById('profile-activity').value;
      const goal = document.getElementById('profile-goal').value;

      // Handle Supabase re-configuration if changed
      const newUrl = document.getElementById('profile-supabase-url').value.trim();
      const newKey = document.getElementById('profile-supabase-key').value.trim();

      if (newUrl !== supabaseUrl || newKey !== supabaseKey) {
        reinitializeSupabase(newUrl, newKey);
        showToast("Supabase configuration updated!");
      }

      const updatedProfile = {
        supabase_id: state.supabaseId,
        name: name || state.supabaseId,
        age,
        height,
        weight,
        gender,
        activity_level,
        goal
      };

      state.loading = true;
      render();
      try {
        const saved = await saveUserProfile(updatedProfile);
        state.profile = saved;
        state.targets = calculateTargets(saved);
        showToast("Profile synced successfully!");
        navigateTo('daily');
      } catch (err) {
        showToast("Error updating profile.");
      } finally {
        state.loading = false;
        render();
      }
    }
  });

  // Global button click handler (Event delegation)
  document.addEventListener('click', (e) => {
    // Logout
    if (e.target.closest('#logout-btn')) {
      state.supabaseId = '';
      state.profile = null;
      state.targets = {};
      state.dailyEntries = [];
      state.historyEntries = [];
      localStorage.removeItem('supabase_id');
      destroyChart();
      render();
      showToast("Logged out successfully.");
      return;
    }

    // Theme Toggle
    if (e.target.closest('#theme-toggle-btn')) {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', state.theme);
      document.documentElement.classList.toggle('light-mode', state.theme === 'light');
      render();
      
      if (state.currentView === 'history') {
        const end = new Date(state.selectedDate);
        const start = new Date(state.selectedDate);
        if (state.historySubView === 'weekly') {
          start.setDate(start.getDate() - 6);
        } else {
          start.setDate(start.getDate() - 29);
        }
        updateChart(getLocalDateString(start), getLocalDateString(end));
      }
      showToast(`Switched to ${state.theme} mode`);
      return;
    }

    // Click on clickable nutrient to open food-by-food breakdown
    const clickableCard = e.target.closest('.clickable-nutrient');
    if (clickableCard) {
      const nutrient = clickableCard.dataset.nutrient;
      showNutrientBreakdown(nutrient);
      return;
    }

    // Close Modal overlay
    if (e.target.closest('#close-modal-btn') || e.target.classList.contains('modal-overlay')) {
      closeModal();
      return;
    }

    // Nav tabs
    const navBtn = e.target.closest('.nav-tab-btn');
    if (navBtn) {
      const tab = navBtn.dataset.tab;
      navigateTo(tab);
      return;
    }

    // History sub-tabs
    const subBtn = e.target.closest('.history-sub-btn');
    if (subBtn) {
      state.historySubView = subBtn.dataset.subview;
      refreshHistoryData();
      return;
    }

    // Date navigation
    if (e.target.closest('#prev-date-btn')) {
      adjustDate(-1);
      return;
    }
    if (e.target.closest('#next-date-btn')) {
      adjustDate(1);
      return;
    }
  });

  // Date picker change
  document.addEventListener('change', (e) => {
    if (e.target.id === 'date-picker') {
      state.selectedDate = e.target.value;
      if (state.currentView === 'daily') {
        state.loading = true;
        render();
        refreshDailyData().finally(() => {
          state.loading = false;
          render();
        });
      } else if (state.currentView === 'history') {
        refreshHistoryData();
      }
    }

    // Chart nutrient selection dropdown change
    if (e.target.id === 'chart-nutrient-select') {
      state.selectedChartNutrient = e.target.value;
      
      const end = new Date(state.selectedDate);
      const start = new Date(state.selectedDate);
      if (state.historySubView === 'weekly') {
        start.setDate(start.getDate() - 6);
      } else {
        start.setDate(start.getDate() - 29);
      }
      updateChart(getLocalDateString(start), getLocalDateString(end));
    }
  });
}

function adjustDate(days) {
  const d = new Date(state.selectedDate);
  d.setDate(d.getDate() + days);
  state.selectedDate = getLocalDateString(d);
  if (state.currentView === 'daily') {
    state.loading = true;
    render();
    refreshDailyData().finally(() => {
      state.loading = false;
      render();
    });
  } else if (state.currentView === 'history') {
    refreshHistoryData();
  }
}

// RENDER ENGINE
function render() {
  const appRoot = document.getElementById('app-root');
  if (!appRoot) return;

  if (!state.supabaseId) {
    appRoot.innerHTML = renderLoginPage();
    if (window.lucide) {
      window.lucide.createIcons();
    }
    return;
  }

  // Theme Icon reflects active state: Moon in Light Mode, Sun in Dark Mode
  const themeIcon = state.theme === 'light' 
    ? `<i data-lucide="moon"></i>`
    : `<i data-lucide="sun"></i>`;

  const displayName = state.profile && state.profile.name ? state.profile.name : state.supabaseId;

  let html = `
    <header class="app-header">
      <div class="logo-text">FitMetrics</div>
      <div class="header-actions">
        <div class="header-user-badge">
          <i data-lucide="user" style="width: 14px; height: 14px; margin-right: 4px;"></i>
          <span>${displayName}</span>
        </div>
        <button id="theme-toggle-btn" class="header-btn" title="Toggle Theme">
          ${themeIcon}
        </button>
        <button id="logout-btn" class="header-btn logout-btn" title="Logout">
          <i data-lucide="log-out"></i>
        </button>
      </div>
    </header>

    <nav class="nav-tabs">
      <button class="nav-tab-btn ${state.currentView === 'daily' ? 'active' : ''}" data-tab="daily">
        <i data-lucide="calendar"></i>
        Daily
      </button>
      <button class="nav-tab-btn ${state.currentView === 'history' ? 'active' : ''}" data-tab="history">
        <i data-lucide="trending-up"></i>
        Trends
      </button>
      <button class="nav-tab-btn ${state.currentView === 'profile' ? 'active' : ''}" data-tab="profile">
        <i data-lucide="user"></i>
        Profile
      </button>
    </nav>

    <main class="content-area">
      ${state.loading ? renderLoader() : renderActiveTab()}
    </main>
  `;

  appRoot.innerHTML = html;
  
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderLoginPage() {
  const themeIcon = state.theme === 'light' 
    ? `<i data-lucide="moon"></i>`
    : `<i data-lucide="sun"></i>`;

  return `
    <div class="login-wrapper">
      <div class="login-card glass-card" style="position: relative;">
        <div style="position: absolute; top: 16px; right: 16px;">
          <button id="theme-toggle-btn" class="header-btn" title="Toggle Theme">
            ${themeIcon}
          </button>
        </div>
        <div class="logo-container">
          <div class="logo-icon">
            <i data-lucide="activity" style="width: 32px; height: 32px; color: white;"></i>
          </div>
          <div class="logo-text">FitMetrics</div>
          <div class="login-subtitle">Connect to your Supabase Nutrition Database</div>
        </div>
        <form id="login-form">
          <div class="form-group">
            <label for="supabase-id-input">Supabase User/Profile ID</label>
            <input type="text" id="supabase-id-input" class="input-field" placeholder="Enter your ID (e.g. nitin)" value="${state.supabaseId}" required>
          </div>
          <button type="submit" class="btn-primary">Connect & View Dashboard</button>
        </form>
      </div>
    </div>
  `;
}

function renderLoader() {
  return `
    <div class="loader-container">
      <div class="spinner"></div>
      <p style="color: var(--text-secondary); font-size: 14px;">Fetching data from Supabase...</p>
    </div>
  `;
}

function renderActiveTab() {
  switch (state.currentView) {
    case 'daily':
      return renderDailyDashboard();
    case 'history':
      return renderHistoryDashboard();
    case 'profile':
      return renderProfileForm();
    default:
      return '';
  }
}

// DAILY DASHBOARD RENDER
function renderDailyDashboard() {
  const totals = {
    calories_kcal: 0,
    protein_g: 0,
    carbohydrates_g: 0,
    fat_g: 0
  };

  const microTotals = {};
  Object.keys(nutrientMetadata).forEach(key => {
    if (nutrientMetadata[key].group !== 'Macros') {
      microTotals[key] = 0;
    }
  });

  state.dailyEntries.forEach(entry => {
    ['calories_kcal', 'protein_g', 'carbohydrates_g', 'fat_g'].forEach(key => {
      const val = parseFloat(entry[key]);
      if (!isNaN(val)) totals[key] += val;
    });

    Object.keys(microTotals).forEach(key => {
      const val = parseFloat(entry[key]);
      if (!isNaN(val)) microTotals[key] += val;
    });
  });

  const getPercentage = (val, target) => {
    if (!target) return 0;
    return Math.round((val / target) * 100);
  };

  const renderMacroRing = (key, label, value, unit) => {
    const target = state.targets[key] || 0;
    const percentage = getPercentage(value, target);
    const status = getColorCode(key, value, target);
    
    const radius = 42;
    const circ = 2 * Math.PI * radius;
    const dashOffset = circ - (Math.min(100, percentage) / 100) * circ;

    return `
      <div class="macro-ring-card glass-card clickable-nutrient" data-nutrient="${key}">
        <div class="macro-ring-label">${label}</div>
        <div class="progress-ring-container">
          <svg class="progress-ring-svg">
            <circle class="progress-ring-circle-bg" cx="50" cy="50" r="${radius}"></circle>
            <circle class="progress-ring-circle" cx="50" cy="50" r="${radius}" 
              style="stroke: ${status.color}; stroke-dasharray: ${circ}; stroke-dashoffset: ${dashOffset};">
            </circle>
          </svg>
          <div class="progress-ring-text">
            <span class="progress-ring-val">${Math.round(value)}</span>
            <span class="progress-ring-unit">${unit}</span>
          </div>
        </div>
        <div class="macro-target-label">Target: ${target}${unit}</div>
        <span class="status-badge" style="color: ${status.color}; border-color: ${status.color}33; background: ${status.color}08">${status.label}</span>
      </div>
    `;
  };

  const microsHtml = `
    <div class="micro-grid">
      ${Object.keys(microTotals).map(key => {
        const val = microTotals[key];
        const target = state.targets[key] || 0;
        const meta = nutrientMetadata[key] || { label: key, unit: '', group: 'Other' };
        const percentage = getPercentage(val, target);
        const status = getColorCode(key, val, target);
        
        return `
          <div class="micro-row-card clickable-nutrient" data-nutrient="${key}">
            <div class="micro-row-header">
              <span class="micro-row-title">${meta.label}</span>
              <span class="micro-row-percentage" style="color: ${status.color}">${percentage}%</span>
            </div>
            <div class="micro-progressbar-bg">
              <div class="micro-progressbar-fill" style="width: ${Math.min(100, percentage)}%; background-color: ${status.color};"></div>
            </div>
            <div class="micro-row-values">
              <span>Intake: ${val.toFixed(1).replace(/\.0$/, '')} ${meta.unit}</span>
              <span>Target: ${target} ${meta.unit}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  return `
    <div class="dashboard-view">
      <div class="date-selector-bar">
        <button id="prev-date-btn" class="date-btn" title="Previous Day">
          <i data-lucide="chevron-left"></i>
        </button>
        <div class="date-display-wrapper">
          <span class="date-label">${getRelativeDateString(state.selectedDate)}</span>
          <i data-lucide="calendar" style="color: var(--text-secondary);"></i>
          <input type="date" id="date-picker" class="date-picker-hidden" value="${state.selectedDate}">
        </div>
        <button id="next-date-btn" class="date-btn" title="Next Day">
          <i data-lucide="chevron-right"></i>
        </button>
      </div>

      <div class="macro-rings-grid">
        ${renderMacroRing('calories_kcal', 'Calories', totals.calories_kcal, 'kcal')}
        ${renderMacroRing('protein_g', 'Protein', totals.protein_g, 'g')}
        ${renderMacroRing('carbohydrates_g', 'Carbohydrates', totals.carbohydrates_g, 'g')}
        ${renderMacroRing('fat_g', 'Fats', totals.fat_g, 'g')}
      </div>

      <div class="micro-accordion-wrapper">
        <h3 style="font-family: var(--font-heading); font-size: 18px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
          <i data-lucide="activity" style="color: var(--color-brand);"></i>
          Micronutrients & Hydration Dashboard
          <span style="font-size: 12px; font-weight: normal; color: var(--text-muted); margin-left: auto;">(Click card for food breakdown)</span>
        </h3>
        ${microsHtml}
      </div>
    </div>
  `;
}

// TRENDS (HISTORY) DASHBOARD RENDER
function renderHistoryDashboard() {
  const loggedDates = new Set(state.historyEntries.map(e => e.entry_date));
  const activeDays = Math.max(1, loggedDates.size);
  const durationDays = state.historySubView === 'weekly' ? 7 : 30;
  
  const nutrientSums = {
    calories_kcal: 0,
    protein_g: 0,
    carbohydrates_g: 0,
    fat_g: 0,
    water_ml: 0,
    dietary_fiber_g: 0,
    calcium_mg: 0,
    iron_mg: 0,
    sodium_mg: 0,
    potassium_mg: 0,
    magnesium_mg: 0,
    zinc_mg: 0
  };

  state.historyEntries.forEach(entry => {
    Object.keys(nutrientSums).forEach(key => {
      const val = parseFloat(entry[key]);
      if (!isNaN(val)) {
        nutrientSums[key] += val;
      }
    });
  });

  const renderAverageCard = (key, label, unit) => {
    const sum = nutrientSums[key];
    if (sum === 0 || isNaN(sum)) return '';
    
    const avg = sum / activeDays;
    const target = state.targets[key] || 0;
    const percentage = target > 0 ? Math.round((avg / target) * 100) : 0;
    const status = getColorCode(key, avg, target);

    return `
      <div class="average-card">
        <div class="average-card-title">${label}</div>
        <div class="average-card-value" style="color: ${status.color}">
          ${Math.round(avg)}
          <span class="average-card-unit">${unit}</span>
        </div>
        <div class="average-card-comparison">
          Avg: ${percentage}% of target (${target}${unit})
        </div>
      </div>
    `;
  };

  const dropdownOptions = Object.keys(nutrientMetadata).map(key => {
    const meta = nutrientMetadata[key];
    return `<option value="${key}" ${state.selectedChartNutrient === key ? 'selected' : ''}>${meta.group}: ${meta.label}</option>`;
  }).join('');

  return `
    <div class="dashboard-view">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div class="history-sub-tabs">
          <button class="history-sub-btn ${state.historySubView === 'weekly' ? 'active' : ''}" data-subview="weekly">Weekly Avg</button>
          <button class="history-sub-btn ${state.historySubView === 'monthly' ? 'active' : ''}" data-subview="monthly">Monthly Avg</button>
        </div>
        <div style="font-size: 13px; color: var(--text-muted);">
          Ending on: ${state.selectedDate} (${activeDays} log day${activeDays > 1 ? 's' : ''})
        </div>
      </div>

      <div class="chart-card glass-card">
        <div class="chart-header">
          <div class="chart-title-group">
            <span class="chart-title">${state.historySubView === 'weekly' ? 'Weekly' : 'Monthly'} Chart Analysis</span>
            <span class="chart-subtitle">Compare daily logs against your calculated targets</span>
          </div>
          <div class="chart-dropdown-wrapper">
            <label for="chart-nutrient-select" style="font-size: 13px; color: var(--text-secondary);">Show Chart:</label>
            <select id="chart-nutrient-select" class="select-dropdown">
              ${dropdownOptions}
            </select>
          </div>
        </div>
        
        <div class="chart-container-wrapper">
          <canvas id="history-chart"></canvas>
        </div>
      </div>

      <div>
        <h3 style="font-family: var(--font-heading); font-size: 18px; margin-bottom: 16px;">
          Daily Averages (Only on Days Logged)
        </h3>
        <div class="averages-grid">
          ${renderAverageCard('calories_kcal', 'Calories', 'kcal')}
          ${renderAverageCard('protein_g', 'Protein', 'g')}
          ${renderAverageCard('carbohydrates_g', 'Carbs', 'g')}
          ${renderAverageCard('fat_g', 'Fats', 'g')}
          ${renderAverageCard('water_ml', 'Water Intake', 'ml')}
          ${renderAverageCard('dietary_fiber_g', 'Dietary Fiber', 'g')}
          ${renderAverageCard('sodium_mg', 'Sodium Limit', 'mg')}
          ${renderAverageCard('potassium_mg', 'Potassium', 'mg')}
          ${renderAverageCard('magnesium_mg', 'Magnesium', 'mg')}
          ${renderAverageCard('zinc_mg', 'Zinc', 'mg')}
        </div>
      </div>
    </div>
  `;
}

// PROFILE SETUP RENDER
function renderProfileForm() {
  const p = state.profile || { age: 30, height: 175, weight: 70, gender: 'male', activity_level: 'moderately_active', goal: 'maintain' };
  const nameVal = p.name || state.supabaseId;

  return `
    <div class="profile-card glass-card">
      <h2 class="profile-title">Personal Profile & Target Goals</h2>
      
      <div class="profile-info-alert">
        <i data-lucide="info" style="color: var(--color-brand); flex-shrink: 0; margin-right: 8px;"></i>
        <div>
          Entering your statistics calculates daily energy expenditures via the <strong>Mifflin-St Jeor formula</strong>, establishes a <strong>2.0g/kg protein target</strong>, and sets standard mineral and vitamin requirements.
        </div>
      </div>

      <form id="profile-form">
        <h3 style="font-family: var(--font-heading); font-size: 16px; margin-bottom: 12px; color: var(--text-secondary);">User Information</h3>
        <div class="form-grid">
          <div class="form-group" style="grid-column: span 2;">
            <label for="profile-name">Full Name / Display Name</label>
            <input type="text" id="profile-name" class="input-field" value="${nameVal}" placeholder="Enter your name" required>
          </div>
          <div class="form-group">
            <label for="profile-age">Age (years)</label>
            <input type="number" id="profile-age" class="input-field" value="${p.age}" min="1" max="120" required>
          </div>
          <div class="form-group">
            <label for="profile-gender">Gender</label>
            <select id="profile-gender" class="input-field select-field">
              <option value="male" ${p.gender === 'male' ? 'selected' : ''}>Male</option>
              <option value="female" ${p.gender === 'female' ? 'selected' : ''}>Female</option>
            </select>
          </div>
          <div class="form-group">
            <label for="profile-height">Height (cm)</label>
            <input type="number" id="profile-height" class="input-field" value="${p.height}" min="50" max="250" step="0.1" required>
          </div>
          <div class="form-group">
            <label for="profile-weight">Weight (kg)</label>
            <input type="number" id="profile-weight" class="input-field" value="${p.weight}" min="10" max="300" step="0.1" required>
          </div>
          <div class="form-group">
            <label for="profile-activity">Physical Activity Level</label>
            <select id="profile-activity" class="input-field select-field">
              <option value="sedentary" ${p.activity_level === 'sedentary' ? 'selected' : ''}>Sedentary (desk job, little/no exercise)</option>
              <option value="lightly_active" ${p.activity_level === 'lightly_active' ? 'selected' : ''}>Lightly Active (1-3 days light exercise)</option>
              <option value="moderately_active" ${p.activity_level === 'moderately_active' ? 'selected' : ''}>Moderately Active (3-5 days moderate exercise)</option>
              <option value="very_active" ${p.activity_level === 'very_active' ? 'selected' : ''}>Very Active (6-7 days heavy exercise)</option>
            </select>
          </div>
          <div class="form-group">
            <label for="profile-goal">Daily Goal</label>
            <select id="profile-goal" class="input-field select-field">
              <option value="lose" ${p.goal === 'lose' ? 'selected' : ''}>Fat Loss (500 kcal deficit)</option>
              <option value="maintain" ${p.goal === 'maintain' ? 'selected' : ''}>Weight Maintenance (TDEE)</option>
              <option value="gain" ${p.goal === 'gain' ? 'selected' : ''}>Muscle Gain (500 kcal surplus)</option>
            </select>
          </div>
        </div>

        <h3 style="font-family: var(--font-heading); font-size: 16px; margin-top: 24px; margin-bottom: 12px; color: var(--text-secondary);">Supabase Project Configuration</h3>
        <div class="form-grid">
          <div class="form-group" style="grid-column: span 2;">
            <label for="profile-supabase-url">Supabase Project URL</label>
            <input type="text" id="profile-supabase-url" class="input-field" value="${supabaseUrl}" placeholder="https://your-project.supabase.co" required>
          </div>
          <div class="form-group" style="grid-column: span 2;">
            <label for="profile-supabase-key">Supabase Publishable/Anon API Key</label>
            <input type="text" id="profile-supabase-key" class="input-field" value="${supabaseKey}" placeholder="sb_publishable_..." required>
          </div>
        </div>
        
        <button type="submit" class="btn-primary" style="margin-top: 12px;">Save Profile & Sync Database</button>
      </form>
    </div>
  `;
}

// Initialization Guard Flag
let isInitialized = false;

// Kickstart
document.addEventListener('DOMContentLoaded', initApp);
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initApp();
}
