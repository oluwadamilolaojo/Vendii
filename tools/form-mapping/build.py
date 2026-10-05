import json, sys, traceback
from mapper import Form, resolve, companies, photo, signature
from preview import preview

STD = {
    "bvn": dict(label=r"Bank Verification Number|Verification Number"),
    "bankName": dict(label=r"^Bank Name|Bank Name"),
    "accountNumber": dict(label=r"Bank Account Number|Account Number"),
    "surname": dict(label=r"Surname", mode="below", at=True, until=r"First ?Name"),
    "firstName": dict(label=r"First ?Name", mode="below", at=True, until=r"Other ?Names?"),
    "otherNames": dict(label=r"Other ?Names?", mode="below", at=True),
    "address": dict(label=r"^Address", mode="below"),
    "city": dict(label=r"^City", mode="below"),
    "state": dict(label=r"\bState\b", mode="below", row_of=r"^City\b"),
    "country": dict(label=r"Country", mode="below", row_of=r"^City\b"),
    "previousAddress": dict(label=r"Previous Address", mode="below"),
    "chn": dict(label=r"^CHN\b|\bCHN \(If", mode="below"),
    "phone1": dict(label=r"Mobile Tele ?phone ?\(?1|Mobile Tele ?phone(?! ?\(?2)", mode="below"),
    "phone2": dict(label=r"Mobile Tele ?phone ?\(?2", mode="below"),
    "email": dict(label=r"E-?mail Address", mode="below"),
}

# name, file, display name, overrides
FORMS = {}
def form(key, file, display, fields=None, drop=(), comp=None, photo_spec=None, sig=None, notes=None):
    FORMS[key] = dict(file=file, display=display, fields=fields or {}, drop=drop, comp={} if comp is None else comp, photo=photo_spec, sig=sig, notes=notes)

form("coronation", "Coronation_Registrars", "Coronation Registrars", comp=dict(stop=r"For inquiries"))
form("apel", "Apel_Registrars", "Apel Capital Registrars",
     fields=dict(bvn=dict(label=r"^BVN\b", mode="line", width=560), bankName=dict(label=r"^BANK NAME", mode="line", width=520),
                 accountNumber=dict(label=r"^ACCOUNT NUMBER", mode="line", width=460),
                 surname=dict(label=r"Surname", mode="below", at=True, until=r"First Name"),
                 firstName=dict(label=r"First Name", mode="below", at=True, until=r"Other Name"),
                 otherNames=dict(label=r"Other Name", mode="below", at=True)),
     comp=dict(region=(1170, 380, 1400, 2300), tick_mode="leftcell"))
form("atlas", "Atlas_Registrars", "Atlas Registrars",
     # Scan too soft for OCR to anchor labels: positions read from the detected boxes.
     fields=dict(bvn=dict(box=(164, 684, 743, 30), cells=11), bankName=dict(box=(281, 724, 622, 30)),
                 accountNumber=dict(box=(366, 768, 542, 31), cells=10),
                 surname=dict(box=(164, 921, 330, 35)), firstName=dict(box=(495, 921, 235, 35)), otherNames=dict(box=(735, 921, 170, 35)),
                 address=dict(box=(162, 994, 745, 42)), city=dict(box=(157, 1129, 143, 34)), state=dict(box=(352, 1130, 198, 34)),
                 country=dict(box=(596, 1131, 307, 35)), previousAddress=dict(box=(160, 1202, 745, 39)), chn=dict(box=(160, 1272, 362, 37)),
                 phone1=dict(box=(157, 1351, 322, 37)), phone2=dict(box=(592, 1355, 311, 37)), email=dict(box=(161, 1428, 742, 40))),
     sig=dict(box=(160, 1514, 323, 61)),
     comp=dict(region=(975, 485, 1380, 625)))
form("cardinalstone", "Cardinal_Stone_Registrars", "CardinalStone Registrars", comp=dict(stop=r"CARDINALSTONE REGISTRARS$|Head Office"))
form("carnation", "Carnation_Registrars", "Carnation Registrars", comp=dict(tick_mode="cellright", header=r"NAME OF COMPANY"))
form("centurion", "Centurion_Registrars", "Centurion Registrars",
     # Letter-style mandate for one company only: no photo box, no tick list.
     fields=dict(surname=dict(box=(655, 905, 440, 44)), givenNames=dict(box=(1100, 905, 445, 44)),
                 chn=dict(box=(655, 1189, 890, 44)), phone1=dict(box=(655, 1348, 890, 44)), email=dict(box=(1176, 1418, 370, 44)),
                 bankName=dict(box=(655, 1485, 316, 44)), accountNumber=dict(box=(655, 1554, 316, 44))),
     drop=("bvn", "firstName", "otherNames", "address", "city", "state", "country", "previousAddress", "phone2"),
     sig=dict(box=(860, 1700, 230, 70)), comp=False,
     notes="Covers C & I Leasing Plc only. No passport photo box.")
