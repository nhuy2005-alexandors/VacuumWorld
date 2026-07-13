# Design Principles — Vacuum World web

Gu đã chốt: **dark mode kỹ thuật** (terminal/hacker), hợp trình chiếu + chụp báo cáo.

## Màu
- Nền: `#0d1117` (gần đen, kiểu GitHub dark). Panel: `#161b22`. Viền: `#30363d`.
- Chữ chính: `#e6edf3`. Chữ mờ (nhãn phụ): `#8b949e`.
- Nhấn chính (accent): cyan `#39d0d8`. Nhấn phụ / cảnh báo: xanh lá `#3fb950`, cam `#d29922`.
- Màu phân biệt 4 giải thuật (dùng cho biểu đồ + cây):
  - BFS = `#58a6ff` (xanh dương) · DFS = `#d29922` (cam) · IDS = `#bc8cff` (tím) · A\* = `#3fb950` (xanh lá).
- Ô bẩn = `#d29922`, ô sạch = nền, robot = cyan `#39d0d8`.

## Font
- Toàn bộ dùng **monospace** hệ thống: `ui-monospace, "Cascadia Code", "Consolas", monospace`. Đúng chất terminal, khỏi tải web-font.

## Nguyên tắc
- Không gradient loè loẹt, không đổ bóng nặng. Viền mảnh 1px + nền phẳng.
- Số liệu (metrics) canh phải, monospace → cột thẳng hàng như bảng terminal.
- Animation nhẹ (highlight node đang mở, robot di chuyển) — mượt nhưng không phô.
- Không dùng thư viện UI/chart nặng: **SVG thuần + CSS**. Mở file HTML là chạy, không build step.

## ponytail
Vanilla JS + SVG, không framework, không bundler. Lý do: đề chỉ cần demo + chụp hình, thêm React/d3/Chart.js là gánh nặng vô ích cho một trang tĩnh.
