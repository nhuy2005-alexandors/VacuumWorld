// Web Worker chay IDS (Expanded ~4.5 trieu -> vai giay) de khong block UI.
// Nhan message {type:"run"}, tra {type:"done", result} voi result = {solution, tree, goalId, metrics}.
import { ids } from "./solver.js";

self.onmessage = (e) => {
  if (e.data && e.data.type === "run") {
    const treeCap = e.data.treeCap ?? 20000;
    const r = ids(e.data.start, { treeCap });   // start === undefined -> ban do goc
    // Post ket qua. tree co the lon -> chi giu truong can thiet, state la object nho.
    self.postMessage({ type: "done", result: r });
  }
};
