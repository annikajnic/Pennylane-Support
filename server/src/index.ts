import "dotenv/config";
import cors from "cors";
import express from "express";
import { errorHandler, notFound } from "./lib/http.js";
import { challengesRouter } from "./routes/challenges.js";
import { conversationsRouter } from "./routes/conversations.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/challenges", challengesRouter);
app.use("/conversations", conversationsRouter);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
