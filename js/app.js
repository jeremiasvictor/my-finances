// ─────────────────────────────────────────────────────────────────────────────
// js/app.js  –  Main entry point
// ─────────────────────────────────────────────────────────────────────────────

import { onAuth, login, register, logout } from "./auth.js";
import {
  addTransaction,
  getMonthTransactions,
  instantiateFixedBills,
  togglePaid,
  deleteTransaction,
  updateTransaction,
  addFixedTemplate,
  deleteFixedTemplate,
} from "./db.js";
import { getState, setState, subscribe, selectTotals } from "./state.js";
import {
  renderMonthPicker,
  renderSummary,
  renderChecklist,
  renderOtherTxs,
  initChecklistListeners,
  initOtherTxsListeners,
  updateTxCount,
  setLoading,
  toast,
  toastWithUndo,
  fmt,
} from "./ui.js";
import { renderDonut, renderLiquidityChart } from "./charts.js";
import {
  openTransactionModal,
  openTemplateModal,
  openModal,
  closeModal,
} from "./modal.js";

// ── Auth screen ───────────────────────────────────────────────────────────────

function showAuth() {
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app-screen").style.display = "none";
}
function showApp() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "block";
}

(function wireAuthForm() {
  let mode = "login";
  const setMode = (m) => {
    mode = m;
    document.getElementById("auth-title").textContent =
      m === "login" ? "Entre na sua conta" : "Crie sua conta";
    document.getElementById("auth-submit").textContent =
      m === "login" ? "Entrar" : "Criar conta";
    document.getElementById("auth-toggle-text").innerHTML =
      m === "login"
        ? 'Não tem conta? <span id="auth-toggle" class="link">Criar agora</span>'
        : 'Já tem conta? <span id="auth-toggle" class="link">Entrar</span>';
    document.getElementById("auth-error").textContent = "";
    document
      .getElementById("auth-toggle")
      ?.addEventListener("click", () =>
        setMode(mode === "login" ? "signup" : "login"),
      );
  };
  document
    .getElementById("auth-toggle")
    ?.addEventListener("click", () =>
      setMode(mode === "login" ? "signup" : "login"),
    );

  document.getElementById("auth-submit").addEventListener("click", async () => {
    const email = document.getElementById("auth-email").value.trim();
    const pass = document.getElementById("auth-pass").value;
    const errEl = document.getElementById("auth-error");
    errEl.textContent = "";
    try {
      if (mode === "login") await login(email, pass);
      else await register(email, pass);
    } catch (e) {
      errEl.textContent = e.message;
    }
  });
  document.getElementById("auth-pass")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("auth-submit").click();
  });
})();

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadMonth() {
  const { user, month, year } = getState();
  if (!user) return;
  setLoading(true);
  try {
    await instantiateFixedBills(user.uid, month, year);
    const txs = await getMonthTransactions(user.uid, month, year);
    setState({ transactions: txs, loading: false });
  } catch (e) {
    console.error(e);
    toast("Erro ao carregar dados.", "error");
  } finally {
    setLoading(false);
  }
}

// ── Delete with undo ──────────────────────────────────────────────────────────

async function deleteWithUndo(uid, id, label = "Lançamento") {
  // Optimistically remove from UI
  const { transactions } = getState();
  const backup = transactions.find((t) => t.id === id);
  setState({ transactions: transactions.filter((t) => t.id !== id) });

  const confirmed = await toastWithUndo(`${label} excluído`, () => {
    // Undo: restore local state (no need to re-fetch)
    setState({
      transactions: [...getState().transactions, backup].sort(
        (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0),
      ),
    });
  });

  if (confirmed) {
    await deleteTransaction(uid, id);
    // Re-fetch to stay in sync (handles template re-instantiation etc.)
    await loadMonth();
  }
}

