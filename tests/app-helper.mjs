import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import pg from "pg";

export async function testApp() {
  if (!process.env.PG_PASSWORD) throw new Error("Load the project's database env before integration tests");
  const database = `ielts_test_${randomBytes(6).toString("hex")}`;
  const sql = statement => {
    const result = spawnSync("docker", ["exec", "-i", "traffic-monitor-db-1", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "umami", "-d", "umami"], {
      input: statement, encoding: "utf8",
    });
    if (result.status !== 0) throw new Error("Isolated test database operation failed");
  };
  sql(`CREATE DATABASE ${database} OWNER ielts; REVOKE ALL ON DATABASE ${database} FROM PUBLIC; GRANT CONNECT ON DATABASE ${database} TO ielts;`);
  const pool = new pg.Pool({
    host: "127.0.0.1", port: 5432, user: "ielts", password: process.env.PG_PASSWORD, database, max: 2,
  });
  let server;
  const close = async () => {
    try {
      if (server && server.exitCode === null) {
        const exited = once(server, "exit");
        server.kill("SIGTERM");
        await exited;
      }
    } finally {
      await pool.end();
      sql(`DROP DATABASE ${database} WITH (FORCE);`);
    }
  };
  try {
    await pool.query(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
    await pool.query(await readFile(new URL("../db/demo.sql", import.meta.url), "utf8"));
    const socket = createServer();
    socket.listen(0, "127.0.0.1");
    await once(socket, "listening");
    const address = socket.address();
    if (!address || typeof address === "string") throw new Error("No free test port");
    const port = address.port;
    await new Promise(resolve => socket.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    const url = `${origin}/ielts`;
    server = spawn(process.execPath, [".next/standalone/server.js"], {
      env: {
        ...process.env, HOSTNAME: "127.0.0.1", PORT: String(port), PG_HOST: "127.0.0.1", PG_DB: database,
        PUBLIC_URL: url, NEXT_PUBLIC_UMAMI_SRC: "", NEXT_PUBLIC_UMAMI_WEBSITE_ID: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    server.stdout.on("data", data => { output += data.toString(); });
    server.stderr.on("data", data => { output += data.toString(); });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (server.exitCode !== null) throw new Error(`Test server exited: ${output}`);
      try { ready = (await fetch(`${url}/api/health`)).ok; } catch { /* Wait for the bounded test server startup. */ }
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw new Error(`Test server did not start: ${output}`);
    return { pool, url, origin, close };
  } catch (error) {
    await close();
    throw error;
  }
}
