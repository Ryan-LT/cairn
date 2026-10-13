/** Messages for the assets area. */
export const assets = {
  title: "Assets",
  description: "Everything you own and how quickly you can access it.",
  addAsset: "Add asset",
  kpi: {
    total: { label: "Total assets", hint: (p: { count: number }) => `${p.count} tracked ${p.count === 1 ? "asset" : "assets"}` },
    instant: { label: "Instant access", hint: "Cash and equivalents" },
    notInstant: { label: "Not instant", hint: "Locked, property, term" },
    categories: { label: "Categories", hint: (p: { count: number }) => `${p.count} available` },
  },
  list: {
    title: "All assets",
    description: "Drag rows to set your preferred order.",
    searchPlaceholder: "Search name or category…",
    emptyTitle: "No assets yet",
    emptyDescription: "Add cash, investments, property and anything else you own.",
    noMatch: "No assets match your search",
  },
  toast: {
    added: "Asset added",
    updated: "Asset updated",
    deleted: "Asset deleted",
  },
  confirmDelete: {
    title: "Delete asset?",
    description: (p: { name: string }) =>
      `This removes "${p.name}" from your list. Goal plans using it lose that allocation.`,
  },
  form: {
    addTitle: "Add asset",
    editTitle: "Edit asset",
    description: "Assets count toward net worth and can fund goal plans.",
    name: "Name",
    namePlaceholder: "e.g. Emergency fund, apartment",
    nameRequired: "Name is required",
    category: "Category",
    categoryRequired: "Pick or create a category",
    categoryDescription: "Type a new name to create your own category.",
    access: "Access",
    accessDescription: "Instant: cash or equivalents you can spend now. Not instant: locked, term deposits, property.",
    currentValue: "Current value",
    submitAdd: "Add asset",
  },
};
