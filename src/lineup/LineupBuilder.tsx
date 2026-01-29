import { useState, useMemo } from "react";
import {
  Box,
  Button,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import type { LineupState, Player } from "../models";
import { createInitialState } from "./createInitialState";
import { exportLineupToCsv, importLineupFromCsv } from "./csv";
import { useLineupLogic, BATTER_POS } from "./useLineupLogic";
import {
  SectionTitle,
  HintCard,
  DraggablePlayerCard,
  SortableBatterRow,
  BenchDropArea,
  SortableBenchItem,
  PitchSlot,
  TrashArea,
} from "./components";

export default function LineupBuilder({ players }: { players: Player[] }) {
  const [state, setState] = useState<LineupState>(() => createInitialState());
  const [csvText, setCsvText] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const { playerMap, isOhtani, getUsedPlayerIds, handleDragEnd } =
    useLineupLogic(players);

  const usedIds = useMemo(
    () => getUsedPlayerIds(state),
    [state, getUsedPlayerIds],
  );

  /**
   * 未配置（打順候補）
   * - 野手は全員OK
   * - 投手は「大谷翔平のみ」OK
   */
  const availableLineupCandidates = useMemo(
    () =>
      players.filter(
        (p) => !usedIds.has(p.id) && (p.type === "B" || isOhtani(p)),
      ),
    [players, usedIds, isOhtani],
  );

  /**
   * 未配置（投手枠用）
   * - 投手のみ（大谷も含めると「投手枠に入れられる」ので含める）
   * - ※もし大谷を投手枠に入れたくないなら isOhtani(p) を除外してください
   */
  const availablePitchers = useMemo(
    () => players.filter((p) => p.type === "P" && !usedIds.has(p.id)),
    [players, usedIds],
  );

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
      onDragEnd={(e) => handleDragEnd(state, setState, e)}
    >
      {/* 2カラム（md以上で 4/8、xsは1カラム） */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "repeat(12, 1fr)" },
        }}
      >
        {/* 左：プールとCSV */}
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

        {/* 右：編成 */}
        <Box sx={{ gridColumn: { md: "span 8" } }}>
          {/* 打順（Sortable） */}
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
                  batterPosList={BATTER_POS}
                />
              ))}
            </Stack>
          </SortableContext>

          <Divider sx={{ my: 2 }} />

          {/* ベンチ（Droppable + Sortable） */}
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

          {/* 投手 */}
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
