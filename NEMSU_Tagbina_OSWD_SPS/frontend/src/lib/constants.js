export const STUDENT_CATEGORIES = [
  { value: 'new', label: 'New' },
  { value: 'transferee', label: 'Transferee' },
  { value: 'returnee', label: 'Returnee' },
  { value: 'continuing', label: 'Continuing' },
];

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'date', label: 'Date' },
  { value: 'radio', label: 'Radio' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'file_upload', label: 'File Upload' },
  { value: 'table', label: 'Table' },
];

export const generateVerificationCode = (semesterNumber, year) => {
  const prefix = `OSWD-${year || '2025'}`;
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${semesterNumber || '1'}-${random}`;
};