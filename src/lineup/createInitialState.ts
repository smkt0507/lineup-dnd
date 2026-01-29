import type { BatterPos, LineupState } from "../models";

const DEFAULT_RP = 6;

function uid() {
  return crypto.randomUUID();
}

export function createInitialState(): LineupState {
  const defaultPos: BatterPos = "DH";

  return {
    meta: { name: "My Order" },
    batters: Array.from({ length: 9 }, () => ({
      uid: uid(),
      playerId: null,
      position: defaultPos,
    })),
    bench: [],
    pitchers: {
      sp: Array.from({ length: 5 }, (_, i) => ({
        slot: i + 1,
        playerId: null,
      })),
      rp: Array.from({ length: DEFAULT_RP }, (_, i) => ({
        slot: i + 1,
        playerId: null,
      })),
      cl: { slot: 1, playerId: null },
    },
  };
}
