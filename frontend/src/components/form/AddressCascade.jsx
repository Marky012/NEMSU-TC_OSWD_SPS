import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function AddressCascade({
  regionValue, provinceValue, municipalityValue, barangayValue, addressValue,
  onRegionChange, onProvinceChange, onMunicipalityChange, onBarangayChange, onAddressChange,
  error,
}) {
  const toUpper = (val) => (val || '').toUpperCase();

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/30">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Complete Primary Address</p>
      <p className="text-[11px] text-muted-foreground/70 -mt-1">
        Please indicate your primary/home address (not boarding house or temporary address).
      </p>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">Region <span className="text-red-500 ml-0.5">*</span></Label>
        <Input
          value={regionValue || ''}
          onChange={e => onRegionChange(toUpper(e.target.value))}
          placeholder="e.g. CARAGA REGION XIII"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">Province <span className="text-red-500 ml-0.5">*</span></Label>
        <Input
          value={provinceValue || ''}
          onChange={e => onProvinceChange(toUpper(e.target.value))}
          placeholder="e.g. SURIGAO DEL SUR"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">City / Municipality <span className="text-red-500 ml-0.5">*</span></Label>
        <Input
          value={municipalityValue || ''}
          onChange={e => onMunicipalityChange(toUpper(e.target.value))}
          placeholder="e.g. TAGBINA"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">Barangay <span className="text-red-500 ml-0.5">*</span></Label>
        <Input
          value={barangayValue || ''}
          onChange={e => onBarangayChange(toUpper(e.target.value))}
          placeholder="e.g. POBLACION"
          className="h-11"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">
          Purok / Sitio / Street <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          value={addressValue || ''}
          onChange={e => onAddressChange(toUpper(e.target.value))}
          placeholder="e.g. PUROK 1"
          className="h-11"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}