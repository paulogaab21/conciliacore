import "dotenv/config";
import { processNextOutboxEvent } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";
import { getServerEnv } from "@/lib/env";

let stopping = false;

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<void> {
  const { WORKER_POLL_MS } = getServerEnv();
  console.log(`ConciliaCore worker started (poll interval: ${WORKER_POLL_MS}ms)`);

  while (!stopping) {
    const processed = await processNextOutboxEvent();
    if (!processed) await sleep(WORKER_POLL_MS);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
