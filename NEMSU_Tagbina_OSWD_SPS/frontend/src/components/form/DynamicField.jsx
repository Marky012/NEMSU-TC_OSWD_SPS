import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Upload, FileIcon, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function DynamicField({ question, value, onChange, error }) {
  const [uploading, setUploading] = useState(false);
  const options = question.options_json ? JSON.parse(question.options_json) : [];
  const tableColumns = question.table_columns_json ? JSON.parse(question.table_columns_json) : [];

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File must be under 5MB');
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.type)) {
      alert('Only PDF, JPG, and PNG files are allowed');
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      onChange(file_url);
    } catch (err) {
      alert('Upload failed');
    }
    setUploading(false);
  };

  const renderField = () => {
    switch (question.field_type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter ${question.question_text.toLowerCase()}`}
            className="bg-background"
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="0"
            className="bg-background"
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter ${question.question_text.toLowerCase()}`}
            className="bg-background"
          />
        );

      case 'date':
        return (
          <div className="space-y-1">
            <Input
              type="date"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="bg-background"
            />
            {value && (
              <p className="text-xs text-muted-foreground">
                Age: {Math.floor((Date.now() - new Date(value).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years old
              </p>
            )}
          </div>
        );

      case 'radio':
        return (
          <RadioGroup value={value || ''} onValueChange={onChange} className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`${question.id}-${opt}`} />
                <Label htmlFor={`${question.id}-${opt}`} className="font-normal cursor-pointer text-sm">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
      case 'multi_select': {
        const selected = value ? (typeof value === 'string' ? JSON.parse(value) : value) : [];
        return (
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${opt}`}
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => {
                    const newVal = checked
                      ? [...selected, opt]
                      : selected.filter((v) => v !== opt);
                    onChange(JSON.stringify(newVal));
                  }}
                />
                <Label htmlFor={`${question.id}-${opt}`} className="font-normal cursor-pointer text-sm">{opt}</Label>
              </div>
            ))}
          </div>
        );
      }

      case 'dropdown':
        return (
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'file_upload':
        return (
          <div className="space-y-2">
            {value ? (
              <div className="flex items-center gap-2 p-2 bg-accent rounded-md">
                <FileIcon className="w-4 h-4 text-primary" />
                <span className="text-xs truncate flex-1">File uploaded</span>
                <Button variant="ghost" size="sm" onClick={() => onChange('')}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {uploading ? 'Uploading...' : 'Click to upload (PDF, JPG, PNG, max 5MB)'}
                </span>
                <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploading} />
              </label>
            )}
          </div>
        );

      case 'table': {
        const rows = value ? (typeof value === 'string' ? JSON.parse(value) : value) : [];
        const addRow = () => {
          const emptyRow = {};
          tableColumns.forEach(col => { emptyRow[col] = ''; });
          onChange(JSON.stringify([...rows, emptyRow]));
        };
        const updateRow = (rowIdx, col, val) => {
          const newRows = [...rows];
          newRows[rowIdx] = { ...newRows[rowIdx], [col]: val };
          onChange(JSON.stringify(newRows));
        };
        const removeRow = (rowIdx) => {
          onChange(JSON.stringify(rows.filter((_, i) => i !== rowIdx)));
        };
        return (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              {rows.length > 0 && (
                <table className="w-full text-sm border border-border rounded-md">
                  <thead>
                    <tr className="bg-muted">
                      {tableColumns.map(col => (
                        <th key={col} className="px-2 py-1.5 text-left font-medium text-xs">{col}</th>
                      ))}
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {tableColumns.map(col => (
                          <td key={col} className="px-1 py-1">
                            <Input
                              value={row[col] || ''}
                              onChange={(e) => updateRow(i, col, e.target.value)}
                              className="h-8 text-xs bg-background"
                            />
                          </td>
                        ))}
                        <td className="px-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(i)}>
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="w-3 h-3 mr-1" /> Add Row
            </Button>
          </div>
        );
      }

      default:
        return <Input value={value || ''} onChange={(e) => onChange(e.target.value)} className="bg-background" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-1">
        <Label className="text-sm font-medium">
          {question.question_text}
          {question.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
      </div>
      {question.help_text && (
        <p className="text-xs text-muted-foreground">{question.help_text}</p>
      )}
      {renderField()}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}