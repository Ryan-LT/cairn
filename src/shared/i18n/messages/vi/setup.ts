import type { Messages } from "../en";

export const setup: Messages["setup"] = {
  title: "Thiết lập Cairn",
  description: (p) => `Xong ${p.done}/${p.total} bước: vài phút là có bức tranh tiền bạc đầy đủ.`,
  dismiss: "Ẩn hướng dẫn",
  steps: {
    income: { label: "Thêm thu nhập", hint: "Lương, thu nhập phụ, tiền lãi" },
    bills: { label: "Liệt kê hóa đơn và chi tiêu", hint: "Tiền nhà, điện nước, ăn uống…" },
    assets: { label: "Thêm tài sản", hint: "Tiền gửi, vàng, chứng khoán, nhà" },
    debts: { label: "Thêm khoản nợ", hint: "Vay mua nhà, xe, thẻ tín dụng" },
    goal: { label: "Đặt mục tiêu đầu tiên", hint: "Mua nhà, du lịch, quỹ học cho con" },
  },
  noDebts: "Tôi không có khoản nợ nào",
  start: "Bắt đầu",
};
