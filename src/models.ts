export type BatterPos =
  | "P"
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "LF"
  | "CF"
  | "RF"
  | "DH";

export type PlayerType = "B" | "P";

export type Player = {
  id: string; // CSVキー（固定）
  name: string;
  type: PlayerType;
  team?: string;
  number?: number;
  group?: "投手" | "捕手" | "内野手" | "外野手";
};

export type BatterRow = {
  uid: string; // 並べ替え用の安定ID
  playerId: string | null;
  position: BatterPos;
};

export type PitchSlot = {
  slot: number;
  playerId: string | null;
};

export type LineupState = {
  meta: { name: string };
  batters: BatterRow[]; // length=9（並べ替え）
  bench: string[]; // playerId[]（Sortable）
  pitchers: {
    sp: PitchSlot[]; // 5
    rp: PitchSlot[]; // 可変
    cl: PitchSlot; // 1
  };
};
