// js/state.js – Centralised reactive state

const _state = {
  user: null,
  month: new Date().getMonth(),
  year: new Date().getFullYear(),
  transactions: [],
  budgetPlans: [],
  invoices: [], // array of { invoice, members[] }
  loading: false,
  hideAmounts: false,
};

const _listeners = new Set();

export function getState() {
  return { ..._state };
}
export function setState(patch) {
  Object.assign(_state, patch);
  _listeners.forEach((fn) => fn({ ..._state }));
}
export function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// ── Selectors ─────────────────────────────────────────────────────────────────

export function selectTotals(txs = _state.transactions) {
  let income = 0,
    fixed = 0,
    variable = 0;
  for (const t of txs) {
    if (t.type === "income") {
      income += t.amount;
    } else if (t.kind === "fixed" && t.isPaid) {
      fixed += t.paidAmount != null ? t.paidAmount : t.amount;
    } else if (t.kind === "variable") {
      variable += t.amount;
    }
  }
  return {
    income,
    fixed,
    variable,
    expenses: fixed + variable,
    balance: income - fixed - variable,
  };
}

export function selectFixedBills(txs = _state.transactions) {
  return txs.filter((t) => t.type === "expense" && t.kind === "fixed");
}

export function selectOtherTxs(txs = _state.transactions) {
  return txs.filter((t) => t.kind === "variable" || t.type === "income");
}

/** Returns spending per categoryId from variable expenses */
export function selectSpendingByCategory(txs = _state.transactions) {
  const map = {};
  for (const t of txs) {
    if (t.type !== "expense" || t.kind !== "variable") continue;
    const key = t.categoryId;
    map[key] = (map[key] || 0) + t.amount;
  }
  return map;
}
