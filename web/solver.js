/*
 * Vacuum World — solver port tu c/vacuum.c sang JS thuan (ES module).
 * Chay duoc ca Node (self-test) lan trinh duyet (import trong app.js).
 *
 * Model:
 *   Luoi 4x3 = 12 o, o = row*4 + col. Robot xuat phat o 0.
 *   4 o ban ban dau: 3, 5, 8, 11.
 *   Trang thai = {robot:int 0..11, dirt:int[4]}. dirt[i] = vi tri o ban thu i,
 *   hoac -1 neu o do da duoc hut sach. Moi slot GAN CO DINH voi 1 o ban ban
 *   dau, khong bao gio splice/doi vi tri slot (de stateKey nhat quan).
 *   5 hanh dong Up/Down/Left/Right/Suck, moi buoc cost = 1. Goal: het slot != -1.
 *
 * So lieu tham chieu (config nay, tinh tu chinh solver JS):
 *   BFS  SolLen=13 Expanded=153   Generated=458   PeakFront=27
 *   DFS  SolLen=18 Expanded=24
 *   IDS  SolLen=13 Expanded=14256
 *   A*h1 SolLen=13 Expanded=137
 *   A*h2 SolLen=13 Expanded=106
 */

// ---------- Cau hinh bai toan ----------
export const W = 5, H = 5, NCELL = W * H;   // luoi 5 cot x 5 hang = 25 o
export const START_CELL = 0;
export const DIRTY_CELLS = [4, 12, 20, 24];

// ---------- Hanh dong ----------
export const UP = 0, DOWN = 1, LEFT = 2, RIGHT = 3, SUCK = 4, NACTION = 5;
export const ACTION_NAME = ["Up", "Down", "Left", "Right", "Suck"];

// ---------- So lieu C tham chieu (de self-check so sanh) ----------
export const C_REF = {
  BFS:   { solLen: 20, expanded: 375,   generated: 1232, peakFrontier: 44 },
  DFS:   { solLen: 24, expanded: 24 },
  IDS:   { solLen: 20, expanded: 4508128 },
  "A*h1":{ solLen: 20, expanded: 361 },
  "A*h2":{ solLen: 20, expanded: 232 },
};

