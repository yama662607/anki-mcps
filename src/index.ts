import { runStdioServer } from './server.js';

runStdioServer().catch((error) => {
  console.error('Failed to start anki-mcps:', error);
  process.exit(1);
});
