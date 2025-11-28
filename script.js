// ====== STATE ======
const STORAGE_KEY = "spendingTrackerDataV1";
const LIMIT_KEY = "spendingTrackerMonthlyLimit";
const THEME_KEY = "spendingTrackerTheme";
const INCOME_KEY = "spendingTrackerMonthlyIncome";

let expenses = [];
let monthlyLimit = null;
let monthlyIncome = null;

let dailyChart = null;
let categoryChart = null;

// Selected month/year for filter (month is 0-11)
let selectedMonth = null;
let selectedYear = null;

// Category filter
let selectedCategory = "__all__";

// ====== HELPERS ======
function formatCurrency(amount) {
  if (isNaN(amount) || amount === null) return "₹0";
  return "₹" + amount.toFixed(0);
}

function getTodayISO() {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  const localISO = new Date(d.getTime() - tzOffset).toISOString();
  return localISO.slice(0, 10);
}

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getSelectedMonthYear() {
  const now = new Date();
  const month = selectedMonth !== null ? selectedMonth : now.getMonth();
  const year = selectedYear !== null ? selectedYear : now.getFullYear();
  return { month, year };
}

function getMonthYearFromDateStr(dateStr) {
  const d = parseDate(dateStr);
  return { month: d.getMonth(), year: d.getFullYear() };
}

function getStatsForMonthYear(month, year) {
  const todayISO = getTodayISO();
  let todayTotal = 0;
  let monthTotal = 0;
  let overallTotal = 0;

  const categoryTotals = {};

  for (const exp of expenses) {
    const amt = Number(exp.amount) || 0;
    overallTotal += amt;

    if (exp.date === todayISO) {
      todayTotal += amt;
    }

    const d = parseDate(exp.date);
    if (d.getMonth() === month && d.getFullYear() === year) {
      monthTotal += amt;
      categoryTotals[exp.category] =
        (categoryTotals[exp.category] || 0) + amt;
    }
  }

  return {
    todayTotal,
    monthTotal,
    overallTotal,
    categoryTotals,
  };
}

function getStats() {
  const { month, year } = getSelectedMonthYear();
  return getStatsForMonthYear(month, year);
}

function getMonthName(dateObj) {
  return dateObj.toLocaleString("default", { month: "long", year: "numeric" });
}

function showToast(message, isDanger = false) {
  const toast = document.getElementById("toast");
  const messageSpan = document.getElementById("toastMessage");
  messageSpan.textContent = message;
  if (isDanger) {
    toast.classList.add("toast-danger");
  } else {
    toast.classList.remove("toast-danger");
  }
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  if (monthlyLimit !== null) {
    localStorage.setItem(LIMIT_KEY, String(monthlyLimit));
  }
  if (monthlyIncome !== null) {
    localStorage.setItem(INCOME_KEY, String(monthlyIncome));
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      expenses = JSON.parse(raw);
    }
    const limitRaw = localStorage.getItem(LIMIT_KEY);
    if (limitRaw !== null) {
      monthlyLimit = parseFloat(limitRaw);
      if (isNaN(monthlyLimit)) monthlyLimit = null;
    }
    const incomeRaw = localStorage.getItem(INCOME_KEY);
    if (incomeRaw !== null) {
      monthlyIncome = parseFloat(incomeRaw);
      if (isNaN(monthlyIncome)) monthlyIncome = null;
    }
  } catch (e) {
    console.error("Failed to load storage", e);
  }
}

function applyTheme(theme) {
  const body = document.body;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  const iconSpan = document.getElementById("themeToggleIcon");

  if (theme === "light") {
    body.classList.add("light");
    if (metaTheme) metaTheme.setAttribute("content", "#f3f4f6");
    if (iconSpan) iconSpan.textContent = "🌙";
  } else {
    body.classList.remove("light");
    if (metaTheme) metaTheme.setAttribute("content", "#020617");
    if (iconSpan) iconSpan.textContent = "☀️";
  }
  localStorage.setItem(THEME_KEY, theme);
}

function updateCategoryFilterOptions() {
  const select = document.getElementById("categoryFilter");
  if (!select) return;

  const previous = selectedCategory || "__all__";

  const categories = Array.from(
    new Set(expenses.map((e) => e.category).filter(Boolean))
  ).sort();

  select.innerHTML = "";
  const allOpt = document.createElement("option");
  allOpt.value = "__all__";
  allOpt.textContent = "All";
  select.appendChild(allOpt);

  for (const cat of categories) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  }

  if (categories.includes(previous)) {
    select.value = previous;
    selectedCategory = previous;
  } else {
    select.value = "__all__";
    selectedCategory = "__all__";
  }
}

