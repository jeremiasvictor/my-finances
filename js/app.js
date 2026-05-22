// js/app.js – Main entry point

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
  getBudgetPlans,
  addBudgetPlan,
  deleteBudgetPlan,
  getBudgetPlanTemplates,
  addBudgetPlanTemplate,
  deleteBudgetPlanTemplate,
  instantiateBudgetPlans,
  getInvoices,
  addInvoice,
  deleteInvoice,
  getInvoiceMembers,
  addInvoiceMember,
  toggleMemberPaid,
  deleteInvoiceMember,
} from "./db.js";
import { getState, setState, subscribe, selectTotals } from "./state.js";
import {
  renderMonthPicker,
  renderSummary,
  renderChecklist,
  renderOtherTxs,
  renderBudgetPlan,
  renderInvoices,
  initChecklistListeners,
  initOtherTxsListeners,
  updateTxCount,
  setLoading,
  toast,
  toastWithUndo,
  showDeleteOptions,
  showPayModal,
  fmt,
} from "./ui.js";
import { renderDonut, renderLiquidityChart } from "./charts.js";
import {
  openTransactionModal,
  openTemplateModal,
  openModal,
  closeModal,
} from "./modal.js";
import { VARIABLE_CATS, ALL_CATS } from "./categories.js";

// ── Auth ──────────────────────────────────────────────────────────────────────

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

async function loadMonth(skipInstantiate = false) {
  const { user, month, year } = getState();
  if (!user) return;
  setLoading(true);
  try {
    if (!skipInstantiate) {
      await instantiateFixedBills(user.uid, month, year);
      await instantiateBudgetPlans(user.uid, month, year);
    }

    const [txs, plans, invoicesList] = await Promise.all([
      getMonthTransactions(user.uid, month, year),
      getBudgetPlans(user.uid, month, year),
      getInvoices(user.uid, month, year),
    ]);

    const invoicesData = await Promise.all(
      invoicesList.map(async (inv) => ({
        invoice: inv,
        members: await getInvoiceMembers(user.uid, inv.id),
      })),
    );

    setState({
      transactions: txs,
      budgetPlans: plans,
      invoices: invoicesData,
      loading: false,
    });
  } catch (e) {
    console.error(e);
    toast("Erro ao carregar dados.", "error");
  } finally {
    setLoading(false);
  }
}

// ── Delete helpers ────────────────────────────────────────────────────────────

async function deleteFixedBill(uid, tx) {
  const label = tx.customLabel || tx.categoryId;
  const choice = await showDeleteOptions(label);
  if (!choice) return;
  const { transactions } = getState();
  setState({ transactions: transactions.filter((t) => t.id !== tx.id) });
  if (choice === "forever") {
    if (tx.templateId) await deleteFixedTemplate(uid, tx.templateId);
    await deleteTransaction(uid, tx.id);
    toast("Conta fixa removida para sempre");
  } else {
    await deleteTransaction(uid, tx.id);
    toast("Removida só deste mês ✓");
  }
  await loadMonth(choice === "month");
}

async function deleteWithUndo(uid, id, label = "Lançamento") {
  const { transactions } = getState();
  const backup = transactions.find((t) => t.id === id);
  setState({ transactions: transactions.filter((t) => t.id !== id) });
  const confirmed = await toastWithUndo(`${label} excluído`, () => {
    setState({
      transactions: [...getState().transactions, backup].sort(
        (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0),
      ),
    });
  });
  if (confirmed) {
    await deleteTransaction(uid, id);
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
    await Promise.all(
      backups.map(async (tx) => {
        if (tx.kind === "fixed" && tx.templateId)
          await deleteFixedTemplate(uid, tx.templateId);
        await deleteTransaction(uid, tx.id);
      }),
    );
    await loadMonth(true);
  }
}

// ── Budget plan modal ─────────────────────────────────────────────────────────

