import type { Messages } from "../en";

export const allocations: Messages["allocations"] = {
  kpi: {
    instantPool: { label: "Tiền dùng ngay còn trống", hint: "Tiền dùng được ngay chưa dành cho kế hoạch nào" },
    notInstantPool: { label: "Tài sản khác còn trống", hint: "Bất động sản, đầu tư, tiền có kỳ hạn" },
    custom: { label: "Số tiền tự nhập", hint: "Đã dành cho kế hoạch nhưng không gắn với tài sản nào" },
  },
  plans: {
    title: "Tiền đã dành cho từng kế hoạch",
    description: "Chạm vào một kế hoạch để đổi nguồn tiền của nó.",
    emptyTitle: "Chưa có kế hoạch mục tiêu nào được lưu",
    emptyDescription: "Lưu một kế hoạch để xem nó dành tài sản của bạn ra sao.",
    goToGoals: "Đến trang mục tiêu",
    sharePerMonth: (p) => `${p.pct} tiền tiết kiệm hằng tháng · ${p.amount} / tháng`,
    noMonthly: "Không góp từ tiền tiết kiệm hằng tháng",
  },
  matrix: {
    title: "Từng tài sản đã dành cho đâu",
    description: "Mỗi tài sản đã dành cho kế hoạch nào bao nhiêu, và còn trống bao nhiêu.",
    filterLabel: "Lọc theo khả năng dùng ngay",
    filter: { both: "Tất cả", instant: "Dùng ngay", not_instant: "Không dùng ngay" },
    emptyTitle: "Chưa có gì để hiển thị",
    emptyDescription: "Không có nguồn nào có số dư hoặc phần giữ chỗ.",
    noMatch: "Không có tài sản nào khớp bộ lọc này",
    colSource: "Nguồn",
    colIncomeCapital: "Vốn tạo thu nhập",
    incomeCapitalHint: "Tổng vốn của tài sản này được phân bổ cho mọi nguồn thu nhập (một quỹ riêng).",
    colReserved: "Đã dành",
    colLive: "Giá trị",
    colPool: "Còn trống",
  },
};
