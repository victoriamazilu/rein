import "dotenv/config";
import { BackboardClient } from "backboard-sdk";

const apiKey = process.env.BACKBOARD_API_KEY;
if (!apiKey) {
  throw new Error("Missing BACKBOARD_API_KEY in .env");
}

const client = new BackboardClient({ apiKey });

const first = await client.sendMessage({
  content: "Hello! I'm excited to get started.",
  memory: "Auto",
  stream: false,
});

console.log(first.content);
console.log(`thread_id: ${first.threadId}`);
console.log(`assistant_id: ${first.assistantId}`);

const second = await client.sendMessage({
  content: "What can you help me with?",
  threadId: first.threadId,
  stream: false,
});

console.log(second.content);