function openBudgetModal(onSubmit) {
  document.getElementById("modal-budget")?.remove();
  const modal = document.createElement("div");
  modal.id = "modal-budget";
  modal.className = "modal-wrapper open";

  const catOptions = [...VARIABLE_CATS.filter((c) => c.id !== "outros")]
    .map((c) => `<option value="${c.id}">${c.label}</option>`)
    .join("");

  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-box">
      <div class="modal-header">
        <h2 class="modal-title">Nova Categoria do Plano</h2>
        <button class="close-btn" id="close-budget-modal"><i data-lucide="x"></i></button>
      </div>
      <p style="font-size:.75rem;color:var(--muted);margin-bottom:1rem">
        Defina um orçamento para esta categoria. Os gastos reais serão deduzidos automaticamente.
      </p>
      <div style="display:flex;gap:.5rem;margin-bottom:.75rem">
        <select id="bgt-cat" class="field" style="flex:1">
          <option value="">Categoria existente...</option>
          ${catOptions}
          <option value="__custom">+ Personalizada</option>
        </select>
      </div>
      <div id="bgt-custom-wrap" style="display:none;margin-bottom:.75rem">
        <input id="bgt-custom-label" class="field" placeholder="Nome da categoria" style="width:100%"/>
      </div>
      <input id="bgt-budget" class="field" type="number" step="0.01" min="0"
        placeholder="Orçamento previsto (R$)" style="width:100%;margin-bottom:.85rem"/>
      <label class="toggle-row" style="margin-bottom:.85rem">
        <div class="toggle-info">
          <span class="toggle-label">Repetir todo mês</span>
          <span class="toggle-sub">Aparece automaticamente em meses futuros</span>
        </div>
        <div class="toggle-switch" id="bgt-repeat-toggle" data-on="true">
          <div class="toggle-thumb"></div>
        </div>
      </label>
      <button id="btn-bgt-submit" class="submit-btn">Adicionar ao Plano</button>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
  if (window.lucide) lucide.createIcons();

  let repeatOn = true;
  const toggle = modal.querySelector("#bgt-repeat-toggle");
  toggle.addEventListener("click", () => {
    repeatOn = !repeatOn;
    toggle.dataset.on = repeatOn;
  });

  modal.querySelector("#bgt-cat").addEventListener("change", (e) => {
    modal.querySelector("#bgt-custom-wrap").style.display =
      e.target.value === "__custom" ? "block" : "none";
  });

  const closeModal = () => {
    modal.remove();
    document.body.style.overflow = "";
  };
  modal
    .querySelector("#close-budget-modal")
    .addEventListener("click", closeModal);
  modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);

  modal.querySelector("#btn-bgt-submit").addEventListener("click", async () => {
    const catVal = modal.querySelector("#bgt-cat").value;
    const budget = parseFloat(modal.querySelector("#bgt-budget").value);
    if (!catVal) {
      toast("Selecione uma categoria", "error");
      return;
    }
    if (!budget || budget <= 0) {
      toast("Informe um valor válido", "error");
      return;
    }

    const isCustom = catVal === "__custom";
    const customLabel = isCustom
      ? modal.querySelector("#bgt-custom-label").value.trim()
      : null;
    if (isCustom && !customLabel) {
      toast("Informe o nome da categoria", "error");
      return;
    }

    const cat = ALL_CATS.find((c) => c.id === catVal) || {
      id: "outros",
      icon: "plus",
    };
    await onSubmit({
      categoryId: isCustom ? "outros" : catVal,
      customLabel: isCustom ? customLabel : null,
      icon: cat.icon,
      budget,
      repeatEveryMonth: repeatOn,
    });
    closeModal();
  });
}

document.body.appendChild(modal);
document.body.style.overflow = "hidden";
if (window.lucide) lucide.createIcons();

modal.querySelector("#bgt-cat").addEventListener("change", (e) => {
  modal.querySelector("#bgt-custom-wrap").style.display =
    e.target.value === "__custom" ? "block" : "none";
});

const closeModal = () => {
  modal.remove();
  document.body.style.overflow = "";
};
modal
  .querySelector("#close-budget-modal")
  .addEventListener("click", closeModal);
modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);

modal.querySelector("#btn-bgt-submit").addEventListener("click", async () => {
  const catVal = modal.querySelector("#bgt-cat").value;
  const budget = parseFloat(modal.querySelector("#bgt-budget").value);
  if (!catVal) {
    toast("Selecione uma categoria", "error");
    return;
  }
  if (!budget || budget <= 0) {
    toast("Informe um valor válido", "error");
    return;
  }

  const isCustom = catVal === "__custom";
  const customLabel = isCustom
    ? modal.querySelector("#bgt-custom-label").value.trim()
    : null;
  if (isCustom && !customLabel) {
    toast("Informe o nome da categoria", "error");
    return;
  }

  const cat = ALL_CATS.find((c) => c.id === catVal) || {
    id: "outros",
    icon: "plus",
  };
  await onSubmit({
    categoryId: isCustom ? "outros" : catVal,
    customLabel: isCustom ? customLabel : null,
    icon: cat.icon,
    budget,
  });
  closeModal();
});

