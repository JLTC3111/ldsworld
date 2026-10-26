import { ROAD_WIDTHS,DISTRICT_SCALE } from './world-layout.js';
import { roadNodes } from './driving.js';
// Project facts, links and demos are from the existing longd.tech portfolio.
// Source: full-stack-course/1.web-portfolio-en/index.html (and its VN counterpart).
export const projects = [
  {
    id: 'hr', number: '01', title: 'HR Management Platform', short: 'HR Management',
    category: 'People & productivity', year: '2025', date: 'December 22, 2025', color: '#ce795f',
    description: 'An HR workspace centered on multilingual PDF, CSV and Excel reporting, leave requests and approvals, and Time Clock records for salary calculations. Employee records, tasks and performance information support those daily workflows.',
    highlights: ['Time Clock records for salary calculations', 'Leave management & approvals', 'Multilingual PDF, CSV & Excel reports'],
    tech: ['React', 'Tailwind CSS', 'Chart.js', 'PostgreSQL'],
    live: 'https://hr.icue.vn', github: 'https://github.com/JLTC3111/hr_software',
    position: [-62, -73], stop: 'o1', scale:1.7, rotation:0, footprint: [5.4, 4], labelHeight: 5.9,
    vi: { title: 'Nền tảng Quản trị Nhân sự', short: 'Quản trị Nhân sự', category: 'Nhân sự & năng suất', description: 'Nền tảng nhân sự tập trung vào báo cáo PDF, CSV và Excel bằng nhiều ngôn ngữ, quản lý yêu cầu nghỉ phép và phê duyệt, cùng dữ liệu Time Clock hỗ trợ tính lương. Hồ sơ nhân viên, công việc và hiệu suất kết nối trong cùng hệ thống.', highlights: ['Dữ liệu Time Clock hỗ trợ tính lương', 'Quản lý và phê duyệt nghỉ phép', 'Báo cáo PDF, CSV, Excel đa ngôn ngữ'] }
  },
  {
    id: 'crypto', number: '02', title: 'Crypto Dashboard', short: 'Crypto Dashboard',
    category: 'Data & analytics', year: '2025', date: 'September 12, 2025', color: '#ba9451',
    description: 'An English-language analytics dashboard for comparing crypto assets, exploring historical prices and reviewing investment risk. Interactive charts, return measures and correlations turn market data into a workspace for analysis.',
    highlights: ['Market data & portfolio tracking', 'Risk measures & asset correlations', 'Historical charts & liquidity monitoring'],
    tech: ['Python', 'Streamlit', 'Plotly', 'NumPy', 'Supabase'],
    live: 'https://jltc3111-crypto-dashboard-home-7grwzp.streamlit.app/', github: 'https://github.com/JLTC3111/crypto-dashboard',
    position: [56, -72], stop: 'o3', scale:1.55, rotation:0, footprint: [4.8, 3.6], labelHeight: 7.2,
    vi: { title: 'Quản lý Đầu tư Cá nhân', short: 'Quản lý Đầu tư', category: 'Dữ liệu & phân tích', description: 'Dashboard phân tích bằng tiếng Anh để so sánh tài sản tiền mã hóa, xem lịch sử giá và đánh giá rủi ro đầu tư. Biểu đồ tương tác, chỉ số lợi nhuận và tương quan hỗ trợ khám phá dữ liệu thị trường.', highlights: ['Dữ liệu thị trường & danh mục đầu tư', 'Chỉ số rủi ro & tương quan tài sản', 'Biểu đồ lịch sử & thanh khoản'] }
  },
  {
    id: 'contracts', number: '03', title: 'Contract Management', short: 'Contract Management',
    category: 'Business software', year: '2025', date: 'July 10, 2025', color: '#9384ae',
    description: 'A bilingual workspace for contract records, lifecycle stages, approvals and supporting documents. Table and Kanban dashboards summarize contract value, status and deadlines, while analytics and activity history keep changes visible.',
    highlights: ['Contract records, stages & approvals', 'Collaboration & granular permissions', 'Version control & multilingual support'],
    tech: ['React', 'Next.js', 'Supabase', 'Tailwind CSS', 'GSAP'],
    live: 'https://contract.icue.vn/', github: 'https://github.com/JLTC3111/contract-management-app',
    position: [108, -29], stop: 'o4', scale:1.8, rotation:Math.PI/4, footprint: [4.6, 3.6], labelHeight: 6.2,
    vi: { title: 'Quản lý Hợp đồng', short: 'Quản lý Hợp đồng', category: 'Phần mềm doanh nghiệp', description: 'Không gian làm việc song ngữ cho hồ sơ hợp đồng, giai đoạn xử lý, phê duyệt và tài liệu đính kèm. Bảng dữ liệu và Kanban tổng hợp giá trị, trạng thái và thời hạn; phân tích cùng lịch sử hoạt động giúp theo dõi thay đổi.', highlights: ['Hồ sơ, giai đoạn & phê duyệt hợp đồng', 'Cộng tác & phân quyền chi tiết', 'Quản lý phiên bản & đa ngôn ngữ'] }
  },
  {
    id: 'compressor', number: '04', title: 'File Compressor', short: 'File Compressor',
    category: 'Desktop utility', year: '2025', date: 'July 3, 2025', color: '#6f9fa9',
    description: 'An offline desktop utility for compressing PDF, Word, Excel, PowerPoint and image files. Drag-and-drop batches, adjustable quality, output-folder controls and seven interface languages make everyday file preparation easier.',
    highlights: ['Drag-and-drop documents & images', 'Batch compression', 'Offline processing & no tracking'],
    tech: ['Python', 'Tkinter', 'PyInstaller'],
    live: null, github: 'https://github.com/JLTC3111/file_compressor',
    position: [101, 40], stop: 'o6', scale:1.65, rotation:Math.PI/4, footprint: [4.4, 3.6], labelHeight: 6.7,
    vi: { title: 'Ứng dụng Nén File', short: 'Nén File', category: 'Tiện ích máy tính', description: 'Tiện ích máy tính ngoại tuyến để nén PDF, Word, Excel, PowerPoint và hình ảnh. Hỗ trợ kéo thả nhiều tệp, điều chỉnh chất lượng, chọn thư mục đầu ra và giao diện với bảy ngôn ngữ.', highlights: ['Kéo thả tài liệu & hình ảnh', 'Nén tệp hàng loạt', 'Hoạt động ngoại tuyến & không theo dõi'] }
  },
  {
    id: 'ceremony', number: '05', title: 'IKI–GIZ–ICUE Ceremony', short: 'Hội An Ceremony',
    category: 'Interactive microsite', year: '2025', date: 'June 15, 2025', color: '#d3a352',
    description: 'A bilingual event microsite presenting the IKI, GIZ and ICUE collaboration in Hội An. Partner branding, project photography and an interactive celebratory presentation document the community project.',
    highlights: ['Hội An community development', 'IKI, GIZ & ICUE collaboration', 'Interactive event presentation'],
    tech: ['JavaScript', 'HTML5', 'CSS'],
    live: 'https://gizen.longd.tech', github: 'https://github.com/JLTC3111/ICUE-GIZ-Ceremony-EN',
    liveVi: 'https://gizvn.longd.tech', githubVi: 'https://github.com/JLTC3111/ICUE-GIZ-Ceremony-VN',
    position: [4, 77], stop: 'o8', scale:1.36, rotation:0, footprint: [6, 3.6], labelHeight: 5.8,
    vi: { title: 'Lễ Khánh thành & Bàn giao', short: 'Sự kiện Hội An', category: 'Microsite tương tác', description: 'Microsite sự kiện song ngữ giới thiệu sự hợp tác giữa IKI, GIZ và ICUE tại Hội An. Hình ảnh dự án, nhận diện các đối tác và phần trình bày tương tác ghi lại hoạt động cộng đồng.', highlights: ['Phát triển cộng đồng tại Hội An', 'Hợp tác giữa IKI, GIZ & ICUE', 'Trình bày sự kiện tương tác'] }
  },
  {
    id: 'icue', number: '06', title: 'ICUE — Institute Website', short: 'ICUE Website',
    category: 'Institutional website', year: '2025', date: 'May 29, 2025', color: '#618a73',
    description: 'The English and Vietnamese websites of ICUE — the Institute for Construction, Urban and Economic Research. Visitors can explore research and project work, read institute news, learn about its organization and contact the team.',
    highlights: ['Institute news & projects', 'Professional & community connections', 'English & Vietnamese websites'],
    tech: ['Vite', 'JavaScript', 'Tailwind CSS', 'GSAP', 'AOS'],
    live: 'https://en.icue.vn/', github: 'https://github.com/JLTC3111/ICUE-mainsite-en',
    liveVi: 'https://icue.vn', githubVi: 'https://github.com/JLTC3111/ICUE-mainsite-vn',
    position: [-104, 38], stop: 'o10', scale:1.55, rotation:Math.PI/4, footprint: [6, 4], labelHeight: 7.8,
    vi: { title: 'Viện Nghiên cứu Đô thị & Kinh tế', short: 'Website ICUE', category: 'Website tổ chức', description: 'Website tiếng Anh và tiếng Việt của ICUE — Viện Nghiên cứu Kinh tế Xây dựng và Đô thị. Giới thiệu nghiên cứu, dự án, tin tức, cơ cấu tổ chức và các kênh liên hệ với Viện.', highlights: ['Tin tức & dự án của Viện', 'Kết nối chuyên gia & cộng đồng', 'Website tiếng Việt & tiếng Anh'] }
  },

];

