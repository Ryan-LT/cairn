import type { Messages } from "../en";

export const wealth: Messages["wealth"] = {
  summary: {
    assets: "Tài sản",
    debts: "Khoản nợ",
    netWorth: "Tài sản ròng",
    debtShare: (p) => `Nợ bằng ${p.pct} tài sản`,
    withLoans: "gồm cả cho vay cá nhân",
  },
  assets: {
    updatedAgo: (p) => `cập nhật ${p.ago}`,
    neverUpdated: "chưa cập nhật giá trị",
    updateValue: "Cập nhật giá trị",
    updateTitle: (p) => `${p.name}: giá trị hôm nay`,
    updateConfirm: "Lưu giá trị",
    updated: "Đã cập nhật giá trị",
    byCategory: "Theo danh mục",
    stale: (p) => `${p.count} tài sản chưa cập nhật giá trị trong 3 tháng`,
  },
  migrate: {
    title: (p) => `${p.count} khoản từ phiên bản cũ`,
    body: "Các khoản này hiện chỉ xem được. Chuyển vào danh sách tài sản để sửa, cập nhật giá trị và xóa như mọi tài sản khác. Tài sản ròng và các kế hoạch giữ nguyên.",
    action: "Chuyển vào danh sách",
    done: (p) => `Đã chuyển ${p.count} khoản vào danh sách tài sản`,
  },
  debts: {
    payoffOn: (p) => `Trả xong ${p.date}`,
    noPayment: "Thêm số trả hằng tháng để biết ngày trả xong",
    perMonth: (p) => `${p.amount} / tháng`,
    inSpending: "Đã có trong chi tiêu",
    addToSpending: "Thêm vào chi tiêu",
    addedToSpending: (p) => `Đã thêm ${p.name} vào chi tiêu`,
    priority: "Ưu tiên trả",
    priorityHint: "Lãi suất cao nhất: trả thêm vào đây đỡ tốn nhất.",
    extra: (p) => `Trả thêm ${p.extra} mỗi tháng → xong sớm ${p.months} tháng, đỡ ${p.interest} tiền lãi.`,
    billArchived: "Khoản trả nợ trong chi tiêu cũng đã được gỡ",
  },
  loans: {
    statusOn: "Các khoản chưa tất toán đang được tính vào tài sản ròng.",
    statusOff: "Sổ ghi riêng: không tính vào tài sản ròng.",
    change: "Đổi trong Cài đặt",
  },
};
