// ─────────────────────────────────────────────────────────────────────────────
// js/modal.js  –  Transaction & Fixed-Template modal logic
// ─────────────────────────────────────────────────────────────────────────────

import { FIXED_CATS, VARIABLE_CATS, INCOME_CATS } from "./categories.js";

// ── Generic open/close ────────────────────────────────────────────────────────

export function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add("open");
    document.body.style.overflow = "hidden";
  }
}

export function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove("open");
    document.body.style.overflow = "";
  }
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-backdrop")) {
    closeModal(e.target.closest(".modal-wrapper").id);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document
      .querySelectorAll(".modal-wrapper.open")
      .forEach((m) => closeModal(m.id));
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAT_GROUPS = {
  income: INCOME_CATS,
  fixed: FIXED_CATS,
  variable: VARIABLE_CATS,
};

function buildCatGrid(cats, selected = "") {
  return cats
    .map(
      (c) => `
    <button type="button" class="cat-btn ${selected === c.id ? "active" : ""}" data-cat="${c.id}">
      <i data-lucide="${c.icon}"></i>
      <span>${c.label}</span>
    </button>`,
    )
    .join("");
}

/** Renders a day input paired with a "Hoje" shortcut button. */
function dueDayField(inputId, value = "") {
  const today = new Date().getDate();
  return `
    <div style="display:flex;gap:.4rem;align-items:center;flex:none">
      <input id="${inputId}" class="field w-20" type="number" min="1" max="31"
        placeholder="Dia" value="${value}" />
      <button type="button" class="today-btn" data-target="${inputId}" title="Usar hoje (dia ${today})">
        Hoje
      </button>
    </div>`;
}

/** Wire all "Hoje" buttons inside a container. */
function wireHojeButtons(container) {
  container.querySelectorAll(".today-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const inp = container.querySelector(`#${btn.dataset.target}`);
      if (inp) inp.value = new Date().getDate();
    });
  });
}

// ── Transaction modal (add + edit) ────────────────────────────────────────────

/**
 * @param {function} onSubmit  — called with (payload, txId|null)
 * @param {object}   [editTx]  — if provided, pre-fills form for editing
 */
export function openTransactionModal(onSubmit, editTx = null) {
  const modal = document.getElementById("modal-tx");
  if (!modal) return;

  const isEdit = !!editTx;

  let txType = editTx?.type || "expense";
  let txKind = editTx?.kind || "variable";
  let catId = editTx?.categoryId || "";

  // Inject due-day field with Hoje button
  const dueWrap = modal.querySelector("#tx-due-wrap");
  if (dueWrap) {
    dueWrap.innerHTML = dueDayField("tx-due", editTx?.dueDay || "");
    wireHojeButtons(dueWrap);
  }

  // Pre-fill fields
  modal.querySelector("#tx-amount").value = editTx?.amount || "";
  modal.querySelector("#tx-desc").value = editTx?.description || "";
  modal.querySelector("#tx-custom-cat").value = editTx?.customLabel || "";
  modal.querySelector("#tx-custom-wrap").style.display =
    catId === "outros" ? "block" : "none";
  modal.querySelector(".modal-title").textContent = isEdit
    ? "Editar Lançamento"
    : "Novo Lançamento";
  modal.querySelector("#btn-tx-submit").textContent = isEdit
    ? "Salvar alterações"
    : "Adicionar";

  // Set active tabs
  modal
    .querySelectorAll("[data-tx-type]")
    .forEach((b) => b.classList.toggle("active", b.dataset.txType === txType));
  modal
    .querySelectorAll("[data-tx-kind]")
    .forEach((b) => b.classList.toggle("active", b.dataset.txKind === txKind));

  function refreshCats(keepCat = false) {
    const group = txType === "income" ? "income" : txKind;
    modal.querySelector("#cat-grid").innerHTML = buildCatGrid(
      CAT_GROUPS[group],
      keepCat ? catId : "",
    );
    if (!keepCat) catId = "";
    if (window.lucide) lucide.createIcons();
    modal.querySelector("#kind-row").style.display =
      txType === "expense" ? "flex" : "none";
    modal.querySelector("#tx-custom-wrap").style.display =
      catId === "outros" ? "block" : "none";
  }

  refreshCats(true);

  // Type tabs
  modal.querySelectorAll("[data-tx-type]").forEach((btn) => {
    btn.onclick = () => {
      txType = btn.dataset.txType;
      modal
        .querySelectorAll("[data-tx-type]")
        .forEach((b) => b.classList.toggle("active", b === btn));
      refreshCats();
    };
  });

  // Kind tabs
  modal.querySelectorAll("[data-tx-kind]").forEach((btn) => {
    btn.onclick = () => {
      txKind = btn.dataset.txKind;
      modal
        .querySelectorAll("[data-tx-kind]")
        .forEach((b) => b.classList.toggle("active", b === btn));
      refreshCats();
    };
  });

  // Cat grid
  modal.querySelector("#cat-grid").onclick = (e) => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    catId = btn.dataset.cat;
    modal
      .querySelectorAll(".cat-btn")
      .forEach((b) => b.classList.toggle("active", b === btn));
    modal.querySelector("#tx-custom-wrap").style.display =
      catId === "outros" ? "block" : "none";
  };

  // Submit
  modal.querySelector("#btn-tx-submit").onclick = async () => {
    const amount = parseFloat(modal.querySelector("#tx-amount").value);
    if (!amount || amount <= 0) {
      alert("Informe um valor válido.");
      return;
    }
    if (!catId) {
      alert("Selecione uma categoria.");
      return;
    }

    const payload = {
      type: txType,
      kind: txType === "income" ? "variable" : txKind,
      categoryId: catId,
      customLabel:
        catId === "outros"
          ? modal.querySelector("#tx-custom-cat").value || "Outros"
          : null,
      description: modal.querySelector("#tx-desc").value || null,
      amount,
      dueDay: parseInt(modal.querySelector("#tx-due").value) || null,
      isPaid: editTx?.isPaid || false,
    };

    await onSubmit(payload, isEdit ? editTx.id : null);
    closeModal("modal-tx");
  };

  openModal("modal-tx");
}

