import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

if (!process.argv.includes("--approve-new-secrets")) {
  throw new Error("Approval required: --approve-new-secrets");
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configDir = path.join(homedir(), ".config");
const config = path.join(configDir, "ielts.env");
const monitorConfig = path.join(configDir, "ielts-monitor.env");
const envLink = path.join(root, ".env");
if ([config, monitorConfig, envLink].some(existsSync)) throw new Error("Existing configuration found; refusing to overwrite");

function sql(database, statement, user = "umami", password) {
  const args = ["exec", "-i"];
  if (password) args.push("-e", "PGPASSWORD");
  args.push("traffic-monitor-db-1", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", "-U", user, "-d", database);
  if (password) args.push("-h", "127.0.0.1");
  const result = spawnSync("docker", args, {
    input: statement, encoding: "utf8",
    env: password ? { ...process.env, PGPASSWORD: password } : process.env,
  });
  if (result.status !== 0) throw new Error(`Database setup failed (${database}); SQL and secrets not printed`);
  return result.stdout.trim();
}
if (sql("umami", "SELECT rolname FROM pg_roles WHERE rolname IN ('ielts','ielts_monitor'); SELECT datname FROM pg_database WHERE datname='ielts';")) {
  throw new Error("Target database or roles already exist; refusing to claim them");
}
const password = randomBytes(32).toString("hex");
const monitorPassword = randomBytes(32).toString("hex");
const render = values => Object.entries(values).map(([key, value]) => `${key}='${value}'`).join("\n") + "\n";
await mkdir(configDir, { recursive: true, mode: 0o700 });
await writeFile(config, render({
  PUBLIC_URL: "https://ai-native.japaneast.cloudapp.azure.com/ielts",
  PG_HOST: "db", PG_PORT: "5432", PG_USER: "ielts", PG_DB: "ielts", PG_PASSWORD: password,
  NEXT_PUBLIC_UMAMI_SRC: "", NEXT_PUBLIC_UMAMI_WEBSITE_ID: "",
}), { flag: "wx", mode: 0o600 });
const monitor = { IELTS_PG_USER: "ielts_monitor", IELTS_PG_PASSWORD: monitorPassword, IELTS_PG_DB: "ielts" };
await writeFile(monitorConfig, render(monitor), { flag: "wx", mode: 0o600 });
await symlink(config, envLink);
sql("umami", `
CREATE ROLE ielts LOGIN PASSWORD '${password}';
CREATE ROLE ielts_monitor LOGIN PASSWORD '${monitorPassword}';
CREATE DATABASE ielts OWNER ielts;
REVOKE ALL ON DATABASE ielts FROM PUBLIC;
GRANT CONNECT ON DATABASE ielts TO ielts,ielts_monitor;
`);
sql("ielts", await readFile(path.join(root, "db/schema.sql"), "utf8"), "ielts", password);
sql("ielts", await readFile(path.join(root, "db/demo.sql"), "utf8"), "ielts", password);
sql("ielts", "GRANT USAGE ON SCHEMA public TO ielts_monitor; GRANT SELECT ON service_health TO ielts_monitor;", "ielts", password);
console.log("IELTS database, example catalog, and read-only status monitor initialized. Admin password is not set.");
