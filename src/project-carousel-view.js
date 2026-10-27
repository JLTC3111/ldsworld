const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export function renderProjectCarousel({ projects, mediaFor, localize, storyFor, captionFor, labels, initialId, language = 'en' }) {
  const selected = Math.max(0, projects.findIndex(project => project.id === initialId));
  return `<section class="project-carousel" data-project-carousel role="region" aria-roledescription="${escape(labels.carousel)}" aria-label="${escape(labels.previews)}">
    <div class="carousel-heading"><span>${escape(labels.previews)}</span><span data-carousel-count>${String(selected + 1).padStart(2, '0')} / ${String(projects.length).padStart(2, '0')}</span></div>
    <div class="carousel-viewport" data-carousel-viewport tabindex="0" aria-label="${escape(labels.choose)}"><div class="carousel-container">${projects.map((project, index) => {
      const p = localize(project), media = mediaFor(p), active = index === selected;
      return `<article class="carousel-slide" data-carousel-project="${p.id}" role="group" aria-roledescription="${escape(labels.slide)}" aria-label="${index + 1} / ${projects.length}: ${escape(p.title)}" aria-hidden="${!active}" ${active ? '' : 'inert'}>
        <div class="project-video-wrap carousel-media"><div class="carousel-parallax" data-carousel-parallax><video id="carousel-video-${p.id}" data-carousel-video muted playsinline preload="none" poster="${media.poster}" data-source-language="${language}" data-recording-language="${media.recordingLanguage}" aria-label="${escape(labels.demo)}: ${escape(p.title)}"><a href="${media.video}">${escape(labels.demo)}</a></video></div><button class="video-toggle" data-carousel-play aria-label="${escape(labels.watch)}: ${escape(p.title)}" aria-controls="carousel-video-${p.id}">${icon('play')}</button></div>
        <div class="carousel-description"><div><span class="carousel-project-number">${p.number}</span><h3>${escape(p.title)}</h3></div><p>${escape(storyFor(p.id).teaser)}</p>${captionFor(p)}<button class="carousel-project-link" data-open-project="${p.id}">${escape(labels.explore)}${icon('up-right')}</button></div>
      </article>`;
    }).join('')}</div></div>
    <div class="carousel-toolbar"><button type="button" data-carousel-prev aria-label="${escape(labels.previous)}">${icon('arrow')}</button><div class="carousel-dots" role="group" aria-label="${escape(labels.choose)}">${projects.map((project, index) => `<button type="button" data-carousel-index="${index}" aria-label="${escape(localize(project).title)}" aria-current="${index === selected}"><span></span></button>`).join('')}</div><button type="button" data-carousel-next aria-label="${escape(labels.next)}">${icon('arrow')}</button><button type="button" class="carousel-autoplay" data-carousel-autoplay aria-label="${escape(labels.pause)}" aria-pressed="false">${icon('pause')}</button></div>
    <div class="carousel-progress" aria-hidden="true"><span data-carousel-progress></span></div><p class="carousel-status" data-carousel-status aria-live="polite"></p>
  </section>`;
}
