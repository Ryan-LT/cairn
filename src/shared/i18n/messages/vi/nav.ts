import type { Messages } from "../en";

export const nav: Messages["nav"] = {
  hubs: {
    home: { label: "Tổng quan", short: "Tổng quan", description: "Tình hình tiền bạc của bạn hôm nay" },
    cashflow: { label: "Dòng tiền", short: "Dòng tiền", description: "Tiền vào, tiền ra và các hóa đơn tháng này" },
    wealth: { label: "Tài sản ròng", short: "Tài sản", description: "Tài sản, khoản nợ và tiền cho vay, đi vay" },
    goals: { label: "Mục tiêu", short: "Mục tiêu", description: "Kế hoạch tiết kiệm và số tiền đã dành cho từng kế hoạch" },
    settings: { label: "Cài đặt", short: "Cài đặt", description: "Tài khoản, giao diện và dữ liệu của bạn" },
  },
  tabs: {
    cashflowMonth: { label: "Tháng này", description: "Hóa đơn cần trả, ngân sách và số tiền còn lại tháng này" },
    cashflowSpending: { label: "Chi tiêu", description: "Mọi hóa đơn và ngân sách, theo danh mục" },
    cashflowIncome: { label: "Thu nhập", description: "Lương, thu nhập phụ và thu nhập thụ động" },
    wealthAssets: { label: "Tài sản", description: "Mọi thứ bạn sở hữu và tốc độ có thể dùng đến" },
    wealthDebts: { label: "Khoản nợ", description: "Khoản vay, thẻ tín dụng, ngày trả xong và tiền lãi" },
    wealthLoans: { label: "Cho vay", description: "Tiền cho người quen vay hoặc vay của người quen" },
    goalsPlans: { label: "Kế hoạch", description: "Từng mục tiêu, tiến độ và có kịp hạn hay không" },
    settingsGeneral: { label: "Chung", description: "Tài khoản, giao diện và dữ liệu của bạn" },
    settingsActivity: { label: "Nhật ký thay đổi", description: "Mọi lần thêm, sửa, xóa, để xem lại quyết định tiền bạc của bạn" },
    goalsFunding: { label: "Phân bổ", description: "Khoản tiền nào đã dành cho kế hoạch nào" },
  },
  quickAdd: {
    record: { label: "Ghi khoản đã chi", short: "Ghi chi", keywords: "trả hóa đơn đã trả chi tiêu ghi chép pay bill paid spent" },
    bill: { label: "Thêm hóa đơn, ngân sách", short: "Hóa đơn", keywords: "tạo mới hóa đơn ngân sách chi tiêu tiền ra create bill budget expense" },
    income: { label: "Thêm thu nhập", short: "Thu nhập", keywords: "tạo mới thu nhập lương tiền vào create income salary" },
    asset: { label: "Thêm tài sản", short: "Tài sản", keywords: "tạo mới tài sản create new asset" },
    debt: { label: "Thêm khoản nợ", short: "Khoản nợ", keywords: "tạo mới khoản nợ vay thẻ tín dụng create debt loan card" },
    loan: { label: "Ghi khoản cho vay", short: "Cho vay", keywords: "tạo mới cho vay đi vay create lend borrow" },
    plan: { label: "Kế hoạch mục tiêu mới", short: "Mục tiêu", keywords: "tạo mới kế hoạch mục tiêu tiết kiệm create goal plan" },
  },
};
