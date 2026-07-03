import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '@/api/apiClient';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

export default function AddressCascade({
  regionValue, municipalityValue, barangayValue, addressValue,
  onRegionChange, onMunicipalityChange, onBarangayChange, onAddressChange,
  error,
}) {
  const [regions, setRegions] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedProvince, setSelectedProvince] = useState('');
  const [loading, setLoading] = useState({ regions: true });

  const codeToName = (list, code) => {
    const item = list.find(i => i.code === code);
    return item ? item.name : code;
  };

  const nameToCode = (list, name) => {
    const item = list.find(i => i.name === name);
    return item ? item.code : '';
  };

  useEffect(() => {
    apiClient.get('/address/regions')
      .then(res => setRegions(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(prev => ({ ...prev, regions: false })));
  }, []);

  const regionName = codeToName(regions, regionValue);
  useEffect(() => {
    if (!regionName || !regionValue) { setProvinces([]); return; }
    setLoading(prev => ({ ...prev, provinces: true }));
    apiClient.get('/address/provinces', { params: { region_code: regionValue } })
      .then(res => setProvinces(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(prev => ({ ...prev, provinces: false })));
  }, [regionValue, regionName]);

  useEffect(() => {
    const provinceCode = nameToCode(provinces, selectedProvince);
    if (!provinceCode) { setCities([]); return; }
    setLoading(prev => ({ ...prev, cities: true }));
    apiClient.get('/address/cities', { params: { province_code: provinceCode } })
      .then(res => setCities(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(prev => ({ ...prev, cities: false })));
  }, [selectedProvince, provinces]);

  const handleProvinceChange = useCallback((name) => {
    setSelectedProvince(name);
    onMunicipalityChange('');
    onBarangayChange('');
  }, [onMunicipalityChange, onBarangayChange]);

  const handleCityChange = useCallback((name) => {
    onMunicipalityChange(name);
    onBarangayChange('');
  }, [onMunicipalityChange, onBarangayChange]);

  const purokValue = addressValue || '';
  const handlePurokChange = (e) => {
    onAddressChange(e.target.value);
  };

  const CARAGA_CODE = '13';

  const regionOptions = regions.map(r => ({
    ...r,
    disabled: r.code !== CARAGA_CODE,
  }));

  const renderSelect = (label, placeholder, options, value, setter, isLoading, valueField = 'code', displayField = 'name') => (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <Select value={value || ''} onValueChange={setter}>
        <SelectTrigger className="h-11 w-full">
          <SelectValue placeholder={isLoading ? 'Loading...' : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt[valueField]} value={opt[valueField]} disabled={opt.disabled}
              className={opt.disabled ? 'opacity-40' : ''}>
              {opt[displayField]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Philippine Address</p>
      <p className="text-[11px] text-muted-foreground/70 -mt-1">Only Caraga is available; other regions are disabled.</p>

      {renderSelect('Region', 'Select Region', regionOptions, regionValue,
        (code) => { onRegionChange(code); setSelectedProvince(''); onMunicipalityChange(''); onBarangayChange(''); },
        loading.regions)}

      {regionValue && renderSelect('Province', 'Select Province', provinces, selectedProvince,
        handleProvinceChange, loading.provinces, 'name', 'name')}

          {selectedProvince && renderSelect('City / Municipality', 'Select City / Municipality', cities, municipalityValue,
              handleCityChange, loading.cities, 'name', 'name')}

      {municipalityValue && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">Barangay <span className="text-red-500 ml-0.5">*</span></Label>
          <Input
            value={barangayValue || ''}
            onChange={e => onBarangayChange(e.target.value)}
            placeholder="Type your barangay"
            className="h-11"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Purok / Sitio / Street <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          value={purokValue}
          onChange={handlePurokChange}
          placeholder="e.g. Purok 1, Maharlika St."
          className="h-11"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
