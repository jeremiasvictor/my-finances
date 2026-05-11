// ─────────────────────────────────────────────────────────────────────────────
// js/state.js  –  Centralised reactive state
// ─────────────────────────────────────────────────────────────────────────────

const _state = {
  user: null,
  month: new Date().getMonth(), // 0-11
  year: new Date().getFullYear(),
  transactions: [], // current month
  templates: [], // fixed-bill templates
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
  return () => _listeners.delete(fn); // returns unsubscribe
}

// ── Derived selectors ─────────────────────────────────────────────────────────

export function selectTotals(txs = _state.transactions) {
  let income = 0,
    fixed = 0,
    variable = 0;
  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else if (t.kind === "fixed" && t.isPaid)
      fixed += t.amount; // só conta quando paga
    else if (t.kind === "variable") variable += t.amount;
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
