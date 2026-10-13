import { describe, expect, it } from "vitest";

import { FOLD_FROM, FOLD_TO, foldSearch } from "./search-fold";

describe("foldSearch", () => {
  it("drops Vietnamese accents and case", () => {
    expect(foldSearch("Xăng Xe")).toBe("xang xe");
    expect(foldSearch("  TRẢ LÃI Midory  ")).toBe("tra lai midory");
    expect(foldSearch("Đóng học phí")).toBe("dong hoc phi");
    expect(foldSearch("Nhẫn trơn 9999")).toBe("nhan tron 9999");
  });

  it("folds decomposed input the same way", () => {
    expect(foldSearch("Xăng".normalize("NFD"))).toBe("xang");
  });

  it("keeps the SQL letter map aligned", () => {
    expect([...FOLD_FROM]).toHaveLength(FOLD_TO.length);
  });
});
