// app.js — wiring UI cho Vacuum World.
// Phan A: luoi 5x5 + cay duyet (vis-network). Phan B: bang so lieu + bieu do (Chart.js) + replay.
// IDS chay trong Web Worker (ids-worker.js) de khong block UI.

import {
  W, H, NCELL, DIRTY_CELLS, START_CELL, ACTION_NAME, C_REF,
  initialState, randomStartState, applyAction, statesAlongSolution,
  bfs, dfs, astar, h1, h2,
} from "./solver.js";

// Mau theo docs/design-principles.md
const COLOR = {
  bg: "#0d1117", panel: "#161b22", border: "#30363d",
  text: "#e6edf3", muted: "#8b949e",
  cyan: "#39d0d8", green: "#3fb950", orange: "#d29922",
  BFS: "#58a6ff", DFS: "#d29922", IDS: "#bc8cff", "A*h1": "#3fb950", "A*h2": "#3fb950", "A*": "#3fb950",
};
const ALGOS = ["BFS", "DFS", "IDS", "A*h1", "A*h2"];

// Ket qua moi giai thuat: {solution, tree, goalId, metrics}. IDS lay tu worker.
const results = {};

// Ban do khoi tao hien tai. Mac dinh = ban do goc (khop C). Nut "Random" doi sang ban do ngau nhien.
let currentStart = initialState();

// ---------- Luoi SVG (dung cho ca grid tinh lan replay) ----------
const CELL = 50; // 250/5
function drawGrid(svg, state) {
  const ns = "http://www.w3.org/2000/svg";
  svg.textContent = "";
  for (let cell = 0; cell < NCELL; cell++) {
    const r = (cell / W) | 0, c = cell % W;
    const dirty = state.dirt.includes(cell);
    const isRobot = cell === state.robot;

    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("x", c * CELL + 1); rect.setAttribute("y", r * CELL + 1);
    rect.setAttribute("width", CELL - 2); rect.setAttribute("height", CELL - 2);
    rect.setAttribute("rx", 4);
    rect.setAttribute("fill", dirty ? COLOR.orange : COLOR.panel);
    rect.setAttribute("fill-opacity", dirty ? "0.35" : "1");
    rect.setAttribute("stroke", COLOR.border);
    svg.appendChild(rect);

    if (dirty) {
      const t = document.createElementNS(ns, "text");
      t.setAttribute("x", c * CELL + CELL / 2); t.setAttribute("y", r * CELL + CELL / 2 + 5);
      t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", COLOR.orange);
      t.setAttribute("font-size", "20"); t.textContent = "*";
      svg.appendChild(t);
    }
    if (isRobot) {
      const circ = document.createElementNS(ns, "circle");
      circ.setAttribute("cx", c * CELL + CELL / 2); circ.setAttribute("cy", r * CELL + CELL / 2);
      circ.setAttribute("r", 14);
      circ.setAttribute("fill", COLOR.cyan); circ.setAttribute("fill-opacity", "0.25");
      circ.setAttribute("stroke", COLOR.cyan); circ.setAttribute("stroke-width", "2");
      svg.appendChild(circ);
      const t = document.createElementNS(ns, "text");
      t.setAttribute("x", c * CELL + CELL / 2); t.setAttribute("y", r * CELL + CELL / 2 + 5);
      t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", COLOR.cyan);
      t.setAttribute("font-size", "16"); t.setAttribute("font-weight", "bold"); t.textContent = "R";
      svg.appendChild(t);
    }
    // nhan so o (goc tren-trai) cho de doi chieu
    const lab = document.createElementNS(ns, "text");
    lab.setAttribute("x", c * CELL + 5); lab.setAttribute("y", r * CELL + 14);
    lab.setAttribute("fill", COLOR.muted); lab.setAttribute("font-size", "9");
    lab.textContent = cell;
    svg.appendChild(lab);
  }
}

// ---------- Chay cac giai thuat nhanh (khong IDS) ----------
function runFast() {
  const start = currentStart;
  results.BFS = bfs(start);
  results.DFS = dfs(start);
  results["A*h1"] = astar(start, h1);
  results["A*h2"] = astar(start, h2);
  renderTable();
  renderCharts();
}

