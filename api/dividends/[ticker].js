import { chromium } from "playwright-chromium";

export default async function handler(req, res) {
  const { ticker } = req.query;
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!ticker) return res.status(400).json({ error: "ticker required" });

  const url = `https://www.wantgoo.com/stock/${encodeURIComponent(ticker)}/dividend-policy/ex-dividend`;
  const browser = await chromium.launch({ args: ["--no-sandbox"], headless: true });
  const page = await browser.newPage({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"
  });

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // 抓「現金股利（元）」表格：年度 / 股利 / 除息日（排掉年總計）
    const data = await page.$$eval("table", (tables) => {
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
    res.status(200).json({ ticker, data });
  } catch (e) {
    await browser.close();
    res.status(500).json({ error: e.message });
  }
}
