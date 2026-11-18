import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { testApp } from "./app-helper.mjs";

const browser = await chromium.launch({ headless: true });
let app;
const screenshots = process.env.SCREENSHOT_DIR;
try {
  app = await testApp();
  const token = randomBytes(32).toString("hex");
  await app.pool.query("INSERT INTO password_tokens(token_hash,expires_at) VALUES($1,now()+interval '1 hour')", [createHash("sha256").update(token).digest("hex")]);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", error => failures.push(error.message));
  await page.goto(`${app.url}/password#token=${token}`);
  await page.getByLabel("新密码", { exact: true }).fill("BrowserPassword123");
  await page.getByLabel("确认新密码").fill("BrowserPassword123");
  await page.getByRole("button", { name: "保存密码" }).click();
  await page.getByRole("heading", { name: "密码设置好了" }).waitFor();
  assert.equal(new URL(page.url()).hash, "");
  await page.getByRole("link", { name: "前往登录" }).click();
  await page.getByLabel("密码", { exact: true }).fill("BrowserPassword123");
  await page.getByRole("button", { name: "进入 Speaking Room" }).click();
  await page.getByRole("heading", { name: "每一次练习，都算数。" }).waitFor();
  if (screenshots) {
    await mkdir(screenshots, { recursive: true });
    await page.screenshot({ path: `${screenshots}/ielts-overview-desktop.png`, fullPage: true });
  }
  await page.getByRole("button", { name: "打开题库" }).click();
  await page.getByRole("button").filter({ hasText: "你的学习与工作" }).click();
  await page.getByRole("button", { name: "复制题目" }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "Do you work or are you a student?");
  await page.getByRole("button", { name: "添加答案", exact: true }).click();
  await page.getByLabel("标题", { exact: false }).fill("工作经历版");
  await page.getByLabel("推荐答案 / 练习内容").fill("I work as a software developer.\nWhat I enjoy most is solving problems.");
  await page.getByLabel("Feedback / 我的思路").fill("Use a concrete example.\n思路：职业 → 日常工作 → 喜欢的原因。");
  await page.getByRole("button", { name: "保存答案" }).click();
  await page.getByRole("heading", { name: "工作经历版" }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: /题目 Catalog/ }).click();
  await page.getByRole("button").filter({ hasText: "你的学习与工作" }).click();
  await page.getByRole("heading", { name: "工作经历版" }).waitFor();
  await page.getByRole("button", { name: "添加答案", exact: true }).click();
  await page.getByLabel("推荐答案 / 练习内容").fill("I'm currently preparing for a new career.");
  await page.getByRole("button", { name: "保存答案" }).click();
  await page.getByRole("heading", { name: "未命名答案", exact: true }).waitFor();
  await page.getByRole("button", { name: "编辑答案 工作经历版" }).click();
  await page.getByLabel("标题", { exact: false }).fill("工作经历版 · 修改");
  await page.getByRole("button", { name: "保存答案" }).click();
  await page.getByRole("heading", { name: "工作经历版 · 修改" }).waitFor();
  if (screenshots) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${screenshots}/ielts-catalog-desktop.png`, fullPage: true });
  }
  await page.getByLabel("搜索题目").fill("zzzz-nothing");
  await page.getByText("没有找到匹配的题目").waitFor();
  await page.getByRole("button", { name: "清除搜索" }).click();
  await page.getByLabel("只看暂无答案").check();
  assert.equal(await page.locator(".question-item").count(), 11);
  await page.getByLabel("只看暂无答案").uncheck();
  await page.getByRole("button", { name: "Part 2", exact: true }).click();
  assert.equal(await page.locator(".question-item").count(), 4);
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator(".question-list").isVisible(), false);
  await page.getByRole("button", { name: "返回题目列表" }).click();
  assert.equal(await page.locator(".question-list").isVisible(), true);
  await page.getByRole("button").filter({ hasText: "你的学习与工作" }).click();
  assert.equal(await page.locator(".question-list").isVisible(), false);
  if (screenshots) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${screenshots}/ielts-catalog-mobile.png`, fullPage: true });
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "No mobile horizontal overflow");
  await page.getByRole("button", { name: "添加答案", exact: true }).click();
  await page.getByLabel("推荐答案 / 练习内容").fill("Unsaved text");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "返回题目列表" }).click();
  assert.equal(await page.getByLabel("推荐答案 / 练习内容").inputValue(), "Unsaved text");
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "关闭编辑" }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "删除答案 工作经历版 · 修改" }).click();
  await page.getByRole("heading", { name: "工作经历版 · 修改" }).waitFor({ state: "detached" });
  await page.getByRole("button", { name: "学习概览", exact: true }).click();
  await page.getByRole("heading", { name: "每一次练习，都算数。" }).waitFor();
  if (screenshots) await page.screenshot({ path: `${screenshots}/ielts-overview-mobile.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.setViewportSize({ width: 768, height: 1024 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "No tablet horizontal overflow");
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("heading", { name: "回到你的口语空间" }).waitFor();
  assert.deepEqual(failures, []);
  console.log("Browser checks passed: setup/login, copy, persistent multi-answer CRUD, filters, unsaved edits, mobile/tablet layout and logout.");
} finally {
  await browser.close();
  if (app) await app.close();
}
