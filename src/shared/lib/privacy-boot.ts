/** Per-device setting (not synced): someone may want amounts hidden on the phone only. */
export const PRIVACY_STORAGE_KEY = "cairn:privacy";
export const PRIVACY_CLASS = "privacy";

/**
 * Inline `<head>` script (server-safe module): applies the saved setting
 * before first paint so amounts never flash unblurred.
 */
export const PRIVACY_BOOT_SCRIPT = `try{localStorage.getItem("${PRIVACY_STORAGE_KEY}")==="1"&&document.documentElement.classList.add("${PRIVACY_CLASS}")}catch(e){}`;
