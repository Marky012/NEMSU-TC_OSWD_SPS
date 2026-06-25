import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Upload, FileIcon, AlertCircle } from 'lucide-react';
import apiClient from '@/api/apiClient';

export default function DynamicField({ question, value, onChange, error }) {
  const [uploading, setUploading] = useState(false);
  const options = Array.isArray(question.options) ? question.options : [];

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
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post('/students/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(data.file_path);
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
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder={`Enter ${question.question_text.toLowerCase()}`}
            className="bg-background uppercase"
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
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            placeholder={`Enter ${question.question_text.toLowerCase()}`}
            className="bg-background uppercase"
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

      case 'select':
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

      case 'file':
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

      default:
        return <Input value={value || ''} onChange={(e) => onChange(e.target.value.toUpperCase())} className="bg-background uppercase" />;
    }
  };

  return (
    <div className="space-y-2">
      {renderField()}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}
