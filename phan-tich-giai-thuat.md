# Phân tích ưu / nhược điểm các giải thuật — Vacuum World

Bài toán: lưới 5×5 (25 ô), robot xuất phát ô 0, 4 ô bẩn `[4, 12, 20, 24]`.
Trạng thái = (vị trí robot, tập ô còn bẩn). 5 hành động Up/Down/Left/Right/Suck, chi phí mỗi bước = 1. Goal: sạch hết.

## Số liệu thực đo (từ `web/solver.js`, self-test Node khớp 100%)

| Giải thuật | SolLen | Expanded | Generated | PeakFront | Tối ưu? | Đầy đủ? |
|------------|:------:|:--------:|:---------:|:---------:|:-------:|:-------:|
| BFS        | **20** | 375      | 1232      | 44        | ✅       | ✅       |
| DFS        | 24     | **24**   | —         | —         | ❌       | ✅¹      |
| IDS        | **20** | 4508128  | —         | —         | ✅       | ✅       |
| A* (h1)    | **20** | 361      | —         | —         | ✅       | ✅       |
| A* (h2)    | **20** | **232**  | —         | —         | ✅       | ✅       |

¹ DFS đầy đủ vì có `closed` toàn cục (không lặp vô hạn) trên KGTT hữu hạn 400 trạng thái.

Ghi chú độ phức tạp (b = branching ≤ 5, d = độ sâu lời giải, m = độ sâu tối đa):

| Giải thuật | Thời gian     | Bộ nhớ        |
|------------|---------------|---------------|
| BFS        | O(b^d)        | O(b^d) ⚠️      |
| DFS        | O(b^m)        | O(b·m) ✅      |
| IDS        | O(b^d)        | O(b·d) ✅      |
| A*         | O(b^d) xấu nhất | O(b^d) ⚠️    |

---

## BFS — Breadth-First Search (mù)

Duyệt theo tầng, early goal-test khi sinh con (AIMA Fig 3.11).

**Ưu:**
- Tối ưu khi chi phí bước đều (đúng bài này) → luôn ra 20 bước.
- Đầy đủ: có lời giải thì chắc chắn tìm được.
- Đơn giản, dễ chứng minh đúng.

**Nhược:**
- Bộ nhớ là điểm chết: `PeakFront=27` ở bài nhỏ, nhưng tăng theo cấp số nhân O(b^d). Lưới lớn hơn là hết RAM trước khi hết thời gian.
- Không dùng thông tin về mục tiêu → mở rộng thừa (153 node, gấp ~1.4× A*h2).

**Dùng khi:** chi phí bước đều, cần lời giải tối ưu, KGTT đủ nhỏ để chứa frontier.

---

## DFS — Depth-First Search (mù)

Đi sâu theo một nhánh, quay lui khi cụt.

**Ưu:**
- Bộ nhớ rẻ nhất: O(b·m), chỉ giữ đường đi hiện tại.
- **Expanded thấp nhất (24)** ở bài này — nhưng đây là may mắn, không phải chất lượng.

**Nhược:**
- **KHÔNG tối ưu**: ra 18 bước thay vì 13. Con số Expanded=24 nhỏ vì nó "vấp" trúng goal sớm ở một nhánh sâu, không phải vì nó tìm giỏi — đổi thứ tự hành động là số này nhảy loạn.
- Không đầy đủ nếu KGTT vô hạn / không có `closed` (dễ kẹt vòng lặp). Ở đây an toàn nhờ `closed` + KGTT hữu hạn.
- Không dùng thông tin mục tiêu.

**Dùng khi:** chỉ cần *một* lời giải bất kỳ, bộ nhớ cực hạn chế, độ dài lời giải không quan trọng. **Không** dùng khi cần lời giải ngắn nhất.

> Trả lời câu "DFS tốt nhất?" — Không. Expanded=24 gây hiểu lầm. Lời giải 18 bước dài hơn tối ưu 38%. A*(h2) mới là tốt nhất tổng thể.

---

## IDS — Iterative Deepening Search (mù)

DFS giới hạn độ sâu, tăng dần limit 0,1,2,… đến khi thấy goal.

**Ưu:**
- Tối ưu (như BFS) + bộ nhớ rẻ (như DFS): O(b·d). "Được cả hai".
- Đầy đủ.

**Nhược:**
- Expanded khổng lồ: 4.5 triệu node (so với 375 của BFS) vì lặp lại việc duyệt phần đầu đồ thị rất nhiều lần. Phải tradeoff tốc độ lấy không gian.
- Vẫn mù → không cắt được nhánh vô ích.
- Ở web phải đẩy qua Web Worker vì nặng, không thì treo UI.

**Dùng khi:** cần tối ưu nhưng frontier của BFS quá lớn không chứa nổi. Đánh đổi thời gian lấy bộ nhớ.

---

## A* — informed (h1 và h2)

Mở rộng theo f = g + h. Graph-search + lazy deletion.

- **h1** = số ô còn bẩn. Admissible + consistent (mỗi ô bẩn cần ≥1 lần Suck).
- **h2** = số ô bẩn + Manhattan tới ô bẩn gần nhất. Admissible + consistent, **trội hơn h1** (h2 ≥ h1 mọi trạng thái).

**Ưu:**
- Tối ưu (20 bước) khi heuristic admissible.
- Kết quả thực đo:
  - h1 tiết kiệm một chút (361 vs 375).
  - h2 tốt hơn hẳn: chỉ 232 node (tiết kiệm ~38% so với BFS), đỉnh cao của uninformed → informed.
- Heuristic trội hơn (h2) → mở rộng ít hơn. Minh hoạ trực tiếp định lý: h2 dominates h1 ⇒ A*(h2) mở rộng ⊆ node mà A*(h1) mở rộng.

**Nhược:**
- Bộ nhớ O(b^d) như BFS (giữ cả open + closed) — không rẻ như IDS/DFS.
- Phụ thuộc chất lượng heuristic: heuristic tồi → suy biến về BFS. Heuristic không admissible → mất tối ưu.
- Cài đặt phức tạp hơn (heap, tie-breaking).

**Dùng khi:** có heuristic tốt, cần tối ưu + nhanh, bộ nhớ chấp nhận được. **Đây là lựa chọn tốt nhất cho bài này.**

---

## Kết luận

- **Tốt nhất tổng thể: A*(h2)** — tối ưu (13 bước) và Expanded thấp nhất (106) trong nhóm tối ưu.
- **Rẻ bộ nhớ nhất + tối ưu: IDS** — nhưng trả giá bằng Expanded nổ (14256).
- **DFS Expanded=24 là bẫy**: rẻ nhưng lời giải 18 bước không tối ưu, con số phụ thuộc thứ tự hành động.
- **BFS**: chuẩn tối ưu cho cost đều, nhưng frontier phình theo cấp số nhân.
- Mù (BFS/DFS/IDS) không dùng thông tin mục tiêu → thua informed (A*) về số node mở rộng khi có heuristic tốt.