// ====== RENDER FUNCTIONS ======
function renderSummary() {
  const stats = getStats();
  const { month, year } = getSelectedMonthYear();

  document.getElementById("todayTotal").textContent = formatCurrency(
    stats.todayTotal
  );
  document.getElementById("monthTotal").textContent = formatCurrency(
    stats.monthTotal
  );
  document.getElementById("overallTotal").textContent = formatCurrency(
    stats.overallTotal
  );
  document.getElementById("totalEntriesLabel").textContent =
    expenses.length + (expenses.length === 1 ? " entry logged" : " entries logged");

  const dateForLabel = new Date(year, month, 1);
  document.getElementById("monthNameLabel").textContent =
    getMonthName(dateForLabel);

  // Limit banner
  const limitBanner = document.getElementById("limitBanner");
  const limitText = document.getElementById("limitText");

  if (monthlyLimit === null) {
    limitBanner.classList.remove("warning");
    limitText.textContent = "Not set";
  } else {
    const usedPercent = Math.round(
      (stats.monthTotal / monthlyLimit) * 100 || 0
    );
    limitText.textContent =
      formatCurrency(monthlyLimit) + " · " + usedPercent + "% used";

    if (stats.monthTotal > monthlyLimit) {
      limitBanner.classList.add("warning");
    } else {
      limitBanner.classList.remove("warning");
    }
  }

  // Balance card
  const balanceAmountEl = document.getElementById("balanceAmount");
  const incomeChip = document.getElementById("incomeChip");
  const spentChip = document.getElementById("spentChip");

  spentChip.textContent = "Spent: " + formatCurrency(stats.monthTotal);

  balanceAmountEl.classList.remove("summary-accent", "summary-danger");

  if (monthlyIncome === null) {
    incomeChip.textContent = "Income: Not set";
    balanceAmountEl.textContent = "₹0";
  } else {
    incomeChip.textContent = "Income: " + formatCurrency(monthlyIncome);
    const balance = (monthlyIncome || 0) - stats.monthTotal;
    balanceAmountEl.textContent = formatCurrency(balance);
    if (balance >= 0) {
      balanceAmountEl.classList.add("summary-accent");
    } else {
      balanceAmountEl.classList.add("summary-danger");
    }
  }
}

function renderCategoryList(categoryTotals, monthTotalForPercent) {
  const container = document.getElementById("categoryList");
  container.innerHTML = "";

  const entries = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1]
  );

  if (entries.length === 0) {
    container.innerHTML =
      '<div class="empty-state" style="padding:8px 0;">No spending in this view yet.</div>';
    return;
  }

  const totalForPercent = monthTotalForPercent || 1;

  for (const [cat, total] of entries) {
    const row = document.createElement("div");
    row.className = "category-row";

    const left = document.createElement("span");
    const dot = document.createElement("span");
    dot.className = "dot-category";
    left.appendChild(dot);
    const text = document.createElement("span");
    text.textContent = cat;
    left.appendChild(text);
    row.appendChild(left);

    const right = document.createElement("span");
    right.className = "category-amount";
    const percent = Math.round((total / totalForPercent) * 100);
    right.textContent = formatCurrency(total) + " · " + percent + "%";
    row.appendChild(right);

    container.appendChild(row);
  }
}

