#!/usr/bin/env node

import { runStdioServer } from "./server.js";

runStdioServer().catch((error) => {
  console.error("Failed to start anki-mcp:", error);
  process.exit(1);
});
