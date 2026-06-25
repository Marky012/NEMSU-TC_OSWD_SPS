export const STUDENT_CATEGORIES = [
  { value: 'New', label: 'New', description: 'First-time enrollee in any college or university' },
  { value: 'Transferee', label: 'Transferee', description: 'Transferred from another school or program' },
  { value: 'Returnee', label: 'Returnee', description: 'Returning after a break of at least one term' },
  { value: 'Continuing', label: 'Continuing', description: 'Currently enrolled, proceeding to next term' },
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