// Keep local model dimensions separate from rotated world-space collision bounds.
for(const project of projects){
  project.position=project.position.map((value,i)=>roadNodes[project.stop][i]+value-roadNodes[project.stop][i]/DISTRICT_SCALE);
  project.baseFootprint=[...project.footprint];
  const [width,depth]=project.baseFootprint,c=Math.abs(Math.cos(project.rotation)),s=Math.abs(Math.sin(project.rotation));
  project.footprint=[((width+1.1)*c+(depth+1.1)*s)*project.scale,((width+1.1)*s+(depth+1.1)*c)*project.scale];
  project.labelHeight*=project.scale;
  const stop=roadNodes[project.stop],dx=project.position[0]-stop[0],dz=project.position[1]-stop[1],distance=Math.hypot(dx,dz),nx=dx/distance,nz=dz/distance;
  const clearance=ROAD_WIDTHS.shoulder/2+(Math.abs(nx)*project.footprint[0]+Math.abs(nz)*project.footprint[1])/2+2.5;
  if(distance<clearance){project.position[0]+=nx*(clearance-distance);project.position[1]+=nz*(clearance-distance);}
}

export const getProject = id => projects.find(project => project.id === id);
export const localizeProject = (project, language = 'en') => language === 'vi' ? { ...project, ...project.vi, live: project.liveVi || project.live, github: project.githubVi || project.github } : project;