form("cordros", "Cordros_Registrars", "Cordros Registrars",
     fields=dict(bvn=dict(label=r"Bank Verification Number", mode="below"), accountNumber=dict(label=r"^Account Number|Account Number$", mode="below"),
                 bankName=dict(label=r"^Bank Name", mode="right"),
                 surname=dict(label=r"Surname/Company", mode="below"), firstName=None, otherNames=None,
                 givenNames=dict(label=r"Other Names", mode="below"),
                 phone1=dict(label=r"Number ?[1!]\b|prone Number", mode="below", until_cells=r"Phone Number 2"), phone2=dict(label=r"Phone Number 2", mode="below"),
                 email=dict(label=r"^Email Address", mode="below"), address=dict(label=r"^Address", mode="below"),
                 chn=dict(label=r"Clearing House Number", mode="below", skip_cells=1)),
     drop=("city", "state", "country", "previousAddress", "firstName", "otherNames"),
     comp=dict(region=(1150, 770, 1420, 1640), strip_num=True, tick_mode="leftcell", tick_pos=.78),
     sig=dict(box=(116, 2072, 300, 82)))
FORMS["cordros"]["fields"]["fullName"] = dict(box=(116, 1994, 420, 40))
form("datamax", "Datamax_Registrars", "Datamax Registrars", comp=dict(stop=r"The Bank stamp|AUTHORISED SIGNATORY"))
form("edc", "EDC_Registrars", "EDC Registrars",
     fields=dict(city=dict(label=r"Previous Address", mode="rowbox", above=True, index=0),
                 state=dict(label=r"Previous Address", mode="rowbox", above=True, index=1),
                 country=dict(label=r"Previous Address", mode="rowbox", above=True, index=2),
                 chn=dict(label=r"^CHN", mode="right"), phone1=dict(label=r"Mobile Telephone", mode="right"),
                 phone2=dict(label=r"Tel ?\(2\)", mode="right"), email=dict(label=r"E-mail Address", mode="right")))
form("flourmills", "FLOURMILLS_Registrars", "Flour Mills Registrars", comp=dict(stop=r"Help Desk|Flour Mills Registrars Limited"))
form("first", "First_Registrars", "First Registrars", fields=dict(state=dict(label=r"^City\b", mode="rowbox", index=1)))
form("greenwich", "Greenwich_Registrars", "Greenwich Registrars",
     fields=dict(bvn=dict(box=(410, 870, 575, 37)), bankName=dict(box=(410, 910, 575, 37)), accountNumber=dict(box=(410, 954, 575, 36)),
                 surname=dict(box=(42, 1210, 398, 31)), firstName=dict(box=(443, 1210, 276, 31)), otherNames=dict(box=(722, 1210, 272, 31)),
                 address=dict(box=(42, 1284, 952, 34)), city=dict(box=(42, 1398, 315, 34)), state=dict(box=(360, 1398, 316, 34)),
                 country=dict(box=(679, 1398, 316, 34)), previousAddress=dict(box=(42, 1474, 952, 35)),
                 chn=dict(box=(42, 1551, 474, 34)), email=dict(box=(520, 1551, 475, 34)),
                 phone1=dict(box=(42, 1628, 474, 34)), phone2=dict(box=(520, 1628, 475, 34))),
     sig=dict(box=(44, 1722, 470, 72)),
     comp=dict(region=(1110, 440, 1470, 1905), tick_mode="leftcell", skip=(r"^Company( Name)?$", r"^Name$")))
form("lancelot", "LANCELOT_REGISTRARS", "Lancelot Registrars", fields=dict(bankName=dict(box=(181, 755, 714, 43)), address=dict(box=(45, 1158, 850, 44))), comp=dict(stop=r"This service costs|Office: No"))
form("lighthouse", "Lighthouse_Registrars", "Lighthouse Registrars",
     fields=dict(chn=dict(label=r"Clearing House No", mode="right"), bvn=dict(label=r"Bank Verification No", mode="right"),
                 address=dict(label=r"^Address", mode="right"),
                 phone1=dict(label=r"Mobile Telephone 1", mode="right"), phone2=dict(label=r"Mobile Telephone 2", mode="right"),
                 email=dict(label=r"Email Address", mode="right"), country=dict(box=(1094, 1707, 397, 34))),
     comp=dict(stop=r"Clearing House No|Instruction"))
