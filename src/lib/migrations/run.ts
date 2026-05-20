import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";

/**
 * Lit tous les fichiers .sql du dossier /src/lib/migrations/ dans l'ordre
 * alphabétique et les exécute via LibSQL.
 *
 * Chaque fichier est découpé en statements individuels (séparés par ";\n")
 * pour être compatible avec client.execute() qui n'accepte qu'une seule
 * instruction à la fois.
 */
export async function runMigrations(): Promise<{ file: string; statements: number }[]> {
  const url =
    process.env.TURSO_DATABASE_URL ??
    `file:${process.cwd()}/.data/vo-radar.db`;

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const migrationsDir = path.join(process.cwd(), "src", "lib", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // ordre alphabétique → numérotation 001, 002…

  const results: { file: string; statements: number }[] = [];

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");

    // Découpe en statements non vides
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const stmt of statements) {
      await client.execute(stmt);
    }

    console.log(`[migrations] applied ${file} (${statements.length} statements)`);
    results.push({ file, statements: statements.length });
  }

  return results;
}
