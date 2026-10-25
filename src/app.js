import { loadCarAssets } from './car-assets.js';
import { VEHICLE_MODELS,vehicleModel } from './vehicle-models.js';
import { mapLocations,mapFrame } from './locations.js';
import { TOWN_CENTER,outerTownDirections } from './wayfinding.js';
import { ISLAND_BOUNDS as DRIVING_BOUNDS } from './world-layout.js';
import { BOUNDARY_INSET } from './island-boundary.js';
import { projects, getProject, localizeProject, copy } from './data.js';
import { roadLoop, outerRoadLoop, roadNodes, connectorPaths } from './driving.js';
import { preferredLanguage } from './preferences.js';
import { bindDemoSource, releaseDemo, playDemo } from './media.js';
import { EngineAudio } from './engine-audio.js';
import { bridges, portals, houses, riverCenter, WORLD_SCALE, RIVER_REACH, MAP_BOUNDS, MAP_VIEWBOX, ROAD_WIDTHS, RIVER_HALF_WIDTH } from './world-layout.js';
import { getCaseStudy } from './case-studies.js';
import { formatProjectDate, demoTimestamp } from './portfolio-metadata.js';
import { getProjectMedia } from './project-media.js';
import { getToolInfo } from './stack-tools.js';
import { createBackgroundMusic } from './background-music.js';
import { getScenePresentation } from './scene-presentation.js';
import { createTechText } from './tech-text.js';
import { createEnvironmentAudio } from './environment-audio.js';
import { createPanelPreviews } from './panel-previews.js';
import { createDrivingHud } from './driving-hud.js';
import { drivingKey } from './controls.js';

const $ = selector => document.querySelector(selector);
const formatCount = value => String(value).padStart(2,'0');
const projectCount = formatCount(projects.length);
const isWebsite = project => ['ceremony','icue'].includes(project.id);
const applicationCount = formatCount(projects.filter(project=>!isWebsite(project)).length);
const websiteCount = formatCount(projects.filter(isWebsite).length);
const icon = (name, extra = '') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const storage = {
  get(key, fallback) { try { return localStorage.getItem(`longd-island:${key}`) || fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`longd-island:${key}`, value); } catch { /* The island works without storage. */ } }
};
let visited;
try { visited = new Set(JSON.parse(sessionStorage.getItem('longd-island:visited') || '[]').filter(id => getProject(id))); }
catch { visited = new Set(); }
const savedTheme = storage.get('theme', '');
const state = { language: preferredLanguage({ search: location.search, saved: storage.get('language', ''), languages: navigator.languages || [navigator.language] }), visited, filter: 'all', panel: null, projectId: null, exploring: false, guided: false, destination: null, nearby: null, night: savedTheme === 'dark' || !savedTheme && matchMedia('(prefers-color-scheme: dark)').matches, sound: storage.get('sound', 'on') !== 'off', ready: false, timeMode: 'auto', weatherMode: 'snow', headlights: 'auto', environment: null, spotlightId: 'hr' };
const t = key => copy[state.language][key] || copy.en[key] || key;
const local = project => localizeProject(project, state.language);
const mediaFor = project => getProjectMedia(typeof project === 'string' ? project : project.id, state.language);
state.music = storage.get('music','on') !== 'off';
state.carModel=vehicleModel(storage.get('car','8-ball')).id;
state.mapCategory='buildings';state.mapZoom=1;state.carPosition={x:0,z:13,heading:Math.PI/2};
state.showcaseScreen = 'project'; state.showcaseTool = null;
const panel = $('#panel');
const drivingHud=createDrivingHud();
let world = null, previousFocus = null, toastTimer = null, speedValue = -1;
const engineAudio = new EngineAudio();
engineAudio.setEnabled(state.sound);
const environmentAudio = createEnvironmentAudio({enabled:state.sound});
environmentAudio.start();
let backgroundMusic = null;
backgroundMusic = createBackgroundMusic({enabled:state.music,muted:!state.sound,onStateChange:syncMusicButton});
backgroundMusic.start();
let suspendedDemo = null, panelPreviews = null;
let panelShowcase = null, showcaseRequest = 0;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const brandTechText = createTechText($('#brand-wordmark'), { text:'long d.', fontSize:21, fontWeight:700, letterSpacing:-.025, align:'left', reach:36, dashLength:2.2, dashGap:1.5, strokeWidth:.65, specks:3, labels:false, draggable:false, clickKick:false, sweep:false, intro:'none' });

function translatePage() {
  document.documentElement.lang = state.language;
  document.querySelectorAll('[data-project-count]').forEach(element=>element.textContent=projectCount);
  document.title = t('siteTitle');
  $('meta[name="description"]').content = t('siteDescription');
  $('meta[property="og:title"]').content = t('siteTitle');
  $('meta[property="og:description"]').content = t('ogDescription');
  document.querySelectorAll('[data-copy]').forEach(element => { element.textContent = t(element.dataset.copy); });
  document.querySelectorAll('[data-html]').forEach(element => { element.innerHTML = t(element.dataset.html); });
  document.querySelectorAll('[data-aria]').forEach(element => element.setAttribute('aria-label', t(element.dataset.aria)));
  document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === state.language)));
  $('#reset').setAttribute('aria-label', `${t('reset')} (R)`);
  $('#reset').title = `${t('reset')} (R)`;
  $('#help').setAttribute('aria-label', t('help'));
  $('#help').title = t('help');
  $('#minimap').setAttribute('aria-label', t('map'));
  $('#sound').setAttribute('aria-label', state.sound ? t('soundOff') : t('soundOn'));
  $('#sound').title = state.sound ? t('soundOff') : t('soundOn');
  applyTheme(); syncSoundButton(); syncMusicButton(); updateEnvironment(state.environment);
  if (state.panel) renderPanel();
  refreshNearby(); updateStatus();
}

function setLanguage(language) {
  if (!copy[language]) return;
  state.language = language; storage.set('language', language); world?.setLanguage(language);
  const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  translatePage();
}
function applyTheme() {
  document.body.classList.toggle('evening', state.night);
  $('#theme').innerHTML = icon(state.night ? 'moon' : 'sun'); $('#theme').setAttribute('aria-pressed', String(state.night));
  $('#theme').setAttribute('aria-label', state.night ? t('day') : t('night')); $('#theme').title = state.night ? t('day') : t('night');
  panelShowcase?.setTheme(showcaseDark());
  brandTechText.refresh();
  $('meta[name="theme-color"]').content = state.night ? '#22352f' : '#f0f0e7';
}
function startCurrentDemo() {
  const video = $('#panel-content video[data-project-demo]');
  if (video && panel.open && !document.hidden && getProject(state.projectId)) bindDemoSource(video,mediaFor(state.projectId));
}

