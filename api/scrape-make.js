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
    console.log('🚀 Starting Make.com scraping...');
    console.log('📧 Email:', email);
    console.log('🔑 Password length:', password.length);

    // Launch browser with optimized settings for Railway
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
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

    console.log('🌐 Navigating to Make.com login page...');
    
    // Navigate to login page
    await page.goto('https://www.make.com/en/login', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Take screenshot of login page
    const loginScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Login page screenshot taken');

    // Step 1: Handle Cloudflare verification if present
    console.log('🔒 Checking for Cloudflare verification...');
    try {
      // Wait for Cloudflare challenge or login form
      await page.waitForSelector('input[type="email"], input[name="email"], .cf-challenge-running, [data-ray]', { timeout: 10000 });
      
      // Check if Cloudflare challenge is present
      const cloudflarePresent = await page.$('.cf-challenge-running, [data-ray]');
      if (cloudflarePresent) {
        console.log('🛡️ Cloudflare verification detected, waiting for completion...');
        
        // Wait for Cloudflare to complete (usually takes 5-10 seconds)
        await page.waitForFunction(() => {
          return !document.querySelector('.cf-challenge-running, [data-ray]');
        }, { timeout: 30000 });
        
        console.log('✅ Cloudflare verification completed');
        await sleep(2000); // Wait a bit more for page to load
      }
    } catch (e) {
      console.log('ℹ️ No Cloudflare verification detected or already completed');
    }

    console.log('✍️ Filling email field...');
    
    // Wait for email input and fill it
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
    await page.type('input[type="email"], input[name="email"]', email, { delay: 25 });

    console.log('🔒 Filling password field...');
    
    // Wait for password input and fill it
    await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 30000 });
    await page.type('input[type="password"], input[name="password"]', password, { delay: 25 });

    console.log('🚪 Clicking login button...');
    
    // Click login button
    await page.click('button[type="submit"], button:contains("Sign in"), .sign-in-button');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    console.log('🎯 Handling post-login popups...');
    
    // Step 3: Handle modal popup if present
    try {
      // Wait a bit for any popups to appear
      await sleep(3000);
      
      // Look for common popup close buttons
      const popupSelectors = [
        'button[aria-label="Close"]',
        'button[title="Close"]',
        '.modal-close',
        '.popup-close',
        'button:contains("×")',
        'button:contains("✕")',
        '[data-testid="close"]',
        '.close-button'
      ];
      
      for (const selector of popupSelectors) {
        try {
          const popup = await page.$(selector);
          if (popup) {
            console.log('🚫 Found popup, clicking close button...');
            await popup.click();
            await sleep(1000);
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Also try to press Escape key to close any modals
      await page.keyboard.press('Escape');
      await sleep(1000);
      
    } catch (e) {
      console.log('ℹ️ No popup detected or already closed');
    }

    console.log('📊 Navigating to dashboard...');
    
    // Navigate to dashboard if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      await page.goto('https://eu2.make.com/organization/dashboard', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
    }
    
    await sleep(3000);

    console.log('📸 Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 Extracting credit information...');
    
    // Extract credit information from the dashboard
    const creditInfo = await page.evaluate(() => {
      // Get all text from the page for comprehensive search
      const allText = document.body.innerText || '';
      console.log('Full page text (first 1000 chars):', allText.substring(0, 1000));
      
      // Look for credit patterns in the entire page text
      const creditPatterns = [
        /Credits?\s*left\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /Credits?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Credits/i,
        /Credits?\s*left\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*left/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*credits/i
      ];
      
      let creditsMatch = null;
      
      // Try each credit pattern
      for (let pattern of creditPatterns) {
        creditsMatch = allText.match(pattern);
        if (creditsMatch) {
          console.log('Found credits with pattern:', pattern);
          break;
        }
      }
      
      // If no patterns match, try to find numbers that look like credits
      if (!creditsMatch) {
        // Look for patterns like "8,699/10,000" near the word "credit"
        const creditContext = allText.match(/credit[^0-9]*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          console.log('Found credits in context:', creditContext);
        }
      }
      
      console.log('Final credits match:', creditsMatch);
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        credits_left: creditsMatch ? creditsMatch[1] : null,
        credits_total: creditsMatch ? creditsMatch[2] : null,
        credits_used: creditsMatch ? (parseFloat(creditsMatch[2].replace(/,/g, '')) - parseFloat(creditsMatch[1].replace(/,/g, ''))).toString() : null
      };
    });

    console.log('✅ Credit info extracted:', creditInfo);

    // Return success response
    res.status(200).json({
      ok: true,
      data: {
        rawText: creditInfo?.rawText || 'Could not extract credit information',
        credits_used: creditInfo?.credits_used,
        credits_total: creditInfo?.credits_total,
        credits_left: creditInfo?.credits_left,
        plugAndPlay_used: null, // Make.com doesn't have Plug&Play tokens
        plugAndPlay_total: null,
        plugAndPlay_left: null,
        screenshotBase64: dashboardScreenshot ? dashboardScreenshot.toString('base64') : null
      }
    });

  } catch (error) {
    console.error('❌ Scraping error:', error);
    
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
