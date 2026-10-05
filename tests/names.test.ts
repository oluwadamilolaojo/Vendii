import { describe, expect, it } from "vitest";
import { cleanVariants, normalizeName, suggestVariant } from "@/lib/domain/names";

const n = { first: "Adewale", middle: "Bamidele", last: "Ogunyemi" };

describe("name matching", () => {
  it("normalizes punctuation, spacing, case and accents", () => {
    expect(normalizeName("A. B. Ogunyemi")).toBe("A B OGUNYEMI");
    expect(normalizeName("  a b   ogunyemi ")).toBe("A B OGUNYEMI");
    expect(normalizeName("Adéwálé")).toBe("ADEWALE");
    expect(normalizeName("OGUNYEMI, Adewale B.")).toBe("OGUNYEMI ADEWALE B");
  });
  it("suggests the common register spellings", () => {
    expect(suggestVariant(n, "initials")).toBe("A. B. Ogunyemi");
    expect(suggestVariant(n, "surnameFirst")).toBe("OGUNYEMI, Adewale B.");
    expect(suggestVariant(n, "firstLast")).toBe("Adewale Ogunyemi");
    expect(suggestVariant(n, "maiden")).toBe("Adewale Bamidele ");
  });
  it("drops blanks, the primary name and duplicate spellings", () => {
    expect(cleanVariants(["", "adewale bamidele ogunyemi", "A. B. Ogunyemi", "a b ogunyemi", " Adewale  Ogunyemi "], n))
      .toEqual(["A. B. Ogunyemi", "Adewale Ogunyemi"]);
  });
});
