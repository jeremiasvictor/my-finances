// ─────────────────────────────────────────────────────────────────────────────
// js/ui.js  –  DOM rendering helpers
// ─────────────────────────────────────────────────────────────────────────────

import { FIXED_CATS, VARIABLE_CATS, INCOME_CATS, getCat } from "./categories.js";
import { getState, selectTotals, selectFixedBills, selectOtherTxs } from "./state.js";

const MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export const fmt = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

function el(tag, cls = "", inner = "") {
  const e = document.createElement(tag);
  if (cls)   e.className = cls;
  if (inner) e.innerHTML = inner;
  return e;
}

function mask(val) {
  return getState().hideAmounts ? "••••••" : val;
}

// ── Month picker ──────────────────────────────────────────────────────────────

export function renderMonthPicker(month, year, onPrev, onNext) {
  const wrap = document.getElementById("month-picker");
  if (!wrap) return;
  wrap.innerHTML = `
    <button id="btn-prev-month" class="nav-arrow" aria-label="Mês anterior">
      <i data-lucide="chevron-left"></i>
    </button>
    <div class="month-label">
      <span class="month-name">${MONTHS[month]} ${year}</span>
      <span class="month-sub" id="tx-count"></span>
    </div>
    <button id="btn-next-month" class="nav-arrow" aria-label="Próximo mês">
      <i data-lucide="chevron-right"></i>
    </button>`;
  document.getElementById("btn-prev-month").addEventListener("click", onPrev);
  document.getElementById("btn-next-month").addEventListener("click", onNext);
  if (window.lucide) lucide.createIcons();
}

export function updateTxCount(count) {
  const el = document.getElementById("tx-count");
  if (el) el.textContent = `${count} lançamento${count !== 1 ? "s" : ""}`;
}

// ── Summary cards ──────────────────────────────────────────────────────────────

export function renderSummary(txs) {
  const { income, fixed, variable, expenses, balance } = selectTotals(txs);
  const isPos = balance >= 0;
  const pct   = income > 0 ? Math.abs(Math.round((balance / income) * 100)) : null;

  // Balance
  const balEl = document.getElementById("card-balance");
  if (balEl) {
    balEl.innerHTML = `
      <div class="card-row-between">
        <div>
          <p class="card-label">Saldo do Mês</p>
          <p class="card-value ${isPos ? "lime" : "red"}" id="val-balance">${mask(fmt(balance))}</p>
        </div>
        <div class="badge ${isPos ? "badge-lime" : "badge-red"}">
          <i data-lucide="${isPos ? "trending-up" : "trending-down"}"></i>
          <span>${pct !== null ? pct + "%" : "--"}</span>
        </div>
      </div>`;
  }

  // Income
  const incEl = document.getElementById("card-income");
  if (incEl) {
    incEl.innerHTML = `
      <i data-lucide="trending-up" class="card-icon lime"></i>
      <p class="card-label">Receitas</p>
      <p class="card-value white" id="val-income">${mask(fmt(income))}</p>`;
  }

  // Expenses
  const expEl = document.getElementById("card-expenses");
  if (expEl) {
    expEl.innerHTML = `
      <i data-lucide="trending-down" class="card-icon purple"></i>
      <p class="card-label">Despesas</p>
      <p class="card-value white" id="val-expenses">${mask(fmt(expenses))}</p>
      <div class="expense-split">
        <span class="split-fixed">Fixas: ${mask(fmt(fixed))}</span>
        <span class="split-var">Variáveis: ${mask(fmt(variable))}</span>
      </div>`;
  }

  if (window.lucide) lucide.createIcons();
}

// ── Fixed bills checklist ─────────────────────────────────────────────────────

