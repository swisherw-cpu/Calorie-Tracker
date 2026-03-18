// ── State ──
const STATE_KEY = 'calorie-tracker-data';
const GOALS_KEY = 'calorie-tracker-goals';

let currentDate = todayStr();
let selectedMeal = 'breakfast';
let pendingFood = null;

const defaultGoals = { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 };

// ── Helpers ──
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function loadGoals() {
  try { return { ...defaultGoals, ...JSON.parse(localStorage.getItem(GOALS_KEY)) }; }
  catch { return { ...defaultGoals }; }
}

function saveGoals(goals) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

function loadDayData(date) {
  try {
    const all = JSON.parse(localStorage.getItem(STATE_KEY)) || {};
    return all[date] || { breakfast: [], lunch: [], dinner: [], snacks: [] };
  } catch { return { breakfast: [], lunch: [], dinner: [], snacks: [] }; }
}

function saveDayData(date, data) {
  try {
    const all = JSON.parse(localStorage.getItem(STATE_KEY)) || {};
    all[date] = data;
    localStorage.setItem(STATE_KEY, JSON.stringify(all));
  } catch(e) { console.error('Save error', e); }
}

function round1(n) { return Math.round(n * 10) / 10; }

// ── DOM refs ──
const dateInput = document.getElementById('current-date');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const todayBtn = document.getElementById('today-btn');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const mealBtns = document.querySelectorAll('.meal-btn');
const customForm = document.getElementById('custom-food-form');
const goalsForm = document.getElementById('goals-form');
const servingModal = document.getElementById('serving-modal');

// ── Date Navigation ──
dateInput.value = currentDate;

dateInput.addEventListener('change', () => {
  currentDate = dateInput.value;
  render();
});

prevDayBtn.addEventListener('click', () => {
  const d = new Date(currentDate + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  currentDate = d.toISOString().slice(0, 10);
  dateInput.value = currentDate;
  render();
});

nextDayBtn.addEventListener('click', () => {
  const d = new Date(currentDate + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  currentDate = d.toISOString().slice(0, 10);
  dateInput.value = currentDate;
  render();
});

todayBtn.addEventListener('click', () => {
  currentDate = todayStr();
  dateInput.value = currentDate;
  render();
});

// ── Meal Selector ──
mealBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    mealBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMeal = btn.dataset.meal;
  });
});

// ── Food Search ──
function searchFoods(query) {
  if (!query.trim()) return [];
  const terms = query.toLowerCase().split(/\s+/);
  const scored = FOOD_DATABASE.map(food => {
    const name = food.name.toLowerCase();
    let score = 0;
    let allMatch = true;
    for (const term of terms) {
      if (name.includes(term)) {
        score += term.length;
        if (name.startsWith(term)) score += 3;
      } else {
        allMatch = false;
      }
    }
    return { food, score, allMatch };
  }).filter(r => r.score > 0);

  scored.sort((a, b) => {
    if (a.allMatch !== b.allMatch) return a.allMatch ? -1 : 1;
    return b.score - a.score;
  });

  return scored.slice(0, 20).map(r => r.food);
}

function showSearchResults(foods) {
  if (!foods.length) {
    searchResults.innerHTML = '<div class="search-result-item"><span class="result-name">No results found. Try a different search or add custom food.</span></div>';
    searchResults.classList.remove('hidden');
    return;
  }
  searchResults.innerHTML = foods.map((f, i) => `
    <div class="search-result-item" data-index="${i}">
      <div>
        <div class="result-name">${escapeHtml(f.name)}</div>
      </div>
      <div class="result-meta">
        <span class="cal-tag">${f.calories} cal</span>
        <span class="serving-tag">${escapeHtml(f.serving)}</span>
      </div>
    </div>
  `).join('');
  searchResults.classList.remove('hidden');

  // Attach click handlers
  searchResults.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      if (!isNaN(idx)) openServingModal(foods[idx]);
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

searchBtn.addEventListener('click', () => {
  const results = searchFoods(searchInput.value);
  showSearchResults(results);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const results = searchFoods(searchInput.value);
    showSearchResults(results);
  }
});

// Live search as user types (debounced)
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const q = searchInput.value.trim();
    if (q.length >= 2) {
      showSearchResults(searchFoods(q));
    } else {
      searchResults.classList.add('hidden');
    }
  }, 200);
});

// Close search results when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) {
    searchResults.classList.add('hidden');
  }
});