// ── Invoice modal ─────────────────────────────────────────────────────────────

function openInvoiceModal(onSubmit) {
  document.getElementById("modal-invoice")?.remove();
  const modal = document.createElement("div");
  modal.id = "modal-invoice";
  modal.className = "modal-wrapper open";
  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-box">
      <div class="modal-header">
        <h2 class="modal-title">Nova Fatura</h2>
        <button class="close-btn" id="close-invoice-modal"><i data-lucide="x"></i></button>
      </div>
      <input id="inv-name" class="field" placeholder="Nome (ex: Nubank Maio)" style="width:100%;margin-bottom:.75rem"/>
      <input id="inv-total" class="field" type="number" step="0.01" min="0"
        placeholder="Valor total da fatura (R$)" style="width:100%;margin-bottom:.75rem"/>
      <button id="btn-inv-submit" class="submit-btn">Criar Fatura</button>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
  if (window.lucide) lucide.createIcons();

  const closeModal = () => {
    modal.remove();
    document.body.style.overflow = "";
  };
  modal
    .querySelector("#close-invoice-modal")
    .addEventListener("click", closeModal);
  modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);
  modal.querySelector("#btn-inv-submit").addEventListener("click", async () => {
    const name = modal.querySelector("#inv-name").value.trim();
    const total = parseFloat(modal.querySelector("#inv-total").value);
    if (!name) {
      toast("Informe o nome da fatura", "error");
      return;
    }
    if (!total || total <= 0) {
      toast("Informe o valor total", "error");
      return;
    }
    await onSubmit({ name, totalAmount: total });
    closeModal();
  });
}

