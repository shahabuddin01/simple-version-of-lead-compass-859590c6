/** Clean phone numbers from Excel/CSV artifacts (apostrophes, extra quotes, spaces) */
export const cleanPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone || phone.toString().trim() === '') return '';
  let cleaned = phone.toString().trim();
  cleaned = cleaned.replace(/^'+/, '');
  cleaned = cleaned.replace(/^["']+|["']+$/g, '');
  cleaned = cleaned.trim();
  if (!cleaned || cleaned.length < 5) return '';
  return cleaned;
};

/** Clean all phone fields on a lead object */
export const cleanLeadPhones = <T extends Record<string, unknown>>(lead: T): T => {
  const phoneFields = ['phone', 'personalPhone1', 'personalPhone2'];
  const cleaned = { ...lead };
  for (const field of phoneFields) {
    if (field in cleaned && typeof cleaned[field] === 'string') {
      (cleaned as Record<string, unknown>)[field] = cleanPhoneNumber(cleaned[field] as string);
    }
  }
  return cleaned;
};

/** Clean all phone data in an array of leads (for existing dirty data cleanup) */
export const cleanAllLeadPhones = (leads: any[]): { cleaned: any[]; dirtyCount: number } => {
  let dirtyCount = 0;
  const cleaned = leads.map(lead => {
    const origWork = lead?.phone || '';
    const origP1 = lead?.personalPhone1 || '';
    const origP2 = lead?.personalPhone2 || '';
    const result = cleanLeadPhones(lead);
    if (result.phone !== origWork || result.personalPhone1 !== origP1 || result.personalPhone2 !== origP2) {
      dirtyCount++;
    }
    return result;
  });
  return { cleaned, dirtyCount };
};
