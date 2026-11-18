declare module "*.mjs" {
  import type { Pool } from "pg";
  export function testApp(): Promise<{ pool: Pool; url: string; origin: string; close: () => Promise<void> }>;
}
