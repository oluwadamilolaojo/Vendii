import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { TEMPLATES, fillForms } from "@/lib/forms/fill";
import { DIRECTORY, bestCompanyOnForm, registrarIdFor, searchCompanies } from "@/lib/forms/registry";
import type { FormProfile } from "@/lib/forms/types";

const profile: FormProfile = {
  surname: "Ogunyemi", firstName: "Adewale", otherNames: "Bamidele", bvn: "22154874718",
  bankName: "Guaranty Trust Bank", accountNumber: "0123456213", address: "14 Bourdillon Close, Ikoyi",
  city: "Lagos", state: "Lagos", country: "Nigeria", previousAddress: "22 Awolowo Road, Ikoyi",
  chn: "C00123456789", phone1: "+2348031234567", phone2: "08091112222", email: "adewale.ogunyemi@example.com",
};
const images = { photo: readFileSync("tests/fixtures/photo.jpg"), signature: readFileSync("tests/fixtures/signature.png") };

describe("registrar form filling", () => {
  it("fills every mapped registrar form, ticking the first two companies on each", async () => {
    const holdings = TEMPLATES.flatMap((t) => t.companies.slice(0, 2).map((c) => ({ registrarId: t.id, company: c.name })));
    const { pdf, forms } = await fillForms(profile, holdings, images);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(21);
    for (const f of forms) expect(f.unlisted).toEqual([]);
    if (process.env.FORMS_OUT) { mkdirSync(process.env.FORMS_OUT, { recursive: true }); writeFileSync(`${process.env.FORMS_OUT}/all.pdf`, pdf); }
  }, 60_000);

  it("finds the registrar from the company name the shareholder types", () => {
    expect(searchCompanies("Coronation Insurance")[0]).toMatchObject({ registrarId: "coronation" });
    expect(searchCompanies("zenith bank")[0]).toMatchObject({ registrarId: "veritas", company: "Zenith Bank Plc" });
    expect(searchCompanies("Okomu")[0]).toMatchObject({ registrarId: "cardinalstone" });
    expect(searchCompanies("United Bank for Africa")[0]).toMatchObject({ registrarId: "africaprudential" });
    expect(searchCompanies("Coronation Insurance").some((e) => e.company.includes("Asset Management"))).toBe(false);
  });

  it("matches register names to the form's own spelling, and flags names that aren't printed", async () => {
    expect(bestCompanyOnForm("cardinalstone", "Okomu Oil Palm")).toBe("OKOMU OIL PALM PLC");
    expect(bestCompanyOnForm("first", "Cadbury Nigeria")).toBe("CADBURY NIGERIA PLC");
    expect(bestCompanyOnForm("coronation", "Zenith Bank")).toBeNull();
    // First Registrars' form lists FBN's funds but not FBN Holdings itself: no tick, flagged instead.
    expect(bestCompanyOnForm("first", "FBN Holdings")).toBeNull();
    expect(bestCompanyOnForm("coronation", "Coronation Insurance")).toBe("Coronation Insurance PLC (WAPIC Insurance)");
    expect(bestCompanyOnForm("datamax", "Guaranty Trust Holding")).toBe("Guaranty Trust Holding Company Plc");
    expect(bestCompanyOnForm("africaprudential", "United Bank for Africa")).toBe("UNITED BANK FOR AFRICA PLC");
    const { forms } = await fillForms(profile, [{ registrarId: "coronation", company: "Dangote Cement" }, { registrarId: "coronation", company: "Some Unlisted Ltd" }], images);
    expect(forms[0].ticked).toEqual(["Dangote Cement PLC"]);
    expect(forms[0].unlisted).toEqual(["Some Unlisted Ltd"]);
  });

  it("ticks every listed company when given its own name, and never a neighbour", () => {
    const wrong = DIRECTORY.filter((e) => bestCompanyOnForm(e.registrarId, e.company) !== e.company);
    expect(wrong).toEqual([]);
  });

  it("maps registrar names from the register to form templates", () => {
    expect(registrarIdFor("CardinalStone Registrars")).toBe("cardinalstone");
    expect(registrarIdFor("Africa Prudential Registrars")).toBe("africaprudential");
    expect(registrarIdFor("PACE Registrars")).toBe("pace");
    expect(registrarIdFor("PAC Registrars")).toBe("pac");
    expect(registrarIdFor("GTL Registrars")).toBe("greenwich");
  });
});
