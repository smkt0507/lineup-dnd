import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { BatterPos, LineupState, Player } from "../models";
import { createInitialState } from "./createInitialState";
import { exportLineupToCsv, importLineupFromCsv } from "./csv";

/**
 * DnD ID設計
 * - 選手カード（プール/配置済み共通）: player:<playerId>
 * - 打順の行（並べ替え用）: batterRow:<uid>
 * - 打順の「配置先」: batterDrop:<uid>
 * - ベンチの「配置先」: benchDrop
 * - ベンチの並べ替えアイテム: benchItem:<playerId>
 * - 投手配置先: spDrop:<slot> / rpDrop:<slot> / clDrop
 * - ゴミ箱（外す）: trash
 */

/** 打順に投手も入れたいので P を追加 */
const BATTER_POS: BatterPos[] = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "DH",
];

export default function LineupBuilder({ players }: { players: Player[] }) {
  const [state, setState] = useState<LineupState>(() => createInitialState());
  const [csvText, setCsvText] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players],
  );

  const usedIds = useMemo(() => {
    const ids = new Set<string>();

    state.batters.forEach((b) => {
      if (b.playerId) ids.add(b.playerId);
    });

    state.bench.forEach((id) => {
      ids.add(id);
    });

    state.pitchers.sp.forEach((p) => {
      if (p.playerId) ids.add(p.playerId);
    });

    state.pitchers.rp.forEach((p) => {
      if (p.playerId) ids.add(p.playerId);
    });

    if (state.pitchers.cl.playerId) {
      ids.add(state.pitchers.cl.playerId);
    }

    return ids;
  }, [state]);

  /**
   * 「打順へ置ける候補」＝全選手（投手も含む）
   * ※DH起用もあるので投手を打順へ入れられるようにする
   */
  const availableLineupCandidates = useMemo(
    () => players.filter((p) => !usedIds.has(p.id)),
    [players, usedIds],
  );

  /**
   * 「投手枠へ置ける候補」＝投手のみ
   */
  const availablePitchers = useMemo(
    () => players.filter((p) => p.type === "P" && !usedIds.has(p.id)),
    [players, usedIds],
  );

  function removePlayerEverywhere(
    prev: LineupState,
    playerId: string,
  ): LineupState {
    const batters = prev.batters.map((b) =>
      b.playerId === playerId ? { ...b, playerId: null } : b,
    );
    const bench = prev.bench.filter((id) => id !== playerId);
    const sp = prev.pitchers.sp.map((p) =>
      p.playerId === playerId ? { ...p, playerId: null } : p,
    );
    const rp = prev.pitchers.rp.map((p) =>
      p.playerId === playerId ? { ...p, playerId: null } : p,
    );
    const cl =
      prev.pitchers.cl.playerId === playerId
        ? { ...prev.pitchers.cl, playerId: null }
        : prev.pitchers.cl;

    return {
      ...prev,
      batters,
      bench,
      pitchers: { ...prev.pitchers, sp, rp, cl },
    };
  }

  function onDragEnd(e: DragEndEvent) {
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    // 1) 打順（行）の並べ替え
    if (activeId.startsWith("batterRow:") && overId.startsWith("batterRow:")) {
      const aUid = activeId.replace("batterRow:", "");
      const oUid = overId.replace("batterRow:", "");
      const oldIndex = state.batters.findIndex((b) => b.uid === aUid);
      const newIndex = state.batters.findIndex((b) => b.uid === oUid);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setState((prev) => ({
          ...prev,
          batters: arrayMove(prev.batters, oldIndex, newIndex),
        }));
      }
      return;
    }

    // 2) ベンチ並べ替え
    if (activeId.startsWith("benchItem:") && overId.startsWith("benchItem:")) {
      const aPid = activeId.replace("benchItem:", "");
      const oPid = overId.replace("benchItem:", "");
      const oldIndex = state.bench.findIndex((x) => x === aPid);
      const newIndex = state.bench.findIndex((x) => x === oPid);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        setState((prev) => ({
          ...prev,
          bench: arrayMove(prev.bench, oldIndex, newIndex),
        }));
      }
      return;
    }

    // 3) 選手カード（プール/配置済み共通）は player:<id>
    if (!activeId.startsWith("player:")) return;
    const playerId = activeId.replace("player:", "");
    const player = playerMap.get(playerId);
    if (!player) return;

    // 4) ゴミ箱：外す
    if (overId === "trash") {
      setState((prev) => removePlayerEverywhere(prev, playerId));
      return;
    }

    // 5) 打順への配置（投手もOK）
    if (overId.startsWith("batterDrop:")) {
      const uid = overId.replace("batterDrop:", "");
      setState((prev) => {
        let next = removePlayerEverywhere(prev, playerId);
        next = {
          ...next,
          batters: next.batters.map((b) =>
            b.uid === uid ? { ...b, playerId } : b,
          ),
        };
        return next;
      });
      return;
    }

    // 6) ベンチに入れる（ベンチは野手のみのまま）
    if (overId === "benchDrop") {
      if (player.type !== "B") return;
      setState((prev) => {
        let next = removePlayerEverywhere(prev, playerId);
        next = { ...next, bench: [...next.bench, playerId] };
        return next;
      });
      return;
    }

    // 7) 投手枠（投手のみ）
    if (overId.startsWith("spDrop:")) {
      if (player.type !== "P") return;
      const slot = Number(overId.replace("spDrop:", ""));
      setState((prev) => {
        let next = removePlayerEverywhere(prev, playerId);
        next = {
          ...next,
          pitchers: {
            ...next.pitchers,
            sp: next.pitchers.sp.map((p) =>
              p.slot === slot ? { ...p, playerId } : p,
            ),
          },
        };
        return next;
      });
      return;
    }

    if (overId.startsWith("rpDrop:")) {
      if (player.type !== "P") return;
      const slot = Number(overId.replace("rpDrop:", ""));
      setState((prev) => {
        let next = removePlayerEverywhere(prev, playerId);
        next = {
          ...next,
          pitchers: {
            ...next.pitchers,
            rp: next.pitchers.rp.map((p) =>
              p.slot === slot ? { ...p, playerId } : p,
            ),
          },
        };
        return next;
      });
      return;
    }

    if (overId === "clDrop") {
      if (player.type !== "P") return;
      setState((prev) => {
        let next = removePlayerEverywhere(prev, playerId);
        next = {
          ...next,
          pitchers: { ...next.pitchers, cl: { slot: 1, playerId } },
        };
        return next;
      });
      return;
    }
  }

  function onExportCsv() {
    const csv = exportLineupToCsv(state);
    setCsvText(csv);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.meta.name || "lineup"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportCsv() {
    try {
      const next = importLineupFromCsv(csvText);
      setState(next);
    } catch {
      alert("CSVの読み込みに失敗しました。形式を確認してください。");
    }
  }

  const batterRowIds = state.batters.map((b) => `batterRow:${b.uid}`);
  const benchItemIds = state.bench.map((id) => `benchItem:${id}`);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" },
        }}
      >
        {/* 左 */}
        <Box sx={{ gridColumn: { md: "span 4" } }}>
          <SectionTitle title="未配置（打順候補）" />
          <Stack spacing={1} mt={1}>
            {availableLineupCandidates.map((p) => (
              <DraggablePlayerCard key={p.id} player={p} />
            ))}
            {availableLineupCandidates.length === 0 && (
              <HintCard text="未配置の選手がいません" />
            )}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <SectionTitle title="未配置（投手）" />
          <Stack spacing={1} mt={1}>
            {availablePitchers.map((p) => (
              <DraggablePlayerCard key={p.id} player={p} />
            ))}
            {availablePitchers.length === 0 && (
              <HintCard text="未配置の投手がいません" />
            )}
          </Stack>

          <Divider sx={{ my: 2 }} />

          <SectionTitle title="CSV（共有用）" />
          <Stack direction="row" spacing={1} alignItems="center" mb={1}>
            <TextField
              label="オーダー名"
              value={state.meta.name}
              size="small"
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  meta: { ...s.meta, name: e.target.value },
                }))
              }
              fullWidth
            />
          </Stack>

          <TextField
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="ここにCSVを貼り付けてインポートできます"
            multiline
            minRows={10}
            fullWidth
          />

          <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
            <Button variant="contained" onClick={onExportCsv}>
              CSVエクスポート
            </Button>
            <Button
              variant="outlined"
              onClick={() => setCsvText(exportLineupToCsv(state))}
            >
              CSVを生成
            </Button>
            <Button variant="contained" color="secondary" onClick={onImportCsv}>
              CSVインポート
            </Button>
            <Button
              variant="outlined"
              onClick={() => setState(createInitialState())}
            >
              リセット
            </Button>
          </Stack>

          <Divider sx={{ my: 2 }} />

          <TrashArea />
        </Box>

        {/* 右 */}
        <Box sx={{ gridColumn: { md: "span 8" } }}>
          <SectionTitle title="スタメン（打順 / 守備）" />
          <SortableContext
            items={batterRowIds}
            strategy={verticalListSortingStrategy}
          >
            <Stack spacing={1} mt={1}>
              {state.batters.map((b, idx) => (
                <SortableBatterRow
                  key={b.uid}
                  rowId={`batterRow:${b.uid}`}
                  dropId={`batterDrop:${b.uid}`}
                  order={idx + 1}
                  batter={b}
                  player={
                    b.playerId ? (playerMap.get(b.playerId) ?? null) : null
                  }
                  onChangePos={(pos) =>
                    setState((s) => ({
                      ...s,
                      batters: s.batters.map((x) =>
                        x.uid === b.uid ? { ...x, position: pos } : x,
                      ),
                    }))
                  }
                />
              ))}
            </Stack>
          </SortableContext>

          <Divider sx={{ my: 2 }} />

          <SectionTitle title="ベンチ（野手）" />
          <BenchDropArea>
            <SortableContext
              items={benchItemIds}
              strategy={verticalListSortingStrategy}
            >
              <Stack spacing={1} mt={1}>
                {state.bench.length === 0 && (
                  <HintCard text="（ここに野手をドロップしてベンチ入り。ベンチ内はドラッグで並べ替え）" />
                )}
                {state.bench.map((pid) => {
                  const p = playerMap.get(pid);
                  if (!p) return null;
                  return (
                    <SortableBenchItem
                      key={pid}
                      id={`benchItem:${pid}`}
                      player={p}
                    />
                  );
                })}
              </Stack>
            </SortableContext>
          </BenchDropArea>

          <Divider sx={{ my: 2 }} />

          <SectionTitle title="投手（先発5 / 中継ぎ / 抑え1）" />
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" },
              mt: 0,
            }}
          >
            <Box sx={{ gridColumn: { md: "span 6" } }}>
              <Typography variant="subtitle1" fontWeight={800}>
                先発（5）
              </Typography>
              <Stack spacing={1} mt={1}>
                {state.pitchers.sp.map((p) => (
                  <PitchSlot
                    key={`sp-${p.slot}`}
                    title={`先発 ${p.slot}`}
                    dropId={`spDrop:${p.slot}`}
                    player={
                      p.playerId ? (playerMap.get(p.playerId) ?? null) : null
                    }
                  />
                ))}
              </Stack>
            </Box>

            <Box sx={{ gridColumn: { md: "span 6" } }}>
              <Typography variant="subtitle1" fontWeight={800}>
                抑え（1）
              </Typography>
              <Stack spacing={1} mt={1}>
                <PitchSlot
                  title="抑え"
                  dropId="clDrop"
                  player={
                    state.pitchers.cl.playerId
                      ? (playerMap.get(state.pitchers.cl.playerId) ?? null)
                      : null
                  }
                />
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" fontWeight={800}>
                中継ぎ
              </Typography>
              <Stack spacing={1} mt={1}>
                {state.pitchers.rp.map((p) => (
                  <PitchSlot
                    key={`rp-${p.slot}`}
                    title={`中継 ${p.slot}`}
                    dropId={`rpDrop:${p.slot}`}
                    player={
                      p.playerId ? (playerMap.get(p.playerId) ?? null) : null
                    }
                  />
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </DndContext>
  );
}

/* --------------------------
   UI Parts
-------------------------- */

function SectionTitle({ title }: { title: string }) {
  return (
    <Typography variant="h6" fontWeight={900}>
      {title}
    </Typography>
  );
}

function HintCard({ text }: { text: string }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography color="text.secondary">{text}</Typography>
      </CardContent>
    </Card>
  );
}

