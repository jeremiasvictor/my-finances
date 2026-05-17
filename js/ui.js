// js/ui.js – DOM rendering helpers

import { getCat, ALL_CATS } from "./categories.js";
import {
  getState,
  selectTotals,
  selectFixedBills,
  selectOtherTxs,
  selectSpendingByCategory,
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
    <button id="btn-prev-month" class="nav-arrow"><i data-lucide="chevron-left"></i></button>
    <div class="month-label">
      <span class="month-name">${MONTHS[month]} ${year}</span>
      <span class="month-sub" id="tx-count"></span>
    </div>
    <button id="btn-next-month" class="nav-arrow"><i data-lucide="chevron-right"></i></button>`;
  document.getElementById("btn-prev-month").addEventListener("click", onPrev);
  document.getElementById("btn-next-month").addEventListener("click", onNext);
  if (window.lucide) lucide.createIcons();
}

export function updateTxCount(count) {
  const el = document.getElementById("tx-count");
  if (el) el.textContent = `${count} lançamento${count !== 1 ? "s" : ""}`;
}

// ── Summary cards ─────────────────────────────────────────────────────────────

export function renderSummary(txs) {
  const { income, fixed, variable, expenses, balance } = selectTotals(txs);
  const isPos = balance >= 0;
  const pct =
    income > 0 ? Math.abs(Math.round((balance / income) * 100)) : null;

  const balEl = document.getElementById("card-balance");
  if (balEl)
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

  const incEl = document.getElementById("card-income");
  if (incEl)
    incEl.innerHTML = `
    <i data-lucide="trending-up" class="card-icon lime"></i>
    <p class="card-label">Receitas</p>
    <p class="card-value white">${mask(fmt(income))}</p>`;

  const expEl = document.getElementById("card-expenses");
  if (expEl)
    expEl.innerHTML = `
    <i data-lucide="trending-down" class="card-icon purple"></i>
    <p class="card-label">Despesas</p>
    <p class="card-value white">${mask(fmt(expenses))}</p>
    <div class="expense-split">
      <span class="split-fixed">Fixas: ${mask(fmt(fixed))}</span>
      <span class="split-var">Variáveis: ${mask(fmt(variable))}</span>
    </div>`;

  if (window.lucide) lucide.createIcons();
}

// ── Toast ─────────────────────────────────────────────────────────────────────

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

export function toastWithUndo(msg, onUndo) {
  document.querySelectorAll(".toast-undo-wrap").forEach((t) => t.remove());
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "toast toast-undo-wrap show";
    wrap.innerHTML = `<span class="toast-msg">${msg}</span><button class="toast-undo-btn">Desfazer</button>`;
    document.body.appendChild(wrap);
    let undone = false;
    wrap.querySelector(".toast-undo-btn").addEventListener("click", () => {
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

// ── Generic dialog helpers ────────────────────────────────────────────────────

function makeOverlay(id, html) {
  document.getElementById(id)?.remove();
  const el = document.createElement("div");
  el.id = id;
  el.className = "del-overlay";
  el.innerHTML = `<div class="del-box">${html}</div>`;
  document.body.appendChild(el);
  if (window.lucide) lucide.createIcons();
  requestAnimationFrame(() => el.classList.add("open"));
  return el;
}

function closeOverlay(el) {
  el.classList.remove("open");
  setTimeout(() => el.remove(), 250);
}

export function showDeleteOptions(label) {
  return new Promise((resolve) => {
    const ov = makeOverlay(
      "delete-dialog",
      `
      <p class="del-title">Excluir "${label}"</p>
      <p class="del-sub">Como você quer excluir esta conta?</p>
      <div class="del-options">
        <button class="del-opt" data-choice="month">
          <i data-lucide="calendar-x"></i>
          <div><strong>Só este mês</strong><span>Remove apenas este mês. Volta nos próximos.</span></div>
        </button>
        <button class="del-opt del-opt-danger" data-choice="forever">
          <i data-lucide="trash-2"></i>
          <div><strong>Para sempre</strong><span>Remove o template. Não aparece mais em nenhum mês.</span></div>
        </button>
      </div>
      <button class="del-cancel" data-choice="cancel">Cancelar</button>`,
    );
    const close = (v) => {
      closeOverlay(ov);
      resolve(v === "cancel" ? null : v);
    };
    ov.querySelectorAll("[data-choice]").forEach((b) =>
      b.addEventListener("click", () => close(b.dataset.choice)),
    );
    ov.addEventListener("click", (e) => {
      if (e.target === ov) close("cancel");
    });
  });
}

export function showPayModal(tx) {
  return new Promise((resolve) => {
    const label = tx.customLabel || tx.categoryId;
    const ov = makeOverlay(
      "pay-dialog",
      `
      <p class="del-title">Confirmar pagamento</p>
      <p class="del-sub">${label} · Estimativa: <strong style="color:var(--lime)">${fmt(tx.amount)}</strong></p>
      <input id="pay-amount-input" class="field" type="number" step="0.01" min="0"
        placeholder="Valor pago (vazio = usar estimativa)" style="width:100%;margin-bottom:1rem"/>
      <div style="display:flex;gap:.5rem">
        <button class="del-cancel" data-choice="cancel" style="flex:1">Cancelar</button>
        <button class="submit-btn" data-choice="confirm" style="flex:1;margin-top:0">Confirmar</button>
      </div>`,
    );
    const input = ov.querySelector("#pay-amount-input");
    input.focus();
    const close = (choice) => {
      closeOverlay(ov);
      if (choice === "cancel") {
        resolve(undefined);
        return;
      }
      const val = parseFloat(input.value);
      resolve(isNaN(val) || val <= 0 ? null : val);
    };
    ov.querySelectorAll("[data-choice]").forEach((b) =>
      b.addEventListener("click", () => close(b.dataset.choice)),
    );
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") close("confirm");
      if (e.key === "Escape") close("cancel");
    });
    ov.addEventListener("click", (e) => {
      if (e.target === ov) close("cancel");
    });
  });
}

export function setLoading(active) {
  const ov = document.getElementById("loading-overlay");
  if (ov) ov.style.display = active ? "flex" : "none";
}

// ─────────────────────────────────────────────────────────────────────────────
// FIXED BILLS CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────

const _cb = { toggle: null, edit: null, delete: null, bulkDelete: null };
const _selected = new Set();

export function initChecklistListeners() {
  const list = document.getElementById("checklist-items");
  const bulkBar = document.getElementById("bulk-bar");
  const bulkCnt = document.getElementById("bulk-count");
  if (!list) return;

  list.addEventListener("click", (e) => {
    const cb = e.target.closest(".row-checkbox");
    if (cb) {
      const id = cb.closest(".bill-row").dataset.id;
      cb.checked ? _selected.add(id) : _selected.delete(id);
      _updateBulkBar(bulkBar, bulkCnt);
      return;
    }
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id = btn.closest(".bill-row")?.dataset.id;
    if (!id) return;
    if (btn.dataset.action === "toggle" && _cb.toggle) _cb.toggle(id);
    if (btn.dataset.action === "edit" && _cb.edit) _cb.edit(id);
    if (btn.dataset.action === "delete" && _cb.delete) _cb.delete(id);
  });

  document.getElementById("btn-bulk-delete")?.addEventListener("click", () => {
    if (_cb.bulkDelete) _cb.bulkDelete([..._selected]);
    _selected.clear();
    _updateBulkBar(bulkBar, bulkCnt);
  });
  document.getElementById("btn-bulk-cancel")?.addEventListener("click", () => {
    _selected.clear();
    _updateBulkBar(bulkBar, bulkCnt);
    list.querySelectorAll(".row-checkbox").forEach((c) => {
      c.checked = false;
    });
  });
}

function _updateBulkBar(bar, countEl) {
  if (!bar) return;
  bar.style.display = _selected.size > 0 ? "flex" : "none";
  if (countEl)
    countEl.textContent = `${_selected.size} selecionada${_selected.size !== 1 ? "s" : ""}`;
}

export function renderChecklist(txs, callbacks) {
  Object.assign(_cb, callbacks);
  const bills = selectFixedBills(txs);
  const list = document.getElementById("checklist-items");
  const badge = document.getElementById("bills-badge");
  if (!list) return;

  const validIds = new Set(bills.map((b) => b.id));
  [..._selected].forEach((id) => {
    if (!validIds.has(id)) _selected.delete(id);
  });

  if (badge)
    badge.textContent = `${bills.filter((b) => b.isPaid).length}/${bills.length} pagas`;

  if (bills.length === 0) {
    list.innerHTML = `<div class="empty-state"><i data-lucide="target" style="opacity:.3"></i>
      <p>Nenhuma conta fixa cadastrada</p><small>Clique em "Nova fixa" para adicionar</small></div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  list.innerHTML = bills
    .map((tx) => {
      const cat = getCat(tx.categoryId);
      const label = tx.customLabel || cat.label;
      const checked = _selected.has(tx.id);
      const hasDiff =
        tx.isPaid && tx.paidAmount != null && tx.paidAmount !== tx.amount;
      const amountHtml = tx.isPaid
        ? hasDiff
          ? `<div class="bill-amounts">
             <span class="bill-estimate">${mask(fmt(tx.amount))}</span>
             <span class="bill-paid-val">${mask(fmt(tx.paidAmount))}</span>
           </div>`
          : `<p class="bill-amount dimmed">${mask(fmt(tx.paidAmount ?? tx.amount))}</p>`
        : `<p class="bill-amount">${mask(fmt(tx.amount))}</p>`;

      return `
      <div class="bill-row ${tx.isPaid ? "paid" : ""} ${checked ? "selected" : ""}" data-id="${tx.id}">
        <label class="row-select-wrap"><input type="checkbox" class="row-checkbox" ${checked ? "checked" : ""}/></label>
        <div class="bill-icon ${tx.isPaid ? "dimmed" : ""}"><i data-lucide="${cat.icon}"></i></div>
        <div class="bill-info">
          <p class="bill-name">${label}</p>
          ${tx.description ? `<p class="bill-desc">${tx.description}</p>` : ""}
          ${tx.dueDay ? `<p class="bill-due">Vence dia ${tx.dueDay}</p>` : ""}
        </div>
        ${amountHtml}
        <button class="check-btn ${tx.isPaid ? "checked" : ""}" data-action="toggle">
          ${tx.isPaid ? '<i data-lucide="check"></i>' : '<span class="check-inner"></span>'}
        </button>
        <button class="edit-btn" data-action="edit"><i data-lucide="pencil"></i></button>
        <button class="delete-btn" data-action="delete"><i data-lucide="trash-2"></i></button>
      </div>`;
    })
    .join("");

  if (window.lucide) lucide.createIcons();
}

