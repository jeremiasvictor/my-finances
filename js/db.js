// ─────────────────────────────────────────────────────────────────────────────
// js/db.js  –  Firestore data layer
// Collections:
//   /users/{uid}/fixedTemplates/{id}   → recurring bill templates
//   /users/{uid}/transactions/{id}     → monthly transactions
//   /users/{uid}/budgetPlans/{id}      → spending plan categories (per month/year)
//   /users/{uid}/invoices/{id}         → credit card invoices (per month/year)
//   /users/{uid}/invoiceMembers/{id}   → people sharing an invoice
// ─────────────────────────────────────────────────────────────────────────────

import { db } from "./firebase-config.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const txCol = (uid) => collection(db, "users", uid, "transactions");
const tplCol = (uid) => collection(db, "users", uid, "fixedTemplates");
const budgetCol = (uid) => collection(db, "users", uid, "budgetPlans");
const invoiceCol = (uid) => collection(db, "users", uid, "invoices");
const memberCol = (uid) => collection(db, "users", uid, "invoiceMembers");

// ── Fixed Bill Templates ──────────────────────────────────────────────────────

export async function addFixedTemplate(uid, data) {
  return addDoc(tplCol(uid), { ...data, createdAt: serverTimestamp() });
}
export async function getFixedTemplates(uid) {
  const snap = await getDocs(query(tplCol(uid), orderBy("createdAt")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function deleteFixedTemplate(uid, templateId) {
  return deleteDoc(doc(tplCol(uid), templateId));
}

// ── Transactions ──────────────────────────────────────────────────────────────

export async function addTransaction(uid, payload) {
  return addDoc(txCol(uid), {
    userId: uid,
    templateId: null,
    customLabel: null,
    description: null,
    dueDay: null,
    isPaid: false,
    paidAmount: null,
    ...payload,
    createdAt: serverTimestamp(),
  });
}

export async function instantiateFixedBills(uid, month, year) {
  const templates = await getFixedTemplates(uid);
  if (!templates.length) return;
  const existing = await getMonthTransactions(uid, month, year);
  const existingIds = new Set(
    existing.filter((t) => t.templateId).map((t) => t.templateId),
  );
  return Promise.all(
    templates
      .filter((tpl) => !existingIds.has(tpl.id))
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
          paidAmount: null,
          month,
          year,
          templateId: tpl.id,
          createdAt: serverTimestamp(),
        }),
      ),
  );
}

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

export async function togglePaid(uid, txId, current, paidAmount = null) {
  const fields = { isPaid: !current };
  fields.paidAmount = !current ? paidAmount : null;
  return updateDoc(doc(txCol(uid), txId), fields);
}
export async function updateTransaction(uid, txId, fields) {
  return updateDoc(doc(txCol(uid), txId), fields);
}
export async function deleteTransaction(uid, txId) {
  return deleteDoc(doc(txCol(uid), txId));
}

// ── Budget Plans ──────────────────────────────────────────────────────────────
// Schema: { uid, month, year, categoryId, customLabel, icon, budget, createdAt }

export async function getBudgetPlans(uid, month, year) {
  const q = query(
    budgetCol(uid),
    where("month", "==", month),
    where("year", "==", year),
    orderBy("createdAt", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addBudgetPlan(uid, month, year, data) {
  return addDoc(budgetCol(uid), {
    userId: uid,
    month,
    year,
    ...data,
    createdAt: serverTimestamp(),
  });
}
export async function updateBudgetPlan(uid, planId, fields) {
  return updateDoc(doc(budgetCol(uid), planId), fields);
}
export async function deleteBudgetPlan(uid, planId) {
  return deleteDoc(doc(budgetCol(uid), planId));
}

// ── Invoices ──────────────────────────────────────────────────────────────────
// Schema: { uid, month, year, name, totalAmount, createdAt }

export async function getInvoices(uid, month, year) {
  const q = query(
    invoiceCol(uid),
    where("month", "==", month),
    where("year", "==", year),
    orderBy("createdAt", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addInvoice(uid, month, year, data) {
  return addDoc(invoiceCol(uid), {
    userId: uid,
    month,
    year,
    ...data,
    createdAt: serverTimestamp(),
  });
}
export async function updateInvoice(uid, invoiceId, fields) {
  return updateDoc(doc(invoiceCol(uid), invoiceId), fields);
}
export async function deleteInvoice(uid, invoiceId) {
  return deleteDoc(doc(invoiceCol(uid), invoiceId));
}

// ── Invoice Members ───────────────────────────────────────────────────────────
// Schema: { uid, invoiceId, name, amount, isPaid, createdAt }

export async function getInvoiceMembers(uid, invoiceId) {
  const q = query(
    memberCol(uid),
    where("invoiceId", "==", invoiceId),
    orderBy("createdAt", "asc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function addInvoiceMember(uid, invoiceId, data) {
  return addDoc(memberCol(uid), {
    userId: uid,
    invoiceId,
    isPaid: false,
    ...data,
    createdAt: serverTimestamp(),
  });
}
export async function toggleMemberPaid(uid, memberId, current) {
  return updateDoc(doc(memberCol(uid), memberId), { isPaid: !current });
}
export async function deleteInvoiceMember(uid, memberId) {
  return deleteDoc(doc(memberCol(uid), memberId));
}
