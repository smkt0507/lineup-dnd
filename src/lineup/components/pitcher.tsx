import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import { useDroppable } from "@dnd-kit/core";

import type { Player } from "../../models";
import { PlayerMetaLine } from "./common";
import { DraggableMini } from "./playerCard";

/**
 * 投手スロット（ドロップ可能）
 */
export function PitchSlot({
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
