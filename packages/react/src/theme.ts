export type McpTheme = "light" | "dark";

const query = "(prefers-color-scheme: dark)";

export function systemTheme(): McpTheme {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches
    ? "dark"
    : "light";
}

export function subscribeSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const preference = window.matchMedia(query);
  if (typeof preference.addEventListener === "function") {
    preference.addEventListener("change", onChange);
    return () => preference.removeEventListener("change", onChange);
  }
  preference.addListener(onChange);
  return () => preference.removeListener(onChange);
}
