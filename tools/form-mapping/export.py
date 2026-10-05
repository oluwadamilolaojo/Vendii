import json, re
from build import FORMS, build

# OCR slips, checked against the scans by eye. (form, as read) -> as printed.
FIX = {
 ("coronation", "Food Emporium Int! Limited"): "Food Emporium Int'l Limited",
 ("coronation", "Caverton Offshore Support group"): "Caverton Offshore Support Group",
 ("apel", "ADAS PROGRAMME"): "ADAS PROGRAMME LIMITED",
 ("apel", "AllCO BALANCED FUND"): "AIICO BALANCED FUND",
 ("cordros", "AllCO EUROBOND FUND"): "AIICO EUROBOND FUND",
 ("cordros", "C&l LEASING PLC"): "C&I LEASING PLC",
 ("cordros", "CAPITAL TRUST HALAL FIXED INCOME EUND"): "CAPITAL TRUST HALAL FIXED INCOME FUND",
 ("greenwich", "NigerialReinsurance"): "Nigeria Reinsurance",
 ("greenwich", "CEE OES"): "Oluwa Glass Company",
 ("greenwich", "Local Contractors Receivables Bond Tranche"): "Local Contractors Receivables Bond Tranche 1, 2 & 3",
 ("lancelot", "IN DUSTRIAL & MEDICAL GASES NIG PLC"): "INDUSTRIAL & MEDICAL GASES NIG PLC",
 ("meristem", "ENERGY COMPANY OF NIGERIA PLC [ENCON"): "ENERGY COMPANY OF NIGERIA PLC [ENCON]",
 ("meristem", "Nouns ANY [NMRC] PLC EFINANCE"): "NIGERIA MORTGAGE REFINANCE COMPANY [NMRC] PLC",
 ("pac", "FUMMAN Prod. Plc"): "FUMMAN Agric. Prod. Plc",
 ("pac", "inti Energy Insurance Plc"): "Int'l Energy Insurance Plc",
 ("pace", "SFS REAL ESTATE INVESTMENT TRUST FUND PLC (Formerly Skye Shelter Fund Pic)"): "SFS REAL ESTATE INVESTMENT TRUST FUND PLC (Formerly Skye Shelter Fund Plc)",
 ("africaprudential", "A PLC"): "A & G INSURANCE PLC",
 ("africaprudential", "GOLDEN CAPITAL PLC [TF"): "GOLDEN CAPITAL PLC",
 ("africaprudential", "RESORT SAVINGS & LOANS PLC [TF"): "RESORT SAVINGS & LOANS PLC",
 ("africaprudential", "PORTLAND PAINTS &PRODUCTSNIG.PLC"): "PORTLAND PAINTS & PRODUCTS NIG. PLC",
 ("africaprudential", "MIXTA REAL ESTATE PLC (formerlyARM Properties Plc)"): "MIXTA REAL ESTATE PLC (formerly ARM Properties Plc)",
 ("first", "LAGOS STATE BOND 167.5 BILLION 2° DEBT ISSUANCE PROGRAMME N80 BILLION 14.5% (SERIES 1 BOND)"): "LAGOS STATE BOND 167.5 BILLION 2ND DEBT ISSUANCE PROGRAMME N80 BILLION 14.5% (SERIES 1 BOND)",
 ("first", "LAGOS STATE GOVT BOND (3RD) SERIES 2 TRANCHE 1.N46.37 BILLION"): "LAGOS STATE GOVT BOND (3RD) SERIES 2 TRANCHE 1 N46.37 BILLION",
}
JUNK = {("apel", "Ikoyi Lagos"), ("meristem", "Limited"), ("meristem", "info@meristemregistrars.com")}

out, problems = [], []
for key in FORMS:
    t, errs = build(key, False)
    if errs: problems.append((key, errs))
    comps = []
    for c in t["companies"]:
        if (key, c["name"]) in JUNK: continue
        c = dict(c, name=FIX.get((key, c["name"]), c["name"]))
        comps.append(c)
    t["companies"] = comps
    for f in t["fields"]:
        f.pop("label", None)
        if key in ("cordros", "africaprudential", "pac") and f["key"] == "chn": f["printedPrefix"] = "C"
    t["file"] = f"{key}.pdf"
    out.append(t)
json.dump(out, open("templates.json", "w"), indent=1)
print(len(out), "templates;", sum(len(t["companies"]) for t in out), "companies;", "problems:", problems)
missing_fix = [k for k in FIX if not any(t["id"] == k[0] and any(c["name"] == FIX[k] for c in t["companies"]) for t in out)]
print("fixes not applied:", missing_fix)
