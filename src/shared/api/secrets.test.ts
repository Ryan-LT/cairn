import { describe, expect, it } from "vitest";

import { hashWebhookToken, newShareId, newWebhookToken, openWithPassword, SHARE_ID_PATTERN, sealWithPassword } from "./secrets";

describe("webhook keys", () => {
  it("are random, prefixed, and hashed deterministically", () => {
    const a = newWebhookToken();
    expect(a).toMatch(/^wt_[A-Za-z0-9_-]{43}$/);
    expect(newWebhookToken()).not.toBe(a);
    expect(hashWebhookToken(a)).toBe(hashWebhookToken(a));
    expect(hashWebhookToken(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("share sealing", () => {
  it("round-trips with the right password only", async () => {
    const sealed = await sealWithPassword('{"hello":"thế giới"}', "correct horse");
    expect(sealed.ciphertext).not.toContain("hello");
    expect(await openWithPassword(sealed, "correct horse")).toBe('{"hello":"thế giới"}');
    expect(await openWithPassword(sealed, "wrong horse")).toBeNull();
  });

  it("uses a new salt and iv every time and detects tampering", async () => {
    const a = await sealWithPassword("x", "password1");
    const b = await sealWithPassword("x", "password1");
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    const bytes = Buffer.from(a.ciphertext, "base64");
    bytes[0] ^= 1;
    expect(await openWithPassword({ ...a, ciphertext: bytes.toString("base64") }, "password1")).toBeNull();
    expect(await openWithPassword({ ...a, ciphertext: "" }, "password1")).toBeNull();
  });

  it("makes URL-safe link ids", () => {
    expect(newShareId()).toMatch(SHARE_ID_PATTERN);
  });
});
