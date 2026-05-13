// ─────────────────────────────────────────────────────────────────────────────
// js/db.js  –  Firestore data layer
//
// Collections:
//   /users/{uid}/fixedTemplates/{id}   → recurring bill definitions
//   /users/{uid}/transactions/{id}     → monthly transaction instances
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const txCol = (uid) => collection(db, "users", uid, "transactions");
const tplCol = (uid) => collection(db, "users", uid, "fixedTemplates");

// ── Fixed Bill Templates ──────────────────────────────────────────────────────

/**
 * Create a recurring fixed-bill template.
 * @param {string} uid
 * @param {{ name, amount, categoryId, dueDay }} data
 */
export async function addFixedTemplate(uid, data) {
  return addDoc(tplCol(uid), { ...data, createdAt: serverTimestamp() });
}

/** Get all fixed-bill templates for a user. */
export async function getFixedTemplates(uid) {
  const snap = await getDocs(query(tplCol(uid), orderBy("createdAt")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Delete a fixed-bill template. */
export async function deleteFixedTemplate(uid, templateId) {
  return deleteDoc(doc(tplCol(uid), templateId));
}

// ── Transactions ──────────────────────────────────────────────────────────────

/**
 * Schema for a transaction document:
 * {
 *   userId     : string
 *   type       : "income" | "expense"
 *   kind       : "fixed" | "variable"
 *   categoryId : string          // e.g. "aluguel", "mercado", "salario"
 *   customLabel: string | null   // for "outros" category
 *   description: string | null
 *   amount     : number
 *   dueDay     : number | null   // day-of-month bill is due
 *   isPaid     : boolean
 *   month      : number          // 0-11
 *   year       : number
 *   templateId : string | null   // links back to fixedTemplate if instantiated
 *   createdAt  : Timestamp
 * }
 */

/** Add a new transaction. Returns the created doc reference. */
export async function addTransaction(uid, payload) {
  return addDoc(txCol(uid), {
    userId: uid,
    templateId: null,
    customLabel: null,
    description: null,
    dueDay: null,
    isPaid: false,
    ...payload,
    createdAt: serverTimestamp(),
  });
}

/**
 * Ensure all fixed-bill templates have a transaction instance for a given month/year.
 * Creates missing ones; skips those already present (idempotent).
 */
export async function instantiateFixedBills(uid, month, year) {
  const templates = await getFixedTemplates(uid);
  if (!templates.length) return;

  // Fetch existing fixed transactions for this month
  const existing = await getMonthTransactions(uid, month, year);
  const existingTemplateIds = new Set(
    existing.filter((t) => t.templateId).map((t) => t.templateId),
  );

  const promises = templates
    .filter((tpl) => !existingTemplateIds.has(tpl.id))
    .map((tpl) =>
      addDoc(txCol(uid), {
        userId: uid,
        type: "expense",
        kind: "fixed",
        categoryId: tpl.categoryId,
        customLabel: tpl.name,
        description: null,
        amount: tpl.amount,
        dueDay: tpl.dueDay || null,
        isPaid: false,
        month,
        year,
        templateId: tpl.id,
        createdAt: serverTimestamp(),
      }),
    );

  return Promise.all(promises);
}

/** Fetch all transactions for a user in a given month/year. */
export async function getMonthTransactions(uid, month, year) {
  const q = query(
    txCol(uid),
    where("month", "==", month),
    where("year", "==", year),
    orderBy("createdAt", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Mark as paid (with optional real amount) or unpaid.
 * paidAmount=null means use the estimate (amount field).
 */
export async function togglePaid(uid, txId, current, paidAmount = null) {
  const fields = { isPaid: !current };
  if (!current) {
    fields.paidAmount = paidAmount; // null = use estimate
  } else {
    fields.paidAmount = null; // clear when marking unpaid
  }
  return updateDoc(doc(txCol(uid), txId), fields);
}

/** Update any fields on a transaction. */
export async function updateTransaction(uid, txId, fields) {
  return updateDoc(doc(txCol(uid), txId), fields);
}

/** Delete a transaction. */
export async function deleteTransaction(uid, txId) {
  return deleteDoc(doc(txCol(uid), txId));
}
