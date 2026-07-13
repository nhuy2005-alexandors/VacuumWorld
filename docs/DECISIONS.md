# Decisions (ADR) — Vacuum World

Architectural decisions + REASONING. Cumulative, never deleted.

## ADR-001: Biến thể lưới N×M, quan sát đầy đủ + xác định
- **Date**: 2026-07-10
- **Context**: Đề cho phép nhiều biến thể Vacuum World (2 ô cổ điển vs lưới, quan sát đầy đủ vs mù).
- **Decision**: Lưới 2D N×M, nhiều ô bẩn, môi trường xác định + quan sát đầy đủ.
- **Reasoning**: Lưới lớn làm nổi bật khác biệt số node mở rộng giữa các giải thuật (mù vs A*), phục vụ phần so sánh mà đề chấm nặng. Bản 2 ô quá nhỏ, khác biệt không rõ.
- **Trade-offs**: Không vẽ được full state-space graph như bản 2 ô (8 trạng thái). "Mù/informed" trong đề nói về THUẬT TOÁN, không phải môi trường.

## ADR-002: Bộ giải thuật BFS, DFS, IDS, A*
- **Date**: 2026-07-10
- **Context**: Đề yêu cầu cả tìm kiếm mù lẫn có thông tin + so sánh ưu/khuyết.
- **Decision**: Mù = BFS, DFS, IDS. Có thông tin = A* (chính). Bỏ UCS và Greedy khỏi bộ chính.
- **Reasoning**: Cost mọi hành động = 1 → UCS trùng BFS, không thêm ý nghĩa. Greedy chỉ để minh họa "thiếu g(n) thì không tối ưu", không cần chạy benchmark chính. Bộ 4 đủ so sánh: tối ưu vs không, tốn RAM vs ít RAM, mù vs có định hướng.
- **Trade-offs**: Không "đủ bộ sách giáo khoa". Thêm lại UCS/Greedy/IDA* dễ nếu cần.

## ADR-003: Thuật toán viết JS thuần
- **Date**: 2026-07-10
- **Context**: Đầu ra là web demo (làm sau). Cần test solver ở giai đoạn dev.
- **Decision**: Viết solver bằng JavaScript thuần, không phụ thuộc thư viện. Test bằng Node (v22 sẵn có), ghép vào web sau không sửa gì.
- **Reasoning**: Viết một lần, dùng hai nơi (Node + trình duyệt). Web không cần server. Solver trả về cây duyệt để phần vẽ cây dùng lại.
- **Trade-offs**: Không dùng thư viện heap/PQ có sẵn của ngôn ngữ khác → tự viết priority queue cho A*.

## ADR-004: Kèm bản lưới nhỏ để phân tích không gian trạng thái
- **Date**: 2026-07-10
- **Context**: Đề có 3 vế; vế 1 "phân tích không gian trạng thái" đòi phân tích đầy đủ, không chỉ chạy giải thuật. Bản lưới lớn (để benchmark) quá to để vẽ trọn state-space graph.
- **Decision**: Hỗ trợ 2 cấu hình: (a) bản NHỎ 2×2 để vẽ trọn state-space graph + minh họa công thức n×2^n; (b) bản lớn N×M để benchmark so sánh giải thuật. Báo cáo nói rõ: xuất phát từ bản 2 ô của Russell & Norvig (AIMA), mở rộng lên lưới N×M.
- **Reasoning**: Vế 1 cần phân tích KGTT (công thức n×2^n, branching factor ≤ 5, ví dụ số, đồ thị trạng thái). Bản nhỏ vẽ được hết; bản lớn cho so sánh có ý nghĩa. Solver JS thuần chạy được cả hai không sửa gì.
- **Trade-offs**: Thêm việc chuẩn bị 2 cấu hình. Đổi lại khớp đủ cả 3 vế đề.

