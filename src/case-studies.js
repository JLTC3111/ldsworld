// Short project stories grounded in the original longd.tech portfolio and its demos.
// Gallery images are genuine frames from src/assets/demos, not illustrative UI.
const media = {
  hr: [
    { src: './assets/gallery/hr-dashboard.jpg', time: 5.67, width: 900, height: 506 },
    { src: './assets/gallery/hr-performance.jpg', time: 22.68, width: 900, height: 506 }
  ],
  crypto: [
    { src: './assets/gallery/crypto-comparison.jpg', time: 10.03, width: 900, height: 506 },
    { src: './assets/gallery/crypto-risk.jpg', time: 15.05, width: 900, height: 506 }
  ],
  contracts: [
    { src: './assets/gallery/contracts-record.jpg', time: 26.24, width: 900, height: 538 },
    { src: './assets/gallery/contracts-dashboard.jpg', time: 104.95, width: 900, height: 538 }
  ],
  compressor: [
    { src: './assets/gallery/compressor-main.jpg', time: 9.03, width: 900, height: 844 },
    { src: './assets/gallery/compressor-settings.jpg', time: 27.09, width: 900, height: 844 }
  ],
  ceremony: [
    { src: './assets/gallery/ceremony-gallery.jpg', time: 2.59, width: 900, height: 838 },
    { src: './assets/gallery/ceremony-project.jpg', time: 7.78, width: 900, height: 838 }
  ],
  icue: [
    { src: './assets/gallery/icue-projects.jpg', time: 4.93, width: 900, height: 506 },
    { src: './assets/gallery/icue-home.jpg', time: 19.73, width: 900, height: 506 }
  ]
};

// Distinct Vietnamese recordings have their own real frames and seek positions.
// Other projects intentionally reuse the recording shared by both source sites.
const vietnameseMedia = {
  contracts: [
    { src: './assets/gallery/vi/contracts-record.jpg', time: 26.24, width: 900, height: 538 },
    { src: './assets/gallery/vi/contracts-dashboard.jpg', time: 104.95, width: 900, height: 538 }
  ],
  compressor: [
    { src: './assets/gallery/vi/compressor-main.jpg', time: 9.03, width: 900, height: 844 },
    { src: './assets/gallery/vi/compressor-settings.jpg', time: 27.09, width: 900, height: 844 }
  ],
  ceremony: [
    { src: './assets/gallery/vi/ceremony-gallery.jpg', time: 1.79, width: 900, height: 844 },
    { src: './assets/gallery/vi/ceremony-project.jpg', time: 5.38, width: 900, height: 844 }
  ],
  icue: [
    { src: './assets/gallery/vi/icue-projects.jpg', time: 5.79, width: 900, height: 506 },
    { src: './assets/gallery/vi/icue-home.jpg', time: 23.15, width: 900, height: 506 }
  ]
};

const gallery = (id, labels, language = 'en') =>
  (language === 'vi' && vietnameseMedia[id] ? vietnameseMedia[id] : media[id])
    .map((image, index) => ({ ...image, alt: labels[index][0], caption: labels[index][1] }));

