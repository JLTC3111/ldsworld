import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Dock from './react-bits/Dock.jsx';
import GooeyNav from './react-bits/GooeyNav.jsx';

const glyph = name => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;

// Two small React roots keep the real React Bits components independent of the
// Three.js animation loop. All actions and translations belong to the portfolio.
export function mountPortfolioControls({ navigation, dock, model, onAction }) {
  const navRoot = createRoot(navigation), dockRoot = createRoot(dock);
  let previous = '', disposed = false;
  function update(next) {
    const serialized = JSON.stringify(next);
    if (disposed || serialized === previous) return;
    previous = serialized;
    const { labels, night, sound, musicPlaying, view } = next;
    const navigationItems = ['home', 'projects', 'about', 'contact'].map(action => ({ label:labels[action], action }));
    const activeIndex = view === 'project' || view === 'projects' ? 1 : view === 'about' ? 2 : view === 'contact' ? 3 : 0;
    const item = (id, icon, label, action, active, pressed) => ({ id, icon:glyph(icon), label, active, pressed, onClick:() => onAction(action) });
    const items = [
      item('garage', 'car', labels.garage, 'garage'),
      item('reset', 'reset', labels.reset, 'reset'),
      { separator:true },
      item('sound', sound ? 'sound' : 'muted', labels.sound, 'toggle-sound', sound, sound),
      item('music', musicPlaying ? 'pause' : 'play', labels.music, 'toggle-music', musicPlaying, musicPlaying),
      { separator:true },
      item('theme', night ? 'moon' : 'sun', labels.theme, 'toggle-theme', false, night),
      item('help', 'help', labels.help, 'help')
    ];
    flushSync(() => {
      navRoot.render(<GooeyNav items={navigationItems} activeIndex={activeIndex} ariaLabel={labels.navigation} theme={night ? 'dark' : 'light'} color={night ? '#fafafa' : '#171717'} activeTextColor={night ? '#171717' : '#fafafa'} size="md" frame={true} particleCount={15} spread={56} animationTime={600} timeVariance={300} gooeyness={0.5} wobble={0.5} hoverEffect={true} onChange={(_, item) => onAction(item.action)} className="portfolio-navigation" style={{ '--gn-frame':'var(--chrome)', '--gn-frame-edge':'var(--line)', '--gn-frame-highlight':'var(--surface)', '--gn-ink':'var(--ink)', '--gn-muted':'var(--muted)' }} />);
      dockRoot.render(<Dock items={items} baseItemSize={50} magnification={70} panelHeight={68} autoHide={false} accentColor={night ? '#ffffff' : '#111111'} className="portfolio-dock" style={{ '--dock-panel':'var(--chrome)', '--dock-panel-edge':'var(--line)', '--dock-panel-highlight':'var(--surface)', '--dock-ink':'var(--ink)', '--dock-tile':night ? 'linear-gradient(#303030, #202020)' : 'linear-gradient(#ffffff, #eeeeee)', '--dock-tile-edge':'var(--line)', '--dock-dot':'var(--ink)', '--dock-separator':'var(--line)', '--dock-label':'var(--paper)', '--dock-label-ink':'var(--ink)' }} />);
    });
  }
  update(model);
  return { update, dispose() { if (disposed) return; disposed = true; navRoot.unmount(); dockRoot.unmount(); } };
}
