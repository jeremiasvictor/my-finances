// ─────────────────────────────────────────────────────────────────────────────
// js/ui.js  –  DOM rendering helpers
// ─────────────────────────────────────────────────────────────────────────────

import { getCat } from "./categories.js";
import {
  getState,
  selectTotals,
  selectFixedBills,
  selectOtherTxs,
} from "./state.js";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export const fmt = (n) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n || 0,
  );

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
  const pct =
    income > 0 ? Math.abs(Math.round((balance / income) * 100)) : null;

  const balEl = document.getElementById("card-balance");
  if (balEl) {
    balEl.innerHTML = `
      <div class="card-row-between">
        <div>
          <p class="card-label">Saldo do Mês</p>
          <p class="card-value ${isPos ? "lime" : "red"}">${mask(fmt(balance))}</p>
        </div>
        <div class="badge ${isPos ? "badge-lime" : "badge-red"}">
          <i data-lucide="${isPos ? "trending-up" : "trending-down"}"></i>
          <span>${pct !== null ? pct + "%" : "--"}</span>
        </div>
      </div>`;
  }

  const incEl = document.getElementById("card-income");
  if (incEl) {
    incEl.innerHTML = `
      <i data-lucide="trending-up" class="card-icon lime"></i>
      <p class="card-label">Receitas</p>
      <p class="card-value white">${mask(fmt(income))}</p>`;
  }

  const expEl = document.getElementById("card-expenses");
  if (expEl) {
    expEl.innerHTML = `
      <i data-lucide="trending-down" class="card-icon purple"></i>
      <p class="card-label">Despesas</p>
      <p class="card-value white">${mask(fmt(expenses))}</p>
      <div class="expense-split">
        <span class="split-fixed">Fixas: ${mask(fmt(fixed))}</span>
        <span class="split-var">Variáveis: ${mask(fmt(variable))}</span>
      </div>`;
  }

  if (window.lucide) lucide.createIcons();
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST WITH UNDO
// Shows a toast immediately; calls onUndo if user taps "Desfazer" within 4s.
// Returns a Promise that resolves to true (confirmed) or false (undone).
// ─────────────────────────────────────────────────────────────────────────────

export function toastWithUndo(msg, onUndo) {
  // Remove any existing undo toasts to avoid stacking
  document.querySelectorAll(".toast-undo-wrap").forEach((t) => t.remove());

  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "toast toast-undo-wrap show";
    wrap.innerHTML = `
      <span class="toast-msg">${msg}</span>
      <button class="toast-undo-btn">Desfazer</button>`;
    document.body.appendChild(wrap);

    let undone = false;

    const undoBtn = wrap.querySelector(".toast-undo-btn");
    undoBtn.addEventListener("click", () => {
      undone = true;
      dismiss();
      onUndo();
      resolve(false);
    });

    const timer = setTimeout(() => {
      if (!undone) resolve(true);
      dismiss();
    }, 4000);

    function dismiss() {
      clearTimeout(timer);
      wrap.classList.remove("show");
      setTimeout(() => wrap.remove(), 300);
    }
  });
}

