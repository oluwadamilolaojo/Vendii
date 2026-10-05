import { describe, expect, it } from "vitest";
import { normalizeNgPhone } from "@/lib/domain/phone";
import { bankErrors, identityErrors } from "@/lib/domain/validation";

describe("Nigerian phone numbers", () => {
  it("accepts the usual ways people type them", () => {
    for (const v of ["08031234567", "0803 123 4567", "+234 803 123 4567", "2348031234567", "8031234567"]) {
      expect(normalizeNgPhone(v)).toBe("+2348031234567");
    }
    expect(normalizeNgPhone("09121234567")).toBe("+2349121234567");
  });
  it("rejects anything that isn't a Nigerian mobile", () => {
    for (const v of ["", "12345", "06031234567", "080312345678", "+447911123456"]) expect(normalizeNgPhone(v)).toBeNull();
  });
});

describe("form validation", () => {
  it("needs a BVN or NIN and an address for your own claim", () => {
    const e = identityErrors({ flowType: "own", bvn: "", nin: "", address: "" });
    expect(e.bvn).toBeTruthy();
    expect(e.address).toBeTruthy();
    expect(identityErrors({ flowType: "own", bvn: "", nin: "12345678901", address: "Ikoyi" })).toEqual({});
  });
  it("lets estate claims continue without the deceased's numbers", () => {
    expect(identityErrors({ flowType: "estate", bvn: "", nin: "", address: "" })).toEqual({});
    expect(identityErrors({ flowType: "estate", bvn: "123", nin: "", address: "" }).bvn).toBeTruthy();
  });
  it("checks bank details", () => {
    expect(bankErrors({ bankName: "", accountNumber: "123" })).toHaveProperty("accountNumber");
    expect(bankErrors({ bankName: "Zenith Bank", accountNumber: "0123456789" })).toEqual({});
  });
});
