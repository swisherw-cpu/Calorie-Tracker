// ═══════════════════════════════════════
// FUEL - Calorie & Macro Tracker
// ═══════════════════════════════════════

const STATE_KEY = 'fuel-tracker-data';
const GOALS_KEY = 'fuel-tracker-goals';

let currentDate = todayStr();
let selectedMeal = 'breakfast';
let pendingFood = null;
let animFrame = null;

const defaultGoals = {
  calories: 2000,
  protein: 180,
  carbs: 200,
  fat: 55,
  fiber: 30,
  sugar: 50,
};

const MACRO_COLORS = {
  calories: '#f97066',
  protein: '#22d3ee',
  carbs: '#facc15',
  fat: '#c084fc',
  fiber: '#4ade80',
  sugar: '#fb7185',
};

// ── Helpers ──
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatNum(n) {
  return n >= 1000 ? n.toLocaleString() : String(Math.round(n * 10) / 10);
}

function round1(n) { return Math.round(n * 10) / 10; }

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
  } catch (e) { console.error('Save error', e); }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const today = todayStr();
  const yesterday = (() => {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  })();

  if (dateStr === today) return 'Today';
  if (dateStr === yesterday) return 'Yesterday';

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// ── DOM Refs ──
const dateInput = document.getElementById('current-date');
const dateDisplay = document.getElementById('date-display');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const servingModal = document.getElementById('serving-modal');
const settingsPanel = document.getElementById('settings-panel');
const toast = document.getElementById('toast');

// ── Date Navigation ──
function setDate(dateStr) {
  currentDate = dateStr;
  dateInput.value = dateStr;
  dateDisplay.textContent = formatDate(dateStr);
  render();
}

setDate(currentDate);

document.getElementById('prev-day').addEventListener('click', () => {
  const d = new Date(currentDate + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  setDate(d.toISOString().slice(0, 10));
});

document.getElementById('next-day').addEventListener('click', () => {
  const d = new Date(currentDate + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  setDate(d.toISOString().slice(0, 10));
});

dateDisplay.addEventListener('click', () => {
  dateInput.showPicker ? dateInput.showPicker() : dateInput.click();
});

dateInput.addEventListener('change', () => setDate(dateInput.value));

// ── Meal Tabs ──
document.querySelectorAll('.meal-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.meal-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMeal = btn.dataset.meal;
  });
});

// ── Settings ──
document.getElementById('settings-toggle').addEventListener('click', () => {
  loadGoalsForm();
  settingsPanel.classList.remove('hidden');
});
document.getElementById('settings-close').addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
});
settingsPanel.addEventListener('click', (e) => {
  if (e.target === settingsPanel) settingsPanel.classList.add('hidden');
});

document.getElementById('goals-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const goals = {
    calories: parseInt(document.getElementById('goal-calories').value) || 2000,
    protein: parseInt(document.getElementById('goal-protein').value) || 180,
    carbs: parseInt(document.getElementById('goal-carbs').value) || 200,
    fat: parseInt(document.getElementById('goal-fat').value) || 55,
    fiber: parseInt(document.getElementById('goal-fiber').value) || 30,
    sugar: parseInt(document.getElementById('goal-sugar').value) || 50,
  };
  saveGoals(goals);
  settingsPanel.classList.add('hidden');
  render();
  showToast('Goals saved');
});

function loadGoalsForm() {
  const g = loadGoals();
  document.getElementById('goal-calories').value = g.calories;
  document.getElementById('goal-protein').value = g.protein;
  document.getElementById('goal-carbs').value = g.carbs;
  document.getElementById('goal-fat').value = g.fat;
  document.getElementById('goal-fiber').value = g.fiber;
  document.getElementById('goal-sugar').value = g.sugar;
}

// ── Custom Food ──
document.getElementById('custom-toggle').addEventListener('click', () => {
  const area = document.getElementById('custom-form-area');
  area.classList.toggle('hidden');
});

document.getElementById('custom-food-form').addEventListener('submit', (e) => {
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
  };
  addFoodEntry(selectedMeal, entry);
  e.target.reset();
  document.getElementById('custom-fiber').value = '0';
  document.getElementById('custom-sugar').value = '0';
  document.getElementById('custom-form-area').classList.add('hidden');
  showToast(`Added ${entry.name}`);
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
        if (name.startsWith(term)) score += 5;
        if (name.includes(' ' + term)) score += 2;
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

  return scored.slice(0, 15).map(r => r.food);
}

