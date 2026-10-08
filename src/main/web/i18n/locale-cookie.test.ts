import { detectLocale, persistLocale } from "./locale-cookie";

describe("client locale detection", () => {
  it.each([
    ["locale=tr; theme=dark", ["en-US"], "tr"],
    ["locale=en", ["tr-TR"], "en"],
    ["locale=de", ["tr-TR", "en-US"], "tr"],
    ["", ["de-DE", "en-GB"], "en"],
    ["", ["tr-TR"], "tr"],
    ["", ["fr-FR"], "en"],
    ["", [], "en"],
  ] as const)("detects locale from %s and %s", (cookie, languages, expected) => {
    expect(detectLocale(cookie, languages)).toBe(expected);
  });

  it("persists the selection for later page loads", () => {
    persistLocale("tr");
    expect(detectLocale(document.cookie, ["en-US"])).toBe("tr");
    persistLocale("en");
    expect(detectLocale(document.cookie, ["tr-TR"])).toBe("en");
  });
});
