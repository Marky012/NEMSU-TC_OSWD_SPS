"""Check city records"""
import barangay
all_cm = barangay.cities.to_dicts() + barangay.municipalities.to_dicts()
for cm in all_cm:
    name = cm.get("name", "")
    if "Bislig" in name or "Tandag" in name or "Bayabas" in name:
        print(f'name={cm["name"]}')
        print(f'  type={cm.get("type")}')
        print(f'  psgc_id={cm["psgc_id"]}')
        print(f'  province={cm.get("province")}')
        for k, v in cm.items():
            if v and k not in ("name", "type", "psgc_id", "parent_psgc_id", "region"):
                print(f'  {k}={v}')
        print()
