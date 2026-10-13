import type { Messages } from "../en";

export const assets: Messages["assets"] = {
  title: "Tài sản",
  description: "Mọi thứ bạn sở hữu và bạn có thể dùng đến chúng nhanh đến đâu.",
  addAsset: "Thêm tài sản",
  kpi: {
    total: { label: "Tổng tài sản", hint: (p) => `Đang theo dõi ${p.count} tài sản` },
    instant: { label: "Dùng ngay", hint: "Tiền mặt và tương đương tiền" },
    notInstant: { label: "Không dùng ngay", hint: "Bị khóa, bất động sản, có kỳ hạn" },
    categories: { label: "Danh mục", hint: (p) => `Có sẵn ${p.count} danh mục` },
  },
  list: {
    title: "Tất cả tài sản",
    description: "Kéo các dòng để sắp xếp theo thứ tự bạn muốn.",
    searchPlaceholder: "Tìm theo tên hoặc danh mục…",
    emptyTitle: "Chưa có tài sản nào",
    emptyDescription: "Thêm tiền mặt, khoản đầu tư, bất động sản và mọi thứ khác bạn sở hữu.",
    noMatch: "Không có tài sản nào khớp với tìm kiếm",
  },
  toast: {
    added: "Đã thêm tài sản",
    updated: "Đã cập nhật tài sản",
    deleted: "Đã xóa tài sản",
  },
  confirmDelete: {
    title: "Xóa tài sản?",
    description: (p) => `Thao tác này sẽ xóa "${p.name}" khỏi danh sách. Các kế hoạch mục tiêu đang dùng tài sản này sẽ mất phần phân bổ đó.`,
  },
  form: {
    addTitle: "Thêm tài sản",
    editTitle: "Sửa tài sản",
    description: "Tài sản được tính vào tài sản ròng và có thể dùng cho các kế hoạch mục tiêu.",
    name: "Tên",
    namePlaceholder: "VD: Quỹ dự phòng, căn hộ",
    nameRequired: "Vui lòng nhập tên",
    category: "Danh mục",
    categoryRequired: "Chọn hoặc tạo một danh mục",
    categoryDescription: "Gõ tên mới để tạo danh mục của riêng bạn.",
    access: "Thanh khoản",
    accessDescription: "Dùng ngay: tiền mặt hoặc tương đương mà bạn có thể chi ngay. Không dùng ngay: bị khóa, tiền gửi có kỳ hạn, bất động sản.",
    currentValue: "Giá trị hiện tại",
    submitAdd: "Thêm tài sản",
  },
};
