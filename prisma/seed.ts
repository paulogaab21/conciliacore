import "dotenv/config";
import { getServerEnv } from "../src/lib/env";
import { seedDemoData } from "../src/lib/demo-data";
import { prisma } from "../src/lib/prisma";

async function main() {
  const env = getServerEnv();
  await seedDemoData({
    encryptionKey: env.ENCRYPTION_KEY,
    webhookSecret: env.DEMO_WEBHOOK_SECRET,
  });

  console.log("ConciliaCore demo data is ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
