import { chromium } from "playwright-chromium";
import fs from "fs";
import path from "path";

async function scrape(ticker) {
  const url = `https://www.wantgoo.com/stock/${encodeURIComponent(ticker)}/dividend-policy/ex-dividend`;
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
  });

  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

  // 抓「現金股利（元）」那個表格：年度 / 股利 / 除息日（排除年總計）
  const rows = await page.$$eval("table", (tables) => {
    const pick = tables.find(t => t.innerText.includes("現金股利") && t.innerText.includes("除息日"));
    if (!pick) return [];
    const out = [];
    let lastYear = "";
    pick.querySelectorAll("tr").forEach(tr => {
      const cells = Array.from(tr.querySelectorAll("th,td")).map(td => td.innerText.trim());
      if (cells.length < 3) return;
      const year = cells[0] || lastYear;
      const cash = cells[1];
      const ex   = cells[2];
      if (year) lastYear = year;
      if (ex && ex !== "--") out.push({ year, cash, ex });
    });
    return out;
  });

  await browser.close();
  return rows;
}

async function main() {
  const ticker = process.env.TICKER || process.argv[2] || "2330";
  const data = await scrape(ticker);

  fs.mkdirSync("data", { recursive: true });
  fs.writeFileSync(`data/${ticker}.json`, JSON.stringify({ ticker, data }, null, 2), "utf8");
  console.log(`Saved data/${ticker}.json (${data.length} rows)`);
}

main().catch(e => { console.error(e); process.exit(1); });