export function renderChecklist(txs, onToggle, onDelete) {
  const bills = selectFixedBills(txs);
  const list  = document.getElementById("checklist-items");
  const badge = document.getElementById("bills-badge");
  if (!list) return;

  if (badge) badge.textContent = `${bills.filter((b) => b.isPaid).length}/${bills.length} pagas`;

  if (bills.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i data-lucide="target" style="opacity:.3"></i>
        <p>Nenhuma conta fixa cadastrada</p>
        <small>Clique em + para adicionar</small>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  list.innerHTML = bills.map((tx) => {
    const cat   = getCat(tx.categoryId);
    const label = tx.customLabel || cat.label;
    return `
      <div class="bill-row ${tx.isPaid ? "paid" : ""}" data-id="${tx.id}">
        <div class="bill-icon ${tx.isPaid ? "dimmed" : ""}">
          <i data-lucide="${cat.icon}"></i>
        </div>
        <div class="bill-info">
          <p class="bill-name">${label}${tx.description ? ` · ${tx.description}` : ""}</p>
          ${tx.dueDay ? `<p class="bill-due">Vence dia ${tx.dueDay}</p>` : ""}
        </div>
        <p class="bill-amount ${tx.isPaid ? "dimmed" : ""}">${mask(fmt(tx.amount))}</p>
        <button class="check-btn ${tx.isPaid ? "checked" : ""}" data-action="toggle" title="Marcar como paga">
          ${tx.isPaid ? '<i data-lucide="check"></i>' : '<span class="check-inner"></span>'}
        </button>
        <button class="delete-btn" data-action="delete" title="Excluir">
          <i data-lucide="trash-2"></i>
        </button>
      </div>`;
  }).join("");

  // Delegate events
  list.addEventListener("click", (e) => {
    const row = e.target.closest("[data-action]");
    if (!row) return;
    const id  = row.closest(".bill-row").dataset.id;
    const tx  = bills.find((b) => b.id === id);
    if (!tx) return;
    if (row.dataset.action === "toggle") onToggle(tx);
    if (row.dataset.action === "delete") onDelete(tx.id);
  });

  if (window.lucide) lucide.createIcons();
}

// ── Other transactions list ───────────────────────────────────────────────────

export function renderOtherTxs(txs, onDelete) {
  const others = selectOtherTxs(txs);
  const list   = document.getElementById("other-txs");
  if (!list) return;

  const section = document.getElementById("other-section");
  if (section) section.style.display = others.length ? "flex" : "none";

  list.innerHTML = others.map((tx) => {
    const cat     = getCat(tx.categoryId);
    const label   = tx.customLabel || cat.label;
    const isIncome = tx.type === "income";
    return `
      <div class="tx-row" data-id="${tx.id}">
        <div class="tx-icon ${isIncome ? "income" : ""}">
          <i data-lucide="${cat.icon}"></i>
        </div>
        <div class="tx-info">
          <p class="tx-name">${label}${tx.description ? ` · ${tx.description}` : ""}</p>
          ${tx.dueDay ? `<p class="tx-due">Dia ${tx.dueDay}</p>` : ""}
        </div>
        <p class="tx-amount ${isIncome ? "lime" : "white"}">
          ${isIncome ? "+" : "-"}${mask(fmt(tx.amount))}
        </p>
        <button class="delete-btn" title="Excluir" data-id="${tx.id}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>`;
  }).join("");

  list.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => onDelete(btn.dataset.id));
  });

  if (window.lucide) lucide.createIcons();
}

// ── Donut legend ───────────────────────────────────────────────────────────────

export function renderDonutLegend(fixed, variable) {
  const total = fixed + variable;
  const pFixed = total > 0 ? Math.round((fixed / total) * 100) : 0;
  const pVar   = total > 0 ? Math.round((variable / total) * 100) : 0;

  const leg = document.getElementById("donut-legend");
  if (!leg) return;
  leg.innerHTML = `
    <div class="legend-item">
      <span class="dot purple"></span>
      <span>Fixas <strong>${pFixed}%</strong></span>
    </div>
    <div class="legend-item">
      <span class="dot lime"></span>
      <span>Variáveis <strong>${pVar}%</strong></span>
    </div>`;
}

// ── Loading overlay ────────────────────────────────────────────────────────────

export function setLoading(active) {
  const ov = document.getElementById("loading-overlay");
  if (ov) ov.style.display = active ? "flex" : "none";
}

// ── Toast ──────────────────────────────────────────────────────────────────────

export function toast(msg, type = "success") {
  const id = "toast-" + Date.now();
  const t  = el("div", `toast toast-${type}`, msg);
  t.id = id;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 2800);
}
