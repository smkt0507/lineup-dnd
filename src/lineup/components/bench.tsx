import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Player } from "../../models";
import { PlayerMetaLine } from "./common";
import { DraggableMini } from "./playerCard";

/**
 * ベンチドロップエリア
 */
export function BenchDropArea({ children }: { children: React.ReactNode }) {
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

/**
 * ソート可能なベンチアイテム
 */
export function SortableBenchItem({
  id,
  player,
}: {
  id: string;
  player: Player;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

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