function syncVisitedProjects() {
  try { sessionStorage.setItem('longd-island:visited', JSON.stringify([...state.visited])); } catch { /* Optional session state. */ }
}
function markVisited(id) {
  const previous = state.visited.size; state.visited.add(id); syncVisitedProjects();
  if (previous !== projects.length && state.visited.size === projects.length) showToast(t('complete'), 6000);
}
function showToast(message, duration = 2800) {
  const toast = $('#toast'); clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), duration);
}
function updateStatus() {
  $('#explore-status').hidden = !state.exploring;
  $('#stop-tour').hidden = !state.destination && !state.guided;
  const destination = getProject(state.destination);
  $('#status-text').textContent = destination ? `${t('touring')} ${local(destination).short}` : t('driving');
}
function startExploring() {
  state.exploring = true; document.body.classList.add('exploring'); updateStatus();
  if (state.sound) engineAudio.resume().catch(() => {});
}
function refreshNearby() {
  const project = getProject(state.nearby);
  const button = $('#nearby-project'); button.hidden = !project || !state.exploring || !!state.panel;
  if (project) { $('#nearby-number').textContent = project.number; $('#nearby-title').textContent = local(project).short; button.setAttribute('aria-label', `${t('view')}: ${local(project).title}`); }
}
function stopTour() {
  state.guided = false; state.destination = null; world?.stopRoute(); updateStatus();
}
function navigateTo(id, guided = false) {
  if (!getProject(id)) return;
  if (!world) { openProject(id); return; }
  state.guided = guided; state.destination = id;
  closePanel(); world.driveToProject(id); updateStatus();
}
function startTour(index = 0) { navigateTo(projects[index % projects.length].id, true); }
function openProject(id) {
  if (!getProject(id)) return;
  markVisited(id); showPanel('project', id);
}
function setHash(view, id) {
  const hash = view ? view === 'project' ? `#project/${id}` : `#${view}` : '';
  history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
}
function showPanel(view, id = null) {
  if (!panel.open) previousFocus = document.activeElement;
  drivingHud.reveal();
  state.panel = view; state.projectId = id; renderPanel({ mount: false });
  if (!panel.open) panel.showModal();
  startCurrentDemo(); panelPreviews?.refresh(); mountShowcase();
  document.body.classList.add('panel-open'); world?.setPaused(true); panel.scrollTop = 0;
  $('#panel-close').focus({ preventScroll: true });
  refreshNearby(); setHash(view, id);
  document.querySelectorAll('.navigation button').forEach(button => button.setAttribute('aria-current', button.dataset.action === view ? 'page' : 'false'));
}
function closePanel() { if (panel.open) panel.close(); }
function handlePanelClose() {
  disposeShowcase();
  panelPreviews?.destroy(); panelPreviews = null;
  state.panel = null; state.projectId = null; document.body.classList.remove('panel-open'); world?.setPaused(false);
  setHash(null); refreshNearby(); document.querySelectorAll('.navigation button').forEach(button => button.removeAttribute('aria-current'));
  $('#panel-content').querySelectorAll('video').forEach(releaseDemo);
  suspendedDemo = null;
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
}
panel.addEventListener('close', handlePanelClose);
$('#panel-close').addEventListener('click', closePanel);
panel.addEventListener('click', event => {
  if (event.target !== panel) return;
  const rect = panel.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePanel();
});

