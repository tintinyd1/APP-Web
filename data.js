/**
 * DATA STORAGE & INITIAL CONFIGURATION FOR LABMASTER
 * Hệ thống Quản lý và Đăng ký Phòng Thực Hành 2026 - 2027
 * Không chứa dữ liệu đăng ký ảo/mẫu - Sẵn sàng cho Admin tự khai báo
 */

window.LAB_INITIAL_DATA = {
  schoolYear: '2026 - 2027',
  schoolName: 'TRƯỜNG THPT',
  yearStartDate: '2026-09-07',
  yearEndDate: '2027-05-31',
  currentWeekNumber: 7, // Tuần hiện tại: 19/10/2026 - 25/10/2026

  // Danh mục phòng thực hành ban đầu (Admin có thể tự đổi tên, xóa, hoặc thêm mới bất kỳ)
  rooms: [
    {
      id: 'room_1',
      name: 'Phòng thực hành 1',
      fullName: 'Phòng thực hành 1 (Tầng 2)',
      totalComputers: 36,
      workingComputers: 36,
      damagedComputers: 0,
      projector: 'Máy chiếu Epson HDMI',
      airConditioners: '2 máy điều hòa',
      managerName: 'Quản trị viên',
      managerEmail: 'admin@gmail.com',
      status: 'active'
    },
    {
      id: 'room_2',
      name: 'Phòng thực hành 2',
      fullName: 'Phòng thực hành 2 (Tầng 2)',
      totalComputers: 36,
      workingComputers: 36,
      damagedComputers: 0,
      projector: 'Smart TV 75 inch',
      airConditioners: '2 máy điều hòa',
      managerName: 'Quản trị viên',
      managerEmail: 'admin@gmail.com',
      status: 'active'
    }
  ],

  // Danh mục Lớp thực hành (Admin có thể khai báo thêm, sửa, xóa)
  classes: [
    '10A1', '10A2', '10A3', '10A4',
    '11A1', '11A2', '11A3', '11A4',
    '12A1', '12A2', '12A3', '12A4'
  ],

  // Phân môn / Môn học
  subjects: [
    'Tin học',
    'Tin học ứng dụng',
    'Lập trình máy tính',
    'Công nghệ - STEM',
    'Tiếng Anh trực tuyến',
    'Bồi dưỡng HSG',
    'Khác'
  ],

  // Danh sách tài khoản người dùng ban đầu
  users: [
    {
      email: 'admin@gmail.com',
      name: 'Quản Trị Viên Phòng Máy',
      phone: '0988888888',
      role: 'admin',
      department: 'Ban Quản Trị',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      signature: 'Quản Trị Viên'
    }
  ],

  // Tên tùy chỉnh cho các tuần do Quản trị viên đặt (Admin có thể đặt tên cho từng tuần)
  weekCustomNames: {
    1: 'Tuần 1: Khởi động năm học mới',
    7: 'Tuần 7: Thi đua dạy tốt - học tốt',
    18: 'Tuần 18: Ôn tập & Kiểm tra học kỳ 1',
    19: 'Tuần 19: Kết thúc học kỳ 1',
    35: 'Tuần 35: Ôn tập & Kiểm tra cuối năm'
  },

  // KHÔNG CÓ DỮ LIỆU ĐĂNG KÝ ẢO / MẪU (RỖNG THEO YÊU CẦU NGƯỜI DÙNG)
  initialBookings: [],
  initialIssues: []
};
