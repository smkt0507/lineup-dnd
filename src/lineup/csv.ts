import type { BatterPos, LineupState } from "../models";
import { createInitialState } from "./createInitialState";

/**
 * CSVフォーマット（復元は playerId が命）
 *
 * META,NAME,"My Order"
 * BATTER,1,B_牧秀悟,2B
 * BATTER,2,,DH
 * ...
 * BENCH,1,B_鈴木誠也,
 * PITCHER,SP,1,P_宮城大弥,
 * PITCHER,RP,1,P_大勢,
 * PITCHER,CL,1,P_松井裕樹,
 */

export function exportLineupToCsv(state: LineupState): string {
  const lines: string[] = [];
  lines.push(`META,NAME,${escapeCsv(state.meta.name)}`);

  state.batters.forEach((b, idx) => {
    lines.push(`BATTER,${idx + 1},${b.playerId ?? ""},${b.position}`);
  });

  state.bench.forEach((id, idx) => {
    lines.push(`BENCH,${idx + 1},${id},`);
  });

  state.pitchers.sp.forEach((p) =>
    lines.push(`PITCHER,SP,${p.slot},${p.playerId ?? ""},`),
  );
  state.pitchers.rp.forEach((p) =>
    lines.push(`PITCHER,RP,${p.slot},${p.playerId ?? ""},`),
  );
  lines.push(`PITCHER,CL,1,${state.pitchers.cl.playerId ?? ""},`);

  return lines.join("\n");
}

export function importLineupFromCsv(csv: string): LineupState {
  const base = createInitialState();

  const rows = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseCsvLine);

  const nameRow = rows.find((r) => r[0] === "META" && r[1] === "NAME");
  const name = nameRow?.[2] ?? "Imported Order";

  const next: LineupState = {
    ...base,
    meta: { name },
  };

  // batters
  for (const r of rows) {
    if (r[0] !== "BATTER") continue;
    const slot = Number(r[1]);
    const playerId = r[2] ? r[2] : null;
    const pos = (r[3] || "DH") as BatterPos;
    if (slot >= 1 && slot <= 9) {
      next.batters[slot - 1] = {
        ...next.batters[slot - 1],
        playerId,
        position: pos,
      };
    }
  }

  // bench
  next.bench = rows
    .filter((r) => r[0] === "BENCH")
    .map((r) => r[2])
    .filter(Boolean);

  // pitchers
  for (const r of rows) {
    if (r[0] !== "PITCHER") continue;
    const role = r[1]; // SP/RP/CL
    const slot = Number(r[2]);
    const playerId = r[3] ? r[3] : null;

    if (role === "SP" && slot >= 1 && slot <= next.pitchers.sp.length) {
      next.pitchers.sp[slot - 1] = { slot, playerId };
    }
    if (role === "RP" && slot >= 1) {
      // 可変：いったん最大slot分まで確保
      while (next.pitchers.rp.length < slot) {
        next.pitchers.rp.push({
          slot: next.pitchers.rp.length + 1,
          playerId: null,
        });
      }
      next.pitchers.rp[slot - 1] = { slot, playerId };
    }
    if (role === "CL") {
      next.pitchers.cl = { slot: 1, playerId };
    }
  }

  return next;
}

// --- helpers ---
function escapeCsv(s: string) {
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}
