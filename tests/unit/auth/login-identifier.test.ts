import { describe, expect, it } from "vitest";

import { normalizeLoginPhone } from "@/lib/phone";
import {
  normalizeLoginEmail,
  normalizeLoginIdentifier,
} from "@/lib/login-identifier";

describe("login identifier normalization", () => {
  it("normalizes email without changing the existing behavior", () => {
    expect(normalizeLoginEmail("  ADMIN@SalonFlow.Ma ")).toBe(
      "admin@salonflow.ma",
    );
    expect(normalizeLoginIdentifier(" ADMIN@SalonFlow.Ma ")).toEqual({
      kind: "email",
      value: "admin@salonflow.ma",
    });
  });

  it("normalizes a Moroccan local mobile number", () => {
    expect(normalizeLoginPhone("06 12 34 56 78")).toBe("+212612345678");
    expect(normalizeLoginIdentifier("06 12 34 56 78")).toEqual({
      kind: "phone",
      value: "+212612345678",
    });
  });

  it("normalizes an international 00 prefix", () => {
    expect(normalizeLoginPhone("00212 6 12 34 56 78")).toBe("+212612345678");
  });

  it("rejects malformed identifiers", () => {
    expect(normalizeLoginIdentifier("")).toBeNull();
    expect(normalizeLoginIdentifier("not-an-identifier")).toBeNull();
    expect(normalizeLoginIdentifier("bad@email")).toBeNull();
    expect(normalizeLoginPhone("123")).toBeNull();
  });
});
