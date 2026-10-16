import { messages } from "@kitezh/shared/catalog";

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

function placeholders(message: string) {
  return [...message.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]).sort();
}

describe("shared Web message catalog", () => {
  it("keeps non-empty English and Turkish keys and placeholders aligned", () => {
    const english = flattenMessages(messages.en.web);
    const turkish = flattenMessages(messages.tr.web);
    const keys = Object.keys(english).sort();

    expect(keys.length).toBeGreaterThan(0);
    expect(Object.keys(turkish).sort()).toEqual(keys);
    for (const key of keys) {
      expect(english[key]).toBeTruthy();
      expect(turkish[key]).toBeTruthy();
      expect(placeholders(turkish[key])).toEqual(placeholders(english[key]));
    }
  });
});
