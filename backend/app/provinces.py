VALID_PROVINCES = {
    # Luzon
    "ABRA", "APAYAO", "BENGUET", "IFUGAO", "KALINGA", "MOUNTAIN PROVINCE",
    "ILOCOS NORTE", "ILOCOS SUR", "LA UNION", "PANGASINAN",
    "BATANES", "CAGAYAN", "ISABELA", "NUEVA VIZCAYA", "QUIRINO",
    "AURORA", "BATAAN", "BULACAN", "NUEVA ECIJA", "PAMPANGA", "TARLAC", "ZAMBALES",
    "BATANGAS", "CAVITE", "LAGUNA", "QUEZON", "RIZAL",
    "MARINDUQUE", "OCCIDENTAL MINDORO", "ORIENTAL MINDORO", "PALAWAN", "ROMBLON",
    "ALBAY", "CAMARINES NORTE", "CAMARINES SUR", "CATANDUANES", "MASBATE", "SORSOGON",
    # Visayas
    "AKLAN", "ANTIQUE", "CAPIZ", "GUIMARAS", "ILOILO", "NEGROS OCCIDENTAL",
    "BOHOL", "CEBU", "NEGROS ORIENTAL", "SIQUIJOR",
    "BILIRAN", "EASTERN SAMAR", "LEYTE", "NORTHERN SAMAR", "SAMAR", "SOUTHERN LEYTE",
    # Mindanao
    "ZAMBOANGA DEL NORTE", "ZAMBOANGA DEL SUR", "ZAMBOANGA SIBUGAY",
    "BUKIDNON", "CAMIGUIN", "LANAO DEL NORTE", "MISAMIS OCCIDENTAL", "MISAMIS ORIENTAL",
    "DAVAO DE ORO", "DAVAO DEL NORTE", "DAVAO DEL SUR", "DAVAO OCCIDENTAL", "DAVAO ORIENTAL",
    "COTABATO", "SARANGANI", "SOUTH COTABATO", "SULTAN KUDARAT",
    "AGUSAN DEL NORTE", "AGUSAN DEL SUR", "DINAGAT ISLANDS", "SURIGAO DEL NORTE", "SURIGAO DEL SUR",
    "BASILAN", "LANAO DEL SUR", "MAGUINDANAO DEL NORTE", "MAGUINDANAO DEL SUR", "SULU", "TAWI-TAWI",
}

VALID_REGIONS = {
    "REGION I", "ILOCOS REGION", "ILOCOS",
    "REGION II", "CAGAYAN VALLEY", "CAGAYAN VALLEY REGION",
    "REGION III", "CENTRAL LUZON",
    "REGION IV-A", "REGION IVA", "CALABARZON",
    "MIMAROPA", "MIMAROPA REGION",
    "REGION V", "BICOL REGION", "BICOL",
    "REGION VI", "WESTERN VISAYAS",
    "REGION VII", "CENTRAL VISAYAS",
    "REGION VIII", "EASTERN VISAYAS",
    "REGION IX", "ZAMBOANGA PENINSULA",
    "REGION X", "NORTHERN MINDANAO",
    "REGION XI", "DAVAO REGION", "DAVAO",
    "REGION XII", "SOCCSKSARGEN",
    "REGION XIII", "REGION 13", "CARAGA", "CARAGA REGION",
    "NCR", "NATIONAL CAPITAL REGION",
    "CAR", "CORDILLERA ADMINISTRATIVE REGION",
    "BARMM", "BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO",
    "NIR", "NEGROS ISLAND REGION",
}


def validate_province(province: str) -> str | None:
    """Returns None if valid, or an error message string if invalid."""
    cleaned = province.strip().upper()
    if cleaned in VALID_PROVINCES:
        return None
    return f"Province '{province.strip()}' is invalid or misspelled. Please check the spelling and try again."


def validate_region(region: str) -> str | None:
    """Returns None if valid, or an error message string if invalid."""
    cleaned = region.strip().upper()
    if cleaned in VALID_REGIONS:
        return None
    return f"Region '{region.strip()}' is invalid or misspelled. Please check the spelling and try again."