// ---------- Trang thai ----------
export function initialState() {
  return { robot: START_CELL, dirt: [...DIRTY_CELLS] };   // clone -> khong alias voi hang so module
}
// Ban do khoi tao ngau nhien: robot ngau nhien 0..11, dung 4 o ban ngau nhien
// (giu 4 o de IDS khong no ngoai MAX_DEPTH nhu ban do goc).
// ponytail: co dinh 4 o ban de bao dam runtime IDS bounded; muon so o ban tuy bien thi them tham so.
export function randomStartState() {
  const cells = [...Array(NCELL).keys()];
  for (let i = cells.length - 1; i > 0; i--) {   // Fisher-Yates
    const j = (Math.random() * (i + 1)) | 0;
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return { robot: (Math.random() * NCELL) | 0, dirt: cells.slice(0, 4) };
}
export function isGoal(s) { return s.dirt.every((d) => d === -1); }
// string key gon, hash nhanh trong Map/Set. Thu tu slot dirt CO DINH (khong splice)
// nen 2 trang thai giong nhau logic luon ra cung key.
export function stateKey(s) { return s.robot + "," + s.dirt.join(","); }

// so o con ban (dem slot != -1)
function dirtyCount(dirt) {
  let c = 0;
  for (const d of dirt) if (d !== -1) c++;
  return c;
}

// Sinh trang thai ke tiep. Tra null neu hanh dong khong hop le.
export function applyAction(s, a) {
  if (a === SUCK) {
    const i = s.dirt.indexOf(s.robot);
    if (i === -1) return null;                 // o dang sach -> khong hut
    const nd = [...s.dirt];                     // clone -> KHONG BAO GIO sua dirt tai cho
    nd[i] = -1;
    return { robot: s.robot, dirt: nd };
  }
  let r = (s.robot / W) | 0, c = s.robot % W;
  if (a === UP) r--; else if (a === DOWN) r++;
  else if (a === LEFT) c--; else c++;          // RIGHT
  if (r < 0 || r >= H || c < 0 || c >= W) return null;  // dung tuong
  return { robot: r * W + c, dirt: s.dirt };   // dirt khong doi -> dung chung reference an toan
}

// ---------- Heuristic ----------
// h1 = so o con ban (admissible, consistent).
export function h1(s) { return dirtyCount(s.dirt); }
// h2 = so o ban + Manhattan toi o ban gan nhat (admissible, consistent).
export function h2(s) {
  const cnt = dirtyCount(s.dirt);
  if (cnt === 0) return 0;
  const r = (s.robot / W) | 0, c = s.robot % W;
  let best = Infinity;
  for (const d of s.dirt) {
    if (d === -1) continue;
    const dist = Math.abs(r - ((d / W) | 0)) + Math.abs(c - d % W);
    if (dist < best) best = dist;
  }
  return cnt + best;
}

// ---------- Tien ich chung ----------
const now = (typeof performance !== "undefined" && performance.now)
  ? () => performance.now() : () => Date.now();

// Dung lai chuoi hanh dong tu node dich (node pool co parentId).
function reconstruct(nodes, goalId) {
  const sol = [];
  for (let i = goalId; nodes[i].parentId !== -1; i = nodes[i].parentId)
    sol.push(nodes[i].action);
  sol.reverse();
  return sol;
}

function emptyMetrics() {
  return { solutionLength: -1, nodesExpanded: 0, generated: 0, peakFrontier: 0, timeMs: 0 };
}

// ======================= BFS (mu, toi uu voi cost deu) =======================
// AIMA Fig 3.11 BREADTH-FIRST-SEARCH: EARLY goal test — test goal ngay khi SINH
// node (ca root), khong doi den luc lay ra mo rong. Nho vay Expanded it hon.
export function bfs(start = initialState()) {
  const m = emptyMetrics();
  const t0 = now();
  const nodes = [];
  const closed = new Set();
  const push = (state, parentId, action, g) => {
    const id = nodes.length; nodes.push({ id, parentId, action, state, g }); return id;
  };
  const frontier = []; let head = 0;
  const root = push(start, -1, -1, 0);
  let goalId = isGoal(start) ? root : -1;   // goal-test root truoc vong lap
  frontier.push(root); closed.add(stateKey(start));
  let ord = 0;
  while (goalId < 0 && head < frontier.length) {
    const fs = frontier.length - head;
    if (fs > m.peakFrontier) m.peakFrontier = fs;
    const cur = frontier[head++];
    nodes[cur].order = ++ord;              // thu tu MO RONG (lay ra khoi frontier)
    const s = nodes[cur].state;
    m.nodesExpanded++;
    for (let a = 0; a < NACTION; a++) {
      const ns = applyAction(s, a);
      if (!ns) continue;
      m.generated++;
      const k = stateKey(ns);
      if (closed.has(k)) continue;
      const child = push(ns, cur, a, nodes[cur].g + 1);
      if (isGoal(ns)) { goalId = child; break; }   // EARLY goal test khi SINH con
      closed.add(k);
      frontier.push(child);
    }
  }
  const solution = goalId >= 0 ? reconstruct(nodes, goalId) : null;
  if (goalId >= 0) m.solutionLength = solution.length;
  m.timeMs = now() - t0;
  return { solution, tree: nodes, goalId, metrics: m };
}

// ======================= DFS (mu, KHONG toi uu) =======================
export function dfs(start = initialState()) {
  const m = emptyMetrics();
  const t0 = now();
  const nodes = [];
  const closed = new Set();
  const push = (state, parentId, action, g) => {
    const id = nodes.length; nodes.push({ id, parentId, action, state, g }); return id;
  };
  const frontier = []; let top = 0;
  const root = push(start, -1, -1, 0);
  frontier[top++] = root; closed.add(stateKey(start));
  let goalId = -1, ord = 0;
  while (top > 0) {
    if (top > m.peakFrontier) m.peakFrontier = top;
    const cur = frontier[--top];
    nodes[cur].order = ++ord;              // thu tu MO RONG
    const s = nodes[cur].state;
    if (isGoal(s)) { goalId = cur; break; }
    m.nodesExpanded++;
    for (let a = 0; a < NACTION; a++) {
      const ns = applyAction(s, a);
      if (!ns) continue;
      m.generated++;
      const k = stateKey(ns);
      if (closed.has(k)) continue;
      closed.add(k);
      frontier[top++] = push(ns, cur, a, nodes[cur].g + 1);
    }
  }
  const solution = goalId >= 0 ? reconstruct(nodes, goalId) : null;
  if (goalId >= 0) m.solutionLength = solution.length;
  m.timeMs = now() - t0;
  return { solution, tree: nodes, goalId, metrics: m };
}

// ======================= IDS (mu, toi uu) =======================
// DLS dung cycle-check TREN DUONG DI hien tai (khong dung closed toan cuc),
// de giu tinh toi uu. m.expanded/generated/peakFrontier CONG DON qua cac vong
// lap limit (giong C -> khop Expanded=4.5 trieu).
export const MAX_DEPTH = 80;
export function ids(start = initialState(), opt = {}) {
  const treeCap = opt.treeCap ?? 20000;   // gioi han node luu lai cho cay (metrics van dem du)
  const m = emptyMetrics();
  const t0 = now();
  let solution = null, tree = null, goalId = -1;

  for (let limit = 0; limit <= MAX_DEPTH; limit++) {
    const pathStates = [];
    const pathActions = [];
    let ord = 0;
    const nodes = [{ id: 0, parentId: -1, action: -1, state: start, g: 0 }]; // cay cua vong lap nay
    const rec = (state, parentId, action, g) => {
      if (nodes.length >= treeCap) return -1;   // ngung luu cay (van dem metrics)
      const id = nodes.length; nodes.push({ id, parentId, action, state, g }); return id;
    };

    // DLS de quy. Tra {found, goalTreeId}.
    function dls(s, depth, parentTreeId) {
      if (isGoal(s)) {
        solution = pathActions.slice(0, depth);
        m.solutionLength = depth;
        tree = nodes; goalId = parentTreeId;
        return true;
      }
      if (depth === limit) return false;
      m.nodesExpanded++;
      if (depth > m.peakFrontier) m.peakFrontier = depth;
      if (parentTreeId !== -1 && nodes[parentTreeId]) nodes[parentTreeId].order = ++ord;  // thu tu MO RONG
      pathStates[depth] = s;
      for (let a = 0; a < NACTION; a++) {
        const ns = applyAction(s, a);
        if (!ns) continue;
        const nk = stateKey(ns);
        let onPath = false;
        for (let i = 0; i <= depth; i++)
          if (stateKey(pathStates[i]) === nk) { onPath = true; break; }
        if (onPath) continue;
        m.generated++;
        pathActions[depth] = a;
        const childId = rec(ns, parentTreeId, a, depth + 1);
        if (dls(ns, depth + 1, childId)) return true;
      }
      return false;
    }

    if (dls(start, 0, 0)) break;
  }
  if (!tree) { tree = [{ id: 0, parentId: -1, action: -1, state: start, g: 0 }]; }
  m.timeMs = now() - t0;
  return { solution, tree, goalId, metrics: m };
}

// ======================= A* (co thong tin) =======================
// Min-heap theo f = g + h, so sanh CHI theo f (khop heap trong C -> khop Expanded).
// Lazy deletion: bo qua node da nam trong closed khi pop.
class MinHeapF {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item) {                                   // item = {f, node}
    const a = this.a; let i = a.length; a.push(item);
    while (i > 0) {                              // sift-up (<= giong C)
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a; const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last; let i = 0;
      for (;;) {                                 // sift-down
        const l = 2 * i + 1, r = 2 * i + 2; let s = i;
        if (l < a.length && a[l].f < a[s].f) s = l;
        if (r < a.length && a[r].f < a[s].f) s = r;
        if (s === i) break;
        [a[s], a[i]] = [a[i], a[s]]; i = s;
      }
    }
    return top;
  }
}