async function bulkDeleteWithUndo(uid, ids) {
  const { transactions } = getState();
  const backups = transactions.filter((t) => ids.includes(t.id));
  setState({ transactions: transactions.filter((t) => !ids.includes(t.id)) });

  const confirmed = await toastWithUndo(
    `${ids.length} conta${ids.length !== 1 ? "s" : ""} excluída${ids.length !== 1 ? "s" : ""}`,
    () => {
      setState({
        transactions: [...getState().transactions, ...backups].sort(
          (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0),
        ),
      });
    },
  );

  if (confirmed) {
    await Promise.all(ids.map((id) => deleteTransaction(uid, id)));
    await loadMonth();
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(state) {
  const { transactions: txs, user } = state;
  if (!user) return;

  updateTxCount(txs.length);
  renderSummary(txs);

  // Build tx lookup for callbacks (by id)
  const txById = Object.fromEntries(txs.map((t) => [t.id, t]));

  const handleEdit = (id) => {
    const tx = txById[id];
    if (!tx) return;
    openTransactionModal(async (payload, txId) => {
      await updateTransaction(user.uid, txId, payload);
      toast("Lançamento atualizado ✓");
      await loadMonth();
    }, tx);
  };

  // Checklist callbacks (passed as object, stored at module level in ui.js)
  renderChecklist(txs, {
    toggle: async (id) => {
      const tx = txById[id];
      if (!tx) return;
      await togglePaid(user.uid, id, tx.isPaid);
      toast(tx.isPaid ? "Marcada como pendente" : "Conta marcada como paga ✓");
      await loadMonth();
    },
    edit: handleEdit,
    delete: (id) => {
      const tx = txById[id];
      deleteWithUndo(user.uid, id, tx?.customLabel || "Conta");
    },
    bulkDelete: (ids) => bulkDeleteWithUndo(user.uid, ids),
  });

  renderOtherTxs(txs, {
    edit: handleEdit,
    delete: (id) => {
      const tx = txById[id];
      deleteWithUndo(user.uid, id, tx?.customLabel || "Lançamento");
    },
  });

  renderDonut("donut-canvas", txs);
  renderLiquidityChart("liquidity-canvas", txs);
}

// ── Month navigation ──────────────────────────────────────────────────────────

function navMonth(dir) {
  let { month, year } = getState();
  month += dir;
  if (month < 0) {
    month = 11;
    year--;
  }
  if (month > 11) {
    month = 0;
    year++;
  }
  setState({ month, year });
  renderMonthPicker(
    month,
    year,
    () => navMonth(-1),
    () => navMonth(1),
  );
  loadMonth();
}

// ── Boot ──────────────────────────────────────────────────────────────────────

subscribe((state) => render(state));

onAuth(async (user) => {
  setState({ user });
  if (user) {
    showApp();

    // Init permanent delegated listeners (called ONCE)
    initChecklistListeners();
    initOtherTxsListeners();

    const { month, year } = getState();
    renderMonthPicker(
      month,
      year,
      () => navMonth(-1),
      () => navMonth(1),
    );

    document
      .getElementById("btn-logout")
      ?.addEventListener("click", async () => {
        await logout();
        setState({ transactions: [], templates: [] });
      });

    document.getElementById("btn-hide")?.addEventListener("click", () => {
      const h = !getState().hideAmounts;
      setState({ hideAmounts: h });
      document.getElementById("btn-hide").innerHTML =
        `<i data-lucide="${h ? "eye" : "eye-off"}"></i>`;
      if (window.lucide) lucide.createIcons();
    });

    document.getElementById("fab")?.addEventListener("click", () => {
      openTransactionModal(async (payload, txId) => {
        if (txId) {
          await updateTransaction(user.uid, txId, payload);
          toast("Lançamento atualizado ✓");
        } else {
          await addTransaction(user.uid, {
            ...payload,
            month: getState().month,
            year: getState().year,
          });
          toast("Lançamento adicionado ✓");
        }
        await loadMonth();
      });
    });

    document
      .getElementById("btn-add-template")
      ?.addEventListener("click", () => {
        openTemplateModal(async (data) => {
          await addFixedTemplate(user.uid, data);
          toast("Conta fixa cadastrada ✓");
          await loadMonth();
        });
      });

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });

    await loadMonth();
  } else {
    showAuth();
  }
});
