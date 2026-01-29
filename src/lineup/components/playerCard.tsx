import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import type { Player } from "../../models";
import { PlayerMetaLine } from "./common";

/**
 * ドラッグ可能なプレイヤーカード（プール・配置済み共通）
 */
export function DraggablePlayerCard({ player }: { player: Player }) {
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

/**
 * ドラッグして移動できるミニハンドル
 */
export function DraggableMini({ player }: { player: Player }) {
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
