import { CssBaseline, Container, Typography, Box } from "@mui/material";
import LineupBuilder from "./lineup/LineupBuilder";
import { PLAYERS } from "./players";

export default function App() {
  return (
    <>
      <CssBaseline />
      <Container maxWidth="lg">
        <Box py={3}>
          <Typography variant="h5" fontWeight={900} gutterBottom>
            プロ野球オーダー作成（DnD / CSV共有）
          </Typography>
          <LineupBuilder players={PLAYERS} />
        </Box>
      </Container>
    </>
  );
}