form("mainstreet", "MainstreetBank_Registrars", "MainstreetBank Registrars", comp=dict(stop=r"Help Desk|Company Name$"))
form("meristem", "Meristem_Registrars", "Meristem Registrars")
form("pac", "PAC-Registrars", "PAC Registrars",
     fields=dict(bvn=dict(box=(366, 658, 555, 55), cells=11), bankName=dict(box=(212, 725, 705, 50)),
                 accountNumber=dict(box=(366, 786, 555, 52), cells=10),
                 surname=dict(box=(52, 1044, 868, 58)), firstName=dict(box=(52, 1147, 400, 58)), otherNames=dict(box=(470, 1147, 450, 58)),
                 chn=dict(box=(368, 1222, 556, 54), cells=11), address=dict(box=(300, 1290, 620, 54)),
                 city=dict(box=(110, 1430, 267, 42)), state=dict(box=(448, 1428, 194, 42)), country=dict(box=(722, 1430, 194, 42)),
                 phone1=dict(box=(365, 1482, 555, 50), cells=11), phone2=dict(box=(365, 1545, 555, 48), cells=11),
                 email=dict(box=(226, 1603, 690, 54)), previousAddress=dict(box=(389, 1677, 530, 54))),
     sig=dict(box=(70, 1826, 414, 150)),
     comp=dict(region=(1008, 530, 1480, 1860)))
form("pace", "PACE_Registrars", "PACE Registrars",
     fields=dict(bankName=dict(label=r"Bank Account Number", mode="rowbox", above=True, index=0),
                 phone1=dict(label=r"Mobile Telephone 1", mode="rowbox", index=0),
                 phone2=dict(label=r"Mobile Telephone 1", mode="rowbox", index=1)),
     comp=dict(region=(1045, 440, 1480, 1920), tick_mode="leftcell"))
form("unity", "UNITY_Registrars", "Unity Registrars")
form("veritas", "VERITAS_Registrars", "Veritas Registrars",
     fields=dict(bankName=dict(box=(224, 1113, 678, 60)), accountNumber=dict(box=(325, 1178, 579, 60), cells=10),
                 bvn=dict(box=(267, 1243, 637, 60), cells=11), chn=dict(box=(129, 1497, 346, 43))),
     sig=dict(box=(130, 1936, 438, 60)),
     comp=dict(stop=r"Kindly fill the portion"))
form("africaprudential", "afriprudential_Registrars", "Africa Prudential Registrars",
     fields=dict(address=dict(box=(119, 1138, 962, 40)),
                 chn=dict(label=r"Clearing House Number", mode="below", skip_cells=1)),
     sig=dict(label=r"^Signature:", mode="line", width=250, height=70),
     comp=dict(header=r"CLIENTELE", numbered=True, tick_mode="fixed", tick_dx=1478, stop=r"OTHERS", skip=(r"^OTHERS",)))

def build(key, show=True):
    cfg = FORMS[key]; name = cfg["file"]
    f = Form(name, f"E-mandate Forms/{name.replace('_', ' ')}.pdf" if not name.startswith("PAC-") else f"E-mandate Forms/{name}.pdf")
    specs = {k: v for k, v in {**STD, **cfg["fields"]}.items() if k not in cfg["drop"] and v is not None}
    fields, errors = [], []
    for k, s in specs.items():
        try: fields.append(resolve(f, k, s))
        except Exception as e: errors.append(f"{k}: {e}")
    tpl = {"id": key, "registrar": cfg["display"], "file": name + ".pdf",
           "page": {"w": f.pw, "h": f.ph}, "fields": fields, "photo": None, "signature": None, "companies": []}
    if key != "centurion":
        try: tpl["photo"] = photo(f, **(cfg["photo"] or {}))
        except Exception as e: errors.append(f"photo: {e}")
    try: tpl["signature"] = signature(f, **(cfg["sig"] or {}))
    except Exception as e: errors.append(f"signature: {e}")
    if cfg["comp"] is not False:
        try: tpl["companies"] = companies(f, **cfg["comp"])
        except Exception as e: errors.append(f"companies: {e}")
    elif key == "centurion":
        tpl["companies"] = [{"name": "C & I Leasing Plc", "tick": None}]
    tpl["notes"] = cfg["notes"]
    if show: preview(name, tpl, f"/tmp/pv_{key}.png", .45)
    return tpl, errors

if __name__ == "__main__":
    keys = sys.argv[1:] or list(FORMS)
    for key in keys:
        tpl, errs = build(key)
        print(key, len(tpl["fields"]), "fields,", len(tpl["companies"]), "companies", "photo" if tpl["photo"] else "NO PHOTO", "sig" if tpl["signature"] else "NO SIG")
        for e in errs: print("  !", e)
        if len(keys) == 1:
            for c in tpl["companies"]: print("   -", c["name"])