// ── Serving Modal ──
function openServingModal(food) {
  pendingFood = food;
  document.getElementById('modal-food-name').textContent = food.name;
  document.getElementById('modal-cal').textContent = `${food.calories} cal`;
  document.getElementById('modal-protein').textContent = `P: ${food.protein}g`;
  document.getElementById('modal-carbs').textContent = `C: ${food.carbs}g`;
  document.getElementById('modal-fat').textContent = `F: ${food.fat}g`;
  document.getElementById('serving-qty').value = 1;
  document.getElementById('modal-meal-select').value = selectedMeal;
  servingModal.classList.remove('hidden');
}

document.getElementById('modal-cancel').addEventListener('click', () => {
  servingModal.classList.add('hidden');
  pendingFood = null;
});

servingModal.addEventListener('click', (e) => {
  if (e.target === servingModal) {
    servingModal.classList.add('hidden');
    pendingFood = null;
  }
});

document.getElementById('modal-add').addEventListener('click', () => {
  if (!pendingFood) return;
  const qty = parseFloat(document.getElementById('serving-qty').value) || 1;
  const meal = document.getElementById('modal-meal-select').value;

  const entry = {
    id: Date.now() + Math.random(),
    name: pendingFood.name,
    serving: pendingFood.serving,
    qty,
    calories: round1(pendingFood.calories * qty),
    protein: round1(pendingFood.protein * qty),
    carbs: round1(pendingFood.carbs * qty),
    fat: round1(pendingFood.fat * qty),
    fiber: round1((pendingFood.fiber || 0) * qty),
    sugar: round1((pendingFood.sugar || 0) * qty),
    sodium: round1((pendingFood.sodium || 0) * qty),
    cholesterol: round1((pendingFood.cholesterol || 0) * qty),
  };

  addFoodEntry(meal, entry);
  servingModal.classList.add('hidden');
  pendingFood = null;
  searchInput.value = '';
  searchResults.classList.add('hidden');
  showToast(`Added ${entry.name}`);
});

// ── Custom Food Form ──
customForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const entry = {
    id: Date.now() + Math.random(),
    name: document.getElementById('custom-name').value,
    serving: document.getElementById('custom-serving').value,
    qty: 1,
    calories: parseFloat(document.getElementById('custom-calories').value) || 0,
    protein: parseFloat(document.getElementById('custom-protein').value) || 0,
    carbs: parseFloat(document.getElementById('custom-carbs').value) || 0,
    fat: parseFloat(document.getElementById('custom-fat').value) || 0,
    fiber: parseFloat(document.getElementById('custom-fiber').value) || 0,
    sugar: parseFloat(document.getElementById('custom-sugar').value) || 0,
    sodium: parseFloat(document.getElementById('custom-sodium').value) || 0,
    cholesterol: parseFloat(document.getElementById('custom-cholesterol').value) || 0,
  };
  addFoodEntry(selectedMeal, entry);
  customForm.reset();
  document.getElementById('custom-fiber').value = '0';
  document.getElementById('custom-sugar').value = '0';
  document.getElementById('custom-sodium').value = '0';
  document.getElementById('custom-cholesterol').value = '0';
  showToast(`Added ${entry.name}`);
});

function addFoodEntry(meal, entry) {
  const data = loadDayData(currentDate);
  data[meal].push(entry);
  saveDayData(currentDate, data);
  render();
}

function deleteFoodEntry(meal, id) {
  const data = loadDayData(currentDate);
  data[meal] = data[meal].filter(e => e.id !== id);
  saveDayData(currentDate, data);
  render();
}

// ── Goals ──
goalsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const goals = {
    calories: parseInt(document.getElementById('goal-calories').value) || 2000,
    protein: parseInt(document.getElementById('goal-protein').value) || 150,
    carbs: parseInt(document.getElementById('goal-carbs').value) || 250,
    fat: parseInt(document.getElementById('goal-fat').value) || 65,
    fiber: parseInt(document.getElementById('goal-fiber').value) || 30,
    sugar: parseInt(document.getElementById('goal-sugar').value) || 50,
  };
  saveGoals(goals);
  render();
  showToast('Goals saved!');
});

// Load goals into form
function loadGoalsForm() {
  const goals = loadGoals();
  document.getElementById('goal-calories').value = goals.calories;
  document.getElementById('goal-protein').value = goals.protein;
  document.getElementById('goal-carbs').value = goals.carbs;
  document.getElementById('goal-fat').value = goals.fat;
  document.getElementById('goal-fiber').value = goals.fiber;
  document.getElementById('goal-sugar').value = goals.sugar;
}

