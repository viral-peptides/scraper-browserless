const puppeteer = require('puppeteer');

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let browser;
  let page;

  try {
    // Launch browser with optimized settings for Vercel
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Helper function for sleep
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // Selectors
    const selBadge = '.iconWrap_CliKB,.circularCredits_Huas1,.progress_KbHPt,.ant-progress-text';
    const selPopover = '.ant-popover .ant-popover-inner';

    // Navigate to login page
    await page.goto('https://app.latenode.com/auth', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Wait for email input and fill it
    await page.waitForSelector('input[type=email],#email,input[name=email]', { timeout: 30000 });
    await page.type('input[type=email],#email,input[name=email]', email, { delay: 25 });

    // Helper function to click by text
    const clickByText = async (regex) => {
      const buttons = await page.$$('button,[role=button],input[type=submit]');
      for (const button of buttons) {
        const text = (await (await button.getProperty('innerText')).jsonValue() || '').trim();
        if (new RegExp(regex, 'i').test(text)) {
          await button.click();
          return true;
        }
      }
      return false;
    };

    // Click next/continue button
    await clickByText('Suivant|Next');
    await sleep(1200);

    // Wait for password input and fill it
    await page.waitForSelector('input[type=password],#login,input[name=login]', { timeout: 30000 });
    await page.type('input[type=password],#login,input[name=login]', password, { delay: 25 });

    // Click login button
    (await clickByText('Connexion|Se connecter|Sign in')) || await clickByText('Login');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    // Navigate to scenarios page
    await page.goto('https://app.latenode.com/scenarios', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    await sleep(1200);

    // Try to open the badge popover
    await page.waitForSelector(selBadge, { timeout: 10000 });
    
    try {
      const badge = await page.$(selBadge);
      if (badge) {
        const box = await badge.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await sleep(400);
        }
      }
      await page.hover(selBadge).catch(() => {});
    } catch (e) {
      console.log('Badge hover failed:', e.message);
    }

    // Wait for popover to appear
    await page.waitForSelector(selPopover, { timeout: 5000 }).catch(() => {});

    // Extract data from popover
    const extracted = await page.evaluate((selPopover) => {
      const popover = document.querySelector(selPopover);
      if (!popover) {
        return {
          rawText: null,
          credits_left: null,
          credits_used: null,
          credits_total: null,
          plugAndPlay_left: null,
          plugAndPlay_total: null,
          plugAndPlay_used: null
        };
      }

      const raw = (popover.innerText || '').replace(/\u00a0/g, ' ').trim();
      
      // Match patterns for credits
      const mCredEN = raw.match(/Credits?\s*left\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
      const mCredFR = raw.match(/Cr[ée]dits?\s*(?:restants|utilis[ée]s)?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
      const mTok = raw.match(/Plug\s*&?\s*Play\s*Tokens?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);

      const result = {
        rawText: raw,
        credits_left: null,
        credits_used: null,
        credits_total: null,
        plugAndPlay_left: null,
        plugAndPlay_total: null,
        plugAndPlay_used: null
      };

      if (mCredEN || mCredFR) {
        const match = mCredEN || mCredFR;
        result.credits_left = match[1];
        result.credits_total = match[2];
      }

      const mUsed = raw.match(/Cr[ée]dits?\s*utilis[ée]s?\s*:?\s*([0-9.,]+)/i);
      if (mUsed) {
        result.credits_used = mUsed[1];
      }

      if (mTok) {
        result.plugAndPlay_left = mTok[1];
        result.plugAndPlay_total = mTok[2];
      }

      const mTokUsed = raw.match(/Plug\s*&?\s*Play\s*(?:Tokens?)?\s*used\s*:?\s*([0-9.,]+)/i);
      if (mTokUsed) {
        result.plugAndPlay_used = mTokUsed[1];
      }

      return result;
    }, selPopover);

    // Take screenshot
    const screenshot = await page.screenshot({ fullPage: false }).catch(() => null);

    // Return success response
    res.status(200).json({
      ok: true,
      data: {
        rawText: extracted.rawText,
        credits_used: extracted.credits_used,
        credits_total: extracted.credits_total,
        credits_left: extracted.credits_left,
        plugAndPlay_used: extracted.plugAndPlay_used,
        plugAndPlay_total: extracted.plugAndPlay_total,
        plugAndPlay_left: extracted.plugAndPlay_left,
        screenshotBase64: screenshot ? screenshot.toString('base64') : null
      }
    });

  } catch (error) {
    console.error('Scraping error:', error);
    
    // Take error screenshot if possible
    let errorScreenshot = null;
    try {
      if (page) {
        errorScreenshot = await page.screenshot({ fullPage: true });
      }
    } catch (e) {
      console.log('Could not take error screenshot:', e.message);
    }

    res.status(500).json({
      ok: false,
      error: error.message,
      screenshotBase64: errorScreenshot ? errorScreenshot.toString('base64') : null
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
