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

    // Navigate to scenarios page to see the dashboard
    await page.goto('https://app.latenode.com/scenarios', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    await sleep(2000);

    // Take screenshot of the dashboard
    const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);

    // Extract credit information from the sidebar
    const creditInfo = await page.evaluate(() => {
      // Look for credit information in the sidebar
      const sidebar = document.querySelector('[class*="sidebar"], [class*="nav"], [class*="menu"]');
      if (!sidebar) return null;

      const text = sidebar.innerText || '';
      
      // Extract credits information
      const creditsMatch = text.match(/Credits?\s*left\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
      const tokensMatch = text.match(/Plug[&]?Play\s*Tokens?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
      
      return {
        rawText: text,
        credits_left: creditsMatch ? creditsMatch[1] : null,
        credits_total: creditsMatch ? creditsMatch[2] : null,
        plugAndPlay_left: tokensMatch ? tokensMatch[1] : null,
        plugAndPlay_total: tokensMatch ? tokensMatch[2] : null
      };
    });

    // Return success response
    res.status(200).json({
      ok: true,
      data: {
        rawText: creditInfo?.rawText || 'Could not extract credit information',
        credits_used: creditInfo?.credits_total && creditInfo?.credits_left ? 
          (parseFloat(creditInfo.credits_total) - parseFloat(creditInfo.credits_left)).toString() : null,
        credits_total: creditInfo?.credits_total,
        credits_left: creditInfo?.credits_left,
        plugAndPlay_used: creditInfo?.plugAndPlay_total && creditInfo?.plugAndPlay_left ? 
          (parseFloat(creditInfo.plugAndPlay_total) - parseFloat(creditInfo.plugAndPlay_left)).toString() : null,
        plugAndPlay_total: creditInfo?.plugAndPlay_total,
        plugAndPlay_left: creditInfo?.plugAndPlay_left,
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