function PlayerMetaLine({ player }: { player: Player }) {
  const n = player.number ? `#${player.number}` : "";
  const team = player.team ? player.team : "";
  const group = player.group ? player.group : "";
  return (
    <Typography variant="caption" color="text.secondary">
      {team}
      {team ? " / " : ""}
      {group}
      {group ? " / " : ""}
      {n}
      {n ? " / " : ""}
      {player.id}
    </Typography>
  );
}

function DraggablePlayerCard({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `player:${player.id}`,
    });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1,
    cursor: "grab",
  };

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      variant="outlined"
    >
      <CardContent sx={{ py: 1.2, "&:last-child": { pb: 1.2 } }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography fontWeight={900}>{player.name}</Typography>
          <Chip size="small" label={player.type === "B" ? "野手" : "投手"} />
        </Stack>
        <PlayerMetaLine player={player} />
      </CardContent>
    </Card>
  );
}

function SortableBatterRow(props: {
  rowId: string;
  dropId: string;
  order: number;
  batter: { uid: string; playerId: string | null; position: BatterPos };
  player: Player | null;
  onChangePos: (pos: BatterPos) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: props.rowId,
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} variant="outlined">
      <CardContent sx={{ py: 1.2, "&:last-child": { pb: 1.2 } }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Box sx={{ width: 96 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={`${props.order}番`} />
              <Box
                {...attributes}
                {...listeners}
                sx={{
                  fontWeight: 900,
                  cursor: "grab",
                  userSelect: "none",
                  px: 1,
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                }}
                title="ここをドラッグで打順を並べ替え"
              >
                ↕
              </Box>
            </Stack>
          </Box>

          <Box sx={{ flex: 1 }}>
            <BatterDropZone dropId={props.dropId} player={props.player} />
          </Box>

          <Box sx={{ width: 180 }}>
            <Select
              value={props.batter.position}
              size="small"
              fullWidth
              onChange={(e) => props.onChangePos(e.target.value as BatterPos)}
            >
              {BATTER_POS.map((pos) => (
                <MenuItem key={pos} value={pos}>
                  {pos}
                </MenuItem>
              ))}
            </Select>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function BatterDropZone({
  dropId,
  player,
}: {
  dropId: string;
  player: Player | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        border: "1px dashed",
        borderColor: isOver ? "primary.main" : "divider",
        borderRadius: 2,
        px: 1.5,
        py: 1,
        minHeight: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
      title="ここに選手をドロップ（投手も可）"
    >
      {player ? (
        <Stack spacing={0.2} sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography fontWeight={900}>{player.name}</Typography>
            <Chip size="small" label="配置済み" />
          </Stack>
          <PlayerMetaLine player={player} />
        </Stack>
      ) : (
        <Typography color="text.secondary">（ここに選手をドロップ）</Typography>
      )}

      {player ? (
        <Box sx={{ flexShrink: 0 }}>
          <DraggableMini player={player} />
        </Box>
      ) : null}
    </Box>
  );
}

function DraggableMini({ player }: { player: Player }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `player:${player.id}`,
    });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.6 : 1,
    cursor: "grab",
  };

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      sx={{
        px: 1,
        py: 0.5,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        fontWeight: 900,
        userSelect: "none",
      }}
      title="ドラッグして他の枠へ移動 / ゴミ箱へ"
    >
      ⇄
    </Box>
  );
}

function BenchDropArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "benchDrop" });
  return (
    <Card variant="outlined">
      <CardContent
        ref={setNodeRef}
        sx={{
          border: "1px dashed",
          borderColor: isOver ? "primary.main" : "divider",
          borderRadius: 2,
        }}
      >
        {children}
      </CardContent>
    </Card>
  );
}

function SortableBenchItem({ id, player }: { id: string; player: Player }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  });

  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
    opacity: isDragging ? 0.75 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} variant="outlined">
      <CardContent sx={{ py: 1.2, "&:last-child": { pb: 1.2 } }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack spacing={0.2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography fontWeight={900}>{player.name}</Typography>
              <Chip size="small" label="ベンチ" />
            </Stack>
            <PlayerMetaLine player={player} />
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              {...attributes}
              {...listeners}
              sx={{
                fontWeight: 900,
                cursor: "grab",
                userSelect: "none",
                px: 1,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
              }}
              title="ここをドラッグで並べ替え"
            >
              ↕
            </Box>

            <DraggableMini player={player} />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

function PitchSlot({
  title,
  dropId,
  player,
}: {
  title: string;
  dropId: string;
  player: Player | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });

  return (
    <Card variant="outlined">
      <CardContent
        ref={setNodeRef}
        sx={{
          py: 1.2,
          "&:last-child": { pb: 1.2 },
          border: "1px dashed",
          borderColor: isOver ? "primary.main" : "divider",
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Box sx={{ width: 96 }}>
            <Typography fontWeight={900}>{title}</Typography>
          </Box>

          <Box sx={{ flex: 1 }}>
            {player ? (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
              >
                <Stack spacing={0.2}>
                  <Typography fontWeight={900}>{player.name}</Typography>
                  <PlayerMetaLine player={player} />
                </Stack>
                <DraggableMini player={player} />
              </Stack>
            ) : (
              <Typography color="text.secondary">
                （ここに投手をドロップ）
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function TrashArea() {
  const { setNodeRef, isOver } = useDroppable({ id: "trash" });
  return (
    <Card variant="outlined">
      <CardContent
        ref={setNodeRef}
        sx={{
          border: "2px dashed",
          borderColor: isOver ? "error.main" : "divider",
          borderRadius: 2,
          textAlign: "center",
          py: 3,
        }}
      >
        <Typography fontWeight={900}>🗑 ゴミ箱</Typography>
        <Typography variant="caption" color="text.secondary">
          配置済みの選手をドラッグしてここに落とすと外れます
        </Typography>
      </CardContent>
    </Card>
  );
}
