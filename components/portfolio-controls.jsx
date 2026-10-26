import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Dock from './react-bits/Dock.jsx';
import StaggeredMenu from './react-bits/StaggeredMenu.jsx';

const glyph = name => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;

// Two small React roots keep the real React Bits components independent of the
// Three.js animation loop. All actions and translations belong to the portfolio.
export function mountPortfolioControls({ navigation, dock, model, onAction, onMenuChange=()=>{} }) {
  const navRoot = createRoot(navigation), dockRoot = createRoot(dock);
  const menuController={current:null};
  const menuOpen=()=>onMenuChange(true),menuClose=()=>onMenuChange(false),selectItem=item=>onAction(item.action);
  let previous = '', disposed = false;
  function update(next) {
    const serialized = JSON.stringify(next);
    if (disposed || serialized === previous) return;
    previous = serialized;
    const { labels, language, night, sound, musicPlaying, view } = next;
    const navigationItems = ['home', 'projects', 'about', 'contact','world','garage'].map(action => ({ label:labels[action],ariaLabel:labels[action],link:'#'+action,action,current:view===action||(action==='home'&&!view)||(action==='projects'&&view==='project') }));
    navigationItems.push({id:'header-language',label:language==='en'?'Tiếng Việt':'English',link:'#language',action:'toggle-language',ariaLabel:labels.language});
    const item = (id, icon, label, action, active, pressed) => ({ id, icon:glyph(icon), label, active, pressed, onClick:() => onAction(action) });
    const items = [
      item('garage','car',labels.garage,'garage'),
      item('reset', 'reset', labels.reset, 'reset'),
      { separator:true },
      item('sound', sound ? 'sound' : 'muted', labels.sound, 'toggle-sound', sound, sound),
      item('music', musicPlaying ? 'pause' : 'play', labels.music, 'toggle-music', musicPlaying, musicPlaying),
      { separator:true },
      item('theme', night ? 'moon' : 'sun', labels.theme, 'toggle-theme', false, night),
      item('help', 'help', labels.help, 'help')
    ];
    flushSync(() => {
      navRoot.render(<StaggeredMenu controllerRef={menuController} position="right" items={navigationItems} socialItems={[{label:'GitHub',link:'https://github.com/JLTC3111'},{label:'YouTube',link:'https://www.youtube.com/@Drherbal2011'}]} displaySocials={true} displayItemNumbering={true} displayLogo={false} logoUrl="./assets/favicon.svg" isFixed={true} menuButtonColor="#f2eee6" openMenuButtonColor="#f2eee6" changeMenuColorOnOpen={true} colors={['#B497CF','#5227FF']} accentColor="#ff6b6b" menuLabel={labels.menu} closeLabel={labels.closeMenu} openAriaLabel={labels.openMenuAria} closeAriaLabel={labels.closeMenuAria} socialsLabel={labels.socials} navigationLabel={labels.navigation} onItemSelect={selectItem} onMenuOpen={menuOpen} onMenuClose={menuClose} className="portfolio-menu" />);
      dockRoot.render(<Dock items={items} baseItemSize={50} magnification={70} panelHeight={68} autoHide={false} accentColor={night ? '#c7c8c7' : '#65717a'} className="portfolio-dock" style={{ '--dock-panel':'var(--chrome)', '--dock-panel-edge':'var(--line)', '--dock-panel-highlight':'var(--surface)', '--dock-ink':'var(--ink)', '--dock-tile':night ? 'linear-gradient(#444c55, #343c45)' : 'linear-gradient(#f4f0e8, #e6e1d8)', '--dock-tile-edge':'var(--line)', '--dock-dot':'var(--ink)', '--dock-separator':'var(--line)', '--dock-label':'var(--paper)', '--dock-label-ink':'var(--ink)' }} />);
    });
  }
  update(model);
  return { update, closeMenu(){menuController.current?.close();}, dispose() { if (disposed) return; disposed = true; navRoot.unmount(); dockRoot.unmount(); } };
}
