// ── Input Validation & Sanitization ──

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PHONE_REGEX = /^[0-9+\-() ]{6,20}$/;

/** Validate email format */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 255) return false;
  return EMAIL_REGEX.test(email.trim());
}

/** Validate phone number format */
export function isValidPhone(phone: string): boolean {
  if (!phone) return true; // Phone is optional
  return PHONE_REGEX.test(phone.trim());
}

/** Sanitize text input — escape HTML special chars to prevent XSS */
export function sanitizeText(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Clean text for storage — trim whitespace, normalize spaces */
export function cleanText(str: string): string {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
}

/** Validate and sanitize a lead's fields before saving */
export function validateLeadFields(data: {
  name?: string;
  email?: string;
  personalEmail?: string;
  phone?: string;
  company?: string;
  position?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name?.trim()) {
    errors.push("Name is required");
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.push("Invalid work email format");
  }

  if (data.personalEmail && !isValidEmail(data.personalEmail)) {
    errors.push("Invalid personal email format");
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.push("Invalid phone number — only digits, +, -, (), and spaces allowed");
  }

  if (!data.company?.trim()) {
    errors.push("Company is required");
  }

  return { valid: errors.length === 0, errors };
}

/** Validate CSV import row */
export function validateCSVRow(row: Record<string, string>, rowIndex: number): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!row.name?.trim() && !row.Name?.trim()) {
    errors.push(`Row ${rowIndex}: Missing name`);
  }

  const email = row.email || row.Email || row["Work Email"] || "";
  if (email && !isValidEmail(email)) {
    errors.push(`Row ${rowIndex}: Invalid email "${email}"`);
  }

  const phone = row.phone || row.Phone || "";
  if (phone && !isValidPhone(phone)) {
    errors.push(`Row ${rowIndex}: Invalid phone "${phone}"`);
  }

  return { valid: errors.length === 0, errors };
}

/** Sanitize an object's string fields */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const result = { ...obj };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      (result as Record<string, unknown>)[key] = cleanText(result[key] as string);
    }
  }
  return result;
}
