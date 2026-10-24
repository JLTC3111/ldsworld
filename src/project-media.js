// Audited against the original 1.web-portfolio-en/vn/index.html project mappings.
// `language` describes source provenance; `recordingLanguage` describes the actual
// primary UI, visually audited across the original recordings. Folder names are
// not proof of UI language: both HR/Contracts/Compressor originals show Vietnamese,
// both Crypto originals show English.
const shared = (id, recordingLanguage, duration) => ({
  video: `./assets/demos/${id}.mp4`,
  poster: `./assets/posters/${id}.jpg`,
  language: 'shared', recordingLanguage, duration
});

const localized = (id, language, recordingLanguage, duration) => ({
  video: `./assets/demos/${language === 'vi' ? 'vi/' : ''}${id}.mp4`,
  poster: `./assets/posters/${language === 'vi' ? 'vi/' : ''}${id}.jpg`,
  language, recordingLanguage, duration
});

export const projectMedia = {
  hr: { en: shared('hr', 'vi', 28.345404), vi: shared('hr', 'vi', 28.345404) },
  crypto: { en: shared('crypto', 'en', 25.083333), vi: shared('crypto', 'en', 25.083333) },
  contracts: {
    en: localized('contracts', 'en', 'vi', 131.183333),
    vi: localized('contracts', 'vi', 'vi', 131.183333)
  },
  compressor: {
    en: localized('compressor', 'en', 'vi', 45.15),
    vi: localized('compressor', 'vi', 'vi', 45.15)
  },
  ceremony: {
    en: localized('ceremony', 'en', 'en', 12.966667),
    vi: localized('ceremony', 'vi', 'vi', 8.966667)
  },
  icue: {
    en: localized('icue', 'en', 'en', 24.666667),
    vi: localized('icue', 'vi', 'vi', 28.933333)
  }
};

/** Return matching media where available, with the actual recorded UI language. */
export function getProjectMedia(id, language = 'en') {
  if (!Object.hasOwn(projectMedia, id)) return null;
  return projectMedia[id][language === 'vi' ? 'vi' : 'en'];
}