// ─────────────────────────────────────────────────────────────────────────────
// OTHER TRANSACTIONS
// ─────────────────────────────────────────────────────────────────────────────

const _otherCb = { edit: null, delete: null };

export function initOtherTxsListeners() {
  const list = document.getElementById("other-txs");
  if (!list) return;
  list.addEventListener("click", (e) => {
    const eb = e.target.closest(".edit-btn");
    if (eb) {
      const id = eb.closest(".tx-row")?.dataset.id;
      if (id && _otherCb.edit) _otherCb.edit(id);
      return;
    }
    const db2 = e.target.closest(".delete-btn");
    if (db2) {
      const id = db2.closest(".tx-row")?.dataset.id;
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
        <div class="tx-icon ${isIncome ? "income" : ""}"><i data-lucide="${cat.icon}"></i></div>
        <div class="tx-info">
          <p class="tx-name">${label}</p>
          ${tx.description ? `<p class="tx-desc">${tx.description}</p>` : ""}
          ${tx.dueDay ? `<p class="tx-due">Dia ${tx.dueDay}</p>` : ""}
        </div>
        <p class="tx-amount ${isIncome ? "lime" : "white"}">${isIncome ? "+" : "-"}${mask(fmt(tx.amount))}</p>
        <button class="edit-btn"><i data-lucide="pencil"></i></button>
        <button class="delete-btn"><i data-lucide="trash-2"></i></button>
      </div>`;
    })
    .join("");

  if (window.lucide) lucide.createIcons();
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET PLAN (Plano de Gastos)
// ─────────────────────────────────────────────────────────────────────────────

export function renderBudgetPlan(plans, txs, onAddPlan, onDeletePlan) {
  const container = document.getElementById("budget-plan-items");
  if (!container) return;

  const spending = selectSpendingByCategory(txs);

  if (plans.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <i data-lucide="pie-chart" style="opacity:.3"></i>
      <p>Nenhuma categoria no plano</p>
      <small>Clique em "+ Categoria" para adicionar</small>
    </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const totalBudget = plans.reduce((s, p) => s + p.budget, 0);
  const totalSpent = plans.reduce(
    (s, p) => s + (spending[p.categoryId] || 0),
    0,
  );

  container.innerHTML = plans
    .map((plan) => {
      const cat = getCat(plan.categoryId);
      const icon = plan.icon || cat.icon;
      const label = plan.customLabel || cat.label;
      const spent = spending[plan.categoryId] || 0;
      const pct =
        plan.budget > 0 ? Math.min((spent / plan.budget) * 100, 100) : 0;
      const over = spent > plan.budget;
      const left = plan.budget - spent;

      let barColor = "var(--lime)";
      if (pct > 85) barColor = "#fb923c";
      if (over) barColor = "var(--red)";

      return `
      <div class="budget-row" data-plan-id="${plan.id}">
        <div class="budget-row-top">
          <div class="budget-cat-icon"><i data-lucide="${icon}"></i></div>
          <div class="budget-cat-info">
            <p class="budget-cat-name">${label}</p>
            <p class="budget-cat-sub">
              ${mask(fmt(spent))} <span style="color:var(--muted)">de ${mask(fmt(plan.budget))}</span>
              ${over ? `<span class="budget-over">+${mask(fmt(-left))}</span>` : ""}
            </p>
          </div>
          <p class="budget-left ${over ? "red" : ""}">${over ? "Excedeu" : mask(fmt(left))}</p>
          <button class="delete-btn budget-del" data-plan-id="${plan.id}"><i data-lucide="trash-2"></i></button>
        </div>
        <div class="budget-bar-track">
          <div class="budget-bar-fill" style="width:${pct}%;background:${barColor}"></div>
        </div>
      </div>`;
    })
    .join("");

  // Summary row
  const totalPct =
    totalBudget > 0 ? Math.min((totalSpent / totalBudget) * 100, 100) : 0;
  document.getElementById("budget-summary").innerHTML = `
    <span style="font-size:.72rem;color:var(--muted)">Total planejado: <strong style="color:var(--text)">${mask(fmt(totalBudget))}</strong></span>
    <span style="font-size:.72rem;color:var(--muted)">Gasto: <strong style="color:${totalSpent > totalBudget ? "var(--red)" : "var(--lime)"}">${mask(fmt(totalSpent))}</strong></span>`;

  // Wire delete buttons
  container.querySelectorAll(".budget-del").forEach((btn) => {
    btn.addEventListener("click", () => onDeletePlan(btn.dataset.planId));
  });

  if (window.lucide) lucide.createIcons();
}

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE CARD (Fatura)
// ─────────────────────────────────────────────────────────────────────────────

export function renderInvoices(
  invoicesData,
  onAddInvoice,
  onDeleteInvoice,
  onAddMember,
  onToggleMember,
  onDeleteMember,
) {
  const container = document.getElementById("invoices-container");
  if (!container) return;

  if (invoicesData.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <i data-lucide="credit-card" style="opacity:.3"></i>
      <p>Nenhuma fatura cadastrada</p>
      <small>Clique em "+ Fatura" para adicionar</small>
    </div>`;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = invoicesData
    .map(({ invoice, members }) => {
      const totalMembers = members.reduce((s, m) => s + m.amount, 0);
      const myShare = Math.max(0, invoice.totalAmount - totalMembers);

      return `
      <div class="invoice-card" data-invoice-id="${invoice.id}">
        <div class="invoice-header">
          <div>
            <p class="invoice-name">${invoice.name}</p>
            <p class="invoice-total">${mask(fmt(invoice.totalAmount))}</p>
          </div>
          <button class="delete-btn inv-del" data-invoice-id="${invoice.id}"><i data-lucide="trash-2"></i></button>
        </div>

        ${
          members.length > 0
            ? `
        <div class="invoice-members">
          ${members
            .map(
              (m) => `
            <div class="member-row ${m.isPaid ? "member-paid" : ""}" data-member-id="${m.id}">
              <div class="member-color-dot" style="background:${m.color || "#A855F7"}"></div>
              <div class="member-check ${m.isPaid ? "checked" : ""}" data-action="toggle-member">
                ${m.isPaid ? '<i data-lucide="check"></i>' : ""}
              </div>
              <span class="member-amount">${mask(fmt(m.amount))}</span>
              <span class="member-status">${m.isPaid ? "Depositado" : "Pendente"}</span>
              <button class="delete-btn member-del" data-member-id="${m.id}"><i data-lucide="x"></i></button>
            </div>`,
            )
            .join("")}
        </div>`
            : ""
        }

        <div class="invoice-footer">
          <div class="invoice-my-share">
            <span style="font-size:.7rem;color:var(--muted)">Minha parte</span>
            <span style="font-family:var(--mono);font-size:.85rem;color:var(--lime)">${mask(fmt(myShare))}</span>
          </div>
          <button class="btn-add-member" data-invoice-id="${invoice.id}">
            <i data-lucide="plus"></i> Adicionar parte
          </button>
        </div>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".inv-del").forEach((btn) => {
    btn.addEventListener("click", () => onDeleteInvoice(btn.dataset.invoiceId));
  });
  container.querySelectorAll(".member-del").forEach((btn) => {
    btn.addEventListener("click", () => onDeleteMember(btn.dataset.memberId));
  });
  container.querySelectorAll("[data-action='toggle-member']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.closest(".member-row").dataset.memberId;
      const allMembers = invoicesData.flatMap((d) => d.members);
      const m = allMembers.find((x) => x.id === id);
      if (m) onToggleMember(m);
    });
  });
  container.querySelectorAll(".btn-add-member").forEach((btn) => {
    btn.addEventListener("click", () => onAddMember(btn.dataset.invoiceId));
  });

  if (window.lucide) lucide.createIcons();
}
