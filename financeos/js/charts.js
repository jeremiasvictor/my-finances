// ─────────────────────────────────────────────────────────────────────────────
// js/charts.js  –  Chart.js donut + liquidity line chart
// ─────────────────────────────────────────────────────────────────────────────

let donutChart    = null;
let liquidityChart = null;

const LIME   = "#D4FF3F";
const PURPLE = "#A855F7";
const GRID   = "rgba(255,255,255,0.04)";
const TICK   = "rgba(255,255,255,0.25)";

// ── Donut ─────────────────────────────────────────────────────────────────────

export function renderDonut(canvasId, fixed, variable) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const total = fixed + variable;
  const data  = total > 0
    ? [fixed, variable]
    : [1, 0];   // placeholder ring when empty

  const colors = total > 0
    ? [PURPLE, LIME]
    : ["rgba(255,255,255,0.06)", "transparent"];

  if (donutChart) donutChart.destroy();

  donutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels:   ["Fixas", "Variáveis"],
      datasets: [{
        data,
        backgroundColor:  colors,
        borderWidth:      0,
        hoverOffset:      6,
        borderRadius:     4,
      }],
    },
    options: {
      cutout:  "72%",
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: total > 0,
          callbacks: {
            label: (ctx) => ` ${fmt(ctx.raw)}`,
          },
          backgroundColor: "rgba(10,10,10,0.9)",
          borderColor:     "rgba(255,255,255,0.08)",
          borderWidth:     1,
          titleColor:      "rgba(255,255,255,0.5)",
          bodyColor:       LIME,
          padding:         10,
          cornerRadius:    12,
        },
      },
      animation: { duration: 600, easing: "easeInOutQuart" },
    },
  });
}

// ── Liquidity Line ─────────────────────────────────────────────────────────────

/**
 * Builds a day-by-day running balance for the month
 * using due_day on expenses and income entries.
 * If an income has no dueDay the canonical pay dates (3, 15, 20) are used.
 */
export function renderLiquidityChart(canvasId, transactions) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
  const PAY_DAYS = [3, 15, 20];   // default income spikes

  // Build per-day income / expense maps
  const incomeByDay  = {};
  const expenseByDay = {};

  for (const t of transactions) {
    if (t.type === "income") {
      const days = t.dueDay ? [t.dueDay] : PAY_DAYS;
      const share = t.amount / days.length;
      days.forEach((d) => { incomeByDay[d]  = (incomeByDay[d]  || 0) + share; });
    } else {
      if (t.dueDay) expenseByDay[t.dueDay] = (expenseByDay[t.dueDay] || 0) + t.amount;
    }
  }

  let running = 0;
  const points = DAYS.map((day) => {
    running += (incomeByDay[day] || 0) - (expenseByDay[day] || 0);
    return { x: day, y: running };
  });

  const isPositive = points[points.length - 1].y >= 0;

  if (liquidityChart) liquidityChart.destroy();

  liquidityChart = new Chart(ctx, {
    type: "line",
    data: {
      labels:   DAYS,
      datasets: [{
        label:           "Saldo",
        data:            points.map((p) => p.y),
        borderColor:     isPositive ? LIME : "#ff6b6b",
        backgroundColor: isPositive
          ? "rgba(212,255,63,0.06)"
          : "rgba(255,107,107,0.06)",
        borderWidth:     2,
        pointRadius:     0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: isPositive ? LIME : "#ff6b6b",
        fill:            true,
        tension:         0.45,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: {
          grid:  { color: GRID },
          ticks: { color: TICK, font: { size: 10 }, maxTicksLimit: 8 },
        },
        y: {
          grid:  { color: GRID },
          ticks: {
            color: TICK, font: { size: 10 },
            callback: (v) => fmtShort(v),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10,10,10,0.92)",
          borderColor:     "rgba(255,255,255,0.08)",
          borderWidth:     1,
          titleColor:      "rgba(255,255,255,0.45)",
          bodyColor:       LIME,
          padding:         10,
          cornerRadius:    12,
          callbacks: {
            title:  (items) => `Dia ${items[0].label}`,
            label:  (item)  => ` ${fmt(item.raw)}`,
          },
        },
      },
      animation: { duration: 700, easing: "easeInOutQuart" },
    },
  });
}

// ── Format helpers (local, no import needed) ──────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const fmtShort = (n) => {
  if (Math.abs(n) >= 1000) return `R$${(n / 1000).toFixed(1)}k`;
  return `R$${Math.round(n)}`;
};