export const copy = {
  en: {
    videoPlay:'Play video', videoPause:'Pause video', switchLanguage:'Switch language: English / Tiếng Việt',
    tiltTitle:'Drive by tilting', tiltEnable:'Enable tilt controls', tiltCalibrate:'Recenter tilt',
    tiltIdle:'Choose Let’s explore to enable motion controls. Hold your phone comfortably, then tilt left or right to steer and forward or back to drive.',
    tiltCalibrating:'Hold your phone comfortably to set the neutral position.', tiltReady:'Tilt to steer and lean forward or back to drive. Return to neutral to coast. Tap the car to stop.',
    tiltDenied:'Motion access was not granted. You can still tap the ground to drive.', tiltUnavailable:'Motion sensors are unavailable here. Tap the ground to drive instead.',
    navHome:'Home', navWork:'Work',
    navProjects: 'Projects', navAbout: 'About', navContact: 'Contact', navTour: 'Take a tour',
    eyebrow: 'SOFTWARE ENGINEER · CURIOUS BY NATURE', hero: 'Ideas, made<br>into things.',
    intro: 'I’m Long. I build useful software, thoughtful<br class="desktop-break"> websites, and things worth exploring.', explore: 'Let’s explore', browse: 'Or, go straight to the projects',
    hint: 'A small world of things I’ve built.', hintSub: 'Drive around. Explore the things I’ve built.',
    controls: 'Drive', boost: 'Boost', reset: 'Reset', map: 'Island map',
    index: 'The things I’ve built.', indexSub: 'Six projects. Plenty of curiosity.', all: 'All work', apps: 'Applications', web: 'Websites',
    view: 'Explore project', visit: 'Visit website', code: 'Source code', drive: 'Drive to this stop', next: 'Next stop', back: 'All projects',
    aboutLabel: 'A LITTLE ABOUT ME', aboutTitle: 'Curiosity is<br>the common thread.', aboutIntro: 'I’m Long, a software engineer based in Hanoi, Vietnam.',
    aboutText: 'I design and build websites, databases, and practical software. My work ranges from tools that make everyday tasks easier to platforms that bring people and information together.',
    aboutWork: 'I work at the Institute of Construction, Urban Planning & Economics (ICUE). This island brings together the projects from my portfolio at longd.tech.',
    skills: 'THINGS I WORK WITH', contactLabel: 'LET’S MAKE SOMETHING', contactTitle: 'Good ideas start<br>with a hello.',
    contactText: 'Have a project in mind, a question, or just want to talk about building things? I’d love to hear from you.', email: 'Email Long', emailCopied: 'Email copied', copyEmail: 'Copy email address',
    movePanel:'Drag to move the panel, or use arrow keys. Home restores its position.', helpTitle: 'Take the scenic route.', helpIntro: 'This little island is yours to explore. Each project building opens a real piece of work.',
    helpDrive: 'WASD or arrow keys to drive', helpClick: 'Click the ground to drive there, including through shallow streams', jump:'Jump', helpProps: 'Knock over the eastern bowling pins. TNT gives your car a short shove and burns nearby trees and props. Buildings, stalls, bridges and portals stay intact. R restores the island.', helpProject: 'Click a building to explore its project', helpBoost: 'Shift for rocket boost · Space to jump · H to honk', helpAir:'C raises or lowers the hydraulics. B brakes.', hydraulics:'Hydraulics', playgroundLabel:'PLAYGROUNDS',bowling:'Bowling clearing',tnt:'TNT clearing', helpMore: 'Click the car to stop · Escape to hide/show the interface · M for map · P for projects · R to reset', helpTouch: 'Use the on-screen arrows, tap to drive, or use two fingers to pan and pinch to zoom.',
    soundOn: 'Sound on', soundOff: 'Sound off', day: 'Switch to light theme', night: 'Switch to dark theme',
    arrive: 'You’ve arrived', touring: 'On the way to', driving: 'Enjoy the drive.', nearby: 'Nearby', inspect: 'Explore', ready: 'YOUR LITTLE ADVENTURE STARTS HERE',
    route: 'Route', stopTour: 'Stop tour', return: 'Back to the island', demo: 'Original project demo',
    fallback: 'The 3D island needs WebGL. You can still explore every project below.', loading: 'Growing a little world…', complete: 'All six stops explored. Thanks for taking the scenic route!',
    reduced: 'Motion reduced', help: 'How to explore', overview: 'Island overview', footer: 'Built with curiosity. Based in Hanoi.', resetToast: 'Car and objects reset.', copiedFail: 'Email: dev@icue.vn',
    siteTitle: 'Long D. — Follow your curiosity', siteSubtitle: 'FOLLOW YOUR CURIOSITY',
    siteDescription: 'A little world of things built by Long D., a software engineer in Hanoi. Drive through six projects, watch demos, and explore the work.',
    ogDescription: 'Six projects. One little island. Take the scenic route through Long D.’s interactive software portfolio.',
    skipProjects: 'Skip to projects', browseProjects: 'Browse projects', homeAria: 'Long D. — Home', worldAria: 'Interactive 3D project island', navigationAria: 'Main navigation', languageAria: 'Language', closePanel: 'Close panel',
    languageEnglish: 'English', languageVietnamese: 'Tiếng Việt', filtersAria: 'Project filters', technologiesAria: 'Technologies',
    touchAria: 'Driving controls', steerLeft: 'Steer left', steerRight: 'Steer right', accelerate: 'Accelerate', reverse: 'Reverse',
    mapBuildings:'Project buildings',mapObjects:'Objects & activities',mapOverview:'Fit whole island',mapZoomIn:'Zoom map in',mapZoomOut:'Zoom map out',mapRespawn:'Broken objects return on their own. Small props come back sooner; trees and structures take longer.',
    worldCaption: 'THE PROJECT ISLAND', selectedWork: 'SELECTED WORK', mapEyebrow: '06 STOPS / ONE LITTLE WORLD', town:'TOWN', chooseCar:'Choose your car', garageIntro:'Four rides. One island. Your choice is remembered.', selectedCar:'Selected', selectCar:'Drive this car', teleportHint:'A top view of your island. Select a diamond or a destination to teleport there.', destinations:'Destinations', teleportTo:'Teleport to', teleported:'Arrived at', mapHint:'Follow the road arrows to the town centre. The striped perimeter marks the island boundary.', youAreHere: 'You are here',
    location: 'Hanoi, Vietnam', locationShort: 'HANOI, VN', factRole: 'SOFTWARE ENGINEER', factCuriosity: 'ALWAYS BUILDING SOMETHING',
    frontend: 'Frontend', backend: 'Backend', data: 'Data', delivery: 'Delivery', dataTools: 'Data analysis & visualization',
    helpMouse: 'Drag to orbit · Right-drag or Shift-drag to pan', helpTrackpad: 'Scroll or pinch to zoom · Shift-scroll to pan',
    canvasAria: 'Use WASD or arrow keys to drive. Click the ground to travel, buildings for projects, and loose objects to nudge them. Drag to orbit, right-drag to pan, and scroll or pinch to zoom.',
    scenicSign: 'TAKE THE\nSCENIC ROUTE', welcomeSign: 'HELLO, CURIOUS HUMAN.', dataSign: 'DATA LAB', contractsSign: 'CONTRACTS', compressorSign: 'SMALLER IS BETTER',
    worldSettings: 'World', worldTitle: 'A world with a little life.', worldIntro: 'Discover project buildings across the island. Follow the roads, drive through shallow streams, and find warm fire cans after sunset.',
    timeLabel: 'TIME OF DAY', timeAuto: 'Daylight cycle', timeSunrise: 'Sunrise', timeDay: 'Day', timeSunset: 'Sunset', timeNight: 'Night',
    weatherLabel: 'WEATHER', weatherClear: 'Clear', weatherRain: 'Rain', weatherSnow: 'Snow', weatherAuto: 'Changing',
    headlightsLabel: 'HEADLIGHTS', lightsAuto: 'Automatic', lightsOn: 'On', lightsOff: 'Off',
    worldPhysics: 'Push props gently or hit them at speed to break them. Trees, fences and other scenery can break too; buildings, stalls, bridges and portals stay intact. Objects return on their own, with trees taking longer. R restores everything immediately.',
    worldCycle: 'The sun makes a full journey in about four and a half minutes. Choose a fixed moment to stay there.',
    zoomLabel: 'CAMERA ZOOM', zoomIn: 'Zoom in', zoomOut: 'Zoom out', zoomReset: 'Reset view', zoomNote: 'A little closer, a little wider. The island always fills your view.',
    portalLabel: 'PORTALS', westGate: 'Forest portal', eastGate: 'Coastal portal', portalArrival: 'Through the portal — welcome to the other side.',
    studioLabel: 'THE PORTFOLIO STUDIO', studioTitle: 'A collection of<br>useful things.', projectStageTitle: 'An idea.<br>A working product.', aboutStageTitle: 'Code, craft,<br>and curiosity.', contactStageTitle: 'Let’s build<br>what comes next.', worldStageTitle: 'More roads.<br>Room to explore.', helpStageTitle: 'Take the wheel.', mapStageTitle: 'The scenic route.',
    studioIntro: 'From everyday tools to platforms for people and organizations.', projectPreview: 'Project preview', dragPreview: 'Drag to turn', resetPreview: 'Reset object view', choosePreview: 'Choose a project preview', openPreview: 'Explore this project',
    projectCount: 'Projects', applicationCount: 'Applications', websiteCount: 'Websites', projectType: 'Project type', projectDate: 'Date', currentProject: 'IN THE SPOTLIGHT', galleryLabel: 'A closer look', galleryHint: 'Select a frame to jump to that moment in the demo.', playMoment: 'Play demo at', focusLabel: 'The focus', approachLabel: 'How it comes together', capabilityLabel: 'What you can do', takeawayLabel: 'At a glance', relatedLabel: 'Keep exploring',
    journeyLabel: 'A year of building', journeyIntro: 'The projects in this collection, in the order they came together.', capabilityIntro: 'Different projects. A few shared interests.', operationsTitle: 'Tools for organizations', operationsText: 'People, contracts, and the everyday work that connects them.', dataTitle: 'Data & everyday tools', dataText: 'Dashboards, data analysis, and practical file utilities.', webTitle: 'Websites & communities', webText: 'Digital places for an institute, a collaboration, and the people around them.',
    contactPrompts: 'A good place to start', contactPrompt1: 'What are you trying to build or make easier?', contactPrompt2: 'Which part of the work needs the most care?', contactPrompt3: 'Share a reference, a question, or a rough idea.', contactProjects: 'A few conversation starters', contactStageText: 'A new tool, a better website, or a small idea worth trying.',
    aboutStageText: 'Websites, databases, practical software, and a little room to play.', worldStageText: 'Choose your ride, try the lights, and find a new season.', helpStageText: 'A closer look at your ride before you take the scenic route.', mapStageText: 'Six projects connected by one small island.',
    interfaceLanguage: 'Read in', dayNight: 'Day / night', rainSnow: 'Rain / snow', controlsLabel: 'Controls', driveLabel: 'WASD / arrows', cameraLabel: 'Drag / scroll',
    musicPause:'Pause music', musicPlay:'Play music', worldSoundscape:'Wind and flowing water accompany the island. Roosters call in the morning, birds chirp at sunset, and the river grows louder as you approach. The speaker button mutes the whole soundscape.',
    screenControls: 'Computer display', screenProject: 'Project', screenStack: 'Stack', screenPreview: 'Preview', screenHint: 'Click the screen to switch · Drag to turn', screenStackHint: 'Select a tool to learn what it does.', screenPreviewHint: 'A real frame from this project’s demo.', watchDemo: 'Watch the demo', demoEnglish: 'English recording', demoVietnamese: 'Vietnamese recording', demoShared: 'Shared original recording', demoMultilingual:'Multilingual recording',
  },
  vi: {
    videoPlay:'Phát video', videoPause:'Tạm dừng video', switchLanguage:'Đổi ngôn ngữ: English / Tiếng Việt',
    tiltTitle:'Lái xe bằng cách nghiêng máy', tiltEnable:'Bật điều khiển nghiêng', tiltCalibrate:'Căn lại vị trí trung tâm',
    tiltIdle:'Chọn Cùng khám phá để bật cảm biến. Giữ điện thoại thoải mái, nghiêng trái hoặc phải để lái và nghiêng trước hoặc sau để tiến hoặc lùi.',
    tiltCalibrating:'Giữ điện thoại thoải mái để xác định vị trí trung tâm.', tiltReady:'Nghiêng máy để điều hướng, nghiêng trước hoặc sau để tiến hoặc lùi. Đưa máy về vị trí ban đầu để thả trôi. Chạm xe để dừng.',
    tiltDenied:'Chưa được cấp quyền cảm biến. Bạn vẫn có thể chạm mặt đất để lái xe.', tiltUnavailable:'Thiết bị chưa hỗ trợ cảm biến tại đây. Chạm mặt đất để lái xe.',
    navHome:'Trang chủ', navWork:'Dự án',
    navProjects: 'Dự án', navAbout: 'Giới thiệu', navContact: 'Liên hệ', navTour: 'Tham quan',
    eyebrow: 'KỸ SƯ PHẦN MỀM · LUÔN TÒ MÒ', hero: 'Từ ý tưởng<br>đến thực tế.',
    intro: 'Mình là Long. Mình xây dựng phần mềm,<br class="desktop-break"> website và những điều đáng khám phá.', explore: 'Cùng khám phá', browse: 'Hoặc, xem ngay các dự án',
    hint: 'Một thế giới nhỏ từ những điều mình đã xây dựng.', hintSub: 'Lái xe và khám phá những dự án mình đã làm.',
    controls: 'Lái xe', boost: 'Tăng tốc', reset: 'Về đầu', map: 'Bản đồ đảo',
    index: 'Những điều mình đã xây dựng.', indexSub: 'Sáu dự án. Thật nhiều tò mò.', all: 'Tất cả', apps: 'Ứng dụng', web: 'Website',
    view: 'Khám phá dự án', visit: 'Truy cập website', code: 'Mã nguồn', drive: 'Lái xe đến đây', next: 'Điểm tiếp theo', back: 'Tất cả dự án',
    aboutLabel: 'MỘT CHÚT VỀ MÌNH', aboutTitle: 'Sự tò mò<br>kết nối mọi thứ.', aboutIntro: 'Mình là Long, kỹ sư phần mềm tại Hà Nội, Việt Nam.',
    aboutText: 'Mình thiết kế và xây dựng website, cơ sở dữ liệu và phần mềm thực tiễn. Từ công cụ giúp công việc hằng ngày đơn giản hơn đến nền tảng kết nối con người và thông tin.',
    aboutWork: 'Mình làm việc tại Viện Nghiên cứu Đô thị và Kinh tế (ICUE). Hòn đảo này tập hợp các dự án trong portfolio longd.tech của mình.',
    skills: 'CÔNG NGHỆ MÌNH SỬ DỤNG', contactLabel: 'CÙNG TẠO NÊN ĐIỀU GÌ ĐÓ', contactTitle: 'Ý tưởng hay bắt đầu<br>từ một lời chào.',
    contactText: 'Bạn có ý tưởng dự án, một câu hỏi, hay đơn giản muốn trò chuyện về việc xây dựng sản phẩm? Mình rất vui được nghe từ bạn.', email: 'Gửi email cho Long', emailCopied: 'Đã sao chép email', copyEmail: 'Sao chép địa chỉ email',
    movePanel:'Kéo để di chuyển cửa sổ, hoặc dùng phím mũi tên. Home đặt lại vị trí.', helpTitle: 'Chọn con đường thú vị.', helpIntro: 'Hòn đảo nhỏ này dành cho bạn khám phá. Mỗi tòa nhà dự án đều mở ra một sản phẩm thực tế.',
    helpDrive: 'WASD hoặc phím mũi tên để lái xe', helpClick: 'Nhấp xuống đất để lái xe tới đó, kể cả qua suối nông', jump:'Nhảy', helpProps: 'Húc đổ chai bowling phía đông. TNT đẩy xe lùi một đoạn ngắn, đốt cây và đồ vật xung quanh. Nhà, quầy hàng, cầu và cổng dịch chuyển vẫn nguyên vẹn. R khôi phục hòn đảo.', helpProject: 'Nhấp vào tòa nhà để khám phá dự án', helpBoost: 'Shift để tăng tốc phản lực · Space để nhảy · H để bấm còi', helpAir:'C nâng hoặc hạ thủy lực. B để phanh.', hydraulics:'Thủy lực', playgroundLabel:'KHU VUI CHƠI',bowling:'Bãi bowling',tnt:'Bãi TNT', helpMore: 'Nhấp xe để dừng · Escape để ẩn/hiện giao diện · M mở bản đồ · P xem dự án · R đặt lại', helpTouch: 'Dùng phím điều hướng, chạm để lái xe, hoặc dùng hai ngón để di chuyển góc nhìn và chụm/mở để thu phóng.',
    soundOn: 'Bật âm thanh', soundOff: 'Tắt âm thanh', day: 'Chuyển sang giao diện sáng', night: 'Chuyển sang giao diện tối',
    arrive: 'Bạn đã đến', touring: 'Đang đến', driving: 'Tận hưởng hành trình.', nearby: 'Ở gần', inspect: 'Khám phá', ready: 'HÀNH TRÌNH NHỎ BẮT ĐẦU TỪ ĐÂY',
    route: 'Lộ trình', stopTour: 'Dừng tham quan', return: 'Trở lại hòn đảo', demo: 'Video demo gốc của dự án',
    fallback: 'Hòn đảo 3D cần WebGL. Bạn vẫn có thể khám phá mọi dự án bên dưới.', loading: 'Đang xây một thế giới nhỏ…', complete: 'Đã khám phá cả sáu điểm. Cảm ơn bạn đã ghé chơi!',
    reduced: 'Giảm chuyển động', help: 'Cách khám phá', overview: 'Toàn cảnh hòn đảo', footer: 'Xây dựng bằng sự tò mò. Từ Hà Nội.', resetToast: 'Đã đặt lại xe và đồ vật.', copiedFail: 'Email: dev@icue.vn',
    siteTitle: 'Long D. — Theo dấu tò mò', siteSubtitle: 'THEO DẤU TÒ MÒ',
    siteDescription: 'Thế giới nhỏ của Long D., kỹ sư phần mềm tại Hà Nội. Lái xe khám phá sáu dự án, xem video demo và tìm hiểu những sản phẩm mình đã xây dựng.',
    ogDescription: 'Sáu dự án. Một hòn đảo nhỏ. Cùng khám phá portfolio tương tác của Long D. theo cách thú vị hơn.',
    skipProjects: 'Đi thẳng đến các dự án', browseProjects: 'Xem các dự án', homeAria: 'Long D. — Trang chủ', worldAria: 'Hòn đảo dự án 3D tương tác', navigationAria: 'Điều hướng chính', languageAria: 'Ngôn ngữ', closePanel: 'Đóng bảng thông tin',
    languageEnglish: 'English', languageVietnamese: 'Tiếng Việt', filtersAria: 'Lọc dự án', technologiesAria: 'Công nghệ sử dụng',
    touchAria: 'Điều khiển xe', steerLeft: 'Rẽ trái', steerRight: 'Rẽ phải', accelerate: 'Tiến lên', reverse: 'Lùi lại',
    mapBuildings:'Các tòa nhà dự án',mapObjects:'Đồ vật & hoạt động',mapOverview:'Xem toàn bộ đảo',mapZoomIn:'Phóng to bản đồ',mapZoomOut:'Thu nhỏ bản đồ',mapRespawn:'Đồ vật bị phá hủy sẽ tự khôi phục. Vật nhỏ trở lại sớm hơn; cây và công trình cần lâu hơn.',
    worldCaption: 'HÒN ĐẢO DỰ ÁN', selectedWork: 'DỰ ÁN TIÊU BIỂU', mapEyebrow: '06 ĐIỂM ĐẾN / MỘT THẾ GIỚI NHỎ', town:'THỊ TRẤN', chooseCar:'Chọn xe của bạn', garageIntro:'Bốn chiếc xe. Một hòn đảo. Lựa chọn được ghi nhớ.', selectedCar:'Đã chọn', selectCar:'Lái chiếc xe này', teleportHint:'Góc nhìn từ trên cao. Chọn hình thoi hoặc địa điểm để dịch chuyển đến đó.', destinations:'Địa điểm', teleportTo:'Dịch chuyển đến', teleported:'Đã đến', mapHint:'Đi theo mũi tên trên đường về trung tâm thị trấn. Vành đai sọc đánh dấu ranh giới hòn đảo.', youAreHere: 'Bạn đang ở đây',
    location: 'Hà Nội, Việt Nam', locationShort: 'HÀ NỘI, VN', factRole: 'KỸ SƯ PHẦN MỀM', factCuriosity: 'LUÔN XÂY DỰNG ĐIỀU GÌ ĐÓ',
    frontend: 'Giao diện', backend: 'Hệ thống', data: 'Dữ liệu', delivery: 'Triển khai', dataTools: 'Phân tích & trực quan hóa dữ liệu',
    helpMouse: 'Kéo để xoay góc nhìn · Kéo chuột phải hoặc Shift+kéo để di chuyển góc nhìn', helpTrackpad: 'Cuộn hoặc chụm/mở để thu phóng · Shift+cuộn để di chuyển góc nhìn',
    canvasAria: 'Dùng WASD hoặc phím mũi tên để lái xe. Nhấp xuống đất để đi đến, tòa nhà để xem dự án và đồ vật rời để đẩy chúng. Kéo để xoay, kéo chuột phải để di chuyển góc nhìn và cuộn hoặc chụm/mở để thu phóng.',
    scenicSign: 'CHỌN CON ĐƯỜNG\nTHÚ VỊ HƠN', welcomeSign: 'CHÀO BẠN, NGƯỜI TÒ MÒ.', dataSign: 'PHÂN TÍCH', contractsSign: 'HỢP ĐỒNG', compressorSign: 'GỌN NHẸ HƠN',
    worldSettings: 'Thế giới', worldTitle: 'Một thế giới đầy sức sống.', worldIntro: 'Khám phá các tòa nhà dự án khắp hòn đảo. Đi theo những con đường, lái xe qua suối cạn và tìm những thùng lửa ấm áp sau hoàng hôn.',
    timeLabel: 'THỜI ĐIỂM', timeAuto: 'Ngày đêm tự động', timeSunrise: 'Bình minh', timeDay: 'Ban ngày', timeSunset: 'Hoàng hôn', timeNight: 'Ban đêm',
    weatherLabel: 'THỜI TIẾT', weatherClear: 'Trời quang', weatherRain: 'Mưa', weatherSnow: 'Tuyết', weatherAuto: 'Thay đổi',
    headlightsLabel: 'ĐÈN PHA', lightsAuto: 'Tự động', lightsOn: 'Bật', lightsOff: 'Tắt',
    worldPhysics: 'Đẩy nhẹ đồ vật hoặc đâm mạnh để phá vỡ. Cây, hàng rào và cảnh vật có thể bị phá; nhà, quầy hàng, cầu và cổng dịch chuyển vẫn nguyên vẹn. Đồ vật sẽ tự trở lại, cây cần lâu hơn. R khôi phục mọi thứ ngay lập tức.',
    worldCycle: 'Một vòng ngày đêm kéo dài khoảng bốn phút rưỡi. Chọn một thời điểm cố định nếu bạn muốn giữ nguyên ánh sáng.',
    zoomLabel: 'GÓC NHÌN', zoomIn: 'Phóng to', zoomOut: 'Thu nhỏ', zoomReset: 'Đặt lại góc nhìn', zoomNote: 'Gần hơn một chút, rộng hơn một chút. Hòn đảo luôn phủ đầy khung hình.',
    portalLabel: 'CÁNH CỔNG', westGate: 'Cổng khu rừng', eastGate: 'Cổng ven biển', portalArrival: 'Qua cánh cổng — chào mừng bạn đến phía bên kia.',
    studioLabel: 'KHÔNG GIAN DỰ ÁN', studioTitle: 'Những điều nhỏ<br>thật hữu ích.', projectStageTitle: 'Từ ý tưởng<br>đến sản phẩm.', aboutStageTitle: 'Mã nguồn, sáng tạo<br>và sự tò mò.', contactStageTitle: 'Cùng xây dựng<br>điều tiếp theo.', worldStageTitle: 'Hòn đảo nhỏ.<br>Nhiều điều để khám phá.', helpStageTitle: 'Cầm lái nào.', mapStageTitle: 'Con đường thú vị.',
    studioIntro: 'Từ công cụ hằng ngày đến nền tảng dành cho con người và tổ chức.', projectPreview: 'Xem trước dự án', dragPreview: 'Kéo để xoay', resetPreview: 'Đặt lại góc nhìn vật thể', choosePreview: 'Chọn dự án để xem trước', openPreview: 'Khám phá dự án này',
    projectCount: 'Dự án', applicationCount: 'Ứng dụng', websiteCount: 'Website', projectType: 'Loại dự án', projectDate: 'Thời điểm', currentProject: 'ĐANG XEM TRƯỚC', galleryLabel: 'Nhìn gần hơn', galleryHint: 'Chọn một khung hình để xem đúng thời điểm đó trong video demo.', playMoment: 'Xem demo tại', focusLabel: 'Trọng tâm', approachLabel: 'Cách các phần kết nối', capabilityLabel: 'Bạn có thể làm gì', takeawayLabel: 'Nhìn tổng thể', relatedLabel: 'Tiếp tục khám phá',
    journeyLabel: 'Một năm xây dựng', journeyIntro: 'Các dự án trong bộ sưu tập, theo thứ tự chúng được hình thành.', capabilityIntro: 'Nhiều dự án. Một vài mối quan tâm chung.', operationsTitle: 'Công cụ cho tổ chức', operationsText: 'Nhân sự, hợp đồng và những công việc kết nối chúng mỗi ngày.', dataTitle: 'Dữ liệu & công cụ hằng ngày', dataText: 'Dashboard, phân tích dữ liệu và các tiện ích tệp.', webTitle: 'Website & cộng đồng', webText: 'Không gian số dành cho Viện, các dự án hợp tác và cộng đồng xung quanh.',
    contactPrompts: 'Một vài gợi ý bắt đầu', contactPrompt1: 'Bạn muốn xây dựng điều gì hoặc làm việc gì đơn giản hơn?', contactPrompt2: 'Phần nào của công việc cần được chăm chút nhất?', contactPrompt3: 'Chia sẻ một trang tham khảo, câu hỏi hoặc ý tưởng ban đầu.', contactProjects: 'Một vài dự án để bắt chuyện', contactStageText: 'Một công cụ mới, website tốt hơn hoặc một ý tưởng nhỏ đáng thử.',
    aboutStageText: 'Website, cơ sở dữ liệu, phần mềm thực tiễn và một chút không gian để sáng tạo.', worldStageText: 'Chọn chiếc xe yêu thích, thử đèn xe và khám phá mùa mới.', helpStageText: 'Ngắm kỹ chiếc xe trước khi bắt đầu hành trình khám phá.', mapStageText: 'Sáu dự án được kết nối trên một hòn đảo nhỏ.',
    interfaceLanguage: 'Ngôn ngữ', dayNight: 'Ngày / đêm', rainSnow: 'Mưa / tuyết', controlsLabel: 'Điều khiển', driveLabel: 'WASD / mũi tên', cameraLabel: 'Kéo / cuộn',
    musicPause:'Tạm dừng nhạc', musicPlay:'Phát nhạc', worldSoundscape:'Gió và tiếng nước chảy luôn đồng hành cùng hòn đảo. Gà gáy vào buổi sáng, chim hót lúc hoàng hôn, tiếng sông rõ hơn khi bạn đến gần. Nút loa tắt tiếng toàn bộ không gian âm thanh.',
    screenControls: 'Màn hình máy tính', screenProject: 'Dự án', screenStack: 'Công nghệ', screenPreview: 'Xem trước', screenHint: 'Nhấp màn hình để chuyển · Kéo để xoay', screenStackHint: 'Chọn công cụ để tìm hiểu chức năng.', screenPreviewHint: 'Khung hình thật từ video demo của dự án.', watchDemo: 'Xem video demo', demoEnglish: 'Video tiếng Anh', demoVietnamese: 'Video tiếng Việt', demoShared: 'Video gốc dùng chung', demoMultilingual:'Video đa ngôn ngữ',
  }
};
