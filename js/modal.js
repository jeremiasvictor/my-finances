// ─────────────────────────────────────────────────────────────────────────────
// js/modal.js  –  Transaction & Fixed-Template modal logic
// ─────────────────────────────────────────────────────────────────────────────

import { FIXED_CATS, VARIABLE_CATS, INCOME_CATS } from "./categories.js";

// ── Generic open/close ────────────────────────────────────────────────────────

export function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add("open"); document.body.style.overflow = "hidden"; }
}

export function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove("open"); document.body.style.overflow = ""; }
}

// Close modals on backdrop click
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-backdrop")) {
    closeModal(e.target.closest(".modal-wrapper").id);
  }
});

// Close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-wrapper.open").forEach((m) => closeModal(m.id));
  }
});

// ── Transaction modal ─────────────────────────────────────────────────────────

const CAT_GROUPS = {
  income:   INCOME_CATS,
  fixed:    FIXED_CATS,
  variable: VARIABLE_CATS,
};

function buildCatGrid(cats, selected = "") {
  return cats.map((c) => `
    <button type="button" class="cat-btn ${selected === c.id ? "active" : ""}" data-cat="${c.id}">
      <i data-lucide="${c.icon}"></i>
      <span>${c.label}</span>
    </button>`).join("");
}

export function openTransactionModal(onSubmit) {
  const modal = document.getElementById("modal-tx");
  if (!modal) return;

  // Reset form
  modal.querySelector("#tx-amount").value    = "";
  modal.querySelector("#tx-desc").value      = "";
  modal.querySelector("#tx-due").value       = "";
  modal.querySelector("#tx-custom-cat").value = "";
  modal.querySelector("#tx-custom-wrap").style.display = "none";

  let txType = "expense";  // income | expense
  let txKind = "variable"; // fixed | variable
  let catId  = "";

  function refreshCats() {
    const group = txType === "income" ? "income" : txKind;
    modal.querySelector("#cat-grid").innerHTML = buildCatGrid(CAT_GROUPS[group], catId);
    catId = ""; // reset selection on kind change
    if (window.lucide) lucide.createIcons();
    modal.querySelector("#kind-row").style.display = txType === "expense" ? "flex" : "none";
  }

  // Type tabs
  modal.querySelectorAll("[data-tx-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      txType = btn.dataset.txType;
      modal.querySelectorAll("[data-tx-type]").forEach((b) => b.classList.toggle("active", b === btn));
      refreshCats();
    });
  });

  // Kind tabs
  modal.querySelectorAll("[data-tx-kind]").forEach((btn) => {
    btn.addEventListener("click", () => {
      txKind = btn.dataset.txKind;
      modal.querySelectorAll("[data-tx-kind]").forEach((b) => b.classList.toggle("active", b === btn));
      refreshCats();
    });
  });

  // Cat grid delegation
  modal.querySelector("#cat-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    catId = btn.dataset.cat;
    modal.querySelectorAll(".cat-btn").forEach((b) => b.classList.toggle("active", b === btn));
    modal.querySelector("#tx-custom-wrap").style.display = catId === "outros" ? "block" : "none";
  });

  // Submit
  modal.querySelector("#btn-tx-submit").onclick = async () => {
    const amount = parseFloat(modal.querySelector("#tx-amount").value);
    if (!amount || amount <= 0) { alert("Informe um valor válido."); return; }
    if (!catId) { alert("Selecione uma categoria."); return; }

    const payload = {
      type:        txType,
      kind:        txType === "income" ? "variable" : txKind,
      categoryId:  catId,
      customLabel: catId === "outros" ? modal.querySelector("#tx-custom-cat").value || "Outros" : null,
      description: modal.querySelector("#tx-desc").value || null,
      amount,
      dueDay:      parseInt(modal.querySelector("#tx-due").value) || null,
      isPaid:      false,
    };

    await onSubmit(payload);
    closeModal("modal-tx");
  };

  // Init
  modal.querySelectorAll("[data-tx-type]")[0].classList.add("active");
  modal.querySelectorAll("[data-tx-kind]")[1].classList.add("active"); // variable default
  refreshCats();

  openModal("modal-tx");
}

// ── Fixed Template modal ───────────────────────────────────────────────────────

export function openTemplateModal(onSubmit) {
  const modal = document.getElementById("modal-template");
  if (!modal) return;

  modal.querySelector("#tpl-name").value   = "";
  modal.querySelector("#tpl-amount").value = "";
  modal.querySelector("#tpl-due").value    = "";

  let catId = "";

  modal.querySelector("#tpl-cat-grid").innerHTML = buildCatGrid(FIXED_CATS);
  if (window.lucide) lucide.createIcons();

  modal.querySelector("#tpl-cat-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".cat-btn");
    if (!btn) return;
    catId = btn.dataset.cat;
    modal.querySelectorAll("#tpl-cat-grid .cat-btn").forEach((b) =>
      b.classList.toggle("active", b === btn));
  });

  modal.querySelector("#btn-tpl-submit").onclick = async () => {
    const name   = modal.querySelector("#tpl-name").value.trim();
    const amount = parseFloat(modal.querySelector("#tpl-amount").value);
    if (!name)   { alert("Informe o nome da conta."); return; }
    if (!amount) { alert("Informe o valor."); return; }
    if (!catId)  { alert("Selecione uma categoria."); return; }

    await onSubmit({ name, amount, categoryId: catId,
                     dueDay: parseInt(modal.querySelector("#tpl-due").value) || null });
    closeModal("modal-template");
  };

  openModal("modal-template");
}
