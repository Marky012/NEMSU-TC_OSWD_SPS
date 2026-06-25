from typing import Optional
from fastapi import APIRouter, Query
from app.data.ph_address import get_regions, get_provinces, get_cities, get_barangays

router = APIRouter(prefix="/api/address", tags=["Philippine Address"])

@router.get("/regions")
def list_regions():
    """Returns all 17 Philippine regions."""
    return get_regions()

@router.get("/provinces")
def list_provinces(region_code: Optional[str] = Query(None)):
    """Returns provinces, optionally filtered by region_code."""
    return get_provinces(region_code)

@router.get("/cities")
def list_cities(province_code: Optional[str] = Query(None)):
    """Returns cities/municipalities, optionally filtered by province_code."""
    return get_cities(province_code)

@router.get("/barangays")
def list_barangays(city_code: Optional[str] = Query(None)):
    """Returns barangays, optionally filtered by city_code."""
    return get_barangays(city_code)
