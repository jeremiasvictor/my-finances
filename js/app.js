// ─────────────────────────────────────────────────────────────────────────────
// js/app.js  –  Main entry point; orchestrates all modules
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
  getFixedTemplates,
  deleteFixedTemplate,
} from "./db.js";
import { getState, setState, subscribe, selectTotals } from "./state.js";
import {
  renderMonthPicker,
  renderSummary,
  renderChecklist,
  renderOtherTxs,
  updateTxCount,
  setLoading,
  toast,
  fmt,
} from "./ui.js";
import { renderDonut, renderLiquidityChart } from "./charts.js";
import {
  openTransactionModal,
  openTemplateModal,
  openModal,
  closeModal,
} from "./modal.js";

// ─────────────────────────────────────────────────────────────────────────────
// AUTH SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function showAuth() {
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app-screen").style.display = "none";
}

function showApp() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "block";
}

// Auth form wiring
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
    wireToggle();
  };

  function wireToggle() {
    document
      .getElementById("auth-toggle")
      ?.addEventListener("click", () =>
        setMode(mode === "login" ? "signup" : "login"),
      );
  }
  wireToggle();

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

// ─────────────────────────────────────────────────────────────────────────────
// DATA LOADING
// ─────────────────────────────────────────────────────────────────────────────

async function loadMonth() {
  const { user, month, year } = getState();
  if (!user) return;
  setLoading(true);

  try {
    // Ensure fixed bills are instantiated for this month
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

// ─────────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────────

function render(state) {
  const { transactions: txs, month, year, user } = state;
  if (!user) return;

  const { fixed, variable } = selectTotals(txs);

  updateTxCount(txs.length);
  renderSummary(txs);

  // Edit handler shared by checklist and other txs
  const handleEdit = (tx) => {
    openTransactionModal(async (payload, txId) => {
      await updateTransaction(user.uid, txId, payload);
      toast("Lançamento atualizado ✓");
      await loadMonth();
    }, tx);
  };

  renderChecklist(
    txs,
    async (tx) => {
      await togglePaid(user.uid, tx.id, tx.isPaid);
      toast(tx.isPaid ? "Marcada como pendente" : "Conta marcada como paga ✓");
      await loadMonth();
    },
    handleEdit,
    async (id) => {
      if (!confirm("Excluir este lançamento?")) return;
      await deleteTransaction(user.uid, id);
      toast("Lançamento excluído");
      await loadMonth();
    },
  );
  renderOtherTxs(txs, handleEdit, async (id) => {
    if (!confirm("Excluir este lançamento?")) return;
    await deleteTransaction(user.uid, id);
    toast("Lançamento excluído");
    await loadMonth();
  });
  renderDonut("donut-canvas", txs); // now takes full txs
  renderLiquidityChart("liquidity-canvas", txs);
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTH NAVIGATION
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────

// Subscribe state → render
subscribe((state) => render(state));

// Auth listener
onAuth(async (user) => {
  setState({ user });
  if (user) {
    showApp();

    // Render month picker
    const { month, year } = getState();
    renderMonthPicker(
      month,
      year,
      () => navMonth(-1),
      () => navMonth(1),
    );

    // Logout button
    document
      .getElementById("btn-logout")
      ?.addEventListener("click", async () => {
        await logout();
        setState({ transactions: [], templates: [] });
      });

    // Hide amounts toggle
    document.getElementById("btn-hide")?.addEventListener("click", () => {
      const h = !getState().hideAmounts;
      setState({ hideAmounts: h });
      document.getElementById("btn-hide").innerHTML =
        `<i data-lucide="${h ? "eye" : "eye-off"}"></i>`;
      if (window.lucide) lucide.createIcons();
    });

    // FAB → open transaction modal
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

    // Template modal trigger (in checklist header)
    document
      .getElementById("btn-add-template")
      ?.addEventListener("click", () => {
        openTemplateModal(async (data) => {
          await addFixedTemplate(user.uid, data);
          toast("Conta fixa cadastrada ✓");
          await loadMonth();
        });
      });

    // Close buttons inside modals
    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
    });

    await loadMonth();
  } else {
    showAuth();
  }
});
