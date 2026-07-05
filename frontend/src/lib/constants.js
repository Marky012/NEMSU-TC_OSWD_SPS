export const VALID_PROVINCES = new Set([
  // Luzon
  "ABRA", "APAYAO", "BENGUET", "IFUGAO", "KALINGA", "MOUNTAIN PROVINCE",
  "ILOCOS NORTE", "ILOCOS SUR", "LA UNION", "PANGASINAN",
  "BATANES", "CAGAYAN", "ISABELA", "NUEVA VIZCAYA", "QUIRINO",
  "AURORA", "BATAAN", "BULACAN", "NUEVA ECIJA", "PAMPANGA", "TARLAC", "ZAMBALES",
  "BATANGAS", "CAVITE", "LAGUNA", "QUEZON", "RIZAL",
  "MARINDUQUE", "OCCIDENTAL MINDORO", "ORIENTAL MINDORO", "PALAWAN", "ROMBLON",
  "ALBAY", "CAMARINES NORTE", "CAMARINES SUR", "CATANDUANES", "MASBATE", "SORSOGON",
  // Visayas
  "AKLAN", "ANTIQUE", "CAPIZ", "GUIMARAS", "ILOILO", "NEGROS OCCIDENTAL",
  "BOHOL", "CEBU", "NEGROS ORIENTAL", "SIQUIJOR",
  "BILIRAN", "EASTERN SAMAR", "LEYTE", "NORTHERN SAMAR", "SAMAR", "SOUTHERN LEYTE",
  // Mindanao
  "ZAMBOANGA DEL NORTE", "ZAMBOANGA DEL SUR", "ZAMBOANGA SIBUGAY",
  "BUKIDNON", "CAMIGUIN", "LANAO DEL NORTE", "MISAMIS OCCIDENTAL", "MISAMIS ORIENTAL",
  "DAVAO DE ORO", "DAVAO DEL NORTE", "DAVAO DEL SUR", "DAVAO OCCIDENTAL", "DAVAO ORIENTAL",
  "COTABATO", "SARANGANI", "SOUTH COTABATO", "SULTAN KUDARAT",
  "AGUSAN DEL NORTE", "AGUSAN DEL SUR", "DINAGAT ISLANDS", "SURIGAO DEL NORTE", "SURIGAO DEL SUR",
  "BASILAN", "LANAO DEL SUR", "MAGUINDANAO DEL NORTE", "MAGUINDANAO DEL SUR", "SULU", "TAWI-TAWI",
]);

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

export const SECURITY_QUESTIONS = [
  "What is your favorite pet?",
  "What is the name of your elementary school?",
  "What is the middle name of your mother?",
  "What is the name of your first teacher?",
  "What is your favorite book?",
];

export const generateVerificationCode = (semesterNumber, year) => {
  const prefix = `OSWD-TG-${year || '2025'}`;
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${semesterNumber || '1'}-${random}`;
};