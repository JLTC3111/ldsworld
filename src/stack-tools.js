// Brief roles for the tools listed in the original project portfolio.
const tools = {
  React: ['Interactive user interfaces built from reusable components.', 'Giao diện tương tác được xây dựng từ các thành phần tái sử dụng.'],
  'Next.js': ['A React framework for building web applications.', 'Framework React để xây dựng ứng dụng web.'],
  'Tailwind CSS': ['Utility classes for styling interfaces and responsive layouts.', 'Các lớp tiện ích để tạo kiểu giao diện và bố cục thích ứng.'],
  'Chart.js': ['Charts for presenting data in a web interface.', 'Biểu đồ để trình bày dữ liệu trên giao diện web.'],
  PostgreSQL: ['A relational database for structured application data.', 'Cơ sở dữ liệu quan hệ dành cho dữ liệu có cấu trúc.'],
  Python: ['A programming language for applications, automation, and data processing.', 'Ngôn ngữ lập trình cho ứng dụng, tự động hóa và xử lý dữ liệu.'],
  Streamlit: ['A Python framework for interactive data applications.', 'Framework Python dành cho ứng dụng dữ liệu tương tác.'],
  Plotly: ['Interactive charts and data visualizations.', 'Biểu đồ tương tác và trực quan hóa dữ liệu.'],
  NumPy: ['Numerical arrays and calculations in Python.', 'Mảng số và các phép tính trong Python.'],
  Supabase: ['Backend services built around a PostgreSQL database.', 'Các dịch vụ backend dựa trên cơ sở dữ liệu PostgreSQL.'],
  GSAP: ['Animation tools for motion and interface transitions.', 'Công cụ tạo chuyển động và hiệu ứng chuyển tiếp cho giao diện.'],
  Tkinter: ['Desktop interface widgets for Python applications.', 'Các thành phần giao diện máy tính cho ứng dụng Python.'],
  PyInstaller: ['Packages a Python application for distribution.', 'Đóng gói ứng dụng Python để phân phối.'],
  JavaScript: ['Programming language for browser behavior and interaction.', 'Ngôn ngữ lập trình cho hành vi và tương tác trên trình duyệt.'],
  HTML5: ['The structure and semantic content of a web page.', 'Cấu trúc và nội dung ngữ nghĩa của trang web.'],
  CSS: ['Visual styling, layout, and responsive presentation.', 'Kiểu hiển thị, bố cục và giao diện thích ứng.'],
  Vite: ['Development and build tooling for web projects.', 'Công cụ phát triển và xây dựng dự án web.'],
  AOS: ['Scroll-triggered animations for page elements.', 'Hiệu ứng cho các thành phần trang khi cuộn.']
};

export function getToolInfo(name, language = 'en') {
  const entry = Object.hasOwn(tools, name) ? tools[name] : null;
  return entry ? entry[language === 'vi' ? 1 : 0] : '';
}