// ---------- Bang so lieu ----------
function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e4) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}
function renderTable() {
  const body = document.getElementById("cmp-body");
  body.textContent = "";
  for (const algo of ALGOS) {
    const r = results[algo];
    const tr = document.createElement("tr");
    tr.style.borderLeft = `3px solid ${COLOR[algo] || COLOR.text}`;
    if (!r) {
      tr.innerHTML = `<td>${algo}</td><td class="num" colspan="5">— chưa chạy —</td>`;
    } else {
      const m = r.metrics;
      tr.innerHTML =
        `<td>${algo}</td>` +
        `<td class="num">${m.solutionLength}</td>` +
        `<td class="num" title="${m.nodesExpanded}">${fmtNum(m.nodesExpanded)}</td>` +
        `<td class="num" title="${m.generated}">${fmtNum(m.generated)}</td>` +
        `<td class="num">${m.peakFrontier}</td>` +
        `<td class="num">${m.timeMs.toFixed(2)}</td>`;
    }
    body.appendChild(tr);
  }
}

// ---------- Bieu do (Chart.js) ----------
let chartExpanded = null, chartPeak = null;
function renderCharts() {
  const labels = ALGOS;
  const colors = ALGOS.map(a => COLOR[a] || COLOR.text);
  const expData = ALGOS.map(a => results[a] ? results[a].metrics.nodesExpanded : 0);
  const peakData = ALGOS.map(a => results[a] ? results[a].metrics.peakFrontier : 0);

  const common = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: COLOR.muted, font: { family: "monospace" } }, grid: { color: COLOR.border } },
      y: { ticks: { color: COLOR.muted, font: { family: "monospace" } }, grid: { color: COLOR.border } },
    },
  };

  if (chartExpanded) chartExpanded.destroy();
  chartExpanded = new Chart(document.getElementById("chart-expanded"), {
    type: "bar",
    data: { labels, datasets: [{ data: expData, backgroundColor: colors }] },
    options: {
      ...common,
      scales: {
        ...common.scales,
        y: { ...common.scales.y, type: "logarithmic",
             title: { display: true, text: "Expanded (log)", color: COLOR.muted } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => "Expanded: " + ctx.parsed.y.toLocaleString() } },
      },
    },
  });

  if (chartPeak) chartPeak.destroy();
  chartPeak = new Chart(document.getElementById("chart-peak"), {
    type: "bar",
    data: { labels, datasets: [{ data: peakData, backgroundColor: colors }] },
    options: {
      ...common,
      scales: { ...common.scales,
        y: { ...common.scales.y, title: { display: true, text: "PeakFrontier", color: COLOR.muted } } },
      plugins: { legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => "PeakFront: " + ctx.parsed.y.toLocaleString() } } },
    },
  });
}

// ---------- Cay duyet (vis-network) ----------
// Trang thai gon cho nhan node: "R@6 · bẩn{4,20}" (hoac "sạch" khi het ban).
function stateRepr(s) {
  const dirty = s.dirt.filter((d) => d !== -1);
  return `R@${s.robot} · ${dirty.length ? "bẩn{" + dirty.join(",") + "}" : "sạch"}`;
}
let network = null;
function drawTree() {
  const algo = document.getElementById("tree-algo").value;
  const cap = Math.max(20, Math.min(3000, +document.getElementById("tree-cap").value || 300));
  const container = document.getElementById("tree");
  const r = results[algo];
  if (!r) { container.textContent = `Chưa có kết quả cho ${algo}. Bấm "Chạy lại" (hoặc "Chạy IDS") trước.`; return; }
  const hFn = algo === "A*h1" ? h1 : algo === "A*h2" ? h2 : null;  // A* moi co f/h

  const { tree, goalId } = r;

  // Tap node tren duong loi giai (de highlight).
  const pathIds = new Set();
  for (let i = goalId; i !== -1 && tree[i]; i = tree[i].parentId) pathIds.add(i);

  // Ve TAT CA node duoc SINH ra (tree[] = open+closed). Node frontier (chua duyet)
  // khong co con trong tree[] -> tu nhien la la (khong ve tiep con). Cap de tranh no voi IDS.
  const chosen = new Set();
  for (let i = 0; i < tree.length && chosen.size < cap; i++) chosen.add(i);
  for (const id of pathIds) chosen.add(id);
  for (const id of [...chosen]) {           // dam bao co cha (canh khong gay)
    let p = tree[id].parentId;
    while (p !== -1 && !chosen.has(p)) { chosen.add(p); p = tree[p].parentId; }
  }

  const nodes = [], edges = [];
  for (const id of chosen) {
    const n = tree[id];
    const onPath = pathIds.has(id);
    const isGoalNode = id === goalId;
    const expanded = n.order != null;        // da duyet (lay khoi frontier)? frontier => order==null
    const act = n.action === -1 ? "start" : ACTION_NAME[n.action];
    // Dòng 1: node đã duyệt ghi #thứ-tự, node frontier (chưa duyệt) ghi "·". Dòng 2: trạng thái. Dòng 3: g (+f/h nếu A*).
    const gLine = hFn
      ? `f=${n.g + hFn(n.state)} g=${n.g} h=${hFn(n.state)}`
      : `g=${n.g}`;
    const ordTag = expanded ? `#${n.order}` : "·";
    const label = `${ordTag} ${act}\n${stateRepr(n.state)}\n${gLine}`;
    nodes.push({
      id,
      label,
      color: {
        background: isGoalNode ? COLOR.green : onPath ? "#1f6feb" : expanded ? COLOR.panel : COLOR.bg,
        border: isGoalNode ? COLOR.green : onPath ? COLOR.cyan : expanded ? COLOR.border : COLOR.muted,
      },
      font: { color: expanded || onPath ? COLOR.text : COLOR.muted, face: "monospace", size: 11 },
      borderWidth: isGoalNode ? 3 : onPath ? 2 : 1,
      shapeProperties: { borderDashes: expanded || onPath ? false : [4, 3] },  // frontier = viền đứt
      shape: "box",
      level: n.g, // Ép các node có cùng g (cost/độ sâu) nằm ngang hàng nhau
    });
    if (n.parentId !== -1 && chosen.has(n.parentId)) {
      const edgeOnPath = onPath && pathIds.has(n.parentId);
      edges.push({
        from: n.parentId, to: id,
        color: { color: edgeOnPath ? COLOR.cyan : COLOR.border },
        width: edgeOnPath ? 2.5 : 1,
      });
    }
  }

  const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
  const options = {
    layout: { hierarchical: { direction: "UD", sortMethod: "directed", levelSeparation: 110, nodeSpacing: 130 } },
    physics: false,
    interaction: { hover: true, zoomView: true, dragView: true },
    edges: { arrows: { to: { enabled: true, scaleFactor: 0.5 } }, smooth: false },
    nodes: { shape: "box", margin: 6 },
  };
  if (network) network.destroy();
  network = new vis.Network(container, data, options);
  container.setAttribute("data-info", `Hiển thị ${nodes.length}/${tree.length} node đã sinh`);
}

