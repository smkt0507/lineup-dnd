import { Card, CardContent, Typography } from "@mui/material";
import { useDroppable } from "@dnd-kit/core";

/**
 * ゴミ箱
 */
export function TrashArea() {
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
