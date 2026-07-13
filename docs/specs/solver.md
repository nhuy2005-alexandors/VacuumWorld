# Spec — Solver (Vacuum World)

## Goal
Giải bài Vacuum World lưới N×M bằng 4 giải thuật (BFS, DFS, IDS, A\*), trả về lời giải + cây duyệt + số liệu để so sánh mù vs có thông tin. JS thuần, chạy được Node và trình duyệt.

## Không gian trạng thái
- **State**: `{ robot: int, dirt: int[k] }` — `robot` = ô hiện tại (0-index, `row*W+col`); `dirt` = mảng CỐ ĐỊNH k slot, `dirt[i]` = vị trí ô bẩn thứ i hoặc `-1` nếu đã hút sạch. Slot không splice/đổi vị trí (để `stateKey` nhất quán dù lịch sử hút khác nhau). Key hash: `` `${robot},${dirt.join(",")}` ``.
- **Initial**: robot ở ô cho trước, `dirt` clone từ danh sách ô bẩn cho trước (không share reference với hằng số module — tránh alias mutate).
- **Actions**: `Up, Down, Left, Right, Suck`. Cost mỗi bước = 1.
- **Transition**:
  - Di chuyển ra ngoài lưới → không hợp lệ (không sinh node).
  - `Suck`: nếu `dirt.indexOf(robot) !== -1` → clone mảng, set slot đó = `-1`. Nếu robot đang ở ô sạch (không tìm thấy trong `dirt`) → không hợp lệ (không sinh node).
- **Goal test**: mọi slot `dirt[i] === -1`.
- **Kích thước KGTT**: `n × 2^k` với n = số ô, k = số ô bẩn ban đầu. Ví dụ 5×5, k=4 → 25 × 2⁴ = 400. Branching factor ≤ 5.

## Requirements
- [ ] Model KGTT: `initialState`, `actions(state)`, `result(state, action)`, `isGoal(state)`, `stateKey(state)`.
- [ ] BFS — hàng đợi FIFO, graph-search (đóng node đã thăm).
- [ ] DFS — stack LIFO, graph-search, có giới hạn độ sâu để tránh lặp vô hạn trên đồ thị.
- [ ] IDS — lặp DFS giới hạn sâu tăng dần 0,1,2,…
- [ ] A\* — priority queue theo `f = g + h`, graph-search, 2 heuristic chọn được.
- [ ] Heuristic 1: `h = số ô bẩn` (admissible, consistent).
- [ ] Heuristic 2: `h = số ô bẩn + Manhattan tới ô bẩn gần nhất` (admissible, consistent).
- [ ] Mỗi solver trả về `{ solution, tree, metrics }`:
  - `solution`: mảng action (null nếu vô nghiệm).
  - `tree`: cây duyệt — mỗi node `{ state, parent, action, g }` để web vẽ.
  - `metrics`: `{ nodesExpanded, solutionLength, peakFrontier, timeMs }`.
- [ ] Self-check: `demo()` / `__main__` assert BFS và A\* ra cùng độ dài lời giải (đều tối ưu) trên 1 bản test cố định.

## Constraints
- JS thuần ES modules, không thư viện ngoài.
- Priority queue tự viết (binary heap nhỏ) — stdlib JS không có. `// ponytail: binary heap tay, đủ cho lưới đồ án; thay bằng lib nếu scale lớn`.
- Có giới hạn an toàn (max nodes) để không treo khi KGTT nổ.

## Decisions
- Graph-search (đóng node) cho cả 4, vì KGTT có chu trình (đi qua lại giữa các ô).
- 2 heuristic đều admissible + consistent → graph-search A\* vẫn tối ưu, không cần mở lại node.
- Cost đều = 1 → BFS đã tối ưu, không cần UCS (ADR-002).

## Out of scope
- Web UI (làm sau, solver trả `tree` sẵn để vẽ).
- Bản mù/sensorless (belief-state) — ADR-001 đã bỏ.
- Cost không đều / ô khó hút.
