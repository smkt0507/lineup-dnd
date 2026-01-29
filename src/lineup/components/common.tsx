import { Card, CardContent, Typography } from "@mui/material";

import type { Player } from "../../models";

/**
 * セクションタイトル
 */
export function SectionTitle({ title }: { title: string }) {
  return (
    <Typography variant="h6" fontWeight={900}>
      {title}
    </Typography>
  );
}

/**
 * ヒントカード
 */
export function HintCard({ text }: { text: string }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography color="text.secondary">{text}</Typography>
      </CardContent>
    </Card>
  );
}

/**
 * プレイヤーメタ情報行
 */
export function PlayerMetaLine({ player }: { player: Player }) {
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