function escapeText(value) { return String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }
function stageProject() { const project = local(getProject(state.panel === 'project' ? state.projectId : state.spotlightId) || projects[0]); return { ...project, language:state.language, poster:mediaFor(project).poster }; }
function showcaseDark() { return ['world','help'].includes(state.panel) ? (state.environment?.night || 0) > .55 : state.night; }
function disposeShowcase() { ++showcaseRequest; panelShowcase?.dispose(); panelShowcase = null; }
async function mountShowcase() {
  if(state.panel==='map')return;
  const request = ++showcaseRequest, host = $('#panel [data-showcase]');
  if (!host || !panel.open) return;
  panelShowcase?.dispose(); panelShowcase = null;
  try {
    const { createShowcase } = await import('./showcase.js');
    if (request !== showcaseRequest || !panel.open || !host.isConnected) return;
    panelShowcase = createShowcase({ container: host, carModel:state.carModel, project: stageProject(), mode: host.dataset.showcaseMode, screen:state.showcaseScreen, screenModes:['project','stack'], language:state.language, onScreenChange:mode=>setShowcaseScreen(mode,{fromObject:true}), night: showcaseDark(), reducedMotion });
    panelShowcase.setHeadlights(state.headlights);
  } catch { host.classList.remove('showcase-ready'); }
}
function selectSpotlight(id) {
  const original = getProject(id); if (!original || state.panel !== 'projects') return;
  state.spotlightId = id; state.showcaseTool = null; const project = stageProject(), story = getCaseStudy(id, state.language);
  const stage = $('#panel .panel-stage'); if (!stage) return;
  stage.querySelector('[data-stage-description]').textContent = story.teaser;
  stage.querySelector('[data-stage-project-label]').textContent = project.title;
  const poster = stage.querySelector('.stage-poster'); if (poster) { poster.src = mediaFor(project).poster; poster.alt = `${t('projectPreview')}: ${project.title}`; }
  const action = stage.querySelector('[data-stage-open]'); if (action) { action.dataset.openProject = id; action.setAttribute('aria-label', `${t('view')}: ${project.title}`); }
  stage.querySelectorAll('[data-spotlight]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.spotlight === id)));
  updateScreenReadout();
  panelShowcase?.setProject(project);
}
function renderScreenReadout(project = stageProject()) {
  const heading = `<h4 data-stage-project-label>${escapeText(project.title)}</h4>`;
  if (state.showcaseScreen === 'stack') {
    const selected = project.tech.includes(state.showcaseTool) ? state.showcaseTool : project.tech[0];
    return `${heading}<div class="screen-tools" role="group" aria-label="${t('screenStackHint')}">${project.tech.map(tool=>`<button data-stack-tool="${escapeText(tool)}" aria-pressed="${tool===selected}" aria-controls="showcase-tool-detail">${escapeText(tool)}</button>`).join('')}</div><p class="screen-tool-detail" id="showcase-tool-detail"><strong>${escapeText(selected)}</strong> · ${getToolInfo(selected,state.language)}</p>`;
  }
  return `${heading}<p>${getCaseStudy(project.id,state.language).focus}</p><p class="screen-facts">${escapeText(project.category)}<span aria-hidden="true"> / </span>${project.year}</p>`;
}
function renderScreenInspector(project) {
  return `<div class="screen-inspector" data-screen-inspector data-screen="${state.showcaseScreen}"><div class="screen-tabs" role="group" aria-label="${t('screenControls')}">${['project','stack'].map(mode=>`<button data-screen-mode="${mode}" aria-pressed="${mode===state.showcaseScreen}" aria-controls="showcase-readout">${t({project:'screenProject',stack:'screenStack'}[mode])}</button>`).join('')}</div><div class="screen-readout" id="showcase-readout" aria-live="polite" aria-atomic="true">${renderScreenReadout(project)}</div><p class="screen-hint">${t('screenHint')}</p></div>`;
}
function updateScreenReadout() {
  const inspector = $('#panel [data-screen-inspector]'); if (!inspector) return;
  inspector.dataset.screen = state.showcaseScreen;
  inspector.querySelectorAll('[data-screen-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.screenMode===state.showcaseScreen)));
  $('#showcase-readout').innerHTML = renderScreenReadout();
}
function setShowcaseScreen(mode,{fromObject=false}={}) {
  if (!['project','stack'].includes(mode) || !$('#panel [data-screen-inspector]')) return;
  state.showcaseScreen = mode; updateScreenReadout();
  if (!fromObject && panelShowcase?.getScreen() !== mode) panelShowcase?.setScreen(mode);
}
function selectShowcaseTool(name) {
  if (state.showcaseScreen!=='stack' || !stageProject().tech.includes(name)) return;
  state.showcaseTool = name;
  document.querySelectorAll('[data-stack-tool]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.stackTool===name)));
  const description=$('#showcase-tool-detail');
  if(description)description.innerHTML=`<strong>${escapeText(name)}</strong> · ${getToolInfo(name,state.language)}`;
}
function seekDemo(seconds) {
  const video = $('#panel-content video[data-project-demo]'); if (!video || !Number.isFinite(seconds)) return;
  const seek = () => { if (!video.isConnected || !panel.open || document.hidden) return; video.currentTime = Number.isFinite(video.duration) ? Math.min(seconds, Math.max(0,video.duration-.1)) : seconds; playDemo(video); };
  if (video.readyState >= 1) seek(); else { video.addEventListener('loadedmetadata', seek, {once:true}); playDemo(video); }
  video.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
}
function renderRelatedProjects(current, explicit = null) {
  const selected = explicit ? explicit.map(getProject).filter(Boolean) : projects.filter(p => p.id !== current).slice(0,2);
  return `${explicit ? '' : `<section class="case-section"><h3>${t('relatedLabel')}</h3>`}<div class="${explicit ? 'contact-projects' : 'related-work'}">${selected.map(project=>{const p=local(project);return `<button data-open-project="${p.id}" aria-label="${t('view')}: ${p.title}"><video data-preview-project="${p.id}" data-source-language="${state.language}" data-recording-language="${mediaFor(p).recordingLanguage}" autoplay muted loop playsinline preload="none" poster="${mediaFor(p).poster}" aria-hidden="true" width="480" height="270"></video><span><strong>${p.title}</strong><small>${p.category} · ${p.year}</small></span></button>`;}).join('')}</div>${explicit ? '' : '</section>'}`;
}
function renderCapabilities() {
  const groups = [['operationsTitle','operationsText',['hr','contracts']],['dataTitle','dataText',['crypto','compressor']],['webTitle','webText',['icue','ceremony']]];
  return `<section class="case-section"><h3>${t('capabilityIntro')}</h3><div class="capability-grid">${groups.map(([title,text,ids])=>`<article class="capability-card"><h4>${t(title)}</h4><p>${t(text)}</p><div class="capability-links">${ids.map(id=>`<button data-open-project="${id}">${local(getProject(id)).short}${icon('up-right')}</button>`).join('')}</div></article>`).join('')}</div></section>`;
}
function renderJourney() {
  return `<section class="case-section"><h3>${t('journeyLabel')}</h3><p>${t('journeyIntro')}</p><ol class="work-journey">${[...projects].reverse().map(project=>{const p=local(project);return `<li><button data-open-project="${p.id}"><time>${formatProjectDate(p.date,state.language,true)}</time><span><strong>${p.title}</strong><small>${p.category}</small></span>${icon('up-right')}</button></li>`;}).join('')}</ol></section>`;
}
function renderFallbackArt(kind) {
  if (kind === 'mail') return `<svg class="stage-fallback stage-fallback-art" viewBox="0 0 480 360" aria-hidden="true"><ellipse cx="240" cy="302" rx="152" ry="22" fill="var(--line)" opacity=".45"/><g transform="rotate(-8 240 180)"><rect x="133" y="55" width="213" height="223" rx="12" fill="var(--paper)" stroke="var(--line)" stroke-width="2"/><path d="M165 104h146M165 131h146M165 158h96" fill="none" stroke="var(--line)" stroke-width="8" stroke-linecap="round"/><path d="M100 158h280v141H100Z" fill="var(--yellow)"/><path d="m100 158 140 93 140-93m-280 141 95-81m185 81-95-81" fill="none" stroke="var(--accent-shadow)" stroke-width="2"/><circle cx="240" cy="251" r="18" fill="var(--surface-soft)"/></g></svg>`;
  return `<svg class="stage-fallback stage-fallback-art" viewBox="0 0 480 360" aria-hidden="true"><ellipse cx="245" cy="298" rx="150" ry="24" fill="var(--line)" opacity=".5"/><g transform="rotate(-6 240 190)"><path d="m112 200 82-49h141l53 44v73H112Z" fill="#fa5837"/><path d="m185 151 30-62h105l32 67Z" fill="#f0e5c9"/><path d="m216 99-23 51h62V99Zm48 0v51h73l-23-51Z" fill="#344e5a"/><path d="M112 200h276v23H112Z" fill="#ff9857"/><circle cx="168" cy="267" r="36" fill="#242a2d"/><circle cx="168" cy="267" r="19" fill="#adb6bb"/><circle cx="337" cy="267" r="36" fill="#242a2d"/><circle cx="337" cy="267" r="19" fill="#adb6bb"/><rect x="110" y="233" width="55" height="13" rx="3" fill="#e0c986"/><path d="M209 80h117v10H209Z" fill="#536e5d"/><rect x="229" y="56" width="74" height="25" rx="5" fill="#bea77b"/></g></svg>`;
}
function renderStage() {
  const p = stageProject(), view = state.panel, story = getCaseStudy(p.id,state.language);
  const title = { projects:'studioTitle', project:'projectStageTitle', about:'aboutStageTitle', contact:'contactStageTitle', world:'worldStageTitle', help:'helpStageTitle', map:'mapStageTitle' }[view] || 'studioTitle';
  const mode = ['world','help'].includes(view) ? 'car' : view === 'contact' ? 'mail' : view === 'about' ? 'workbench' : 'device';
  const hasScreen = ['device','workbench'].includes(mode);
  const description = ['projects','project'].includes(view) ? story.teaser : t({about:'aboutStageText',contact:'contactStageText',world:'worldStageText',help:'helpStageText',map:'mapStageText'}[view] || 'studioIntro');
  let metrics;
  if (view==='projects') metrics=[[t('projectCount'),projectCount],[t('applicationCount'),applicationCount],[t('websiteCount'),websiteCount]];
  else if(view==='project') metrics=[[t('projectDate'),p.year],[t('projectType'),p.category],[t('technologiesAria'),p.tech.slice(0,2).join(' / ')]];
  else if(view==='about'||view==='contact') metrics=[[t('location'),state.language==='vi'?'Hà Nội':'Hanoi'],[t('projectCount'),projectCount],[t('interfaceLanguage'),'EN / VI']];
  else if(view==='map') metrics=[[t('projectCount'),projectCount],[t('portalLabel'),String(portals.length).padStart(2,'0')],[t('controlsLabel'),'WASD']];
  else metrics=[[t('controlsLabel'),t('driveLabel')],[t('cameraLabel'),t('dragPreview')],[t('headlightsLabel'),t('lightsAuto')]];
  const stageMap=view==='map'?`<div class="stage-map"><div class="stage-map-surface"><svg viewBox="${MAP_VIEWBOX}" aria-hidden="true">${mapSvg(true,'stage-map-car')}</svg>${projects.map(project=>`<button class="stage-map-stop" data-open-project="${project.id}" style="left:${(project.position[0]+MAP_BOUNDS.x)/(MAP_BOUNDS.x*2)*100}%;top:${(project.position[1]+MAP_BOUNDS.z)/(MAP_BOUNDS.z*2)*100}%;--marker-color:${project.color}" aria-label="${t('view')}: ${local(project).title}">${project.number}</button>`).join('')}</div></div>`:'';
  const artifact=view==='map'?stageMap:`<div class="stage-art"><div data-showcase data-showcase-mode="${mode}"></div>${['device','workbench'].includes(mode)?`<img class="stage-poster stage-fallback" src="${mediaFor(p).poster}" alt="${t('projectPreview')}: ${escapeText(p.title)}" width="960" height="600">`:renderFallbackArt(mode)}<button class="stage-reset" data-action="reset-showcase" aria-label="${t('resetPreview')}">${icon('reset')}</button></div>`;
  const nav=['projects','project'].includes(view)?`<div class="stage-project-nav" role="group" aria-label="${t('choosePreview')}">${projects.map(project=>`<button ${view==='projects'?`data-spotlight="${project.id}" aria-pressed="${p.id===project.id}"`:`data-open-project="${project.id}" aria-current="${p.id===project.id}"`} aria-label="${local(project).title}">${project.number}</button>`).join('')}</div>`:'';
  const caption=['project','projects','about'].includes(view)?p.title:t(mode==='mail'?'navContact':view==='map'?'map':'controls');
  let action;
  if(view==='projects')action=`<button class="primary-button" data-open-project="${p.id}" data-stage-open aria-label="${t('view')}: ${p.title}">${t('openPreview')}${icon('up-right')}</button>`;
  else if(view==='project')action=`<a class="primary-button" href="${p.live||p.github}" target="_blank" rel="noopener noreferrer">${t(p.live?'visit':'code')}${icon('up-right')}</a>`;
  else if(view==='contact')action=`<a class="primary-button" href="mailto:dev@icue.vn">${icon('mail')}${t('email')}</a>`;
  else if(view==='about')action=`<button class="primary-button" data-action="projects">${t('navProjects')}${icon('arrow')}</button>`;
  else action=`<button class="primary-button" data-action="close-world">${t('return')}${icon('arrow')}</button>`;
  return `<aside class="panel-stage stage-${view}${hasScreen?' stage-has-screen':''}"><p class="stage-eyebrow">${t('studioLabel')} / ${p.year}</p><h3 class="stage-title">${t(title)}</h3><p class="stage-description" data-stage-description>${description}</p>${artifact}${hasScreen?renderScreenInspector(p):`<p class="stage-caption"><strong data-stage-project-label>${caption}</strong><span>${t(view==='map'?'helpProject':'dragPreview')}</span></p><dl class="stage-meta">${metrics.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>`}${nav}<div class="stage-cta">${action}</div></aside>`;
}

function renderIndex() {
  const items = projects.filter(project => state.filter === 'all' || (state.filter === 'web' ? isWebsite(project) : !isWebsite(project)));
  if (!items.some(project => project.id === state.spotlightId)) state.spotlightId = items[0]?.id || 'hr';
  return `<div class="panel-intro"><p class="panel-eyebrow">${t('selectedWork')} / 2025</p><h2 id="panel-title">${t('index')}</h2><p>${t('studioIntro')}</p></div>
    <div class="work-summary"><span><strong>${projectCount}</strong>${t('projectCount')}</span><span><strong>${applicationCount}</strong>${t('applicationCount')}</span><span><strong>${websiteCount}</strong>${t('websiteCount')}</span></div>
    <div class="project-filters" role="group" aria-label="${t('filtersAria')}">${[['all','all'],['apps','apps'],['web','web']].map(([value,label]) => `<button data-filter="${value}" aria-pressed="${state.filter===value}">${t(label)}</button>`).join('')}</div>
    <div class="project-list cards-count-${items.length}">${items.map(project => {
      const p = local(project), story = getCaseStudy(p.id, state.language);
      return `<button class="project-card" data-open-project="${p.id}" style="--project-bg:${p.color}28" aria-label="${t('view')}: ${p.title}"><span class="card-number">${p.number}</span>${state.visited.has(p.id)?`<span class="card-found">${icon('check')}</span>`:''}<div class="card-art"><img src="${mediaFor(p).poster}" alt="" loading="lazy" width="480" height="300"></div><div class="card-content"><span class="card-category">${p.category} · ${p.year}</span><h3>${p.title}</h3><p class="card-excerpt">${story.teaser}</p><span class="card-tech">${p.tech.slice(0,3).join(' · ')}</span>${icon('up-right')}</div></button>`;
    }).join('')}</div><div class="reader-closing"><p>${t('studioIntro')}</p><button class="secondary-button" data-action="about">${t('navAbout')}${icon('arrow')}</button></div><p class="panel-footnote">${t('footer')}<br>longd.tech / ${String(items.length).padStart(2,'0')} ${t('navProjects').toLowerCase()}</p>`;
}
function renderProject() {
  const project = getProject(state.projectId); if (!project) return renderIndex();
  const p = local(project), story = getCaseStudy(project.id, state.language); const index = projects.indexOf(project), next = local(projects[(index + 1) % projects.length]);
  const tourDone = state.guided && index === projects.length - 1;
  return `<article class="project-detail" style="--project-color:${p.color};--project-bg:${p.color}20">
    <button class="back-button" data-action="projects">${icon('arrow')} ${t('back')}</button>
    <p class="panel-eyebrow"><span class="project-dot"></span>${p.number} / ${p.category} <span style="margin-left:auto">${p.year}</span></p>
    <h2 id="panel-title">${p.title}</h2>
    <div class="project-video-wrap"><video data-project-demo controls autoplay muted loop playsinline preload="metadata" data-recording-language="${mediaFor(p).recordingLanguage}" data-source-language="${state.language}" poster="${mediaFor(p).poster}" aria-label="${t('demo')}: ${p.title}"><a href="${mediaFor(p).video}">${t('demo')}</a></video></div>
    <p class="demo-caption">${icon('play')} ${t('demo')}<span class="demo-language">${t({en:'demoEnglish',vi:'demoVietnamese',mixed:'demoMultilingual'}[mediaFor(p).recordingLanguage]||'demoShared')}</span></p>
    ${['en','vi'].includes(mediaFor(p).recordingLanguage)&&mediaFor(p).recordingLanguage!==state.language?`<p class="demo-source-note">${t(state.language==='en'?'demoMissingEnglish':'demoMissingVietnamese')}</p>`:''}
    <p class="project-description">${p.description}</p>
    <dl class="case-meta"><div><dt>${t('projectType')}</dt><dd>${p.category}</dd></div><div><dt>${t('projectDate')}</dt><dd>${formatProjectDate(p.date,state.language)}</dd></div><div><dt>${t('technologiesAria')}</dt><dd>${p.tech.slice(0,2).join(' / ')}</dd></div></dl>
    <section class="case-section"><h3>${t('focusLabel')}</h3><p class="case-lead">${story.focus}</p></section>
    <section class="case-section"><h3>${t('approachLabel')}</h3><p>${story.approach}</p></section>
    <section class="case-section"><h3>${t('capabilityLabel')}</h3><div class="case-features">${story.useCases.map((item,i)=>`<div class="case-feature"><span>${String(i+1).padStart(2,'0')}</span><div><h4>${item.title}</h4><p>${item.text}</p></div></div>`).join('')}</div></section>
    <section class="case-section"><h3>${t('galleryLabel')}</h3><p>${t('galleryHint')}</p><div class="case-gallery">${story.gallery.map(image=>`<figure><button data-demo-time="${image.time}" aria-label="${t('playMoment')} ${demoTimestamp(image.time)}"><img src="${image.src}" alt="${escapeText(image.alt)}" loading="lazy" width="${image.width}" height="${image.height}"></button><figcaption><span>${image.caption}</span><time>${demoTimestamp(image.time)}</time></figcaption></figure>`).join('')}</div></section>
    <section class="case-section"><h3>${t('takeawayLabel')}</h3><p>${story.takeaway}</p></section>
    <ul class="project-highlights" hidden>${p.highlights.map(item => `<li>${icon('check')}${item}</li>`).join('')}</ul>
    <div class="tech-tags" aria-label="${t('technologiesAria')}">${p.tech.map(tech => `<span>${tech}</span>`).join('')}</div>
    <div class="project-actions">${p.live ? `<a class="primary-button" href="${p.live}" target="_blank" rel="noopener noreferrer">${t('visit')}${icon('up-right')}</a>` : ''}<a class="${p.live ? 'secondary-button' : 'primary-button'}" href="${p.github}" target="_blank" rel="noopener noreferrer">${icon('github')}${t('code')}</a></div>
    ${renderRelatedProjects(project.id)}<div class="detail-bottom">${world ? `<button class="drive-button" data-drive-project="${p.id}">${icon('car')}${t('drive')}</button>` : '<span></span>'}<button class="next-project" ${tourDone ? 'data-action="end-tour"' : `data-next-project="${next.id}"`}><span><small>${tourDone ? t('route') : t('next')}</small>${tourDone ? t('return') : next.short}</span>${icon('arrow')}</button></div>
  </article>`;
}
function renderAbout() {
  return `<article class="info-content"><p class="panel-eyebrow">${t('aboutLabel')}</p><h2 id="panel-title">${t('aboutTitle')}</h2><p class="info-lead">${t('aboutIntro')}</p><p>${t('aboutText')}</p>
    <div class="about-illustration" aria-hidden="true"><span class="big-asterisk">✳</span><div class="little-facts"><span>${icon('pin')} ${t('location').toLocaleUpperCase(state.language)}</span><span>${icon('car')} ${t('factRole')}</span><span>${icon('leaf')} ${t('factCuriosity')}</span></div></div>
    <p>${t('aboutWork')}</p><h3 class="skill-heading">${t('skills')}</h3>
    <div class="skill-row"><strong>${t('frontend')}</strong><span>React · Next.js · Tailwind CSS · Three.js · GSAP</span></div><div class="skill-row"><strong>${t('backend')}</strong><span>Python · Node.js · Express · Django · PostgreSQL</span></div><div class="skill-row"><strong>${t('data')}</strong><span>Plotly · NumPy · ${t('dataTools')}</span></div><div class="skill-row"><strong>${t('delivery')}</strong><span>Git · Docker · CI/CD · Vercel · Supabase</span></div>
    ${renderCapabilities()}${renderJourney()}<div class="info-links"><button class="primary-button" data-action="contact">${t('navContact')}${icon('up-right')}</button><a class="secondary-button" href="https://github.com/JLTC3111" target="_blank" rel="noopener noreferrer">${icon('github')}GitHub</a></div></article>`;
}
function renderContact() {
  return `<article class="info-content"><p class="panel-eyebrow">${t('contactLabel')}</p><h2 id="panel-title">${t('contactTitle')}</h2><div class="contact-art" aria-hidden="true">${icon('mail')}</div><p>${t('contactText')}</p>
    <section class="case-section"><h3>${t('contactPrompts')}</h3><ul class="contact-prompts">${['contactPrompt1','contactPrompt2','contactPrompt3'].map(key=>`<li>${icon('arrow')}${t(key)}</li>`).join('')}</ul></section><a class="email-address" href="mailto:dev@icue.vn">dev@icue.vn ${icon('up-right')}</a><div class="info-links"><a class="primary-button" href="mailto:dev@icue.vn">${icon('mail')}${t('email')}</a><button class="secondary-button" data-action="copy-email" aria-label="${t('copyEmail')}">${icon('copy')}</button></div>
    <section class="case-section"><h3>${t('contactProjects')}</h3>${renderRelatedProjects(null, ['hr','crypto','icue'])}</section><div class="contact-links"><a href="https://github.com/JLTC3111" target="_blank" rel="noopener noreferrer"><span>${icon('github')}GitHub</span>${icon('up-right')}</a><a href="https://www.youtube.com/@Drherbal2011" target="_blank" rel="noopener noreferrer"><span>${icon('play')}YouTube</span>${icon('up-right')}</a><a href="https://longd.tech" target="_blank" rel="noopener noreferrer"><span>${icon('up-right')}longd.tech</span>${icon('up-right')}</a></div><div class="contact-location">${icon('pin')}${t('location')} · UTC+7</div></article>`;
}
function renderHelp() {
  return `<article class="info-content"><p class="panel-eyebrow">${t('help')}</p><h2 id="panel-title">${t('helpTitle')}</h2><p>${t('helpIntro')}</p><ul class="help-list"><li>${icon('car')}${t('helpDrive')}</li><li>${icon('pin')}${t('helpClick')}</li><li>${icon('map')}${t('helpMouse')}</li><li>${icon('map')}${t('helpTrackpad')}</li><li>${icon('grid')}${t('helpProject')}</li><li>${icon('car')}${t('helpProps')}</li><li><kbd>↟</kbd>${t('helpBoost')}</li><li>${icon('car')}${t('helpAir')}</li><li>${icon('map')}${t('helpMore')}</li></ul><p class="help-touch">${t('helpTouch')}</p>${reducedMotion ? `<p>${t('reduced')}</p>` : ''}<button class="primary-button" data-action="explore">${t('explore')}${icon('arrow')}</button></article>`;
}
function mapSvg(large = false, carId = large ? 'large-car' : 'mini-car') {
  const river = Array.from({length:65},(_,i)=>{ const x=-RIVER_REACH+i*RIVER_REACH*2/64; return `${x},${riverCenter(x)}`; }).join('L');
  const boundaryMarkup=`<ellipse cx="0" cy="0" rx="${DRIVING_BOUNDS.x-BOUNDARY_INSET}" ry="${DRIVING_BOUNDS.z-BOUNDARY_INSET}" fill="none" stroke="#283b42" stroke-width="1.7"/><ellipse cx="0" cy="0" rx="${DRIVING_BOUNDS.x-BOUNDARY_INSET}" ry="${DRIVING_BOUNDS.z-BOUNDARY_INSET}" fill="none" stroke="#f5dfac" stroke-width=".9" stroke-dasharray="4 3"/>`;
  const arrows=outerRoadLoop.map((a,i)=>{const b=outerRoadLoop[(i+1)%12],direction=outerTownDirections[i],heading=Math.atan2((b[0]-a[0])*direction,(b[1]-a[1])*direction)*180/Math.PI;return `<path d="m-.9,-1.2 .9,2  .9,-2" fill="none" stroke="#34484a" stroke-width=".55" stroke-linecap="round" stroke-linejoin="round" transform="translate(${(a[0]+b[0])/2},${(a[1]+b[1])/2}) rotate(${-heading})"/>`;}).join('');
  const town=`<circle cx="${TOWN_CENTER.x}" cy="${TOWN_CENTER.z}" r="2.1" fill="#f5dfac" stroke="#34484a" stroke-width=".55"/>${large?`<text x="0" y="22" text-anchor="middle" font-size="4" font-weight="700" fill="#34484a">${t('town')}</text>`:''}`;
  const features = `${arrows}${town}<path d="M38.7,38.8h.6l.5,1.9q1.2,2.8-.8,2.8t-.8-2.8Z" fill="#f8f3df" stroke="#9a4540" stroke-width=".4"/><rect x="-48" y="21" width="4" height="4" rx=".4" fill="#b6372f"/><path d="M${river}" fill="none" stroke="#80b9b3" stroke-width="${RIVER_HALF_WIDTH*2}"/>${bridges.map(b=>`<rect x="${-b.width/2}" y="${-b.length/2}" width="${b.width}" height="${b.length}" rx=".25" fill="#bda279" transform="translate(${b.x},${b.z}) rotate(${-b.heading*180/Math.PI})"/>`).join('')}${houses.map(h=>`<rect x="${h.x-1.4}" y="${h.z-1.2}" width="2.8" height="2.4" rx=".3" fill="${h.color}"/>`).join('')}${portals.map(p=>`<circle cx="${p.x}" cy="${p.z}" r="1.1" fill="none" stroke="${p.color}" stroke-width=".45"/>`).join('')}`;
  return `<path d="M-28 0C-30 13-19 22-8 22C7 24 22 21 27 11C32 1 29-12 22-17C12-24-6-25-19-19C-27-15-30-7-28 0Z" fill="#c4cfae" transform="scale(${WORLD_SCALE})"/><path d="M${outerRoadLoop.map(point=>point.join(',')).join('L')}Z" fill="none" stroke="#eeeddc" stroke-width="${ROAD_WIDTHS.ring}"/><path d="M${roadLoop.map(point => point.join(',')).join('L')}Z M0,-13V13 M-20,0H20" fill="none" stroke="#eeeddc" stroke-width="${ROAD_WIDTHS.spine}" stroke-linecap="round" stroke-linejoin="round"/>${connectorPaths.map(path=>`<path d="M${path.map(key=>roadNodes[key].join(",")).join("L")}" fill="none" stroke="#eeeddc" stroke-width="${ROAD_WIDTHS.spine}"/>`).join("")}${features}${boundaryMarkup}${projects.map(p => `<rect x="${p.position[0] - p.footprint[0]/2}" y="${p.position[1] - p.footprint[1]/2}" width="${p.footprint[0]}" height="${p.footprint[1]}" rx=".4" fill="${p.color}" opacity=".7"/>`).join('')}${large ? '' : projects.map(p => `<circle cx="${p.position[0]}" cy="${p.position[1]}" r=".55" fill="#fffdf0"/>`).join('')}<g id="${carId}" transform="translate(0,13)"><circle r="1.9" fill="#f8efcd" opacity=".8"/><path d="m0 1.25-.9-1.8L0-.15l.9-.4Z" fill="#e94e31"/></g>`;
}
function renderMap(){
  const all=mapLocations(state.language),locations=all.filter(l=>l.category===state.mapCategory),frame=mapFrame({zoom:state.mapZoom,centre:state.mapZoom>1?state.carPosition:{x:0,z:0}}),picture=world?.captureMap?.(frame)||'';
  const left=frame.x-frame.halfWidth,top=frame.z-frame.halfHeight,width=frame.halfWidth*2,height=frame.halfHeight*2,box=`${left} ${top} ${width} ${height}`;
  const image=picture?`<image href="${picture}" x="${left}" y="${top}" width="${width}" height="${height}" preserveAspectRatio="none"/>`:mapSvg(true,'map-fallback-car').replace(/<g id="map-fallback-car"[\s\S]*?<\/g>/,'');
  const car=state.carPosition,carScale=frame.halfWidth/35;
  const vehicle=`<g id="large-car" data-map-scale="${carScale}" transform="translate(${car.x},${car.z}) rotate(${-car.heading*180/Math.PI}) scale(${carScale})"><circle r="1.3" fill="#fff8de" stroke="#24383e" stroke-width=".12"/><path d="m0 1.1-.65-1.5L0-.1l.65-.3Z" fill="#ed5838"/></g>`;
  return `<article class="travel-map"><p class="panel-eyebrow">${t('mapEyebrow')}</p><h2 id="panel-title">${t('map')}</h2><p class="map-intro">${t('teleportHint')}</p><div class="atlas-tabs" role="group" aria-label="${t('destinations')}">${['buildings','objects'].map(category=>`<button data-map-category="${category}" aria-pressed="${state.mapCategory===category}">${t(category==='buildings'?'mapBuildings':'mapObjects')}<span>${all.filter(l=>l.category===category).length}</span></button>`).join('')}</div><div class="travel-map-layout"><div><div class="large-map top-view-map"><svg viewBox="${box}" aria-hidden="true">${image}${vehicle}</svg><span class="atlas-north" aria-hidden="true">N ↑</span><div class="atlas-zoom"><button data-map-zoom="in" aria-label="${t('mapZoomIn')}">+</button><button data-map-zoom="out" aria-label="${t('mapZoomOut')}">−</button><button data-map-zoom="fit" aria-label="${t('mapOverview')}">↺</button></div>${locations.filter(l=>Math.abs(l.x-frame.x)<frame.halfWidth&&Math.abs(l.z-frame.z)<frame.halfHeight).map(l=>`<button class="map-pin ${l.projectId?'is-building':'is-object'}" data-teleport="${l.id}" style="left:${(l.x-left)/width*100}%;top:${(l.z-top)/height*100}%;--pin-color:${l.color||'#d3efdb'}" aria-label="${t('teleportTo')} ${l.name}"><span class="map-pin-label">${l.name}</span></button>`).join('')}</div><div class="atlas-legend"><span><i class="atlas-car-dot"></i>${t('youAreHere')}</span><span>${t(state.mapCategory==='buildings'?'mapBuildings':'mapObjects')}</span><span>${state.mapZoom.toFixed(1)}×</span></div></div><aside class="map-destinations"><h3>${t('destinations')}</h3><div class="map-location-list">${locations.map(l=>`<button data-teleport="${l.id}"><span class="destination-diamond" aria-hidden="true">${l.projectId?'◆':'◇'}</span><span>${l.name}</span>${icon('arrow')}</button>`).join('')}</div><p class="panel-footnote">${t('mapRespawn')}</p></aside></div><button class="secondary-button" data-action="close-world">${t('return')}</button></article>`;
}
function carIcon(id){if(id!=='explorer')return `<img src="./assets/cars/${id}-preview.png" alt="" loading="lazy" decoding="async">`;const c=vehicleModel(id).color;return `<svg viewBox="0 0 120 66" aria-hidden="true"><ellipse cx="60" cy="58" rx="48" ry="5" fill="currentColor" opacity=".09"/><path d="M17 37 28 28h64l15 12v12H17Z" fill="${c}"/><circle cx="32" cy="51" r="${id==='monster-truck'?13:9}" fill="#26383b"/><circle cx="92" cy="51" r="${id==='monster-truck'?13:9}" fill="#26383b"/>${id==='8-ball'?'<path d="M39 36a22 22 0 0 1 44 0" fill="#142329"/><circle cx="61" cy="22" r="10" fill="#f5f1df"/><text x="61" y="27" text-anchor="middle" font-size="15" font-weight="700" fill="#142329">8</text>':id==='toy-story'?'<path d="M42 31V20h39v12" fill="#f4ce48"/><ellipse cx="62" cy="18" rx="30" ry="7" fill="#765044"/><path d="M48 18V9h26v9" fill="#765044"/>':id==='monster-truck'?'<path d="m23 29 8-15 19 8 8-9 38 12-2 13Z" fill="#659d41"/><path d="m26 28 6 8 6-8 6 8 6-8" fill="#efdc9c"/>':'<path d="m40 29 8-18h30l14 18" fill="#f0e5c9"/><path d="m48 15-6 13h16V15Zm17 0v13h19l-9-13" fill="#344e5a"/>'}</svg>`;}
function renderGarage(){return `<section id="car-selector" class="garage-section"><h3 class="skill-heading">${t('chooseCar')}</h3><p>${t('garageIntro')}</p><div class="garage-grid">${VEHICLE_MODELS.map(model=>`<button class="garage-card" data-car-model="${model.id}" aria-pressed="${state.carModel===model.id}">${carIcon(model.id)}<strong>${state.language==='vi'?model.nameVi:model.name}</strong><small>${state.language==='vi'?model.descriptionVi:model.description}</small><span>${state.carModel===model.id?t('selectedCar'):t('selectCar')}</span></button>`).join('')}</div></section>`;}
const weatherKey = mode => ({ clear: 'weatherClear', rain: 'weatherRain', snow: 'weatherSnow', auto: 'weatherAuto' }[mode] || 'weatherClear');
function updateEnvironment(environment) {
  if (!environment) return;
  state.environment = environment;
  environmentAudio.update({hour:environment.hour,weather:environment.weather,riverDistance:state.riverDistance??12});
  const presentation = getScenePresentation(environment);
  if (document.body.dataset.scenePalette !== presentation.key) {
    document.body.dataset.scenePalette = presentation.key;
    document.body.dataset.scenePhase = presentation.phase;
    document.body.style.setProperty('--scene-ink',presentation.ink);
    document.body.style.setProperty('--scene-muted',presentation.muted);
    document.body.style.setProperty('--scene-wash',presentation.wash);
    document.body.style.setProperty('--scene-wash-mid',`${presentation.wash}cf`);
  }
  const hour = Math.floor(environment.hour) % 24, minute = Math.floor(environment.hour % 1 * 60);
  const clock = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const summary = `${clock} · ${t(weatherKey(environment.weather))}`;
  if ($('#environment-summary').textContent !== summary) $('#environment-summary').textContent = summary;
  if ($('#environment-clock')) $('#environment-clock').textContent = clock;
  state.timeMode = environment.timeMode; state.weatherMode = environment.weatherMode;
  if (['world','help'].includes(state.panel)) panelShowcase?.setTheme(environment.night > .55);
}
function syncWorldChoices() {
  panelShowcase?.setHeadlights(state.headlights);
  document.querySelectorAll('[data-time-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.timeMode === state.timeMode)));
  document.querySelectorAll('[data-weather]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.weather === state.weatherMode)));
  document.querySelectorAll('[data-headlights]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.headlights === state.headlights)));
}
function renderWorld() {
  const times = [['auto','↻','timeAuto'],['sunrise','↗','timeSunrise'],['day','☀','timeDay'],['sunset','↘','timeSunset'],['night','☾','timeNight']];
  const weathers = [['clear','☀','weatherClear'],['rain','☂','weatherRain'],['snow','❄','weatherSnow'],['auto','↻','weatherAuto']];
  return `<article class="info-content world-settings"><p class="panel-eyebrow">${t('worldSettings')} / LONG D.</p><h2 id="panel-title">${t('worldTitle')}</h2><p>${t('worldIntro')}</p><div class="world-clock-card"><span id="environment-clock">08:30</span><svg class="icon"><use href="#i-sun"/></svg></div>
    ${renderGarage()}<h3 class="skill-heading">${t('timeLabel')}</h3><div class="world-options time-options" role="group" aria-label="${t('timeLabel')}">${times.map(([mode,glyph,key])=>`<button data-time-mode="${mode}" aria-pressed="${state.timeMode===mode}"><span aria-hidden="true">${glyph}</span>${t(key)}</button>`).join('')}</div><p class="world-explanation">${t('worldCycle')}</p><p class="world-explanation">${t('worldSoundscape')}</p>
    <h3 class="skill-heading">${t('weatherLabel')}</h3><div class="world-options" role="group" aria-label="${t('weatherLabel')}">${weathers.map(([mode,glyph,key])=>`<button data-weather="${mode}" aria-pressed="${state.weatherMode===mode}"><span aria-hidden="true">${glyph}</span>${t(key)}</button>`).join('')}</div>
    <h3 class="skill-heading">${t('headlightsLabel')}</h3><div class="world-options light-options" role="group" aria-label="${t('headlightsLabel')}">${[['auto','lightsAuto'],['on','lightsOn'],['off','lightsOff']].map(([mode,key])=>`<button data-headlights="${mode}" aria-pressed="${state.headlights===mode}">${t(key)}</button>`).join('')}</div>
    <h3 class="skill-heading">${t('zoomLabel')}</h3><div class="zoom-options"><button class="secondary-button" data-zoom="out" aria-label="${t('zoomOut')}">−</button><button class="secondary-button" data-zoom="reset">${t('zoomReset')}</button><button class="secondary-button" data-zoom="in" aria-label="${t('zoomIn')}">+</button></div><p class="world-explanation">${t('zoomNote')}</p><p class="help-touch">${t('worldPhysics')}</p><button class="primary-button" data-action="close-world">${t('return')}${icon('arrow')}</button></article>`;
}
function syncMusicButton(snapshot) {
  const info=snapshot||backgroundMusic?.getState()||{enabled:state.music,blocked:false};
  const button=$('#music');if(!button)return;
  const active=info.enabled&&!info.blocked;
  button.innerHTML=icon(active?'pause':'play');
  button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',t(active?'musicPause':'musicPlay'));button.title=t(active?'musicPause':'musicPlay');
}
function syncSoundButton() {
  $('#sound').innerHTML = icon(state.sound ? 'sound' : 'muted'); $('#sound').setAttribute('aria-pressed', String(state.sound));
  $('#sound').setAttribute('aria-label', state.sound ? t('soundOff') : t('soundOn')); $('#sound').title = state.sound ? t('soundOff') : t('soundOn');
}
function renderPanel({ mount = true } = {}) {
  disposeShowcase();
  panelPreviews?.destroy(); panelPreviews = null;
  // Pause an active demo before replacing its DOM, including language/filter changes.
  $('#panel-content').querySelectorAll('video').forEach(releaseDemo);
  suspendedDemo = null;
  const context = state.panel === 'project' ? `${getProject(state.projectId)?.number || '01'} / ${projectCount} · LONG D.` : state.panel === 'projects' ? `${t('selectedWork')} · LONG D.` : t('siteSubtitle');
  $('#panel-context').textContent = context;
  const renders = { projects: renderIndex, project: renderProject, about: renderAbout, contact: renderContact, help: renderHelp, map: renderMap, world: renderWorld };
  const content = (renders[state.panel] || renderIndex)();
  panel.classList.add('portfolio-panel'); panel.dataset.view = state.panel || 'projects';
  $('#panel-content').innerHTML = `<div class="panel-layout">${state.panel==='map'?'':renderStage()}<div class="panel-reader">${content}</div></div>`;
  panelPreviews = createPanelPreviews({ container:$('#panel .panel-reader'), mediaFor:id=>mediaFor(id), isActive:()=>panel.open });
  startCurrentDemo(); updateEnvironment(state.environment); if (mount && panel.open) mountShowcase();
}

function goHome() {
  drivingHud.reveal();closePanel(); stopTour(); world?.overview(); state.exploring = false; state.nearby = null;
  document.body.classList.remove('exploring'); updateStatus(); refreshNearby(); setHash(null);
}
async function performAction(action) {
  if (['projects', 'about', 'contact', 'help', 'map', 'world'].includes(action)) { showPanel(action); return; }
  if(action==='garage'){showPanel('world');$('#car-selector')?.scrollIntoView?.({block:'start'});return;}
  if (action === 'jump') { world?.jump(); return; }
  if(action==='hydraulics'){world?.hydraulics();return;}
  if (action === 'tour') { startTour(); return; }
  if (action === 'explore') { closePanel(); if (world) world.start(); else if (state.ready) showPanel('projects'); else showToast(t('loading')); return; }
  if (action === 'toggle-music') { const current=backgroundMusic.getState();state.music=!current.enabled||current.blocked;storage.set('music',state.music?'on':'off');backgroundMusic.setEnabled(state.music);return; }
  if (action === 'watch-demo') { seekDemo(0); return; }
  if (action === 'reset-showcase') { panelShowcase?.resetView(); return; }
  if (action === 'close-world') { closePanel(); return; }
  if (action === 'overview') { goHome(); return; }
  if (action === 'end-tour') { closePanel(); stopTour(); return; }
  if (action === 'copy-email') {
    try { await navigator.clipboard.writeText('dev@icue.vn'); showToast(t('emailCopied')); }
    catch { showToast(t('copiedFail'), 5000); }
  }
}
function spotlightFromCard(event) { if (state.panel !== 'projects') return; const card = event.target.closest?.('.project-card'); if (card && card.dataset.openProject !== state.spotlightId) selectSpotlight(card.dataset.openProject); }
document.addEventListener('pointerdown',event=>{if(!panel.open&&event.target.closest?.('#island-canvas,[data-drive],[data-action="jump"]'))drivingHud.engage();});
document.addEventListener('pointerover', spotlightFromCard);
document.addEventListener('focusin', spotlightFromCard);
document.addEventListener('click', event => {
  const button = event.target.closest('[data-map-category], [data-map-zoom], [data-teleport], [data-car-model], [data-screen-mode], [data-stack-tool], [data-spotlight], [data-demo-time], [data-time-mode], [data-weather], [data-headlights], [data-zoom], [data-go-portal], [data-go-playground], [data-language], [data-action], [data-open-project], [data-drive-project], [data-next-project], [data-filter]');
  if (!button) return;
  if(button.dataset.mapCategory){state.mapCategory=button.dataset.mapCategory==='objects'?'objects':'buildings';state.mapZoom=state.mapCategory==='objects'?3:1;renderPanel();return;}
  if(button.dataset.mapZoom){state.mapZoom=button.dataset.mapZoom==='fit'?1:Math.max(1,Math.min(6,state.mapZoom*(button.dataset.mapZoom==='in'?1.5:1/1.5)));renderPanel();return;}
  if(button.dataset.teleport){const location=mapLocations(state.language).find(l=>l.id===button.dataset.teleport);if(world?.teleportTo(button.dataset.teleport)){closePanel();drivingHud.reveal();engineAudio.update({...engineAudio.motion,paused:false});engineAudio.impact?.('teleport',3);showToast(`${t('teleported')} ${location?.name||''}`);}return;}
  if(button.dataset.carModel){state.carModel=world?.setCarModel(button.dataset.carModel)||vehicleModel(button.dataset.carModel).id;storage.set('car',state.carModel);renderPanel();return;}
  if (button.dataset.screenMode) setShowcaseScreen(button.dataset.screenMode);
  else if (button.dataset.stackTool) selectShowcaseTool(button.dataset.stackTool);
  else if (button.dataset.spotlight) selectSpotlight(button.dataset.spotlight);
  else if (button.hasAttribute('data-demo-time')) seekDemo(Number(button.dataset.demoTime));
  else if (button.dataset.timeMode) { state.timeMode = button.dataset.timeMode; updateEnvironment(world?.setTimeMode(state.timeMode)); syncWorldChoices(); }
  else if (button.dataset.weather) { state.weatherMode = button.dataset.weather; updateEnvironment(world?.setWeather(state.weatherMode)); syncWorldChoices(); }
  else if (button.dataset.headlights) { state.headlights = button.dataset.headlights; world?.setHeadlightsMode(state.headlights); syncWorldChoices(); }
  else if (button.dataset.zoom) { if (button.dataset.zoom === 'reset') world?.resetCamera(); else world?.zoomBy(button.dataset.zoom === 'in' ? -.06 : .06); }
  else if(button.dataset.goPlayground){closePanel();stopTour();world?.goToPlayground(button.dataset.goPlayground);}
  else if (button.dataset.goPortal) { closePanel(); stopTour(); world?.goToPortal(button.dataset.goPortal); }
  else if (button.dataset.language) setLanguage(button.dataset.language);
  else if (button.dataset.action) performAction(button.dataset.action);
  else if (button.dataset.openProject) openProject(button.dataset.openProject);
  else if (button.dataset.driveProject) navigateTo(button.dataset.driveProject);
  else if (button.dataset.nextProject) {
    if (state.guided) navigateTo(button.dataset.nextProject, true); else openProject(button.dataset.nextProject);
  } else if (button.dataset.filter) {
    state.filter = button.dataset.filter; renderPanel();
    $(`[data-filter="${state.filter}"]`)?.focus({ preventScroll: true });
  }
});
$('#explore').addEventListener('click', () => performAction('explore'));
$('#home-link').addEventListener('click', event => { event.preventDefault(); goHome(); });
$('#skip-link').addEventListener('click', event => { event.preventDefault(); showPanel('projects'); });
$('#nearby-project').addEventListener('click', () => { if (state.nearby) openProject(state.nearby); });
$('#stop-tour').addEventListener('click', stopTour);
$('#reset').addEventListener('click', () => { stopTour(); world?.reset(); showToast(t('resetToast')); });
$('#theme').addEventListener('click', () => {
  state.night = !state.night; storage.set('theme', state.night ? 'dark' : 'light'); applyTheme();
});

async function toggleSound() {
  state.sound = !state.sound; storage.set('sound', state.sound ? 'on' : 'off'); engineAudio.setEnabled(state.sound);backgroundMusic.setMuted(!state.sound);environmentAudio.setEnabled(state.sound);
  if (state.sound) await engineAudio.resume(); syncSoundButton();
}
function honk() { if (state.sound) engineAudio.resume().then(() => engineAudio.honk()).catch(() => {}); }
$('#sound').addEventListener('click', () => toggleSound().catch(() => showToast(t('soundOff'))));
document.addEventListener('visibilitychange', () => {
  engineAudio.suspend(document.hidden);
  const video = $('#panel-content video[data-project-demo]');
  if (document.hidden && video && !video.paused) { suspendedDemo = video; video.pause(); }
  else if (!document.hidden && suspendedDemo?.isConnected && panel.open) { playDemo(suspendedDemo); suspendedDemo = null; }
});
window.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (panel.open) return;
  if(drivingKey(event))drivingHud.engage();
  const key = event.key.toLowerCase();
  if (key === 'escape') { event.preventDefault();world?.stopDriving();drivingHud.reveal(); }
  if (key === 'm') { event.preventDefault(); showPanel('map'); }
  if (key === 'p') { event.preventDefault(); showPanel('projects'); }
  if (key === 'r') { event.preventDefault(); stopTour(); world?.reset(); showToast(t('resetToast')); }
  if (key === 'h') honk();
  if (key === '?') showPanel('help');
  if (key === 'enter' && state.nearby && ['BODY', 'CANVAS'].includes(event.target.tagName)) { event.preventDefault(); openProject(state.nearby); }
});
for (const button of document.querySelectorAll('[data-drive]')) {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); button.classList.add('pressed'); world?.setKey(button.dataset.drive, true); });
  const release = () => { button.classList.remove('pressed'); world?.setKey(button.dataset.drive, false); };
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}
function updateClock() {
  $('#local-time').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}
function readHash() {
  const hash = location.hash.slice(1);
  if (hash.startsWith('project/')) { if (getProject(hash.slice(8))) openProject(hash.slice(8)); else showPanel('projects'); }
  else if (['projects', 'about', 'contact', 'map', 'help', 'world'].includes(hash)) showPanel(hash);
}
window.addEventListener('hashchange', readHash);
$('#minimap-svg').setAttribute('viewBox','-85 -52 170 130');$('#minimap-svg').innerHTML = mapSvg(); translatePage(); syncVisitedProjects(); updateClock(); setInterval(updateClock, 30000); readHash();

try {
  const { createWorld } = await import('./world.js');
  await loadCarAssets();
  world = createWorld({
    container: $('#world'), carModel:state.carModel, reducedMotion,
    onStart: startExploring,
    onProject: openProject,
    onArrival(id) { state.destination = null; updateStatus(); openProject(id); },
    onCancelRoute() { state.guided = false; state.destination = null; updateStatus(); },
    onNearby(id) { state.nearby = id; refreshNearby(); },
    onPortal() { engineAudio.impact('teleport',4);showToast(t('portalArrival')); },
    onImpact({kind,strength,distance}){engineAudio.impact(kind,strength,distance);},
    onExplosion({distance}){engineAudio.blast(distance);},
    onEnvironment: updateEnvironment,
    onFrame({ x, z, heading, speed, actualSpeed, rpm, gear, throttle,carModel, acceleration, paused, hop, elapsed,surface,airborne,boosting,landingImpact,steering,weather }) {
      drivingHud.update({speed:actualSpeed,hop,elapsed,paused,panelOpen:panel.open});
      state.carPosition={x,z,heading};$('#minimap-svg').setAttribute('viewBox',`${x-85} ${z-65} 170 130`);
      state.riverDistance = Math.abs(z-riverCenter(x));
      const transform = `translate(${x.toFixed(2)},${z.toFixed(2)}) rotate(${(-heading * 180 / Math.PI).toFixed(1)})`;
      $('#mini-car')?.setAttribute('transform',transform+' scale(3)');const mapCar=$('#large-car');mapCar?.setAttribute('transform',transform+` scale(${mapCar.dataset.mapScale||1})`); $('#stage-map-car')?.setAttribute('transform', transform);
      const value = Math.round(speed * 3.6); if (value !== speedValue) { speedValue = value; $('#speed').textContent = String(value).padStart(2, '0'); }
      engineAudio.update({speed:actualSpeed,rpm,gear,throttle,model:carModel,acceleration,paused,surface,airborne,boosting,elapsed,slip:Math.min(1,Math.abs((steering||0)*actualSpeed)/35*(weather==='snow'?1.2:1))});
    }
  });
  if (state.panel) { world.setPaused(true); renderPanel(); }
  world.setLanguage(state.language); world.setTimeMode(state.timeMode); world.setWeather(state.weatherMode); world.setHeadlightsMode(state.headlights);
  $('#world-toolbar').hidden = false; updateEnvironment(world.getEnvironment());
  document.body.classList.add('loaded'); state.ready = true;
} catch (error) {
  console.warn('The 3D island could not start. The full project portfolio remains available.', error);
  $('#world canvas')?.remove(); $('#webgl-fallback').hidden = false;
  document.body.classList.add('loaded'); state.ready = true;
  $('#explore').innerHTML = `${icon('grid')}<span data-copy="browseProjects">${t('browseProjects')}</span>${icon('arrow')}`;
}
window.addEventListener('pagehide', event => { if (!event.persisted) { drivingHud.dispose();panelPreviews?.destroy(); disposeShowcase(); world?.dispose(); engineAudio.dispose(); backgroundMusic.dispose(); brandTechText.dispose(); environmentAudio.dispose(); } });