// ── Fixed Template modal ───────────────────────────────────────────────────────

// Extended fixed cats including "Outros" for custom
const FIXED_CATS_WITH_CUSTOM = [
  ...FIXED_CATS,
  { id: "outros", label: "Outros", icon: "plus" },
];

export function openTemplateModal(onSubmit) {
  const modal = document.getElementById("modal-template");
  if (!modal) return;

  modal.querySelector("#tpl-name").value = "";
  modal.querySelector("#tpl-amount").value = "";

  const dueWrap = modal.querySelector("#tpl-due-wrap");
  if (dueWrap) {
    dueWrap.innerHTML = dueDayField("tpl-due");
    wireHojeButtons(dueWrap);
  }

  // Inject repeat toggle + custom label field if not already present
  let extraWrap = modal.querySelector("#tpl-extra");
  if (!extraWrap) {
    extraWrap = document.createElement("div");
    extraWrap.id = "tpl-extra";
    modal.querySelector("#btn-tpl-submit").before(extraWrap);
  }
  extraWrap.innerHTML = `
    <div id="tpl-custom-wrap" style="display:none;margin-bottom:.6rem">
      <input id="tpl-custom-label" class="field" placeholder="Nome da categoria" style="width:100%"/>
    </div>
    <label class="toggle-row" style="margin-bottom:.85rem">
      <div class="toggle-info">
        <span class="toggle-label">Repetir todo mês</span>
        <span class="toggle-sub">Aparece automaticamente em meses futuros</span>
      </div>
      <div class="toggle-switch" id="tpl-repeat-toggle" data-on="true">
        <div class="toggle-thumb"></div>
      </div>
    </label>`;

  let catId = "";
  let repeatOn = true;

  modal.querySelector("#tpl-cat-grid").innerHTML = buildCatGrid(
    FIXED_CATS_WITH_CUSTOM,
  );
  if (window.lucide) lucide.createIcons();

  // Toggle switch interaction
  const toggle = modal.querySelector("#tpl-repeat-toggle");
  toggle.addEventListener("click", () => {
    repeatOn = !repeatOn;
    toggle.dataset.on = repeatOn;
  });

  modal.querySelector("#tpl-cat-grid").onclick = (e) => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    catId = btn.dataset.cat;
    modal
      .querySelectorAll("#tpl-cat-grid .cat-btn")
      .forEach((b) => b.classList.toggle("active", b === btn));
    modal.querySelector("#tpl-custom-wrap").style.display =
      catId === "outros" ? "block" : "none";
  };

  modal.querySelector("#btn-tpl-submit").onclick = async () => {
    const name = modal.querySelector("#tpl-name").value.trim();
    const amount = parseFloat(modal.querySelector("#tpl-amount").value);
    const dueDay = parseInt(modal.querySelector("#tpl-due").value) || null;
    if (!name) {
      alert("Informe o nome da conta.");
      return;
    }
    if (!amount) {
      alert("Informe o valor.");
      return;
    }
    if (!catId) {
      alert("Selecione uma categoria.");
      return;
    }

    const customLabel =
      catId === "outros"
        ? modal.querySelector("#tpl-custom-label").value.trim() || "Outros"
        : null;

    await onSubmit({
      name,
      amount,
      categoryId: catId,
      customLabel,
      dueDay,
      repeatEveryMonth: repeatOn,
    });
    closeModal("modal-template");
  };

  openModal("modal-template");
}