export function toast(msg, type = "success") {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLIST  (Fixed bills)
//
// FIX: listeners are attached ONCE to the static parent containers
// in initChecklistListeners(). renderChecklist only swaps innerHTML.
// ─────────────────────────────────────────────────────────────────────────────

// Callbacks stored at module level so delegation always calls the latest version
const _cb = {
  toggle: null,
  edit: null,
  delete: null,
  bulkDelete: null,
};

// Selected IDs for bulk delete
const _selected = new Set();

/** Call once on app boot to attach permanent delegated listeners. */
export function initChecklistListeners() {
  const list = document.getElementById("checklist-items");
  const bulkBar = document.getElementById("bulk-bar");
  const bulkCount = document.getElementById("bulk-count");
  const bulkDel = document.getElementById("btn-bulk-delete");

  if (!list) return;

  // Single delegated listener on the list container
  list.addEventListener("click", (e) => {
    // ── Checkbox (select row) ─────────────────────────────────────────────
    const cb = e.target.closest(".row-checkbox");
    if (cb) {
      const id = cb.closest(".bill-row").dataset.id;
      if (cb.checked) _selected.add(id);
      else _selected.delete(id);
      _updateBulkBar(bulkBar, bulkCount);
      return;
    }

    // ── Action buttons ────────────────────────────────────────────────────
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.closest(".bill-row")?.dataset.id;
    if (!id) return;

    if (btn.dataset.action === "toggle" && _cb.toggle) _cb.toggle(id);
    if (btn.dataset.action === "edit" && _cb.edit) _cb.edit(id);
    if (btn.dataset.action === "delete" && _cb.delete) _cb.delete(id);
  });

  // Bulk delete button
  if (bulkDel) {
    bulkDel.addEventListener("click", () => {
      if (_cb.bulkDelete) _cb.bulkDelete([..._selected]);
      _selected.clear();
      _updateBulkBar(bulkBar, bulkCount);
    });
  }

  // Cancel bulk selection
  document.getElementById("btn-bulk-cancel")?.addEventListener("click", () => {
    _selected.clear();
    _updateBulkBar(bulkBar, bulkCount);
    // Uncheck all checkboxes
    list.querySelectorAll(".row-checkbox").forEach((c) => {
      c.checked = false;
    });
  });
}

function _updateBulkBar(bar, countEl) {
  if (!bar) return;
  const count = _selected.size;
  bar.style.display = count > 0 ? "flex" : "none";
  if (countEl)
    countEl.textContent = `${count} selecionada${count !== 1 ? "s" : ""}`;
}

export function renderChecklist(txs, callbacks) {
  // Update module-level callbacks
  Object.assign(_cb, callbacks);

  const bills = selectFixedBills(txs);
  const list = document.getElementById("checklist-items");
  const badge = document.getElementById("bills-badge");
  if (!list) return;

  // Keep only valid selected IDs
  const validIds = new Set(bills.map((b) => b.id));
  [..._selected].forEach((id) => {
    if (!validIds.has(id)) _selected.delete(id);
  });

  if (badge)
    badge.textContent = `${bills.filter((b) => b.isPaid).length}/${bills.length} pagas`;

  if (bills.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i data-lucide="target" style="opacity:.3"></i>
        <p>Nenhuma conta fixa cadastrada</p>
        <small>Clique em "Nova fixa" para adicionar</small>
      </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  list.innerHTML = bills
    .map((tx) => {
      const cat = getCat(tx.categoryId);
      const label = tx.customLabel || cat.label;
      const checked = _selected.has(tx.id);
      return `
      <div class="bill-row ${tx.isPaid ? "paid" : ""} ${checked ? "selected" : ""}" data-id="${tx.id}">
        <label class="row-select-wrap" title="Selecionar">
          <input type="checkbox" class="row-checkbox" ${checked ? "checked" : ""} />
        </label>
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
        <button class="edit-btn" data-action="edit" title="Editar">
          <i data-lucide="pencil"></i>
        </button>
        <button class="delete-btn" data-action="delete" title="Excluir">
          <i data-lucide="trash-2"></i>
        </button>
      </div>`;
    })
    .join("");

  if (window.lucide) lucide.createIcons();
}

// ── Other transactions list ───────────────────────────────────────────────────
// Same fix: listeners attached once via initOtherTxsListeners()

const _otherCb = { edit: null, delete: null };

export function initOtherTxsListeners() {
  const list = document.getElementById("other-txs");
  if (!list) return;

  list.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".edit-btn");
    if (editBtn) {
      const id = editBtn.closest(".tx-row")?.dataset.id;
      if (id && _otherCb.edit) _otherCb.edit(id);
      return;
    }
    const delBtn = e.target.closest(".delete-btn");
    if (delBtn) {
      const id = delBtn.closest(".tx-row")?.dataset.id;
      if (id && _otherCb.delete) _otherCb.delete(id);
    }
  });
}

export function renderOtherTxs(txs, callbacks) {
  Object.assign(_otherCb, callbacks);

  const others = selectOtherTxs(txs);
  const list = document.getElementById("other-txs");
  if (!list) return;

  const section = document.getElementById("other-section");
  if (section) section.style.display = others.length ? "flex" : "none";

  list.innerHTML = others
    .map((tx) => {
      const cat = getCat(tx.categoryId);
      const label = tx.customLabel || cat.label;
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
        <button class="edit-btn" title="Editar">
          <i data-lucide="pencil"></i>
        </button>
        <button class="delete-btn" title="Excluir">
          <i data-lucide="trash-2"></i>
        </button>
      </div>`;
    })
    .join("");

  if (window.lucide) lucide.createIcons();
}

// ── Loading overlay ────────────────────────────────────────────────────────────

export function setLoading(active) {
  const ov = document.getElementById("loading-overlay");
  if (ov) ov.style.display = active ? "flex" : "none";
}
