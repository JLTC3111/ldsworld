const sections = ['projects', 'about', 'contact'];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);

/** Shared links keep the portfolio sections reachable from within the dialog. */
export function renderSectionNavigation({ view, labels = {}, label = '' } = {}) {
  const current = view === 'project' ? 'projects' : view;
  if (!sections.includes(current)) return '';
  return `<nav class="section-navigation" aria-label="${escapeHtml(label)}">${sections.map(section => `<a href="#${section}" data-action="${section}"${section === current ? ' aria-current="page"' : ''}>${escapeHtml(labels[section])}</a>`).join('')}</nav>`;
}
