import { chromium } from "playwright";

const base = "http://localhost:3000";
const errors = [];

async function checkViewport(page, label, width, height) {
  console.log(`\n=== ${label} ${width}x${height} ===`);
  await page.setViewportSize({ width, height });
  await page.goto(`${base}/timeline`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const bodyText = await page.locator("body").innerText();
  if (bodyText.trim().length < 50) errors.push(`${label}: 页面内容过少/可能空白`);

  const rangeText = await page.locator("text=起点").first().textContent().catch(() => "");
  console.log("起点文案:", rangeText?.trim());

  const stripeCount = await page.locator(".timeline-flow-stripes").count();
  const rowArrows = await page.locator(".timeline-row-flow-arrow").count();
  const oldRipple = await page.locator(".timeline-flow-ripple").count();
  console.log("斜纹块数:", stripeCount, "行箭头层:", rowArrows, "旧水波层:", oldRipple);
  if (oldRipple > 0) errors.push(`${label}: 仍存在 timeline-flow-ripple`);
  if (stripeCount === 0) errors.push(`${label}: 未找到斜纹背景`);
  if (rowArrows === 0) errors.push(`${label}: 未找到行级箭头`);

  const allPerson = await page.locator("select option", { hasText: "全部人员" }).count();
  console.log("全部人员选项:", allPerson > 0 ? "有" : "无");
  if (allPerson === 0) errors.push(`${label}: 缺少全部人员选项`);

  const ownerBtn = page.locator("[data-owner] button").first();
  if (await ownerBtn.count()) {
    await ownerBtn.click();
    await page.waitForTimeout(800);
    const rowArrowsExpanded = await page.locator(".timeline-row-flow-arrow").count();
    console.log("展开行箭头层:", rowArrowsExpanded);

    const block = page.locator(".timeline-bar").first();
    if (await block.count()) {
      await block.click();
      await page.waitForTimeout(500);
      const drawer = await page
        .locator("aside")
        .filter({ hasText: "订单详情" })
        .isVisible()
        .catch(() => false);
      console.log("点击色块打开详情:", drawer ? "是" : "否");
      if (!drawer) errors.push(`${label}: 点击色块未打开详情`);
    }
  }

  if (rowArrows > 0) {
    const anim = await page
      .locator(".timeline-row-flow-arrow")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    console.log("箭头 animationName:", anim);
    if (anim === "none") errors.push(`${label}: 箭头动画未启用`);
  }
}

async function checkImport(page) {
  console.log("\n=== 导入页 ===");
  await page.goto(`${base}/import`, { waitUntil: "networkidle" });
  const pickBtn = await page.getByRole("button", { name: "选择 Excel 文件" }).isVisible();
  console.log("选择 Excel 文件按钮:", pickBtn ? "有" : "无");
  if (!pickBtn) errors.push("导入页缺少文件选择按钮");
}

async function checkAuth(page) {
  console.log("\n=== 登录 ===");
  await page.goto(`${base}/timeline`, { waitUntil: "networkidle" });
  const guestBtn = page.getByRole("button", { name: "游客" });
  if (await guestBtn.count()) {
    errors.push("登录栏仍显示游客按钮");
  } else {
    console.log("游客按钮: 已移除");
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await checkViewport(page, "desktop", 1400, 900);
  await checkViewport(page, "mobile", 390, 844);
  await checkImport(page);
  await checkAuth(page);
} finally {
  await browser.close();
}

if (errors.length) {
  console.log("\n❌ 验收问题:");
  errors.forEach((e) => console.log("-", e));
  process.exit(1);
}
console.log("\n✅ 浏览器验收通过");