export const caseStudies = {
  hr: {
    en: {
      teaser: 'A home for the everyday work of managing people.',
      focus: 'Putting workforce information, activity, and performance within one navigable workspace.',
      approach: 'Time tracking and employee records connect with recruitment, goals, reviews, and reporting, so the platform covers more than a single HR task.',
      useCases: [
        { title: 'See the working day', text: 'Time tracking, activity views, and dashboards make workforce information available in one place.' },
        { title: 'Follow people and goals', text: 'The employee directory sits alongside recruitment, tasks, goals, and development tracking.' },
        { title: 'Review and report', text: 'Performance reviews and reporting add a longer view of how people and work are progressing.' }
      ],
      gallery: gallery('hr', [
        ['HR platform dashboard with workforce charts and employee information', 'Workforce dashboard'],
        ['HR platform performance review screen with ratings and review records', 'Performance reviews']
      ]),
      takeaway: 'A broad HR toolset, presented as one connected workspace.'
    },
    vi: {
      teaser: 'Một không gian cho công việc quản trị con người hằng ngày.',
      focus: 'Đưa thông tin nhân sự, hoạt động và hiệu suất vào một không gian làm việc dễ theo dõi.',
      approach: 'Chấm công và hồ sơ nhân viên kết nối với tuyển dụng, mục tiêu, đánh giá và báo cáo, giúp nền tảng bao quát nhiều công việc nhân sự.',
      useCases: [
        { title: 'Theo dõi ngày làm việc', text: 'Chấm công, thông tin hoạt động và dashboard tập hợp dữ liệu nhân sự trong một nơi.' },
        { title: 'Theo sát con người và mục tiêu', text: 'Danh bạ nhân viên đi cùng tuyển dụng, công việc, mục tiêu và theo dõi phát triển cá nhân.' },
        { title: 'Đánh giá và báo cáo', text: 'Đánh giá hiệu suất và báo cáo mang đến góc nhìn dài hạn hơn về tiến độ công việc và con người.' }
      ],
      gallery: gallery('hr', [
        ['Dashboard nền tảng nhân sự với biểu đồ hoạt động và thông tin nhân viên', 'Dashboard nhân sự'],
        ['Màn hình đánh giá hiệu suất với điểm đánh giá và các bản ghi', 'Đánh giá hiệu suất']
      ], 'vi'),
      takeaway: 'Nhiều công cụ nhân sự trong một không gian làm việc kết nối.'
    }
  },
  crypto: {
    en: {
      teaser: 'A Python workspace for looking beyond a single market price.',
      focus: 'Bringing market context, portfolio monitoring, and historical analysis into the same view.',
      approach: 'Streamlit provides the workspace, while Python, Plotly, and NumPy support the data and visual analysis behind its dashboards.',
      useCases: [
        { title: 'Follow the market', text: 'Market data, news, and global liquidity monitoring provide context around individual assets.' },
        { title: 'Compare and inspect', text: 'Historical charts and analytical views let users explore how assets and market measures relate.' },
        { title: 'Keep a personal view', text: 'Portfolio tracking, watchlists, and price alerts bring the dashboard back to the assets a user follows.' }
      ],
      gallery: gallery('crypto', [
        ['Crypto dashboard asset comparison screen with risk metrics and correlation analysis', 'Asset comparison'],
        ['Crypto risk dashboard with market figures and historical chart', 'Risk and historical views']
      ]),
      takeaway: 'Market context, charts, and portfolio monitoring in one data-focused application.'
    },
    vi: {
      teaser: 'Không gian Python để nhìn xa hơn một mức giá thị trường.',
      focus: 'Đưa bối cảnh thị trường, theo dõi danh mục và phân tích lịch sử vào cùng một góc nhìn.',
      approach: 'Streamlit tạo nên không gian sử dụng, còn Python, Plotly và NumPy hỗ trợ dữ liệu và các góc nhìn phân tích trong dashboard.',
      useCases: [
        { title: 'Theo dõi thị trường', text: 'Dữ liệu thị trường, tin tức và theo dõi thanh khoản toàn cầu bổ sung bối cảnh cho từng tài sản.' },
        { title: 'So sánh và tìm hiểu', text: 'Biểu đồ lịch sử và các góc nhìn phân tích giúp khám phá mối liên hệ giữa tài sản và chỉ số thị trường.' },
        { title: 'Giữ góc nhìn cá nhân', text: 'Danh mục đầu tư, danh sách theo dõi và cảnh báo giá tập trung vào những tài sản người dùng quan tâm.' }
      ],
      gallery: gallery('crypto', [
        ['Màn hình so sánh tài sản với chỉ số rủi ro và phân tích tương quan', 'So sánh tài sản'],
        ['Dashboard rủi ro tiền mã hóa với số liệu thị trường và biểu đồ lịch sử', 'Rủi ro và dữ liệu lịch sử']
      ], 'vi'),
      takeaway: 'Bối cảnh thị trường, biểu đồ và danh mục trong một ứng dụng tập trung vào dữ liệu.'
    }
  },
  contracts: {
    en: {
      teaser: 'A shared place for a contract’s entire lifecycle.',
      focus: 'Keeping a contract visible from its first draft through signing and archiving.',
      approach: 'Document workflows combine with collaboration, granular permissions, and version control, with multilingual support throughout the platform.',
      useCases: [
        { title: 'Move through the lifecycle', text: 'Create, edit, track, sign, and archive contracts within the same application.' },
        { title: 'Work with the right access', text: 'Collaboration and granular permissions support shared work while controlling who can take part.' },
        { title: 'Keep context available', text: 'Version history, notifications, and search help keep the document’s surrounding information accessible.' }
      ],
      gallery: gallery('contracts', [
        ['Contract management application showing a project record and attached document list', 'Project and document record'],
        ['Contract management dashboard showing a table of records and summary values', 'Management dashboard']
      ]),
      takeaway: 'Contract documents and the workflow around them, brought together.'
    },
    vi: {
      teaser: 'Một nơi làm việc chung cho toàn bộ vòng đời hợp đồng.',
      focus: 'Theo dõi hợp đồng từ bản thảo đầu tiên đến khi ký và lưu trữ.',
      approach: 'Quy trình tài liệu kết hợp với cộng tác, phân quyền chi tiết và quản lý phiên bản, cùng hỗ trợ đa ngôn ngữ trên nền tảng.',
      useCases: [
        { title: 'Đi hết vòng đời hợp đồng', text: 'Tạo, chỉnh sửa, theo dõi, ký và lưu trữ hợp đồng trong cùng một ứng dụng.' },
        { title: 'Cộng tác với quyền phù hợp', text: 'Cộng tác và phân quyền chi tiết hỗ trợ làm việc chung đồng thời kiểm soát người có thể tham gia.' },
        { title: 'Giữ thông tin liên quan', text: 'Lịch sử phiên bản, thông báo và tìm kiếm giúp thông tin xung quanh tài liệu luôn có thể truy cập.' }
      ],
      gallery: gallery('contracts', [
        ['Ứng dụng quản lý hợp đồng hiển thị hồ sơ dự án và danh sách tài liệu đính kèm', 'Hồ sơ dự án và tài liệu'],
        ['Dashboard quản lý hợp đồng với bảng hồ sơ và số liệu tổng hợp', 'Bảng điều khiển quản lý']
      ], 'vi'),
      takeaway: 'Kết nối tài liệu hợp đồng với quy trình làm việc xung quanh chúng.'
    }
  },
  compressor: {
    en: {
      teaser: 'A small desktop tool for files that are too big.',
      focus: 'Reducing file size while keeping processing on the user’s own device.',
      approach: 'A Python and Tkinter interface brings file selection, compression options, and batch processing into a desktop utility packaged with PyInstaller.',
      useCases: [
        { title: 'Choose the files', text: 'Documents and images can be selected or dropped into the compression workflow.' },
        { title: 'Handle a batch', text: 'Batch processing lets the utility work through multiple files together.' },
        { title: 'Stay offline', text: 'Compression runs locally, without sending the files to an online service or tracking their use.' }
      ],
      gallery: gallery('compressor', [
        ['File Compressor desktop window with file selection and output folder controls', 'The desktop utility'],
        ['File Compressor settings window with image-quality and processing options', 'Compression settings']
      ]),
      takeaway: 'A practical utility with the processing kept close to the files.'
    },
    vi: {
      teaser: 'Công cụ máy tính nhỏ dành cho những tệp quá lớn.',
      focus: 'Giảm dung lượng tệp trong khi giữ quá trình xử lý trên thiết bị của người dùng.',
      approach: 'Giao diện Python và Tkinter kết hợp chọn tệp, tùy chọn nén và xử lý hàng loạt trong một tiện ích được đóng gói bằng PyInstaller.',
      useCases: [
        { title: 'Chọn những tệp cần nén', text: 'Tài liệu và hình ảnh có thể được chọn hoặc kéo thả vào quy trình nén.' },
        { title: 'Xử lý nhiều tệp', text: 'Xử lý hàng loạt giúp tiện ích làm việc với nhiều tệp trong cùng một lượt.' },
        { title: 'Làm việc ngoại tuyến', text: 'Quá trình nén chạy cục bộ, không gửi tệp đến dịch vụ trực tuyến và không theo dõi việc sử dụng.' }
      ],
      gallery: gallery('compressor', [
        ['Cửa sổ File Compressor với lựa chọn tệp và thư mục đầu ra', 'Tiện ích trên máy tính'],
        ['Cửa sổ cài đặt File Compressor với chất lượng hình ảnh và tùy chọn xử lý', 'Tùy chọn nén']
      ], 'vi'),
      takeaway: 'Một tiện ích thực tế, giữ quá trình xử lý ngay bên cạnh dữ liệu.'
    }
  },
  ceremony: {
    en: {
      teaser: 'A small event site with a sense of celebration.',
      focus: 'Making a community development project and its international collaboration visible online.',
      approach: 'The interactive presentation brings project imagery, partner context, and the Hội An event together in a focused microsite.',
      useCases: [
        { title: 'Tell the community story', text: 'The site presents the community development work associated with Hội An City.' },
        { title: 'Recognize the collaboration', text: 'IKI, GIZ, and ICUE form the partner context around the event and project.' },
        { title: 'Make room to explore', text: 'Project imagery and an interactive presentation give visitors more than a static event notice.' }
      ],
      gallery: gallery('ceremony', [
        ['IKI GIZ ICUE ceremony microsite with rotating project photographs and celebration graphics', 'An interactive celebration'],
        ['Ceremony microsite presenting a larger project image with partner branding', 'Project imagery and partners']
      ]),
      takeaway: 'A focused digital celebration of a collaboration in Hội An.'
    },
    vi: {
      teaser: 'Một website sự kiện nhỏ mang không khí lễ hội.',
      focus: 'Giới thiệu dự án phát triển cộng đồng và sự hợp tác quốc tế trên không gian số.',
      approach: 'Phần trình bày tương tác kết nối hình ảnh dự án, thông tin đối tác và sự kiện tại Hội An trong một microsite tập trung.',
      useCases: [
        { title: 'Kể câu chuyện cộng đồng', text: 'Website giới thiệu hoạt động phát triển cộng đồng gắn với thành phố Hội An.' },
        { title: 'Ghi nhận sự hợp tác', text: 'IKI, GIZ và ICUE tạo nên bối cảnh hợp tác của sự kiện và dự án.' },
        { title: 'Mở không gian khám phá', text: 'Hình ảnh dự án và phần trình bày tương tác mang đến nhiều hơn một thông báo sự kiện tĩnh.' }
      ],
      gallery: gallery('ceremony', [
        ['Microsite sự kiện IKI GIZ ICUE với hình ảnh dự án chuyển động và hiệu ứng lễ hội', 'Một sự kiện tương tác'],
        ['Microsite hiển thị hình ảnh dự án phóng lớn và nhận diện các đối tác', 'Hình ảnh dự án và đối tác']
      ], 'vi'),
      takeaway: 'Một không gian số dành riêng cho sự hợp tác tại Hội An.'
    }
  },
  icue: {
    en: {
      teaser: 'A web home for an institute and the community around its work.',
      focus: 'Helping visitors find the institute’s projects, news, and professional context.',
      approach: 'English and Vietnamese websites combine institutional information with browsable projects and updates for the institute’s community.',
      useCases: [
        { title: 'Explore the work', text: 'The project portfolio gives visitors a way to browse the institute’s construction and urban-planning work.' },
        { title: 'Follow the updates', text: 'Institute news and project information share a common digital home.' },
        { title: 'Connect the community', text: 'The website introduces the institute within a wider network of professionals, local experts, and organizations.' }
      ],
      gallery: gallery('icue', [
        ['ICUE website project portfolio with architectural imagery and planning maps', 'The project portfolio'],
        ['ICUE website homepage introducing the institute and its people', 'The institute’s digital home']
      ]),
      takeaway: 'A public home for the institute’s information, projects, and community.'
    },
    vi: {
      teaser: 'Không gian web của một viện nghiên cứu và cộng đồng quanh các hoạt động của Viện.',
      focus: 'Giúp người xem tìm thấy dự án, tin tức và bối cảnh chuyên môn của Viện.',
      approach: 'Website tiếng Việt và tiếng Anh kết hợp thông tin tổ chức với các dự án và cập nhật dành cho cộng đồng của Viện.',
      useCases: [
        { title: 'Khám phá các dự án', text: 'Danh mục dự án giúp người xem tìm hiểu công việc xây dựng và quy hoạch đô thị của Viện.' },
        { title: 'Theo dõi thông tin mới', text: 'Tin tức của Viện và thông tin dự án cùng xuất hiện trong một không gian số.' },
        { title: 'Kết nối cộng đồng', text: 'Website giới thiệu Viện trong mạng lưới chuyên gia, người am hiểu địa phương và các tổ chức.' }
      ],
      gallery: gallery('icue', [
        ['Danh mục dự án trên website ICUE với hình ảnh kiến trúc và bản đồ quy hoạch', 'Danh mục dự án'],
        ['Trang chủ tiếng Việt của ICUE với nội dung giới thiệu và đồ họa chuyển động', 'Không gian số của Viện']
      ], 'vi'),
      takeaway: 'Nơi giới thiệu thông tin, dự án và cộng đồng của Viện đến công chúng.'
    }
  }
};

export function getCaseStudy(id, language = 'en') {
  const study = Object.hasOwn(caseStudies, id) ? caseStudies[id] : null;
  return study ? study[language === 'vi' ? 'vi' : 'en'] : null;
}
