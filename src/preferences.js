export function preferredLanguage({ search = '', saved, languages = [] } = {}) {
  const requested = new URLSearchParams(search).get('lang');
  if (['en', 'vi'].includes(requested)) return requested;
  if (['en', 'vi'].includes(saved)) return saved;
  return languages.find(language => /^(en|vi)(-|$)/i.test(language))?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}
