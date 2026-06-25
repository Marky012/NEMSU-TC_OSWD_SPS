"""Generate correct Surigao del Sur barangay data from PSGC package"""
import barangay

all_brgys = barangay.barangays.to_dicts()
all_cm = barangay.cities.to_dicts() + barangay.municipalities.to_dicts()

# Map ph_address.py names to package names
name_map = {
    "Bislig City": "City of Bislig",
    "Tandag City": "City of Tandag",
}

# Surigao del Sur municipalities in order matching ph_address.py codes
municipalities = [
    ("130400001", "Bislig City"),
    ("130400002", "Tandag City"),
    ("130400003", "Barobo"),
    ("130400004", "Bayabas"),
    ("130400005", "Cagwait"),
    ("130400006", "Cantilan"),
    ("130400007", "Carmen"),
    ("130400008", "Carrascal"),
    ("130400009", "Cortes"),
    ("130400010", "Hinatuan"),
    ("130400011", "Lanuza"),
    ("130400012", "Lianga"),
    ("130400013", "Lingig"),
    ("130400014", "Madrid"),
    ("130400015", "Marihatag"),
    ("130400016", "San Agustin"),
    ("130400017", "San Miguel"),
    ("130400018", "Tagbina"),
    ("130400019", "Tago"),
]

def get_correct_brgys(cname, prov="Surigao del Sur"):
    pkg_name = name_map.get(cname, cname)
    for cm in all_cm:
        if cm.get("name") == pkg_name:
            cm_prov = cm.get("province") or cm.get("component_city") or cm.get("highly_urbanized_city") or ""
            if prov.lower() in cm_prov.lower() or cm_prov.lower() in prov.lower():
                prefix = cm["psgc_id"][:7]
                brgs = [b for b in all_brgys if b["psgc_id"].startswith(prefix)]
                return sorted(set(b["name"] for b in brgs))
    return None

for code, name in municipalities:
    brgs = get_correct_brgys(name)
    if brgs is None:
        print(f"# {code} {name}: NOT FOUND in PSGC")
        continue
    
    # Format: 5 per line
    quoted = [f'"{b}"' for b in brgs]
    print(f'    "{code}": [  # {name}')
    line = "        "
    for i, n in enumerate(quoted):
        entry = n + ", "
        if len(line + entry) > 115:
            print(line.rstrip(", "))
            line = "        " + entry
        else:
            line += entry
    if line:
        print(line.rstrip(", "))
    print(f'    ],')
