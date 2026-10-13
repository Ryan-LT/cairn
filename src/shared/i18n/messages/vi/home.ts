import type { Messages } from "../en";

export const home: Messages["home"] = {
  greeting: {
    morning: (p) => `Chào buổi sáng, ${p.name}`,
    afternoon: (p) => `Chào buổi chiều, ${p.name}`,
    evening: (p) => `Chào buổi tối, ${p.name}`,
  },
  netWorth: "Tài sản ròng",
  thisMonthChange: "tháng này",
  trendLabel: (p) => `Tài sản ròng thay đổi ${p.change} trong ${p.months} tháng`,
  assets: "Tài sản",
  debts: "Nợ",
  month: {
    title: "Tháng này",
    income: "Tiền vào",
    spent: "Đã chi",
    planned: "Dự kiến chi",
    left: "Dư cuối tháng",
    open: "Mở Dòng tiền",
  },
  due: {
    title: "Hóa đơn cần trả",
    empty: "Không có hóa đơn nào đến hạn trong tuần tới.",
    viewAll: "Tất cả hóa đơn",
  },
  goals: {
    title: "Mục tiêu",
    empty: "Chưa có kế hoạch mục tiêu nào.",
    create: "Tạo kế hoạch",
    viewAll: "Tất cả mục tiêu",
  },
  health: {
    title: "Sức khỏe tài chính",
    emergency: "Quỹ dự phòng",
    debtRatio: "Nợ / tài sản",
    savingsRate: "Tỷ lệ tiết kiệm",
    fi: "Độc lập tài chính",
    months: (p) => `${p.value} tháng`,
  },
};