// ---------- Verify vs C ----------
function verify() {
  const out = document.getElementById("verify-out");
  const lines = [];
  let allPass = true;
  for (const [name, ref] of Object.entries(C_REF)) {
    const r = results[name];
    if (!r) { lines.push(`  ${name.padEnd(6)}: chưa chạy (bấm Chạy lại / Chạy IDS)`); allPass = false; continue; }
    const m = r.metrics;
    const solOk = m.solutionLength === ref.solLen;
    const expOk = ref.expanded === undefined || m.nodesExpanded === ref.expanded;
    if (!solOk) allPass = false;
    let s = `  ${name.padEnd(6)}: SolLen ${m.solutionLength} vs ${ref.solLen} ${solOk ? "OK" : "SAI"}`;
    if (ref.expanded !== undefined)
      s += ` | Expanded ${m.nodesExpanded} vs ${ref.expanded} ${expOk ? "KHOP" : "LECH"}`;
    lines.push(s);
  }
  // Assert tinh toi uu
  const haveAll = ALGOS.every(a => results[a]);
  if (haveAll) {
    const opt = [results.BFS, results.IDS, results["A*h1"], results["A*h2"]].map(r => r.metrics.solutionLength);
    const optLen = C_REF.BFS.solLen;
    const allOpt = opt.every(l => l === optLen);
    const dfsOk = results.DFS.metrics.solutionLength === C_REF.DFS.solLen;
    lines.push("");
    lines.push(allOpt && dfsOk
      ? `[OK] BFS = IDS = A*(h1) = A*(h2) = ${optLen} buoc (deu toi uu). DFS = ${C_REF.DFS.solLen} buoc.`
      : `[LOI] Do dai loi giai khong khop tham chieu!`);
  }
  out.textContent = lines.join("\n");
  out.className = "verify-out " + (allPass ? "pass" : "warn");
}

