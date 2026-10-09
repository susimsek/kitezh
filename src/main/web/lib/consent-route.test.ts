import { decodeConsentRouteKey, encodeConsentRouteKey } from "./consent-route";

describe("consent route key", () => {
  it("round-trips client ids and usernames without exposing slashes in the path segment", () => {
    const key = encodeConsentRouteKey("client/with/slash", "şuayb@example.com");

    expect(key).toMatch(/^[0-9a-f]+$/);
    expect(key).not.toContain("/");
    expect(decodeConsentRouteKey(key)).toEqual({
      clientId: "client/with/slash",
      username: "şuayb@example.com",
    });
  });

  it("rejects malformed route keys", () => {
    expect(decodeConsentRouteKey("not-hex")).toBeNull();
    expect(decodeConsentRouteKey("0")).toBeNull();
  });
});
