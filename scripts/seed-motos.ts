/**
 * Seed les annonces moto directement dans la DB Turso de prod.
 * Lancer avec: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/seed-motos.ts
 */

// Env vars prod (injectées ci-dessous ou via .env)
process.env.TURSO_DATABASE_URL = "libsql://vo-radar-noahduseigneur-svg.aws-eu-west-1.turso.io";
process.env.TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzkzOTY3MzIsImlkIjoiMDE5ZTQ3MTYtMzQwMS03M2I0LTljNzctNWZjMWZjOGQyZDVkIiwicmlkIjoiYTkxNGI1MTMtMjBiMy00ODA2LTlmZDctODZlYzU5MzhmNGZlIn0.0H-OMGh3lkx9yYaDfV5aYmW5wZwHMQSG3ty7SpAEERuYOcpy5g4zhwGgIqCdwV6vAf0C2B6KEaQoFeJHtQxPDg";
process.env.SCRAPERS_ENABLED = "autoscout24-moto";
process.env.LBC_CRAWL_DELAY_MS = "3000";
process.env.AS24_CRAWL_DELAY_MS = "800";
process.env.LC_CRAWL_DELAY_MS = "2000";
process.env.SCRAPE_BATCH_SIZE = "300";

// Import dynamique après injection des vars
async function main() {
  const { runScrapers } = await import("../src/lib/scrapers/index");
  console.log("🏍️  Démarrage scraping motos vers Turso cloud...");
  const result = await runScrapers({ limit: 300 });
  console.log("✅ Terminé :", JSON.stringify(result, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
