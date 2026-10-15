import type { Messages } from "../en";

export const help: Messages["help"] = {
  ui: {
    open: "Trợ giúp",
    menuTitle: "Trợ giúp cho màn hình này",
    explain: "Giải thích màn hình này",
    explainHint: "Đánh dấu từng khung; chạm vào khung để biết nó là gì",
    tour: "Xem hướng dẫn",
    tourHint: "Đi qua từng phần của trang này",
    shortcut: "Mẹo: nhấn ? bất cứ lúc nào để bật hoặc tắt phần giải thích.",
    banner: "Chạm vào khung bất kỳ, hoặc dấu ? của nó, để xem giải thích.",
    nothingHere: "Màn hình này chưa có gì để giải thích.",
    exit: "Xong",
    whatIs: (p) => `“${p.name}” là gì?`,
    markerLabel: (p) => `Giải thích “${p.name}”`,
    prevBlock: "Trước",
    nextBlock: "Tiếp",
    step: (p) => `Bước ${p.n}/${p.total}`,
    back: "Quay lại",
    next: "Tiếp",
    finish: "Hoàn tất",
    skip: "Đóng hướng dẫn",
    keys: "Dùng ← và → để chuyển bước, Esc để đóng.",
    finished: "Xong phần hướng dẫn! Nhấn ? hoặc nút trợ giúp bất cứ lúc nào để xem lại giải thích.",
  },
  pages: {
    home: { title: "Tổng quan của bạn", body: "Tiền bạc của bạn đang ở đâu hôm nay, tuần này cần làm gì, và điều gì đáng để ý. Cùng xem từng phần cho bạn biết điều gì." },
    month: { title: "Tháng này", body: "Theo dõi tháng đang diễn ra: đánh dấu hóa đơn đã trả, ghi chi tiêu ngân sách, ghi thu nhập, và xem cuối tháng còn dư bao nhiêu." },
    spending: { title: "Chi tiêu", body: "Các hóa đơn định kỳ và ngân sách linh hoạt của bạn: kế hoạch mà mỗi tháng được so sánh." },
    income: { title: "Thu nhập", body: "Tiền của bạn đến từ đâu mỗi tháng, và vào tài khoản nào." },
    history: { title: "Lịch sử", body: "Mọi khoản chi và thu đã thực sự ghi lại, theo từng tháng, kèm tổng để so sánh." },
    assets: { title: "Tài sản", body: "Bạn sở hữu những gì, hôm nay đáng giá bao nhiêu, và bao nhiêu trong đó dùng được ngay." },
    debts: { title: "Khoản nợ", body: "Bạn đang nợ bao nhiêu, mỗi tháng tốn bao nhiêu tiền lãi, và cách nhanh nhất để hết nợ." },
    loans: { title: "Cho vay", body: "Tiền bạn cho người khác vay hoặc vay của người khác, để không quên khoản nào." },
    plans: { title: "Kế hoạch mục tiêu", body: "Lập kế hoạch cho mục tiêu lớn với số tiền đã có, khoản góp mỗi tháng và thời hạn, rồi xem có kịp không." },
    funding: { title: "Phân bổ", body: "Tài sản và khoản tiết kiệm hằng tháng được chia cho các kế hoạch thế nào, và phần nào còn trống." },
    settings: { title: "Cài đặt", body: "Tiền tệ hiển thị và tỷ giá, mục tiêu cột mốc, cách tính tổng, và dữ liệu của bạn." },
    activity: { title: "Nhật ký thay đổi", body: "Mọi thay đổi đã lưu vào tài khoản, để bạn luôn biết đã đổi gì và khi nào." },
    connect: { title: "Kết nối & chia sẻ", body: "Cho ngân hàng tự gửi giao dịch vào đây, và chia sẻ bản chụp số liệu có mật khẩu." },
  },
  topics: {
    setupGuide: {
      title: "Thiết lập ban đầu",
      body: "Vài bước để có bức tranh đầy đủ: thu nhập, hóa đơn, tài sản, khoản nợ và mục tiêu đầu tiên. Mỗi bước tự đánh dấu xong khi đã có dữ liệu.",
      tip: "Đóng bất cứ lúc nào; mọi thứ vẫn mở được từ menu.",
    },
    netWorth: {
      title: "Tài sản ròng",
      body: "Tất cả những gì bạn sở hữu trừ đi những gì bạn nợ. Tài sản tính theo giá trị hôm nay: tài khoản tự cộng trừ thu chi đã ghi kể từ lần cập nhật cuối, còn đô la và vàng theo tỷ giá hôm nay. Thanh màu cho biết bao nhiêu trong đó dùng được ngay.",
      tip: "Tiền cho vay hoặc đi vay người quen chỉ được tính khi bạn bật trong Cài đặt → Cách tính.",
    },
    monthGlance: {
      title: "Tháng này",
      body: "Tiền vào là thu nhập mỗi tháng. Đã chi gồm hóa đơn đã trả (kể cả tự động trả), chi tiêu ngân sách và chi ngoài kế hoạch. Dự kiến chi là hóa đơn đến hạn trong tháng cộng ngân sách. Dư cuối tháng là tiền vào trừ mọi khoản đã chi và còn phải chi.",
      tip: "Vòng tròn cho biết đã chi được bao nhiêu phần kế hoạch tháng này.",
    },
    dueBills: {
      title: "Hóa đơn cần trả",
      body: "Hóa đơn quá hạn, hóa đơn cần xác nhận, và hóa đơn đến hạn trong 7 ngày tới. Đánh dấu để ghi khoản đã trả; tiền được trừ vào tài khoản của hóa đơn. Khi chưa có gì sắp đến hạn, các hóa đơn cuối tháng sẽ hiện ở đây.",
    },
    insights: {
      title: "Đáng chú ý",
      body: "Những điều dữ liệu cho thấy nên để ý, khẩn cấp nhất trước: hóa đơn quá hạn, khoản nợ lãi cao, ngân sách sắp vượt, mục tiêu chậm tiến độ, quỹ dự phòng mỏng, hoặc tin vui như tỷ lệ tiết kiệm tốt.",
      tip: "Chạm vào một mục để tới nơi xử lý nó.",
    },
    goalsGlance: {
      title: "Mục tiêu",
      body: "Tiến độ của mỗi kế hoạch là số tiền đã dành cho nó so với mục tiêu. Nhãn trạng thái so sánh số tiền dự kiến có vào ngày đến hạn với mục tiêu: đúng tiến độ, gần kịp, chậm tiến độ hoặc quá hạn.",
      tip: "Chạm vào một mục tiêu để mở kế hoạch.",
    },
    healthScore: {
      title: "Sức khỏe tài chính",
      body: "Điểm trên 100 từ 17 chỉ số trong năm nhóm: an toàn, dòng tiền, nợ, tăng trưởng và đa dạng hóa. Các ô hiện bốn chỉ số: số tháng tiền dùng ngay đủ chi tiêu, nợ so với tài sản, phần thu nhập giữ lại, và tiến độ tới độc lập tài chính.",
      tip: "Mở “Xem tất cả” để thấy mọi chỉ số, cách tính và điều nên cải thiện trước.",
    },
    netWorthTrend: {
      title: "Xu hướng tài sản ròng",
      body: "Tài sản ròng cuối mỗi tháng, được ghi lại tự động, điểm cuối cùng là hôm nay. Chuyển sang dạng bảng để xem số chính xác và mức thay đổi từng tháng.",
    },
    milestone: {
      title: "Mục tiêu cột mốc",
      body: "Một mục tiêu dài hạn bằng đô la, quy đổi theo tỷ giá hôm nay, trước sinh nhật bạn chọn. Dự phóng lấy tài sản ròng hiện tại cộng tiết kiệm hằng tháng, tăng trưởng với lợi nhuận thực vừa phải (sau lạm phát), và nhãn cho biết bạn có kịp không.",
      tip: "Đổi mục tiêu, tuổi hoặc ngày sinh trong Cài đặt → Mục tiêu cột mốc.",
    },
    cashIn: {
      title: "Tiền vào",
      body: "Tổng thu nhập mỗi tháng từ mọi nguồn, cả tiền bạn làm ra lẫn tiền do tài sản sinh ra.",
    },
    cashOut: {
      title: "Tiền ra",
      body: "Chi tiêu mỗi tháng: mọi hóa đơn và ngân sách quy về số tiền mỗi tháng (hằng tuần × 52 ÷ 12, hằng quý ÷ 3, hằng năm ÷ 12). Hóa đơn gắn với khoản nợ dùng số tiền trả hằng tháng của khoản nợ đó.",
    },
    cashLeft: {
      title: "Còn lại mỗi tháng",
      body: "Tiền vào trừ tiền ra: số bạn có thể tiết kiệm hoặc góp cho mục tiêu mỗi tháng. Dòng bên dưới là tỷ lệ tiết kiệm, phần thu nhập còn lại.",
      tip: "Nên giữ lại ít nhất 20% số tiền kiếm được.",
    },
    monthProgress: {
      title: "Tháng này đến nay",
      body: "Đã chi được bao nhiêu phần kế hoạch tháng này: hóa đơn đã trả (kể cả tự động trả), chi tiêu ngân sách và chi ngoài kế hoạch. Còn phải chi là hóa đơn chưa trả cộng phần còn lại của ngân sách. Cuối tháng là thu nhập trừ tất cả các khoản đó.",
    },
    monthCalendar: {
      title: "Lịch tháng",
      body: "Từng ngày trong tháng. Chấm là hóa đơn đến hạn hôm đó, tô màu theo trạng thái, còn biểu tượng tờ tiền đánh dấu ngày nhận lương.",
    },
    monthNeedsConfirm: {
      title: "Cần xác nhận",
      body: "Hóa đơn có hạn trong tháng nhưng trước ngày bạn thêm nó vào, nên ứng dụng không biết đã trả hay chưa. Đánh dấu từng hóa đơn là đã trả hoặc bỏ qua.",
    },
    monthBudgets: {
      title: "Ngân sách",
      body: "Các khoản linh hoạt như ăn uống hay xăng xe. Ghi chi tiêu khi phát sinh; ngân sách được nhắc khi chi nhanh hơn tiến độ tháng, quá 115% mức lẽ ra đã chi tới hôm nay.",
    },
    monthIncome: {
      title: "Thu nhập tháng này",
      body: "Mỗi nguồn thu hiện là đã nhận, đến hạn hoặc đang chờ. Khi tiền về, chạm “Đã nhận” để ghi vào tài khoản. Nguồn được đặt tự nhận sẽ tự ghi vào đúng ngày nhận.",
    },
    monthUnplanned: {
      title: "Chi ngoài kế hoạch",
      body: "Các khoản chi ngoài hóa đơn và ngân sách, ghi bằng “Chi ngay” và trừ vào tài khoản bạn chọn. Chúng được tính vào chi tiêu của tháng.",
    },
    spendingTotal: {
      title: "Chi tiêu mỗi tháng",
      body: "Mọi hóa đơn và ngân sách gộp thành một con số mỗi tháng, chia ra hóa đơn, ngân sách và mức chi mỗi ngày. Thanh màu so chi thiết yếu và chi mong muốn với thu nhập, phần còn lại là tiết kiệm.",
      tip: "Quy tắc phổ biến: 50% thiết yếu, 30% mong muốn, 20% tiết kiệm.",
    },
    spendingByCategory: {
      title: "Theo danh mục",
      body: "Tiền chi mỗi tháng đi đâu, danh mục lớn nhất trước, tính theo phần trăm tổng các khoản đã liệt kê.",
    },
    planVsActual: {
      title: "Kế hoạch so với thực tế",
      body: "Sáu tháng gần nhất: số dự kiến so với số thực sự đã trả và đã chi. Mức trung bình chỉ tính các tháng đã qua và được ghi gần đủ. Lệch dưới 3% là đúng kế hoạch, và các hóa đơn lệch từ 10% trở lên được liệt kê.",
      tip: "Hóa đơn luôn cao hơn dự kiến? Sửa số tiền của nó để kế hoạch tháng sau sát hơn.",
    },
    incomeActive: {
      title: "Thu nhập chủ động",
      body: "Tiền bạn làm ra, như lương hay việc tự do: mỗi tháng nhận bao nhiêu, vào ngày nào và vào tài khoản nào.",
    },
    incomePassive: {
      title: "Thu nhập thụ động",
      body: "Tiền do tài sản sinh ra, như lãi tiết kiệm, tiền thuê hay cổ tức. Lợi suất là thu nhập cả năm chia cho số vốn dành ra để tạo khoản thu đó.",
    },
    historyThisMonth: {
      title: "Tháng này",
      body: "Tổng đã ghi tới nay trong tháng, tính từ các khoản thực tế chứ không phải kế hoạch.",
    },
    historyAverage: {
      title: "Trung bình mỗi tháng",
      body: "Trung bình của tối đa sáu tháng gần nhất đã qua và có ghi chép, một mốc thực tế cho biết mỗi tháng tốn (hoặc thu) bao nhiêu.",
    },
    historyTop: {
      title: "Danh mục lớn nhất",
      body: "Danh mục (hoặc nguồn thu) có tổng lớn nhất trong những tháng đó và tháng này.",
    },
    wealthAssets: {
      title: "Tài sản",
      body: "Mọi thứ bạn sở hữu theo giá trị hôm nay: tài khoản, tiết kiệm, đầu tư, nhà đất, vàng và các tài sản khác.",
    },
    wealthDebts: {
      title: "Khoản nợ",
      body: "Số tiền bạn còn nợ ở các khoản vay và thẻ tín dụng.",
    },
    wealthNetWorth: {
      title: "Tài sản ròng",
      body: "Tài sản trừ khoản nợ. Dòng bên dưới là nợ so với tài sản; dưới 30% là thoải mái.",
    },
    assetInstant: {
      title: "Dùng ngay",
      body: "Tiền dùng được ngay: tài khoản tiền mặt và các tài sản đánh dấu “Dùng ngay”. Quỹ dự phòng được tính từ phần này.",
    },
    assetNotInstant: {
      title: "Không dùng ngay",
      body: "Những gì cần thời gian mới thành tiền mặt: nhà đất, đầu tư và tài sản đánh dấu “Không dùng ngay”.",
    },
    assetsByCategory: {
      title: "Theo danh mục",
      body: "Tài sản gom theo danh mục, lớn nhất trước, để bạn thấy chúng được phân tán thế nào.",
    },
    debtAvgRate: {
      title: "Lãi suất trung bình",
      body: "Lãi suất trung bình theo dư nợ, khoản nợ lớn hơn có trọng số lớn hơn.",
    },
    debtInterest: {
      title: "Tiền lãi mỗi tháng",
      body: "Tiền lãi phát sinh mỗi tháng: dư nợ của từng khoản × lãi suất năm ÷ 12, cộng lại.",
    },
    debtMonthly: {
      title: "Trả nợ mỗi tháng",
      body: "Tổng số tiền phải trả mỗi tháng cho các khoản còn dư nợ.",
    },
    debtPriority: {
      title: "Nên trả trước",
      body: "Trả thêm vào khoản lãi cao nhất trước giúp tiết kiệm nhiều tiền lãi nhất. Phần này chỉ ra khoản đó, và bạn tiết kiệm được bao nhiêu tiền lãi và thời gian nếu trả thêm một ít mỗi tháng.",
    },
    debtList: {
      title: "Tất cả khoản nợ",
      body: "Dư nợ, lãi suất và số tiền trả hằng tháng của từng khoản. Gắn khoản nợ với một hóa đơn để khoản trả hiện trong chi tiêu hằng tháng.",
    },
    loansOwedToYou: {
      title: "Người khác nợ bạn",
      body: "Tiền bạn cho người khác vay mà chưa được trả.",
    },
    loansYouOwe: {
      title: "Bạn nợ người khác",
      body: "Tiền bạn vay của người khác mà chưa trả.",
    },
    loansNet: {
      title: "Chênh lệch",
      body: "Số người khác nợ bạn trừ số bạn nợ người khác.",
      tip: "Bật Cài đặt → Cách tính để tính các khoản này vào tài sản ròng.",
    },
    loanLog: {
      title: "Sổ cho vay",
      body: "Mọi khoản cho vay, đi vay với ai, bao nhiêu, khi nào. Đánh dấu đã xong khi khoản đó được trả.",
    },
    planList: {
      title: "Các kế hoạch",
      body: "Mọi kế hoạch mục tiêu kèm tiến độ và trạng thái. Chọn một kế hoạch để xem và chỉnh sửa.",
    },
    planHero: {
      title: "Đã dành ra",
      body: "Số tiền đã dành cho mục tiêu này so với mục tiêu, kèm một câu cho biết kế hoạch đang tiến tới đâu.",
    },
    planProjected: {
      title: "Dự kiến vào ngày đến hạn",
      body: "Kế hoạch dự kiến có bao nhiêu vào ngày đến hạn: số tiền đã dành ra cộng khoản góp mỗi tháng, tăng trưởng theo lợi nhuận kỳ vọng của kế hoạch.",
    },
    planMonthly: {
      title: "Góp mỗi tháng",
      body: "Phần của kế hoạch trong số tiền còn lại mỗi tháng (thu nhập trừ chi tiêu). Phần bạn tự đặt được giữ nguyên; phần còn lại chia đều cho các kế hoạch có dùng thu nhập hằng tháng.",
    },
    planTimeLeft: {
      title: "Thời gian còn lại",
      body: "Còn bao lâu tới ngày đến hạn của kế hoạch.",
    },
    projection: {
      title: "Dự phóng",
      body: "Kế hoạch qua từng tháng: số dư đang hướng tới, đường mục tiêu, và các khoản phải trả theo mốc cộng dồn theo thời gian. Khi đường số dư nằm trên đường mục tiêu, kế hoạch khả thi.",
    },
    startingBalances: {
      title: "Số dư ban đầu",
      body: "Số tiền đã dành ra, lấy từ các tài sản đang theo dõi hoặc tự nhập. Một nguồn có thể chia cho nhiều kế hoạch nhưng không vượt quá giá trị của nó. Nguồn “Dồn hết” luôn tính toàn bộ phần còn trống và tự theo giá trị của nguồn.",
      tip: "Nếu một nguồn mất giá, phần của mọi kế hoạch từ nguồn đó giảm theo tỷ lệ.",
    },
    checkpoints: {
      title: "Các khoản theo mốc",
      body: "Những khoản phải trả vào ngày định sẵn, như tiền góp hay tiền đặt cọc. Biểu đồ cộng dồn chúng, để bạn thấy kế hoạch luôn đi trước số phải trả.",
    },
    fundingInstant: {
      title: "Tiền dùng ngay còn trống",
      body: "Tiền dùng được ngay chưa dành cho kế hoạch nào.",
    },
    fundingNotInstant: {
      title: "Tài sản khác còn trống",
      body: "Nhà đất, đầu tư và các tài sản không dùng ngay chưa dành cho kế hoạch nào.",
    },
    fundingCustom: {
      title: "Số tiền tự nhập",
      body: "Số dư ban đầu nhập tay trên các kế hoạch, không lấy từ tài sản đang theo dõi.",
    },
    fundingPlans: {
      title: "Phần chia mỗi tháng",
      body: "Phần của mỗi kế hoạch trong số tiền còn lại mỗi tháng, và con số đó tính ra tiền.",
    },
    fundingMatrix: {
      title: "Nguồn và kế hoạch",
      body: "Với từng nguồn: mỗi kế hoạch đã dành bao nhiêu, tổng cộng, giá trị hôm nay, và phần còn trống.",
    },
    settingsCurrency: {
      title: "Tiền tệ và tỷ giá",
      body: "Hiển thị số tiền bằng đồng hoặc đô la. Tỷ giá đô la lấy từ Vietcombank và giá vàng từ PNJ (hoặc số của bạn), dùng để định giá tài sản bằng đô la hoặc vàng.",
    },
    settingsMilestone: {
      title: "Mục tiêu cột mốc",
      body: "Ngày sinh, mục tiêu bằng đô la và độ tuổi muốn đạt, dùng cho thẻ cột mốc ở trang tổng quan.",
    },
    settingsCalculation: {
      title: "Cách tính",
      body: "Chọn có tính tiền cho vay hoặc đi vay người quen vào tài sản ròng hay không.",
    },
    settingsData: {
      title: "Dữ liệu của bạn",
      body: "Sao lưu mọi thứ ra tệp, khôi phục từ tệp, hoặc xuất chi tiêu ra CSV.",
    },
    activityLog: {
      title: "Nhật ký thay đổi",
      body: "Mọi thay đổi đã lưu vào tài khoản, mới nhất trước: đổi gì, khi nào, giá trị trước và sau. Bản thân các khoản chi và thu nằm ở mục Lịch sử.",
    },
    connectWebhook: {
      title: "Webhook ngân hàng",
      body: "Một dịch vụ như SePay, Casso (hoặc script của bạn) gửi từng giao dịch ngân hàng tới địa chỉ webhook bằng một khoá của bạn. Lần tới mở ứng dụng, giao dịch sẽ vào Lịch sử; tiền ra được tính vào ngân sách duy nhất cùng danh mục, nếu không thì là chi ngoài kế hoạch.",
      tip: "Xoá một giao dịch ngân hàng trong Lịch sử thì nó sẽ không quay lại, kể cả khi ngân hàng gửi lại.",
    },
    connectShares: {
      title: "Báo cáo chia sẻ",
      body: "Mỗi đường dẫn là một bản chụp cố định của khoảng thời gian và các phần bạn chọn, được mã hoá bằng mật khẩu riêng. Chỉ người có cả hai mới mở được, và xoá đường dẫn là nó ngừng hoạt động ngay.",
      tip: "Gửi đường dẫn và mật khẩu qua hai ứng dụng khác nhau.",
    },
  },
};
