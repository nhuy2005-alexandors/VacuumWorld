# Checkpoint — Vacuum World

_Last updated: 2026-07-12_

## Done
- **Solver JS thuần** (`web/solver.js`): BFS, DFS, IDS, A*(h1/h2). Trả về cây duyệt (node + parentId + state + g). Self-test Node khớp C tham chiếu 100% (BFS 375, DFS 24, IDS 4508128, A*h1 361, A*h2 232).
- **Web demo** (`web/index.html` + `app.js` + `styles.css`): lưới 5×5, bảng số liệu, biểu đồ Expanded (log) + PeakFrontier (Chart.js), cây duyệt (vis-network), replay robot. Dark mode kỹ thuật theo `docs/design-principles.md`.
- **IDS qua Web Worker** (`web/ids-worker.js`) — chạy ~6–9s không block UI.
- **Cây duyệt — nhãn node 3 dòng** (theo yêu cầu, giống hình DFS mẫu): `web/app.js:162` `stateRepr()` + `web/app.js:199-203`. Dòng 1 `#thứ-tự hành-động`, dòng 2 trạng thái `R@ô · bẩn{...}`, dòng 3 `g=` (BFS/DFS/IDS) hoặc `f= g= h=` (A*). Nới `levelSeparation` 70→110, `nodeSpacing` 90→130 cho node 3 dòng.
- **`order` = thứ tự MỞ RỘNG (duyệt)** — khác `id` (thứ tự sinh). Set khi node bị lấy khỏi frontier: BFS `solver.js:115`, DFS `solver.js:151`, A* `solver.js:281` (sau lazy-delete), IDS `solver.js:203` (reset mỗi vòng limit). Metrics vẫn khớp C 100%.
- **Cây vẽ TẤT CẢ node ĐƯỢC SINH** (`web/app.js:168` `drawTree`, theo yêu cầu user chỉnh lại): lấy `tree[0..cap]` (open+closed) + luôn giữ đường lời giải + cha. Node đã duyệt ghi `#order` (nền đặc, viền liền); node frontier (`order==null`, chưa duyệt) ghi `·` (viền đứt, mờ) — frontier không có con trong `tree[]` nên tự thành lá, KHÔNG vẽ tiếp con của nó (đúng yêu cầu). Path xanh; goal xanh lá. Hệ quả: cây rộng (BFS branching ≤5) — dãy lá đáy = frontier. Node bất khả thi (đụng tường/Suck ô sạch) không tồn tại vì `applyAction` trả `null` (`solver.js:121`). Input `#tree-cap` mặc định 300.

- **Random / Bản đồ gốc** (`web/app.js` `randomStartState` solver + `currentStart`/`setStart` + nút `btn-random`/`btn-reset-map`): khởi tạo giữ bản đồ gốc (`initialState`, khớp ref), Random đổi robot+4 ô bẩn ngẫu nhiên. `setStart` xóa `results.IDS` cũ (lệch map), chạy lại BFS/DFS/A* + vẽ lại. Worker nhận `start` (`ids-worker.js:8`).
- **Lưới đổi 5×5 → 4×3** (`solver.js:20` `W=4,H=3`, ô bẩn `[3,5,8,11]`). C_REF + assert tính từ solver JS (không còn hardcode 20/24). Self-test Node pass 100%. HTML: heading, bảng thông số (12 ô, 12×2⁴=192), 2 SVG viewBox 200×150, verify() dùng C_REF.
- **BFS early goal-test (khớp AIMA Fig 3.11)** (`solver.js:112`): test goal khi SINH con (+ test root lúc tạo) thay vì lúc lấy khỏi frontier. Expanded giảm 173→153. C_REF hiện tại: BFS 13/153, DFS 18/24, IDS 13/14256, A*h1 13/137, A*h2 13/106. Hệ quả: goal node tìm lúc sinh con nên `order==null` → cây vẫn tô xanh-goal nhưng viền đứt (không phải lỗi).
- **Đổi biểu diễn `dirt` từ bitmask sang array** (`solver.js`, `vacuum.c`, `app.js`): `dirt: int[k]` (k=4), slot cố định — `dirt[i]` = vị trí ô bẩn thứ i hoặc `-1` nếu đã hút. Không splice/dời slot (giữ `stateKey` nhất quán). JS: `initialState()` clone `[...DIRTY_CELLS]` (tránh alias với hằng số module), `applyAction` SUCK clone mảng trước khi sửa (`nd = [...s.dirt]`), di chuyển thì dùng lại `s.dirt` (không đổi, an toàn share). C: struct `State{robot,dirt[NDIRTY]}`, gán struct = deep-copy mảng cố định nên không có rủi ro alias như JS. `state_key` pack robot+dirt thành uint64 (mask 0xFF/slot, `-1`→`0xFF`, tránh sign-extension bug). Self-test Node + C build lại đều pass 100%, DFS/IDS/A*h1/A*h2 khớp tuyệt đối C-JS (24/24, 14256/14256, 137/137, 106/106); BFS vẫn lệch 173(C)/153(JS) do khác goal-test timing (đã biết, không phải do đổi array). UI (`app.js` `drawGrid`, `stateRepr`) đổi sang `dirt.includes()`/`.filter()`. Cập nhật `docs/specs/solver.md` + `Bao_Cao_Vacuum_World.md` theo biểu diễn mới.

## In progress
- (không có — self-test pass)

## Next
- (tùy chọn) Viết `docs/technical_specs/web-demo.md` as-built nếu cần nộp.

## Gotcha mới
- ES module `./solver.js` cache rất lì trong trình duyệt: sau khi đổi config, Ctrl+F5 thường vẫn nạp bản cũ. Phải F12 → Network → Disable cache → Ctrl+Shift+R. Triệu chứng: lưới hiện nhãn bước-5 (0,1,2,3/5,6,7,8) = solver 5×5 cũ.

## Gotchas hit
- `agent-browser click` KHÔNG kích được handler nút IDS (artifact công cụ test); phải dùng `.click()` in-page. Logic app không hề lỗi.
- Xem thêm `docs/GOTCHAS.md`.

See also: DECISIONS.md (decisions), GOTCHAS.md (pitfalls), specs/ (design), technical_specs/ (as-built).