// ── Toast ──
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── Render ──
function render() {
  const data = loadDayData(currentDate);
  const goals = loadGoals();

  // Calculate totals
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, cholesterol: 0 };
  const mealTotals = {};

  for (const meal of ['breakfast', 'lunch', 'dinner', 'snacks']) {
    mealTotals[meal] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const entry of data[meal]) {
      totals.calories += entry.calories;
      totals.protein += entry.protein;
      totals.carbs += entry.carbs;
      totals.fat += entry.fat;
      totals.fiber += entry.fiber || 0;
      totals.sugar += entry.sugar || 0;
      totals.sodium += entry.sodium || 0;
      totals.cholesterol += entry.cholesterol || 0;
      mealTotals[meal].calories += entry.calories;
      mealTotals[meal].protein += entry.protein;
      mealTotals[meal].carbs += entry.carbs;
      mealTotals[meal].fat += entry.fat;
    }
  }

  // Round totals
  for (const key in totals) totals[key] = round1(totals[key]);

  // Update progress bars
  updateBar('cal', totals.calories, goals.calories);
  updateBar('protein', totals.protein, goals.protein);
  updateBar('carbs', totals.carbs, goals.carbs);
  updateBar('fat', totals.fat, goals.fat);
  updateBar('fiber', totals.fiber, goals.fiber);
  updateBar('sugar', totals.sugar, goals.sugar);

  // Update circles
  updateCircle('cal', totals.calories, goals.calories);
  updateCircle('protein', totals.protein, goals.protein);
  updateCircle('carbs', totals.carbs, goals.carbs);
  updateCircle('fat', totals.fat, goals.fat);

  // Update food log
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snacks']) {
    const section = document.querySelector(`.meal-section[data-meal="${meal}"]`);
    const itemsDiv = section.querySelector('.meal-items');
    const totalDiv = section.querySelector('.meal-total');

    if (data[meal].length === 0) {
      itemsDiv.innerHTML = '<div class="no-items">No foods logged</div>';
      totalDiv.textContent = '';
    } else {
      itemsDiv.innerHTML = data[meal].map(entry => `
        <div class="food-item">
          <div class="food-item-info">
            <div class="food-item-name">${escapeHtml(entry.name)}</div>
            <div class="food-item-serving">${entry.qty > 1 ? entry.qty + ' x ' : ''}${escapeHtml(entry.serving)}</div>
          </div>
          <div class="food-item-macros">
            <span class="m-cal">${entry.calories} cal</span>
            <span class="m-protein">P: ${entry.protein}g</span>
            <span class="m-carbs">C: ${entry.carbs}g</span>
            <span class="m-fat">F: ${entry.fat}g</span>
          </div>
          <button class="delete-btn" data-meal="${meal}" data-id="${entry.id}" title="Remove">&times;</button>
        </div>
      `).join('');

      totalDiv.textContent = `Total: ${round1(mealTotals[meal].calories)} cal | P: ${round1(mealTotals[meal].protein)}g | C: ${round1(mealTotals[meal].carbs)}g | F: ${round1(mealTotals[meal].fat)}g`;
    }
  }

  // Attach delete handlers
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteFoodEntry(btn.dataset.meal, parseFloat(btn.dataset.id));
    });
  });

  // Update weekly chart
  renderWeeklyChart();
}

function updateBar(id, current, goal) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  document.getElementById(`${id}-bar`).style.width = pct + '%';

  const unit = id === 'cal' ? '' : 'g';
  document.getElementById(`${id}-count`).textContent = `${round1(current)} / ${goal}${unit}`;
}

function updateCircle(id, current, goal) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  document.getElementById(`${id}-circle`).setAttribute('stroke-dasharray', `${pct}, 100`);
  document.getElementById(`${id}-pct`).textContent = Math.round(pct) + '%';
}

// ── Weekly Chart ──
function renderWeeklyChart() {
  const chart = document.getElementById('weekly-chart');
  const goals = loadGoals();
  const days = [];
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const data = loadDayData(dateStr);
    let cal = 0;
    for (const meal of ['breakfast', 'lunch', 'dinner', 'snacks']) {
      for (const entry of data[meal]) cal += entry.calories;
    }
    days.push({ label: dayLabels[d.getDay()], cal, date: dateStr });
  }

  const maxCal = Math.max(goals.calories, ...days.map(d => d.cal), 1);

  chart.innerHTML = days.map(day => {
    const heightPct = (day.cal / maxCal) * 100;
    const isToday = day.date === todayStr();
    const overGoal = day.cal > goals.calories;
    const color = overGoal ? 'var(--danger)' : (isToday ? 'var(--accent)' : 'var(--protein)');
    return `
      <div class="week-day">
        <div class="week-cal-label">${day.cal > 0 ? Math.round(day.cal) : ''}</div>
        <div class="week-bar" style="height: ${Math.max(heightPct, 1)}%; background: ${color};"></div>
        <div class="week-day-label"${isToday ? ' style="color: var(--accent); font-weight: 700;"' : ''}>${day.label}</div>
      </div>
    `;
  }).join('');
}

// ── Init ──
loadGoalsForm();
render();
