import en from "@/locales/en/common.json";
import tr from "@/locales/tr/common.json";

export const messageBundles = ["login", "account", "admin", "email", "backend", "common"] as const;
export type MessageBundle = (typeof messageBundles)[number];

const webRoots: Record<Exclude<MessageBundle, "email" | "backend">, string[]> = {
  login: [
    "brand",
    "navbar",
    "login",
    "accountActions",
    "requiredActions",
    "mfa",
    "registration",
    "consent",
    "error",
  ],
  account: ["brand", "navbar", "theme", "account", "error"],
  admin: ["brand", "navbar", "theme", "admin", "error"],
  common: ["brand", "navbar", "theme", "error"],
};

export function webBundleMessages(locale: "en" | "tr", bundle: MessageBundle) {
  if (bundle === "email" || bundle === "backend") return {};
  const dictionary = locale === "tr" ? tr : en;
  const selected = Object.fromEntries(
    webRoots[bundle].flatMap((root) =>
      root in dictionary ? [[root, dictionary[root as keyof typeof dictionary]]] : [],
    ),
  );
  return flattenMessages(selected);
}

function flattenMessages(value: Record<string, unknown>, prefix = "") {
  return Object.entries(value).reduce<Record<string, string>>((result, [key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") result[path] = child;
    else if (child && typeof child === "object" && !Array.isArray(child)) {
      Object.assign(result, flattenMessages(child as Record<string, unknown>, path));
    }
    return result;
  }, {});
}