export function astar(start = initialState(), h = h1) {
  const m = emptyMetrics();
  const t0 = now();
  const nodes = [];
  const closed = new Set();
  const bestg = new Map();
  const heap = new MinHeapF();
  const push = (state, parentId, action, g) => {
    const id = nodes.length; nodes.push({ id, parentId, action, state, g }); return id;
  };
  const root = push(start, -1, -1, 0);
  bestg.set(stateKey(start), 0);
  heap.push({ f: 0 + h(start), node: root });
  let goalId = -1, ord = 0;
  while (heap.size > 0) {
    if (heap.size > m.peakFrontier) m.peakFrontier = heap.size;
    const it = heap.pop();
    const cur = it.node;
    const s = nodes[cur].state;
    const k = stateKey(s);
    if (closed.has(k)) continue;                 // node cu (lazy delete)
    closed.add(k);
    nodes[cur].order = ++ord;                    // thu tu MO RONG (pop khoi heap, sau lazy-delete)
    if (isGoal(s)) { goalId = cur; break; }
    m.nodesExpanded++;
    for (let a = 0; a < NACTION; a++) {
      const ns = applyAction(s, a);
      if (!ns) continue;
      m.generated++;
      const ng = nodes[cur].g + 1;
      const nk = stateKey(ns);
      if (bestg.has(nk) && ng >= bestg.get(nk)) continue;  // co duong tot hon
      bestg.set(nk, ng);
      heap.push({ f: ng + h(ns), node: push(ns, cur, a, ng) });
    }
  }
  const solution = goalId >= 0 ? reconstruct(nodes, goalId) : null;
  if (goalId >= 0) m.solutionLength = solution.length;
  m.timeMs = now() - t0;
  return { solution, tree: nodes, goalId, metrics: m };
}

