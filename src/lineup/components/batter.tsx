import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { BatterPos, Player } from "../../models";
import { PlayerMetaLine } from "./common";
import { DraggableMini } from "./playerCard";

/**
 * 打順ドロップゾーン
 */
export function BatterDropZone({
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
      title="ここに打順へ配置（野手 + 大谷翔平のみ）"
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

      {/* 配置済みもドラッグ可能 */}
      {player ? (
        <Box sx={{ flexShrink: 0 }}>
          <DraggableMini player={player} />
        </Box>
      ) : null}
    </Box>
  );
}

/**
 * ソート可能な打順行
 */
export function SortableBatterRow(props: {
  rowId: string; // batterRow:<uid>
  dropId: string; // batterDrop:<uid>
  order: number; // 表示上の打順
  batter: { uid: string; playerId: string | null; position: BatterPos };
  player: Player | null;
  onChangePos: (pos: BatterPos) => void;
  batterPosList: readonly BatterPos[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.rowId });

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
            <select
              value={props.batter.position}
              onChange={(e) => props.onChangePos(e.target.value as BatterPos)}
              style={{
                width: "100%",
                padding: "8px 4px",
                borderRadius: "4px",
                border: "1px solid #ccc",
                fontSize: "14px",
              }}
            >
              {props.batterPosList.map((pos) => (
                <option key={pos} value={pos}>
                  {pos}
                </option>
              ))}
            </select>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