function openAddMemberModal(invoiceId, onSubmit) {
  document.getElementById("modal-member")?.remove();
  const modal = document.createElement("div");
  modal.id = "modal-member";
  modal.className = "modal-wrapper open";

  const PRESET_COLORS = [
    "#A855F7",
    "#D4FF3F",
    "#38BDF8",
    "#FB923C",
    "#F472B6",
    "#34D399",
    "#FACC15",
    "#F87171",
    "#2DD4BF",
    "#818CF8",
  ];

  modal.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal-box">
      <div class="modal-header">
        <h2 class="modal-title">Adicionar Parte</h2>
        <button class="close-btn" id="close-member-modal"><i data-lucide="x"></i></button>
      </div>
      <p style="font-size:.75rem;color:var(--muted);margin-bottom:.75rem">Escolha uma cor para identificar esta parte</p>
      <div class="color-picker-row" id="color-picker-row">
        ${PRESET_COLORS.map(
          (c, i) => `
          <button class="color-swatch ${i === 0 ? "active" : ""}" data-color="${c}"
            style="background:${c}" title="${c}"></button>`,
        ).join("")}
      </div>
      <input id="mem-amount" class="field" type="number" step="0.01" min="0"
        placeholder="Valor da parte (R$)" style="width:100%;margin-bottom:.75rem"/>
      <button id="btn-mem-submit" class="submit-btn">Adicionar</button>
    </div>`;

  document.body.appendChild(modal);
  document.body.style.overflow = "hidden";
  if (window.lucide) lucide.createIcons();

  let selectedColor = PRESET_COLORS[0];
  modal.querySelectorAll(".color-swatch").forEach((btn) => {
    btn.addEventListener("click", () => {
      modal
        .querySelectorAll(".color-swatch")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedColor = btn.dataset.color;
    });
  });

  const closeModal = () => {
    modal.remove();
    document.body.style.overflow = "";
  };
  modal
    .querySelector("#close-member-modal")
    .addEventListener("click", closeModal);
  modal.querySelector(".modal-backdrop").addEventListener("click", closeModal);
  modal.querySelector("#btn-mem-submit").addEventListener("click", async () => {
    const amount = parseFloat(modal.querySelector("#mem-amount").value);
    if (!amount || amount <= 0) {
      toast("Informe o valor", "error");
      return;
    }
    await onSubmit(invoiceId, { color: selectedColor, amount });
    closeModal();
  });
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(state) {
  const { transactions: txs, budgetPlans, invoices, user } = state;
  if (!user) return;

  updateTxCount(txs.length);
  renderSummary(txs);

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

  renderChecklist(txs, {
    toggle: async (id) => {
      const tx = txById[id];
      if (!tx) return;
      if (!tx.isPaid) {
        const paidAmount = await showPayModal(tx);
        if (paidAmount === undefined) return;
        await togglePaid(user.uid, id, false, paidAmount);
        toast("Conta marcada como paga ✓");
      } else {
        await togglePaid(user.uid, id, true, null);
        toast("Marcada como pendente");
      }
      await loadMonth(true);
    },
    edit: handleEdit,
    delete: (id) => {
      const tx = txById[id];
      if (tx) deleteFixedBill(user.uid, tx);
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

  renderBudgetPlan(
    budgetPlans,
    txs,
    () =>
      openBudgetModal(async (data) => {
        const { repeatEveryMonth, ...rest } = data;
        const { month, year } = getState();
        if (repeatEveryMonth) {
          await addBudgetPlanTemplate(user.uid, rest);
          toast("Categoria recorrente adicionada ✓");
        } else {
          await addBudgetPlan(user.uid, month, year, rest);
          toast("Categoria adicionada ao plano ✓");
        }
        await loadMonth(true);
      }),
    async (planId) => {
      await deleteBudgetPlan(user.uid, planId);
      toast("Categoria removida");
      await loadMonth(true);
    },
  );

  renderInvoices(
    invoices,
    () =>
      openInvoiceModal(async (data) => {
        await addInvoice(user.uid, getState().month, getState().year, data);
        toast("Fatura criada ✓");
        await loadMonth(true);
      }),
    async (invoiceId) => {
      await deleteInvoice(user.uid, invoiceId);
      toast("Fatura excluída");
      await loadMonth(true);
    },
    (invoiceId) =>
      openAddMemberModal(invoiceId, async (invId, data) => {
        await addInvoiceMember(user.uid, invId, data);
        toast("Pessoa adicionada ✓");
        await loadMonth(true);
      }),
    async (member) => {
      await toggleMemberPaid(user.uid, member.id, member.isPaid);
      await loadMonth(true);
    },
    async (memberId) => {
      await deleteInvoiceMember(user.uid, memberId);
      toast("Removido ✓");
      await loadMonth(true);
    },
  );

  renderDonut("donut-canvas", txs);
  renderLiquidityChart("liquidity-canvas", txs);
}

// ── Navigation ────────────────────────────────────────────────────────────────

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
        setState({ transactions: [], budgetPlans: [], invoices: [] });
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
          const { repeatEveryMonth, ...rest } = data;
          if (repeatEveryMonth) {
            // Save as recurring template (instantiateFixedBills will create this month's entry)
            await addFixedTemplate(user.uid, rest);
            toast("Conta fixa recorrente cadastrada ✓");
          } else {
            // Save only as a one-off transaction for this month
            const { month, year } = getState();
            await addTransaction(user.uid, {
              type: "expense",
              kind: "fixed",
              categoryId: rest.categoryId,
              customLabel: rest.customLabel || rest.name,
              description: null,
              amount: rest.amount,
              dueDay: rest.dueDay || null,
              isPaid: false,
              templateId: null,
              month,
              year,
            });
            toast("Conta fixa adicionada só este mês ✓");
          }
          await loadMonth();
        });
      });

    document.getElementById("btn-add-budget")?.addEventListener("click", () => {
      openBudgetModal(async (data) => {
        const { repeatEveryMonth, ...rest } = data;
        const { month, year } = getState();
        if (repeatEveryMonth) {
          await addBudgetPlanTemplate(user.uid, rest);
          toast("Categoria recorrente adicionada ✓");
        } else {
          await addBudgetPlan(user.uid, month, year, rest);
          toast("Categoria adicionada ao plano ✓");
        }
        await loadMonth(true);
      });
    });

    document
      .getElementById("btn-add-invoice")
      ?.addEventListener("click", () => {
        openInvoiceModal(async (data) => {
          await addInvoice(user.uid, getState().month, getState().year, data);
          toast("Fatura criada ✓");
          await loadMonth(true);
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
