import type { Messages } from "../en";

export const settings: Messages["settings"] = {
  description: "Mục tiêu cột mốc, giao diện, đồng bộ dữ liệu, mật khẩu và phiên đăng nhập.",
  milestone: {
    title: "Mục tiêu cột mốc",
    description:
      "Tài sản ròng bạn muốn đạt được và ở độ tuổi nào. Hiển thị trên trang Tổng quan; hạn chót là sinh nhật của bạn ở tuổi đó.",
    saved: "Đã lưu mục tiêu cột mốc",
    birthDate: "Ngày sinh",
    birthDatePlaceholder: "Chọn ngày sinh của bạn",
    target: "Tài sản ròng mục tiêu (USD)",
    targetAge: "Trước tuổi",
    ageRange: (p) => `Tuổi phải từ ${p.min} đến ${p.max}.`,
  },
  appearance: {
    title: "Giao diện",
    description: (p) => `Chọn giao diện ${p.brand} trên thiết bị này.`,
    languageHint: "Chọn ngôn ngữ của ứng dụng. Lựa chọn này đi theo tài khoản của bạn sang các thiết bị khác.",
  },
  data: {
    title: "Dữ liệu & đồng bộ",
    description:
      "Dữ liệu của bạn chỉ thuộc về tài khoản của bạn. Dữ liệu được lưu trên máy chủ và lưu tạm trên thiết bị này để ứng dụng vẫn chạy khi ngoại tuyến.",
    syncNow: "Đồng bộ ngay",
    connection: "Kết nối",
    lastSynced: "Đồng bộ lần cuối",
    notYet: "Chưa có",
    backup: "Sao lưu",
    backupHint: "Tải xuống mọi bảng dưới dạng JSON (cùng cấu trúc với API).",
    exportJson: "Xuất JSON",
    backupDownloaded: "Đã tải bản sao lưu",
  },
  password: {
    title: "Mật khẩu",
    description: "Đổi mật khẩu sẽ đăng xuất bạn khỏi các thiết bị khác. Quên mật khẩu? Hãy nhờ quản trị viên ứng dụng đặt lại.",
    current: "Mật khẩu hiện tại",
    next: "Mật khẩu mới",
    hint: (p) => `Tối thiểu ${p.min} ký tự.`,
    confirm: "Xác nhận mật khẩu mới",
    submit: "Đổi mật khẩu",
    submitting: "Đang đổi…",
    changed: "Đã đổi mật khẩu",
    changedDescription: "Các thiết bị khác đã được đăng xuất.",
  },
  session: {
    title: "Phiên đăng nhập",
    signedInAs: "Đăng nhập với tên",
    login: "Đăng nhập",
    enabled: "Đã bật",
    disabled: "Đã tắt",
    disabledHint: "Đặt DATABASE_URL và AUTH_SECRET trên máy chủ, rồi thêm tài khoản bằng db/create-user.sql.",
    signOut: "Đăng xuất",
  },
};