function showSearchResults(foods) {
  if (!foods.length) {
    searchResults.innerHTML = '<div class="sr-item"><span class="sr-name" style="color: var(--text-dim)">No results found</span></div>';
    searchResults.classList.remove('hidden');
    return;
  }
  searchResults.innerHTML = foods.map((f, i) => `
    <div class="sr-item" data-index="${i}">
      <div>
        <div class="sr-name">${escapeHtml(f.name)}</div>
        <div class="sr-serving">${escapeHtml(f.serving)}</div>
      </div>
      <div class="sr-right">
        <span class="sr-pro-tag">${f.protein}g P</span>
        <span class="sr-cal">${f.calories}</span>
      </div>
    </div>
  `).join('');
  searchResults.classList.remove('hidden');

  searchResults.querySelectorAll('.sr-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      if (!isNaN(idx)) openServingModal(foods[idx]);
    });
  });
}

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
  }, 150);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    showSearchResults(searchFoods(searchInput.value));
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-container')) {
    searchResults.classList.add('hidden');
  }
});

// ── Serving Modal ──
function openServingModal(food) {
  pendingFood = food;
  document.getElementById('modal-food-name').textContent = food.name;
  document.getElementById('modal-cal').textContent = food.calories;
  document.getElementById('modal-protein').textContent = food.protein + 'g';
  document.getElementById('modal-carbs').textContent = food.carbs + 'g';
  document.getElementById('modal-fat').textContent = food.fat + 'g';
  document.getElementById('modal-serving-desc').textContent = `per ${food.serving}`;
  document.getElementById('serving-qty').value = 1;
  document.getElementById('modal-meal-select').value = selectedMeal;
  servingModal.classList.remove('hidden');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
servingModal.addEventListener('click', (e) => { if (e.target === servingModal) closeModal(); });

function closeModal() {
  servingModal.classList.add('hidden');
  pendingFood = null;
}

document.getElementById('qty-minus').addEventListener('click', () => {
  const inp = document.getElementById('serving-qty');
  const v = Math.max(0.25, parseFloat(inp.value) - 0.25);
  inp.value = v;
});
document.getElementById('qty-plus').addEventListener('click', () => {
  const inp = document.getElementById('serving-qty');
  inp.value = parseFloat(inp.value) + 0.25;
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
  };

  addFoodEntry(meal, entry);
  closeModal();
  searchInput.value = '';
  searchResults.classList.add('hidden');
  showToast(`Added ${entry.name}`);
});

// ── Data Operations ──
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

// ── Toast ──
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// ═══════════════════════════════════════
// CANVAS RING DRAWING
// ═══════════════════════════════════════