// ---------- Replay robot ----------
let replay = { seq: [], pos: 0, timer: null };
function loadReplay() {
  const algo = document.getElementById("play-algo").value;
  const r = results[algo];
  const solStr = document.getElementById("sol-str");
  if (!r || !r.solution) {
    solStr.textContent = `Chưa có lời giải cho ${algo}.`;
    replay.seq = []; replay.pos = 0;
    document.getElementById("play-len").textContent = "0";
    document.getElementById("play-pos").textContent = "0";
    drawGrid(document.getElementById("grid-play"), currentStart);
    return;
  }
  replay.seq = statesAlongSolution(currentStart, r.solution);
  replay.pos = 0;
  document.getElementById("play-len").textContent = r.solution.length;
  document.getElementById("play-pos").textContent = "0";
  // in chuoi hanh dong voi tung buoc co the click
  solStr.textContent = "";
  r.solution.forEach((a, i) => {
    const span = document.createElement("span");
    span.className = "act"; span.textContent = ACTION_NAME[a];
    span.dataset.idx = i;
    solStr.appendChild(span);
    if (i < r.solution.length - 1) solStr.appendChild(document.createTextNode(" → "));
  });
  drawGrid(document.getElementById("grid-play"), replay.seq[0]);
}
function renderReplayAt(pos) {
  replay.pos = Math.max(0, Math.min(replay.seq.length - 1, pos));
  drawGrid(document.getElementById("grid-play"), replay.seq[replay.pos]);
  document.getElementById("play-pos").textContent = replay.pos;
  document.querySelectorAll("#sol-str .act").forEach((el, i) => {
    el.classList.toggle("done", i < replay.pos);
    el.classList.toggle("current", i === replay.pos - 1);
  });
}
function stepReplay() {
  if (replay.pos < replay.seq.length - 1) renderReplayAt(replay.pos + 1);
}
function playReplay() {
  if (replay.timer) { clearInterval(replay.timer); replay.timer = null; document.getElementById("btn-play").textContent = "▶ Play"; return; }
  if (replay.pos >= replay.seq.length - 1) renderReplayAt(0);
  document.getElementById("btn-play").textContent = "⏸ Pause";
  replay.timer = setInterval(() => {
    if (replay.pos >= replay.seq.length - 1) { clearInterval(replay.timer); replay.timer = null; document.getElementById("btn-play").textContent = "▶ Play"; return; }
    stepReplay();
  }, 450);
}

// ---------- IDS qua Web Worker ----------
let idsWorker = null;
function runIDS() {
  const btn = document.getElementById("btn-run-ids");
  btn.disabled = true; btn.textContent = "Đang chạy IDS…";
  if (idsWorker) idsWorker.terminate();
  idsWorker = new Worker("./ids-worker.js", { type: "module" });
  idsWorker.onmessage = (e) => {
    if (e.data.type === "done") {
      results.IDS = e.data.result;
      renderTable(); renderCharts();
      btn.disabled = false; btn.textContent = "Chạy IDS (~vài giây)";
    }
  };
  idsWorker.onerror = (err) => {
    btn.disabled = false; btn.textContent = "Chạy IDS (lỗi — xem console)";
    console.error("IDS worker error:", err);
  };
  idsWorker.postMessage({ type: "run", treeCap: 20000, start: currentStart });
}

// Doi ban do khoi tao: random moi hoac ve ban do goc. Xoa IDS cu (lech ban do), chay lai + ve lai.
function setStart(state) {
  currentStart = state;
  delete results.IDS;      // ket qua IDS cu ung voi ban do cu -> bo di
  drawGrid(document.getElementById("grid"), currentStart);
  runFast();               // BFS/DFS/A* chay ngay
  drawTree();
  loadReplay();
}

// ---------- Khoi tao ----------
function init() {
  drawGrid(document.getElementById("grid"), currentStart);
  drawGrid(document.getElementById("grid-play"), currentStart);
  runFast();               // BFS/DFS/A* chay ngay (nhanh). IDS de user bam nut.
  drawTree();
  loadReplay();

  document.getElementById("btn-run").addEventListener("click", () => { runFast(); drawTree(); loadReplay(); });
  document.getElementById("btn-random").addEventListener("click", () => setStart(randomStartState()));
  document.getElementById("btn-reset-map").addEventListener("click", () => setStart(initialState()));
  document.getElementById("btn-run-ids").addEventListener("click", runIDS);
  document.getElementById("btn-verify").addEventListener("click", verify);
  document.getElementById("btn-draw-tree").addEventListener("click", drawTree);
  document.getElementById("tree-algo").addEventListener("change", drawTree);
  document.getElementById("play-algo").addEventListener("change", loadReplay);
  document.getElementById("btn-play").addEventListener("click", playReplay);
  document.getElementById("btn-step").addEventListener("click", stepReplay);
  document.getElementById("btn-reset").addEventListener("click", () => {
    if (replay.timer) { clearInterval(replay.timer); replay.timer = null; document.getElementById("btn-play").textContent = "▶ Play"; }
    renderReplayAt(0);
  });
  // click vao 1 hanh dong trong chuoi -> nhay toi buoc do
  document.getElementById("sol-str").addEventListener("click", (e) => {
    if (e.target.classList.contains("act")) renderReplayAt(+e.target.dataset.idx + 1);
  });
}

init();