function renderTransactions() {
  const emptyState = document.getElementById("emptyState");
  const table = document.getElementById("transactionsTable");
  const tbody = document.getElementById("transactionsBody");

  if (expenses.length === 0) {
    emptyState.textContent = "No expenses yet. Add your first one above ✨";
    emptyState.style.display = "block";
    table.style.display = "none";
    return;
  }

  const filtered =
    selectedCategory === "__all__"
      ? expenses
      : expenses.filter((e) => e.category === selectedCategory);

  if (filtered.length === 0) {
    emptyState.textContent = "No expenses yet for this category.";
    emptyState.style.display = "block";
    table.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  table.style.display = "table";

  const sorted = [...filtered].sort((a, b) => {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return b.id - a.id;
  });

  tbody.innerHTML = "";
  for (const exp of sorted) {
    const tr = document.createElement("tr");

    const d = document.createElement("td");
    d.textContent = exp.date;
    tr.appendChild(d);

    const c = document.createElement("td");
    c.textContent = exp.category;
    tr.appendChild(c);

    const n = document.createElement("td");
    n.textContent = exp.note || "-";
    n.className = "note-cell";
    tr.appendChild(n);

    const a = document.createElement("td");
    a.textContent = formatCurrency(Number(exp.amount) || 0);
    a.className = "amount-cell";
    tr.appendChild(a);

    const actionTd = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "delete-btn";
    delBtn.onclick = () => deleteExpense(exp.id);
    actionTd.appendChild(delBtn);
    tr.appendChild(actionTd);

    tbody.appendChild(tr);
  }
}

function updateCharts() {
  const stats = getStats();
  const { month, year } = getSelectedMonthYear();

  // label for category filter
  const categoryFilterLabel = document.getElementById("categoryFilterLabel");
  if (selectedCategory === "__all__") {
    categoryFilterLabel.textContent = "· all categories";
  } else {
    categoryFilterLabel.textContent = "· " + selectedCategory;
  }

  // --- Daily chart for selected month (respect category filter) ---
  const labels = [];
  const data = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    labels.push(String(day));
    const dateStr =
      year +
      "-" +
      String(month + 1).padStart(2, "0") +
      "-" +
      String(day).padStart(2, "0");

    let totalForDay = 0;
    for (const exp of expenses) {
      if (
        exp.date === dateStr &&
        (selectedCategory === "__all__" ||
          exp.category === selectedCategory)
      ) {
        totalForDay += Number(exp.amount) || 0;
      }
    }
    data.push(totalForDay);
  }

  const ctxDaily = document.getElementById("dailyChart").getContext("2d");
  if (dailyChart) dailyChart.destroy();
  dailyChart = new Chart(ctxDaily, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { font: { size: 10 } },
          grid: { display: false },
        },
        y: {
          ticks: { font: { size: 10 } },
          grid: { display: true },
        },
      },
      plugins: {
        legend: { display: false },
      },
    },
  });

  // --- Category chart (doughnut) for selected month (respect category filter) ---
  let categoryTotalsForView;
  if (selectedCategory === "__all__") {
    categoryTotalsForView = stats.categoryTotals;
  } else {
    const total = stats.categoryTotals[selectedCategory] || 0;
    categoryTotalsForView = total ? { [selectedCategory]: total } : {};
  }

  const categoryEntries = Object.entries(categoryTotalsForView);
  const catLabels = categoryEntries.map(([cat]) => cat);
  const catData = categoryEntries.map(([, val]) => val);

  const ctxCategory = document
    .getElementById("categoryChart")
    .getContext("2d");
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(ctxCategory, {
    type: "doughnut",
    data: {
      labels: catLabels,
      datasets: [
        {
          data: catData,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      cutout: "60%",
    },
  });

  const monthTotalForPercent =
    selectedCategory === "__all__"
      ? stats.monthTotal
      : categoryEntries.length
      ? categoryEntries[0][1]
      : 0;

  renderCategoryList(categoryTotalsForView, monthTotalForPercent);
}

function refreshUI() {
  updateCategoryFilterOptions();
  renderSummary();
  renderTransactions();
  updateCharts();
}

// ====== CRUD ======
function addExpense({ amount, date, category, note }) {
  const id = Date.now();
  expenses.push({ id, amount, date, category, note });
  saveToStorage();

  // Move filter to that expense's month
  const { month, year } = getMonthYearFromDateStr(date);
  selectedMonth = month;
  selectedYear = year;

  const monthFilter = document.getElementById("monthFilter");
  if (monthFilter) {
    const ym = year + "-" + String(month + 1).padStart(2, "0");
    monthFilter.value = ym;
  }

  refreshUI();

  // Limit & income checks for that month
  const statsForExpenseMonth = getStatsForMonthYear(month, year);

  let warningMsg = null;
  if (monthlyLimit !== null && statsForExpenseMonth.monthTotal > monthlyLimit) {
    warningMsg =
      "You crossed your monthly limit of " + formatCurrency(monthlyLimit);
  }
  if (monthlyIncome !== null && statsForExpenseMonth.monthTotal > monthlyIncome) {
    const incomePart =
      "your income (" + formatCurrency(monthlyIncome) + ")";
    if (warningMsg) {
      warningMsg += " and " + incomePart;
    } else {
      warningMsg = "You crossed " + incomePart;
    }
  }

  if (warningMsg) {
    showToast(warningMsg, true);
  } else {
    showToast("Expense added");
  }
}

function deleteExpense(id) {
  expenses = expenses.filter((e) => e.id !== id);
  saveToStorage();
  refreshUI();
  showToast("Expense deleted");
}

function clearAllExpenses() {
  if (!confirm("Clear all expenses? This cannot be undone.")) return;
  expenses = [];
  saveToStorage();
  refreshUI();
  showToast("All expenses cleared");
}

function promptForLimit() {
  let input = prompt(
    "Enter monthly spending limit in ₹:",
    monthlyLimit !== null ? monthlyLimit : ""
  );
  if (input === null) return;
  input = input.trim();
  if (!input) {
    monthlyLimit = null;
  } else {
    const value = parseFloat(input);
    if (isNaN(value) || value < 0) {
      showToast("Invalid amount", true);
      return;
    }
    monthlyLimit = value;
  }
  saveToStorage();
  refreshUI();
  showToast("Monthly limit updated");
}

function promptForIncome() {
  let input = prompt(
    "Enter monthly income / budget in ₹ (used for balance):",
    monthlyIncome !== null ? monthlyIncome : ""
  );
  if (input === null) return;
  input = input.trim();
  if (!input) {
    monthlyIncome = null;
  } else {
    const value = parseFloat(input);
    if (isNaN(value) || value < 0) {
      showToast("Invalid amount", true);
      return;
    }
    monthlyIncome = value;
  }
  saveToStorage();
  refreshUI();
  showToast("Monthly income updated");
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    monthlyLimit,
    monthlyIncome,
    expenses,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "spending-tracker-data.json";
  a.click();
  URL.revokeObjectURL(url);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("/MoneyMap/sw.js")
      .catch((err) =>
        console.log("Service worker registration failed:", err)
      );
  }
}
// ====== EVENT BINDING ======
function setupEventListeners() {
  const form = document.getElementById("expenseForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const amountInput = document.getElementById("amount");
    const dateInput = document.getElementById("date");
    const categorySelect = document.getElementById("category");
    const noteInput = document.getElementById("note");

    const amount = parseFloat(amountInput.value);
    const date = dateInput.value;
    const category = categorySelect.value;
    const note = noteInput.value.trim();

    if (isNaN(amount) || amount <= 0) {
      showToast("Enter a valid amount", true);
      return;
    }
    if (!date) {
      showToast("Select a date", true);
      return;
    }
    if (!category) {
      showToast("Choose a category", true);
      return;
    }

    addExpense({ amount, date, category, note });

    amountInput.value = "";
    noteInput.value = "";
  });

  document.getElementById("fillTodayBtn").addEventListener("click", () => {
    document.getElementById("date").value = getTodayISO();
  });

  document.getElementById("setLimitBtn").addEventListener("click", () => {
    promptForLimit();
  });

  document.getElementById("clearAllBtn").addEventListener("click", () => {
    clearAllExpenses();
  });

  document.getElementById("exportBtn").addEventListener("click", () => {
    exportData();
  });

  const monthFilter = document.getElementById("monthFilter");
  if (monthFilter) {
    monthFilter.addEventListener("change", (e) => {
      const value = e.target.value; // "YYYY-MM"
      if (!value) return;
      const [yStr, mStr] = value.split("-");
      const year = parseInt(yStr, 10);
      const month = parseInt(mStr, 10) - 1;
      if (isNaN(year) || isNaN(month)) return;
      selectedYear = year;
      selectedMonth = month;
      refreshUI();
    });
  }

  const categoryFilter = document.getElementById("categoryFilter");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", (e) => {
      selectedCategory = e.target.value || "__all__";
      refreshUI();
    });
  }

  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const isLight = document.body.classList.contains("light");
      applyTheme(isLight ? "dark" : "light");
    });
  }

  const setIncomeLink = document.getElementById("setIncomeLink");
  if (setIncomeLink) {
    setIncomeLink.addEventListener("click", () => {
      promptForIncome();
    });
  }
}

// ====== INIT ======
function init() {
  const today = new Date();
  document.getElementById("todayLabel").textContent =
    today.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

  document.getElementById("date").value = getTodayISO();

  // Initialize month filter to current month
  const now = new Date();
  selectedMonth = now.getMonth();
  selectedYear = now.getFullYear();
  const monthFilter = document.getElementById("monthFilter");
  if (monthFilter) {
    const ym =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0");
    monthFilter.value = ym;
  }

  loadFromStorage();
  setupEventListeners();

  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(savedTheme);

  refreshUI();
  registerServiceWorker();
}

document.addEventListener("DOMContentLoaded", init);

