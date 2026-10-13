import { formatOrdinal } from "@/shared/lib/format";

/** Messages for the income area. */
export const income = {
  title: "Income & spending",
  description: "What comes in each month, what goes out, and what is left to save.",
  addSource: "Add income source",
  sourcesTitle: "Income sources",
  activeTitle: "From work",
  passiveTitle: "From money you own",
  active: "Active",
  passive: "Passive",
  paymentDay: (p: { day: number }) => `${formatOrdinal(p.day)} of month`,
  columns: {
    source: "Source",
    type: "Type",
    payment: "Payment",
    capital: "Capital",
    monthly: "Monthly",
  },
  capital: {
    yield: (p: { pct: string }) => `${p.pct} yield / yr`,
    noYield: "No yield",
    /** Wraps the reserved amount: "· of {money} reserved". */
    ofPrefix: " · of ",
    reservedSuffix: " reserved",
  },
  empty: {
    title: "No income sources yet",
    description: "Add your salary, rental or interest income to power the projections.",
  },
  toast: {
    updated: "Income source updated",
    added: "Income source added",
    deleted: "Income source deleted",
  },
  confirmDelete: {
    title: "Delete income source?",
    description: (p: { name: string }) => `Remove "${p.name}" from your income sources?`,
  },


  form: {
    addTitle: "Add income source",
    editTitle: "Edit income source",
    description: "Monthly income feeds the dashboard, goal projections and the year-end estimate.",
    nameRequired: "Name is required",
    type: "Type",
    name: "Name",
    namePlaceholder: "e.g. Salary, rental income",
    details: "Details",
    detailsPlaceholder: "Optional description",
    monthly: "Monthly amount",
    icon: "Icon",
    capital: "Capital invested",
    /** Wraps the capital total: "{money} from N sources". */
    capitalFrom: (p: { count: number }) => ` from ${p.count} ${p.count === 1 ? "source" : "sources"}`,
    capitalEmpty: "Link the assets that earn this income",
    capitalHint: "Mainly for passive income (deposits, bonds, rentals). Tracked separately from goal plans.",
    paidBy: "Paid by",
    paidByPlaceholder: "Optional",
    paymentDay: "Payment day",
    submitAdd: "Add source",
  },
  capitalDialog: {
    title: "Capital invested",
    description: "Which assets produce this income? Amounts are capped by what other income sources already claim.",
    apply: "Use these sources",
    subject: "income source",
  },
};
