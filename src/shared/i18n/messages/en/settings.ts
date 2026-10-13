/** Messages for the settings area. */
export const settings = {
  description: "Your milestone goal, appearance, data sync, password and session.",
  milestone: {
    title: "Milestone goal",
    description:
      "The net worth you want to reach and by what age. Shown on the dashboard; the deadline is your birthday at that age.",
    saved: "Milestone goal saved",
    birthDate: "Date of birth",
    birthDatePlaceholder: "Pick your birthday",
    target: "Target net worth (USD)",
    targetAge: "By age",
    ageRange: (p: { min: number; max: number }) => `Age must be between ${p.min} and ${p.max}.`,
  },
  appearance: {
    title: "Appearance",
    description: (p: { brand: string }) => `Choose how ${p.brand} looks on this device.`,
    languageHint: "Choose the app's language. It follows your account to other devices.",
  },
  data: {
    title: "Data & sync",
    description:
      "Your data is private to your account. It is saved to the server and cached on this device so the app works offline.",
    syncNow: "Sync now",
    connection: "Connection",
    lastSynced: "Last synced",
    notYet: "Not yet",
    backup: "Backup",
    backupHint: "Downloads every table as JSON (same shape as the API).",
    exportJson: "Export JSON",
    backupDownloaded: "Backup downloaded",
  },
  password: {
    title: "Password",
    description: "Changing it signs you out on your other devices. Forgot it? Ask the app admin to reset it.",
    current: "Current password",
    next: "New password",
    hint: (p: { min: number }) => `At least ${p.min} characters.`,
    confirm: "Confirm new password",
    submit: "Change password",
    submitting: "Changing…",
    changed: "Password changed",
    changedDescription: "Other devices were signed out.",
  },
  session: {
    title: "Session",
    signedInAs: "Signed in as",
    login: "Login",
    enabled: "Enabled",
    disabled: "Disabled",
    disabledHint: "Set DATABASE_URL and AUTH_SECRET on the server and add accounts with db/create-user.sql.",
    signOut: "Sign out",
  },
};