// Chay het 5 giai thuat, tra map ket qua. runIDS=false de bo qua IDS (nang ~vai giay).
export function runAll({ runIDS = true } = {}) {
  const start = initialState();
  const out = {
    BFS: bfs(start),
    DFS: dfs(start),
    "A*h1": astar(start, h1),
    "A*h2": astar(start, h2),
  };
  if (runIDS) out.IDS = ids(start);
  return out;
}

// Chuoi hanh dong -> chuoi trang thai (de replay robot tren luoi).
export function statesAlongSolution(start, solution) {
  const seq = [start];
  let s = start;
  for (const a of solution) { s = applyAction(s, a); seq.push(s); }
  return seq;
}

// ---------- Self-test (chi chay khi la main module trong Node) ----------
function pad(v, n) { return String(v).padStart(n); }

function selfTest() {
  const start = initialState();
  console.log("=== VACUUM WORLD (JS port) — self-test ===");
  console.log(`KGTT dat toi: ${NCELL} o x 2^${DIRTY_CELLS.length} = ${NCELL << DIRTY_CELLS.length} trang thai`);
  console.log(`Branching factor toi da: ${NACTION} hanh dong/node\n`);

  const results = {
    BFS: bfs(start),
    DFS: dfs(start),
    IDS: ids(start),
    "A*h1": astar(start, h1),
    "A*h2": astar(start, h2),
  };

  const cols = ["Algo", "SolLen", "Expanded", "Generated", "PeakFront", "Time(ms)"];
  console.log(`  ${cols[0].padEnd(8)}| ${pad(cols[1], 8)} | ${pad(cols[2], 10)} | ${pad(cols[3], 10)} | ${pad(cols[4], 10)} | ${pad(cols[5], 8)}`);
  console.log("  --------+----------+------------+------------+------------+---------");
  for (const [name, r] of Object.entries(results)) {
    const m = r.metrics;
    console.log(`  ${name.padEnd(8)}| ${pad(m.solutionLength, 8)} | ${pad(m.nodesExpanded, 10)} | ${pad(m.generated, 10)} | ${pad(m.peakFrontier, 10)} | ${pad(m.timeMs.toFixed(2), 8)}`);
  }

  console.log("\n  So sanh voi C tham chieu:");
  let ok = true;
  for (const [name, ref] of Object.entries(C_REF)) {
    const m = results[name].metrics;
    const solOk = m.solutionLength === ref.solLen;
    const expOk = ref.expanded === undefined || m.nodesExpanded === ref.expanded;
    if (!solOk) ok = false;
    const marks = [];
    marks.push(`SolLen ${m.solutionLength} vs ${ref.solLen} ${solOk ? "OK" : "SAI"}`);
    if (ref.expanded !== undefined)
      marks.push(`Expanded ${m.nodesExpanded} vs ${ref.expanded} ${expOk ? "KHOP" : "LECH"}`);
    console.log(`    ${name.padEnd(6)}: ${marks.join(" | ")}`);
  }

  // Assert: cac giai thuat toi uu phai ra cung SolLen; DFS co the dai hon.
  const optLens = [results.BFS, results.IDS, results["A*h1"], results["A*h2"]].map(r => r.metrics.solutionLength);
  const allOpt = optLens.every(l => l === optLens[0]);
  console.assert(allOpt, "[LOI] BFS/IDS/A* khong cung do dai toi uu!");
  console.assert(optLens[0] === C_REF.BFS.solLen, `[LOI] SolLen toi uu phai = ${C_REF.BFS.solLen}`);
  console.assert(results.DFS.metrics.solutionLength === C_REF.DFS.solLen, `[LOI] DFS SolLen phai = ${C_REF.DFS.solLen}`);

  if (allOpt && optLens[0] === C_REF.BFS.solLen && results.DFS.metrics.solutionLength === C_REF.DFS.solLen) {
    console.log(`\n[OK] BFS = IDS = A*(h1) = A*(h2) = ${optLens[0]} buoc (deu toi uu). DFS = ${results.DFS.metrics.solutionLength} buoc.`);
  }

  // In loi giai A*(h2)
  const solA2 = results["A*h2"].solution;
  console.log(`\nLoi giai A*(h2), ${solA2.length} buoc:\n  ${solA2.map(a => ACTION_NAME[a]).join(" -> ")}`);

  return ok && allOpt;
}

if (typeof process !== "undefined" && process.argv && process.argv[1]) {
  const { pathToFileURL } = await import("node:url");
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const pass = selfTest();
    process.exit(pass ? 0 : 1);
  }
}