function drawRing(canvas, pct, color, lineWidth, bgAlpha) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = parseInt(canvas.getAttribute('width'));

  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size / 2) - lineWidth;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (2 * Math.PI * Math.min(pct, 1));

  // Background track
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.strokeStyle = `rgba(255,255,255,${bgAlpha || 0.06})`;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  if (pct <= 0) return;

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, color);
  grad.addColorStop(1, shiftColor(color, 30));

  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = grad;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Glow
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth + 4;
  ctx.globalAlpha = 0.12;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function shiftColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r},${g},${b})`;
}

// ═══════════════════════════════════════
// RENDER
// ═══════════════════════════════════════

function render() {
  const data = loadDayData(currentDate);
  const goals = loadGoals();

  // Calculate totals
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 };
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
      mealTotals[meal].calories += entry.calories;
      mealTotals[meal].protein += entry.protein;
      mealTotals[meal].carbs += entry.carbs;
      mealTotals[meal].fat += entry.fat;
    }
  }
  for (const k in totals) totals[k] = round1(totals[k]);

  // ── Main Calorie Ring ──
  const calPct = goals.calories > 0 ? totals.calories / goals.calories : 0;
  const ringColor = calPct > 1 ? '#ef4444' : '#818cf8';
  drawRing(document.getElementById('cal-ring'), calPct, ringColor, 12, 0.06);

  document.getElementById('cal-value').textContent = formatNum(totals.calories);
  document.getElementById('cal-goal-label').textContent = goals.calories.toLocaleString();

  const remaining = goals.calories - totals.calories;
  const badge = document.getElementById('remaining-badge');
  const remText = document.getElementById('remaining-text');
  if (remaining >= 0) {
    remText.textContent = `${formatNum(remaining)} remaining`;
    badge.classList.remove('over');
  } else {
    remText.textContent = `${formatNum(Math.abs(remaining))} over`;
    badge.classList.add('over');
  }

  // ── Macro Pills ──
  const macros = ['protein', 'carbs', 'fat', 'fiber', 'sugar'];
  for (const m of macros) {
    const pct = goals[m] > 0 ? totals[m] / goals[m] : 0;
    document.getElementById(`${m}-current`).textContent = formatNum(totals[m]);
    document.getElementById(`${m}-goal-label`).textContent = goals[m];
    document.getElementById(`${m}-pct`).textContent = Math.round(Math.min(pct, 1) * 100) + '%';
  }

  // Draw pill canvases
  document.querySelectorAll('.pill-canvas').forEach(canvas => {
    const macro = canvas.dataset.macro;
    const pct = goals[macro] > 0 ? totals[macro] / goals[macro] : 0;
    drawRing(canvas, pct, MACRO_COLORS[macro], 3.5, 0.08);
  });

  // ── Food Log ──
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snacks']) {
    const block = document.querySelector(`.meal-block[data-meal="${meal}"]`);
    const itemsDiv = block.querySelector('.meal-items');
    const calTotal = document.getElementById(`${meal}-cal-total`);

    if (data[meal].length === 0) {
      itemsDiv.innerHTML = '<div class="no-items">No foods logged</div>';
      calTotal.textContent = '';
    } else {
      calTotal.textContent = `${Math.round(mealTotals[meal].calories)} cal`;
      itemsDiv.innerHTML = data[meal].map(entry => `
        <div class="food-entry">
          <div class="fe-info">
            <div class="fe-name">${escapeHtml(entry.name)}</div>
            <div class="fe-serving">${entry.qty !== 1 ? entry.qty + ' x ' : ''}${escapeHtml(entry.serving)}</div>
          </div>
          <div class="fe-macros">
            <span class="mc">${Math.round(entry.calories)}</span>
            <span class="mp">${round1(entry.protein)}p</span>
            <span class="mk">${round1(entry.carbs)}c</span>
            <span class="mf">${round1(entry.fat)}f</span>
          </div>
          <button class="fe-delete" data-meal="${meal}" data-id="${entry.id}" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('');
    }
  }

  // Delete handlers
  document.querySelectorAll('.fe-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteFoodEntry(btn.dataset.meal, parseFloat(btn.dataset.id));
    });
  });

  // ── Weekly Chart ──
  renderWeeklyChart();
}

// ═══════════════════════════════════════
// WEEKLY CHART
// ═══════════════════════════════════════

function renderWeeklyChart() {
  const chart = document.getElementById('weekly-chart');
  const goals = loadGoals();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const data = loadDayData(dateStr);
    let cal = 0;
    for (const meal of ['breakfast', 'lunch', 'dinner', 'snacks']) {
      for (const entry of data[meal]) cal += entry.calories;
    }
    days.push({ label: dayNames[d.getDay()], cal, date: dateStr });
  }

  const maxCal = Math.max(goals.calories * 1.2, ...days.map(d => d.cal), 1);
  const goalPct = (goals.calories / maxCal) * 100;

  chart.innerHTML = days.map(day => {
    const heightPct = (day.cal / maxCal) * 100;
    const isToday = day.date === todayStr();
    const over = day.cal > goals.calories;
    let barColor;
    if (day.cal === 0) barColor = 'rgba(255,255,255,0.05)';
    else if (over) barColor = 'linear-gradient(180deg, #ef4444, #b91c1c)';
    else if (isToday) barColor = 'linear-gradient(180deg, #818cf8, #6366f1)';
    else barColor = 'linear-gradient(180deg, #22d3ee, #0891b2)';

    return `
      <div class="wk-day">
        <div class="wk-cal">${day.cal > 0 ? Math.round(day.cal) : ''}</div>
        <div class="wk-bar-wrap">
          <div class="wk-bar" style="height: ${Math.max(heightPct, 2)}%; background: ${barColor};"></div>
        </div>
        <div class="wk-label ${isToday ? 'today' : ''}">${day.label}</div>
      </div>
    `;
  }).join('');
}

// ── Init ──
render();
