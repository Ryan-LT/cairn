import type { Messages } from "../en";

export const insights: Messages["insights"] = {
  title: "Đáng chú ý",
  viewAll: (p) => `Xem tất cả (${p.count})`,
  showLess: "Thu gọn",
  empty: "Mọi thứ ổn: chưa có gì cần bạn chú ý.",
  when: {
    today: "hôm nay",
    tomorrow: "ngày mai",
    inDays: (p) => `sau ${p.count} ngày`,
  },
  more: (p) => ` và ${p.count} khoản khác`,
  bills_overdue: (p) => `${p.count} hóa đơn đã quá hạn (${p.total}). Trả sớm để tránh phí trễ hạn.`,
  bills_due_week: (p) => `${p.name} đến hạn ${p.when}${p.more}.`,
  negative_net: (p) => `Bạn đang chi nhiều hơn thu ${p.amount} mỗi tháng. Xem lại các khoản mong muốn trong Chi tiêu.`,
  emergency_low: (p) => `Tiền dùng ngay chỉ đủ ${p.months} chi tiêu. Nên có quỹ dự phòng 3–6 tháng.`,
  emergency_ok: (p) => `Quỹ dự phòng đủ ${p.months} chi tiêu. Rất vững.`,
  costly_debt_first: (p) => `${p.name} lãi ${p.rate} một năm (${p.interest} tiền lãi mỗi tháng). Nên ưu tiên trả khoản này trước.`,
  budget_over: (p) => `${p.name} đã vượt ngân sách ${p.amount} tháng này.`,
  plan_drift: (p) => `Mấy tháng gần đây bạn chi nhiều hơn kế hoạch khoảng ${p.amount} mỗi tháng.`,
  goal_off_track: (p) => `${p.name} cần góp thêm ${p.amount} mỗi tháng để kịp hạn.`,
  shares_over_allocated: "Tỷ lệ chia tiền tiết kiệm cho các kế hoạch đang vượt 100 %. Hãy điều chỉnh lại.",
  unlinked_debt_payment: (p) => `${p.count} khoản trả nợ (${p.amount} mỗi tháng) chưa có trong chi tiêu.`,
  unitemized_estimate: (p) => `Còn ${p.amount} trong ước tính cũ chưa được chi tiết thành từng khoản.`,
  yearly_bill_ahead: (p) => `${p.name} (${p.amount}) đến hạn ${p.date}. Lần sau, để dành ${p.perMonth} mỗi tháng là đủ.`,
  assets_stale: (p) => `${p.count} tài sản chưa cập nhật giá trị hơn 3 tháng.`,
  savings_rate_good: (p) => `Bạn đang tiết kiệm ${p.pct} thu nhập. Cứ giữ vững nhé.`,
};
