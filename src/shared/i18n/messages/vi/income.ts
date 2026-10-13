import type { Messages } from "../en";

export const income: Messages["income"] = {
  title: "Thu nhập & chi tiêu",
  description: "Tiền vào mỗi tháng, tiền ra, và phần còn lại để tiết kiệm.",
  addSource: "Thêm nguồn thu nhập",
  activeTitle: "Từ công việc",
  passiveTitle: "Từ tài sản (thụ động)",
  active: "Chủ động",
  passive: "Thụ động",
  paymentDay: (p) => `ngày ${p.day} hằng tháng`,
  capital: {
    yield: (p) => `Lợi suất ${p.pct} / năm`,
  },
  empty: {
    title: "Chưa có nguồn thu nhập nào",
    description: "Thêm lương, tiền cho thuê hoặc tiền lãi để tính các dự phóng.",
  },
  toast: {
    updated: "Đã cập nhật nguồn thu nhập",
    added: "Đã thêm nguồn thu nhập",
    deleted: "Đã xóa nguồn thu nhập",
  },
  confirmDelete: {
    title: "Xóa nguồn thu nhập?",
    description: (p) => `Xóa "${p.name}" khỏi danh sách nguồn thu nhập của bạn?`,
  },


  form: {
    addTitle: "Thêm nguồn thu nhập",
    editTitle: "Sửa nguồn thu nhập",
    description: "Thu nhập hằng tháng được dùng cho trang tổng quan, dự phóng mục tiêu và ước tính cuối năm.",
    nameRequired: "Hãy nhập tên",
    type: "Loại",
    name: "Tên",
    namePlaceholder: "VD: Lương, tiền cho thuê nhà",
    details: "Chi tiết",
    detailsPlaceholder: "Mô tả (không bắt buộc)",
    monthly: "Số tiền hằng tháng",
    icon: "Biểu tượng",
    capital: "Vốn đầu tư",
    capitalFrom: (p) => ` từ ${p.count} nguồn`,
    capitalEmpty: "Liên kết các tài sản tạo ra khoản thu nhập này",
    capitalHint: "Chủ yếu dành cho thu nhập thụ động (tiền gửi, trái phiếu, cho thuê). Được theo dõi riêng với kế hoạch mục tiêu.",
    paidBy: "Bên chi trả",
    paidByPlaceholder: "Không bắt buộc",
    paymentDay: "Ngày nhận tiền",
    submitAdd: "Thêm nguồn",
  },
  capitalDialog: {
    title: "Vốn đầu tư",
    description: "Tài sản nào tạo ra khoản thu nhập này? Số tiền bị giới hạn bởi phần mà các nguồn thu nhập khác đã dùng.",
    apply: "Dùng các nguồn này",
    subject: "nguồn thu nhập",
  },
};
