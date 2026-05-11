// ─────────────────────────────────────────────────────────────────────────────
// js/categories.js  –  Category definitions
// ─────────────────────────────────────────────────────────────────────────────

// Lucide icon names map to the global `lucide` object injected by the CDN.
// Call lucide.createIcons() after inserting any data-lucide attribute.

export const FIXED_CATS = [
  { id: "internet",  label: "Internet",  icon: "wifi"         },
  { id: "energia",   label: "Energia",   icon: "zap"          },
  { id: "aluguel",   label: "Aluguel",   icon: "home"         },
  { id: "fatura",    label: "Fatura",    icon: "credit-card"  },
];

export const VARIABLE_CATS = [
  { id: "transporte", label: "Transporte", icon: "bus"           },
  { id: "ru",         label: "RU",         icon: "utensils"      },
  { id: "mercado",    label: "Mercado",    icon: "shopping-cart" },
  { id: "recarga",    label: "Recarga",    icon: "smartphone"    },
  { id: "agua",       label: "Água",       icon: "droplet"       },
  { id: "igreja",     label: "Igreja",     icon: "church"        },
  { id: "outros",     label: "Outros",     icon: "plus"          },
];

export const INCOME_CATS = [
  { id: "salario",      label: "Salário",      icon: "wallet"          },
  { id: "bolsa",        label: "Bolsa",        icon: "graduation-cap"  },
  { id: "renda_extra",  label: "Renda Extra",  icon: "briefcase"       },
  { id: "auxilio",      label: "Auxílio",      icon: "hand-helping"    },
];

export const ALL_CATS = [...FIXED_CATS, ...VARIABLE_CATS, ...INCOME_CATS];

/** Return the category object for a given id (falls back to a generic entry). */
export function getCat(id) {
  return ALL_CATS.find((c) => c.id === id) || { id, label: id, icon: "circle" };
}
