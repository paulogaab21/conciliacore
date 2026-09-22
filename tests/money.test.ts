import { describe, expect, it } from "vitest";
import { parseMoneyToCents } from "@/lib/money";

describe("parseMoneyToCents", () => {
  it.each([
    ["R$ 1.234,56", 123_456],
    ["10,90", 1_090],
    [19.99, 1_999],
  ])("parses %s without floating-point state", (value, expected) => {
    expect(parseMoneyToCents(value)).toBe(expected);
  });

  it("rejects invalid monetary input", () => {
    expect(() => parseMoneyToCents("not-money")).toThrow("Invalid monetary value");
  });
});
