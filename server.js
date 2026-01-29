const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 8080;

// In-memory storage for debug data (in production, use Redis or database)
let debugData = {
  recraft: null
};

// Global scraper control variables
let globalBrowser = null;
let globalPage = null;
let globalScraperPaused = false;
let globalScraperStopped = false;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Serve JSON files specifically
app.use('/files', express.static('public'));
app.use('/screenshots', express.static('screenshots'));

// Test endpoint to check if screenshots are being served
app.get('/test-screenshots', (req, res) => {
  const fs = require('fs');
  const screenshotsDir = path.join(__dirname, 'screenshots');
  
  if (!fs.existsSync(screenshotsDir)) {
    return res.json({ error: 'Screenshots directory does not exist' });
  }
  
  const files = fs.readdirSync(screenshotsDir);
  res.json({ 
    screenshotsDir,
    files: files.filter(f => f.endsWith('.png')),
    count: files.filter(f => f.endsWith('.png')).length
  });
});

// Simple root endpoint for healthcheck
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Scraper API is running',
    timestamp: new Date().toISOString()
  });
});

// Serve the main page at /app
app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the Make.com scraper page
app.get('/make', (req, res) => {
  res.sendFile(path.join(__dirname, 'make.html'));
});

// Serve the KIE.ai scraper page
app.get('/kie', (req, res) => {
  res.sendFile(path.join(__dirname, 'kie.html'));
});

// Serve the KIE.ai AI-powered test page
app.get('/kie-ai', (req, res) => {
  res.sendFile(path.join(__dirname, 'kie-account-ai-test.html'));
});

// Serve the Recraft.ai scraper page
app.get('/recraft', (req, res) => {
  res.sendFile(path.join(__dirname, 'recraft.html'));
});

// Serve the Recraft.ai debug page
app.get('/recraft-debug', (req, res) => {
  res.sendFile(path.join(__dirname, 'recraft-debug.html'));
});

// Debug API endpoint for Recraft.ai
app.get('/api/debug-recraft', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (!debugData.recraft) {
    return res.status(404).json({ 
      error: 'No debug data available. Run the Recraft.ai scraper first.' 
    });
  }

  res.status(200).json(debugData.recraft);
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  try {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Real scraping endpoint
app.post('/api/scrape', async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let browser;
  let page;

  try {
    console.log('🚀 Starting real Latenode scraping...');
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

    console.log('🌐 Navigating to Latenode login page...');
    
    // Navigate to login page
    await page.goto('https://app.latenode.com/auth', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Take screenshot of login page
    const loginScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Login page screenshot taken');

    console.log('✍️ Filling email field...');
    
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

    console.log('➡️ Clicking next button...');
    
    // Click next/continue button
    await clickByText('Suivant|Next');
    await sleep(1200);

    console.log('🔒 Filling password field...');
    
    // Wait for password input and fill it
    await page.waitForSelector('input[type=password],#login,input[name=login]', { timeout: 30000 });
    await page.type('input[type=password],#login,input[name=login]', password, { delay: 25 });

    console.log('🚪 Clicking login button...');
    
    // Click login button
    (await clickByText('Connexion|Se connecter|Sign in')) || await clickByText('Login');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    console.log('📊 Navigating to dashboard...');
    
    // Navigate to scenarios page to see the dashboard
    await page.goto('https://app.latenode.com/scenarios', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    await sleep(3000);

    console.log('📸 STEP 11: Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 STEP 12: Extracting credit information...');
    
    // Extract credit information from the sidebar
    const creditInfo = await page.evaluate(() => {
      // Get all text from the page for comprehensive search
      const allText = document.body.innerText || '';
      console.log('Full page text (first 1000 chars):', allText.substring(0, 1000));
      
      // Look for credit patterns in the entire page text
      // Try multiple patterns to catch different formats
      const creditPatterns = [
        /Credits?\s*left\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /Credits?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Credits/i,
        /Credits?\s*left\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*left/i
      ];
      
      const tokenPatterns = [
        /Plug[&]?Play\s*Tokens?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /Plug[&]?Play\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Plug[&]?Play/i,
        /Plug[&]?Play\s*Tokens?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i
      ];
      
      let creditsMatch = null;
      let tokensMatch = null;
      
      // Try each credit pattern
      for (let pattern of creditPatterns) {
        creditsMatch = allText.match(pattern);
        if (creditsMatch) {
          console.log('Found credits with pattern:', pattern);
          break;
        }
      }
      
      // Try each token pattern
      for (let pattern of tokenPatterns) {
        tokensMatch = allText.match(pattern);
        if (tokensMatch) {
          console.log('Found tokens with pattern:', pattern);
          break;
        }
      }
      
      // If no patterns match, try to find numbers that look like credits
      if (!creditsMatch) {
        // Look for patterns like "296/300" near the word "credit"
        const creditContext = allText.match(/credit[^0-9]*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          console.log('Found credits in context:', creditContext);
        }
      }
      
      if (!tokensMatch) {
        // Look for patterns like "0.82/0" near the word "plug" or "play"
        const tokenContext = allText.match(/(plug|play)[^0-9]*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
        if (tokenContext) {
          tokensMatch = tokenContext;
          console.log('Found tokens in context:', tokenContext);
        }
      }
      
      console.log('Final credits match:', creditsMatch);
      console.log('Final tokens match:', tokensMatch);
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        credits_left: creditsMatch ? creditsMatch[1] : null,
        credits_total: creditsMatch ? creditsMatch[2] : null,
        plugAndPlay_left: tokensMatch ? tokensMatch[1] : null,
        plugAndPlay_total: tokensMatch ? tokensMatch[2] : null
      };
    });

    console.log('✅ Credit info extracted:', creditInfo);

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
});

// Make.com scraping endpoint
app.post('/api/scrape-make', async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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

    // Step 1: Handle cookie consent popup if present
    console.log('🍪 Checking for cookie consent popup...');
    try {
      // Wait a bit for cookie popup to appear
      await sleep(2000);
      
      // Look for cookie consent buttons
      const cookieSelectors = [
        'button:has-text("Accept All Cookies")',
        'button:has-text("Accept all cookies")',
        'button:has-text("Accept All")',
        'button:has-text("Accept all")',
        'button[data-testid="accept-all-cookies"]',
        'button[data-testid="accept-cookies"]',
        '.cookie-accept-all',
        '.accept-all-cookies'
      ];
      
      let cookieAccepted = false;
      for (const selector of cookieSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          cookieAccepted = true;
          console.log('✅ Accepted cookies with selector:', selector);
          await sleep(1000);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      // Fallback: try to find cookie button by text content
      if (!cookieAccepted) {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || '', button);
          if (text && (text.toLowerCase().includes('accept all cookies') || 
                      text.toLowerCase().includes('accept all') ||
                      text.toLowerCase().includes('accept cookies'))) {
            console.log('✅ Accepted cookies by text:', text);
            await button.click();
            await sleep(1000);
            cookieAccepted = true;
            break;
          }
        }
      }
      
      if (cookieAccepted) {
        console.log('🍪 Cookie consent handled successfully');
      } else {
        console.log('ℹ️ No cookie popup detected or already handled');
      }
    } catch (e) {
      console.log('ℹ️ Cookie popup handling failed, continuing...');
    }

    // Step 2: Handle Cloudflare verification if present
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
    
    // Click login button - use proper CSS selectors
    try {
      // Try different selectors for the login button
      const loginSelectors = [
        'button[type="submit"]',
        'button[data-testid="sign-in-button"]',
        'button.sign-in-button',
        'input[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Sign In")',
        'button:has-text("Login")',
        'button:has-text("Log in")'
      ];
      
      let buttonClicked = false;
      for (const selector of loginSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          buttonClicked = true;
          console.log(`✅ Clicked login button with selector: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!buttonClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, input[type="submit"]');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.value, button);
          if (text && (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('login'))) {
            await button.click();
            buttonClicked = true;
            console.log(`✅ Clicked login button with text: ${text}`);
            break;
          }
        }
      }
      
      if (!buttonClicked) {
        throw new Error('Could not find login button');
      }
    } catch (error) {
      console.log('⚠️ Could not click login button, trying alternative approach...');
      // Try pressing Enter on the password field
      await page.keyboard.press('Enter');
    }
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    console.log('🎯 Handling post-login popups...');
    
    // Step 4: Handle modal popup if present
    try {
      // Wait a bit for any popups to appear
      await sleep(3000);
      
      // Look for common popup close buttons
      const popupSelectors = [
        'button[aria-label="Close"]',
        'button[title="Close"]',
        '.modal-close',
        '.popup-close',
        '[data-testid="close"]',
        '.close-button',
        'button[aria-label="×"]',
        'button[title="×"]'
      ];
      
      let popupClosed = false;
      for (const selector of popupSelectors) {
        try {
          const popup = await page.$(selector);
          if (popup) {
            console.log('🚫 Found popup, clicking close button...');
            await popup.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Fallback: try to find close button by text content
      if (!popupClosed) {
        const closeButtons = await page.$$('button, [role="button"]');
        for (const button of closeButtons) {
          const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', button);
          if (text && (text.includes('×') || text.includes('✕') || text.toLowerCase().includes('close'))) {
            console.log('🚫 Found popup close button by text:', text);
            await button.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
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

    console.log('📸 STEP 11: Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 STEP 12: Extracting credit information...');
    
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
});

// KIE.ai scraping endpoint
app.post('/api/scrape-kie', async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  let browser;
  let page;

  try {
    console.log('🚀 Starting KIE.ai scraping...');
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

    console.log('🌐 Navigating to KIE.ai login page...');
    
    // Navigate to login page
    await page.goto('https://kie.ai/login', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Take screenshot of login page
    const loginScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Login page screenshot taken');

    // Step 1: Handle any popups that might appear
    console.log('🎯 Checking for popups...');
    try {
      // Wait a bit for any popups to appear
      await sleep(2000);
      
      // Look for popup close buttons
      const popupSelectors = [
        'button[aria-label="Close"]',
        'button[title="Close"]',
        '.modal-close',
        '.popup-close',
        '[data-testid="close"]',
        '.close-button',
        'button[aria-label="×"]',
        'button[title="×"]'
      ];
      
      let popupClosed = false;
      for (const selector of popupSelectors) {
        try {
          const popup = await page.$(selector);
          if (popup) {
            console.log('🚫 Found popup, clicking close button...');
            await popup.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Fallback: try to find close button by text content
      if (!popupClosed) {
        const closeButtons = await page.$$('button, [role="button"]');
        for (const button of closeButtons) {
          const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', button);
          if (text && (text.includes('×') || text.includes('✕') || text.toLowerCase().includes('close'))) {
            console.log('🚫 Found popup close button by text:', text);
            await button.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        }
      }
      
      // Also try to press Escape key to close any modals
      await page.keyboard.press('Escape');
      await sleep(1000);
      
    } catch (e) {
      console.log('ℹ️ No popup detected or already closed');
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
    
    // Click login button - use proper CSS selectors
    try {
      // Try different selectors for the login button
      const loginSelectors = [
        'button[type="submit"]',
        'button:has-text("Sign In")',
        'button:has-text("Sign in")',
        'button:has-text("Login")',
        'button:has-text("Log in")',
        '.sign-in-button',
        '.login-button'
      ];
      
      let buttonClicked = false;
      for (const selector of loginSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          buttonClicked = true;
          console.log(`✅ Clicked login button with selector: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!buttonClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, input[type="submit"]');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.value, button);
          if (text && (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('login'))) {
            await button.click();
            buttonClicked = true;
            console.log(`✅ Clicked login button with text: ${text}`);
            break;
          }
        }
      }
      
      if (!buttonClicked) {
        throw new Error('Could not find login button');
      }
    } catch (error) {
      console.log('⚠️ Could not click login button, trying alternative approach...');
      // Try pressing Enter on the password field
      await page.keyboard.press('Enter');
    }
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    console.log('📊 Navigating to dashboard...');
    
    // Navigate to dashboard if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      await page.goto('https://kie.ai/dashboard', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
    }
    
    await sleep(3000);

    console.log('📸 STEP 11: Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 STEP 12: Extracting credit information...');
    
    // Extract credit information from the dashboard
    const creditInfo = await page.evaluate(() => {
      // Get all text from the page for comprehensive search
      const allText = document.body.innerText || '';
      console.log('Full page text (first 1000 chars):', allText.substring(0, 1000));
      
      // Look for credit patterns in the entire page text
      const creditPatterns = [
        /Remaining\s*credits?\s*:?\s*([0-9.,]+)/i,
        /Credits?\s*left\s*:?\s*([0-9.,]+)/i,
        /Credits?\s*:?\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*credits?\s*left/i,
        /([0-9.,]+)\s*remaining/i
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
        // Look for patterns like "62,5" near the word "credit" or "remaining"
        const creditContext = allText.match(/(?:credit|remaining)[^0-9]*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          console.log('Found credits in context:', creditContext);
        }
      }
      
      console.log('Final credits match:', creditsMatch);
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        credits_left: creditsMatch ? creditsMatch[1] : null,
        credits_total: null, // KIE.ai only shows remaining credits
        credits_used: null
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
        plugAndPlay_used: null, // KIE.ai doesn't have Plug&Play tokens
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
});

// Recraft.ai scraping endpoint
app.post('/api/scrape-recraft', async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { email, discordEmail, discordPassword, discordToken } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Use provided Discord credentials or token
  const discordCredentials = {
    email: discordEmail,
    password: discordPassword,
    token: discordToken || process.env.DISCORD_BOT_TOKEN || null
  };

  // Initialize debug data
  const startTime = Date.now();
  const debugInfo = {
    email: email,
    discordEmail: discordCredentials.email,
    startTime: new Date().toISOString(),
    steps: [],
    screenshots: [],
    logs: [],
    finalUrl: null,
    executionTime: null,
    ok: false,
    error: null
  };

  let browser;
  let page;

  // Helper function to add debug step
  const addDebugStep = (title, status, description, details = null, error = null, screenshot = null) => {
    const step = {
      title,
      status,
      description,
      details,
      error,
      timestamp: new Date().toISOString(),
      screenshot: screenshot ? screenshot.toString('base64') : null
    };
    debugInfo.steps.push(step);
    console.log(`📋 DEBUG STEP: ${title} - ${status.toUpperCase()}`);
  };

  // Helper function to add debug log
  const addDebugLog = (level, message) => {
    const log = {
      level,
      message,
      timestamp: new Date().toISOString()
    };
    debugInfo.logs.push(log);
  };

  // Helper function to add screenshot
  const addScreenshot = async (title) => {
    try {
      if (page) {
        const screenshot = await page.screenshot({ fullPage: true });
        debugInfo.screenshots.push({
          title,
          data: screenshot.toString('base64'),
          timestamp: new Date().toISOString()
        });
        return screenshot;
      }
    } catch (e) {
      addDebugLog('error', `Failed to take screenshot: ${e.message}`);
    }
    return null;
  };

  // Add initial debug step
  addDebugStep('Scraping Started', 'info', 'Initializing Recraft.ai scraper with Discord login', `Email: ${email}, Discord Email: ${discordCredentials.email}`);
  addDebugLog('info', `Starting scraper with email: ${email}`);
  addDebugLog('info', `Discord credentials: ${discordCredentials.email ? 'Email provided' : 'No email'}, ${discordCredentials.password ? 'Password provided' : 'No password'}, ${discordCredentials.token ? 'Token provided' : 'No token'}`);

  try {
    console.log('🚀 Starting Recraft.ai scraping...');
    console.log('📧 Email:', email);

    // Launch browser with optimized settings for Railway
    addDebugStep('Browser Launch', 'info', 'Launching Puppeteer browser');
    try {
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
      addDebugStep('Browser Launch', 'success', 'Puppeteer browser launched successfully');
    } catch (browserError) {
      addDebugStep('Browser Launch', 'error', 'Failed to launch Puppeteer browser', null, browserError.message);
      throw browserError;
    }

    addDebugStep('Page Creation', 'info', 'Creating new page');
    try {
      page = await browser.newPage();
      addDebugStep('Page Creation', 'success', 'New page created successfully');
    } catch (pageError) {
      addDebugStep('Page Creation', 'error', 'Failed to create new page', null, pageError.message);
      throw pageError;
    }
    
    addDebugStep('Page Configuration', 'info', 'Setting viewport and user agent');
    try {
      await page.setViewport({ width: 1440, height: 900 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      addDebugStep('Page Configuration', 'success', 'Page viewport and user agent set');
    } catch (configError) {
      addDebugStep('Page Configuration', 'error', 'Failed to configure page', null, configError.message);
      throw configError;
    }

    // Helper function for sleep
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // Step 1: Login to Discord using email/password
    console.log('🔐 STEP 1: Logging into Discord...');
    try {
      // Navigate to Discord login page
      console.log('🌐 Navigating to Discord login page...');
      await page.goto('https://discord.com/login', { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      // Wait for page to load
      await sleep(3000);
      
      // Take screenshot of Discord login page
      const discordLoginScreenshot = await addScreenshot('Discord Login Page');
      
      if (discordCredentials.email && discordCredentials.password) {
        console.log('📧 Using Discord email/password login...');
        addDebugStep('Discord Login Method', 'info', 'Using Discord email/password login', `Email: ${discordCredentials.email}`);
        
        // Fill in Discord email
        console.log('✍️ Filling Discord email...');
        try {
          const emailSelectors = [
            'input[name="email"]',
            'input[type="email"]',
            'input[placeholder*="email" i]',
            'input[placeholder*="Email" i]',
            'input[autocomplete="email"]'
          ];
          
          let emailFilled = false;
          for (const selector of emailSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 3000 });
              await page.type(selector, discordCredentials.email, { delay: 50 });
              emailFilled = true;
              console.log('✅ Discord email filled with selector:', selector);
              break;
            } catch (e) {
              console.log('⚠️ Email selector failed:', selector, e.message);
            }
          }
          
          if (!emailFilled) {
            throw new Error('Could not find Discord email input field');
          }
          
          await sleep(1000);
          
          // Fill in Discord password
          console.log('🔒 Filling Discord password...');
          const passwordSelectors = [
            'input[name="password"]',
            'input[type="password"]',
            'input[placeholder*="password" i]',
            'input[placeholder*="Password" i]'
          ];
          
          let passwordFilled = false;
          for (const selector of passwordSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 3000 });
              await page.type(selector, discordCredentials.password, { delay: 50 });
              passwordFilled = true;
              console.log('✅ Discord password filled with selector:', selector);
              break;
            } catch (e) {
              console.log('⚠️ Password selector failed:', selector, e.message);
            }
          }
          
          if (!passwordFilled) {
            throw new Error('Could not find Discord password input field');
          }
          
          await sleep(1000);
          
          // Click login button
          console.log('🚪 Clicking Discord login button...');
          const loginSelectors = [
            'button[type="submit"]',
            'button:has-text("Log In")',
            'button:has-text("Login")',
            'button:has-text("Sign In")',
            'button[class*="login"]',
            'button[class*="submit"]'
          ];
          
          let loginClicked = false;
          for (const selector of loginSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 3000 });
              await page.click(selector);
              loginClicked = true;
              console.log('✅ Discord login button clicked with selector:', selector);
              break;
            } catch (e) {
              console.log('⚠️ Login button selector failed:', selector, e.message);
            }
          }
          
          if (!loginClicked) {
            throw new Error('Could not find Discord login button');
          }
          
          // Wait for login to complete
          await sleep(5000);
          
          // Check if login was successful
          const isLoggedIn = await page.evaluate(() => {
            // Look for elements that indicate we're logged in to Discord
            const guildList = document.querySelector('[class*="guilds"]') || document.querySelector('[data-list-id*="guild"]');
            const userMenu = document.querySelector('[class*="user"]') || document.querySelector('[data-list-item-id*="user"]');
            const channelList = document.querySelector('[class*="channels"]') || document.querySelector('[data-list-id*="channel"]');
            
            return !!(guildList || userMenu || channelList);
          });
          
          if (isLoggedIn) {
            console.log('✅ Successfully logged into Discord!');
            addDebugStep('Discord Login', 'success', 'Successfully logged into Discord with email/password');
            
            // Take screenshot of successful login
            const discordSuccessScreenshot = await addScreenshot('Discord Login Success');
            
          } else {
            console.log('⚠️ Discord login may have failed - checking for errors...');
            addDebugStep('Discord Login', 'warning', 'Discord login may have failed');
            
            // Take screenshot of failed login
            const discordFailedScreenshot = await addScreenshot('Discord Login Failed');
          }
          
        } catch (e) {
          console.log('⚠️ Discord email/password login failed:', e.message);
          addDebugStep('Discord Login', 'error', 'Discord email/password login failed', null, e.message);
        }
        
      } else if (discordCredentials.token) {
        console.log('🔑 Using Discord token login...');
        addDebugStep('Discord Login Method', 'info', 'Using Discord token login');
        
        // Try token-based login (fallback)
        try {
          const response = await fetch('https://discord.com/api/users/@me', {
            headers: {
              'Authorization': discordCredentials.token,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            console.log('✅ Discord token is valid! User:', userData.username);
            addDebugStep('Discord Token Verification', 'success', `Token verified for user: ${userData.username}`, `User ID: ${userData.id}`);
          } else {
            console.log('❌ Discord token is invalid or expired');
            addDebugStep('Discord Token Verification', 'error', 'Discord token is invalid or expired', null, `Status: ${response.status}`);
          }
        } catch (e) {
          console.log('⚠️ Discord token verification failed:', e.message);
          addDebugStep('Discord Token Verification', 'error', 'Discord token verification failed', null, e.message);
        }
      } else {
        console.log('⚠️ No Discord credentials provided');
        addDebugStep('Discord Login', 'warning', 'No Discord credentials provided');
      }
      
    } catch (e) {
      console.log('⚠️ Discord login failed:', e.message);
      addDebugStep('Discord Login', 'error', 'Discord login failed', null, e.message);
    }

    console.log('🌐 STEP 2: Navigating to Recraft.ai...');
    
    // Ensure Discord cookies are still set before navigating to Recraft.ai
    if (discordCredentials.token) {
      await page.setCookie({
        name: 'token',
        value: discordCredentials.token,
        domain: '.discord.com',
        path: '/',
        secure: true,
        sameSite: 'None'
      });
      
      await page.setCookie({
        name: 'discord_token',
        value: discordCredentials.token,
        domain: '.discord.com',
        path: '/',
        secure: true,
        sameSite: 'None'
      });
    }
    
    // Navigate to Recraft.ai landing page
    await page.goto('https://www.recraft.ai/', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Take screenshot of landing page
    const landingScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Landing page screenshot taken');
    
    addDebugStep('Navigation to Recraft.ai', 'success', 'Successfully navigated to Recraft.ai homepage', `URL: ${page.url()}`, null, landingScreenshot);
    
    // Wait for page to fully load
    await sleep(3000);
    
    // Log current URL for debugging
    const landingUrl = page.url();
    console.log('📍 Landing URL:', landingUrl);

    // Step 3: Handle cookie consent popup if present
    console.log('🍪 STEP 3: Checking for cookie consent popup...');
    try {
      await sleep(2000);
      
      // First, let's see what elements are available for cookies
      console.log('📋 Checking for cookie-related elements...');
      const cookieElements = await page.$$('button, a, [role="button"]');
      console.log(`Found ${cookieElements.length} clickable elements on page`);
      
      // Log all elements that might be cookie-related
      for (let i = 0; i < cookieElements.length; i++) {
        const element = cookieElements[i];
        const text = await page.evaluate(el => el.textContent || '', element);
        const className = await page.evaluate(el => el.className || '', element);
        const testId = await page.evaluate(el => el.getAttribute('data-testid') || '', element);
        
        if (text.toLowerCase().includes('accept') || text.toLowerCase().includes('cookie') || 
            text.toLowerCase().includes('privacy') || className.includes('cookie') || 
            testId.includes('cookie') || testId.includes('accept')) {
          console.log(`🍪 Cookie element ${i}: text="${text}", className="${className}", testId="${testId}"`);
        }
      }
      
      // Look for cookie consent buttons
      const cookieSelectors = [
        'button:has-text("Accept All")',
        'button:has-text("Accept all")',
        'button:has-text("Accept All Cookies")',
        'button:has-text("Accept all cookies")',
        'button[data-testid="accept-all-cookies"]',
        'button[data-testid="accept-cookies"]',
        '.cookie-accept-all',
        '.accept-all-cookies',
        'button[class*="accept"]',
        'button[class*="cookie"]'
      ];
      
      let cookieAccepted = false;
      for (const selector of cookieSelectors) {
        try {
          console.log(`🍪 Trying cookie selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          cookieAccepted = true;
          console.log('✅ Accepted cookies with selector:', selector);
          await sleep(1000);
          break;
        } catch (e) {
          console.log('⚠️ Cookie selector failed:', selector, e.message);
        }
      }
      
      // Fallback: try to find cookie button by text content
      if (!cookieAccepted) {
        console.log('🔄 Trying fallback method for cookies...');
        const buttons = await page.$$('button');
        for (let i = 0; i < buttons.length; i++) {
          const button = buttons[i];
          const text = await page.evaluate(el => el.textContent || '', button);
          const className = await page.evaluate(el => el.className || '', button);
          
          if (text && (text.toLowerCase().includes('accept all') || 
                      text.toLowerCase().includes('accept cookies') ||
                      text.toLowerCase().includes('accept'))) {
            console.log(`✅ Found cookie button by text: "${text}", className: "${className}"`);
            await button.click();
            await sleep(1000);
            cookieAccepted = true;
            break;
          }
        }
      }
      
      if (cookieAccepted) {
        console.log('✅ STEP 1 COMPLETE: Cookie consent handled successfully');
        addDebugStep('Cookie Consent', 'success', 'Successfully accepted cookie consent');
      } else {
        console.log('ℹ️ STEP 1 COMPLETE: No cookie popup detected or already handled');
        addDebugStep('Cookie Consent', 'info', 'No cookie popup detected or already handled');
      }
      
      // Take screenshot after cookie handling
      await sleep(2000);
      const afterCookieScreenshot = await addScreenshot('After Cookie Handling');
      
    } catch (e) {
      console.log('⚠️ STEP 1 ERROR: Cookie popup handling failed:', e.message);
      addDebugStep('Cookie Consent', 'error', 'Failed to handle cookie consent', null, e.message);
      
      // Take screenshot even on error
      await sleep(2000);
      const errorScreenshot = await addScreenshot('Cookie Error State');
    }

    console.log('🔍 STEP 4: Looking for Sign In button...');
    
    // First, let's see what elements are available on the page
    console.log('📋 Checking available clickable elements...');
    const allClickableElements = await page.$$('a, button, [role="button"]');
    console.log(`Found ${allClickableElements.length} clickable elements`);
    
    // Log all elements with "sign" or "login" in their text
    for (let i = 0; i < allClickableElements.length; i++) {
      const element = allClickableElements[i];
      const text = await page.evaluate(el => el.textContent || '', element);
      const href = await page.evaluate(el => el.href || '', element);
      const testId = await page.evaluate(el => el.getAttribute('data-testid') || '', element);
      
      if (text.toLowerCase().includes('sign') || text.toLowerCase().includes('login') || 
          href.includes('login') || href.includes('sign') || testId.includes('login')) {
        console.log(`🔍 Element ${i}: text="${text}", href="${href}", testId="${testId}"`);
      }
    }
    
    // Click on Sign In button
    console.log('🔄 STEP 2: Attempting to click Sign In button...');
    try {
      const signInSelectors = [
        'a[data-testid="main-page-login"]',  // Primary selector from your HTML
        'a[href*="/auth/login"]',            // Alternative href selector
        'a:has-text("Sign in")',
        'a:has-text("Sign In")',
        'button:has-text("Sign in")',
        'button:has-text("Sign In")',
        '[href*="sign-in"]',
        '[href*="login"]',
        '.sign-in-button',
        '.login-button'
      ];
      
      let signInClicked = false;
      for (const selector of signInSelectors) {
        try {
          console.log(`🔍 Trying selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: 5000 });
          console.log(`✅ Found element with selector: ${selector}`);
          
          // Get element info before clicking
          const elementInfo = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
              return {
                text: el.textContent || '',
                href: el.href || '',
                testId: el.getAttribute('data-testid') || '',
                tagName: el.tagName
              };
            }
            return null;
          }, selector);
          console.log(`📋 Element info:`, elementInfo);
          
          await page.click(selector);
          signInClicked = true;
          console.log('✅ Clicked Sign In with selector:', selector);
          await sleep(5000); // Wait longer for navigation
          break;
        } catch (e) {
          console.log('⚠️ Selector failed:', selector, e.message);
          // Try next selector
        }
      }
      
      if (!signInClicked) {
        console.log('🔄 Trying fallback method - searching all elements...');
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, a');
        for (let i = 0; i < buttons.length; i++) {
          const button = buttons[i];
          const text = await page.evaluate(el => el.textContent || '', button);
          const href = await page.evaluate(el => el.href || '', button);
          const testId = await page.evaluate(el => el.getAttribute('data-testid') || '', button);
          
          if (text && text.toLowerCase().includes('sign in')) {
            console.log(`✅ Found Sign In button by text: "${text}", href: "${href}", testId: "${testId}"`);
            await button.click();
            await sleep(5000);
            signInClicked = true;
            break;
          }
        }
      }
      
      if (!signInClicked) {
        addDebugStep('Sign In Button', 'error', 'Could not find Sign In button', null, 'No Sign In button found with any selector');
        throw new Error('Could not find Sign In button');
      } else {
        addDebugStep('Sign In Button', 'success', 'Successfully clicked Sign In button');
        
        // Take screenshot after clicking Sign In
        await sleep(3000);
        const afterSignInScreenshot = await addScreenshot('After Sign In Click');
      }
    } catch (error) {
      console.log('⚠️ Could not click Sign In button:', error.message);
      addDebugStep('Sign In Button', 'error', 'Failed to click Sign In button', null, error.message);
      
      // Take screenshot even on error
      await sleep(2000);
      const errorScreenshot = await addScreenshot('Sign In Error State');
      throw error;
    }
    
    // Log URL after clicking Sign In
    const urlAfterSignIn = page.url();
    console.log('📍 URL after Sign In:', urlAfterSignIn);
    
    // Take a screenshot to see what page we're on
    const afterSignInScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Screenshot taken after Sign In click');
    
    // Check if we're on the login page
    if (urlAfterSignIn.includes('/auth/login') || urlAfterSignIn.includes('/login')) {
      console.log('✅ Successfully navigated to login page');
    } else {
      console.log('⚠️ Not on login page - current URL:', urlAfterSignIn);
      console.log('🔍 Checking page content...');
      
      // Get page title and some content to understand where we are
      const pageTitle = await page.title();
      const pageContent = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          hasEmailInput: !!document.querySelector('input[type="email"], input[name="email"], input[name="username"]'),
          hasPasswordInput: !!document.querySelector('input[type="password"]'),
          bodyText: document.body.innerText.substring(0, 500)
        };
      });
      console.log('📋 Page info:', pageContent);
      
      // Check if we're on the "Sorry, nothing to see here" error page
      if (pageContent.bodyText.includes('Sorry, nothing to see here') || 
          pageContent.bodyText.includes('The page you are looking for does not exist')) {
        console.log('🔄 STEP 3: Detected error page - looking for "Go back to recraft" button...');
        
        // First, let's see what elements are available on the error page
        console.log('📋 Checking available elements on error page...');
        const errorPageElements = await page.$$('a, button');
        console.log(`Found ${errorPageElements.length} clickable elements on error page`);
        
        // Log all elements with "go back" or "recraft" in their text or href
        for (let i = 0; i < errorPageElements.length; i++) {
          const element = errorPageElements[i];
          const text = await page.evaluate(el => el.textContent || '', element);
          const href = await page.evaluate(el => el.href || '', element);
          const className = await page.evaluate(el => el.className || '', element);
          
          if (text.toLowerCase().includes('go back') || text.toLowerCase().includes('recraft') || 
              href.includes('recraft') || href.includes('/projects') || className.includes('c-bZNrxE')) {
            console.log(`🔍 Error page element ${i}: text="${text}", href="${href}", className="${className}"`);
          }
        }
        
        try {
          // Look for the "Go back to recraft" button with specific selectors from your HTML
          const goBackSelectors = [
            'a[href="/projects"]',  // Primary selector from your HTML
            'a.c-bZNrxE',          // Specific class from your HTML
            'a[class*="c-bZNrxE"]', // Partial class match
            'a[class*="c-cfmRqm"]', // Another class from your HTML
            'a:has-text("Go back to recraft")',
            'a:has-text("Go back to Recraft")',
            'button:has-text("Go back to recraft")',
            'button:has-text("Go back to Recraft")',
            '[href*="recraft"]',
            'button[class*="back"]',
            'a[class*="back"]'
          ];
          
          let goBackClicked = false;
          for (const selector of goBackSelectors) {
            try {
              console.log(`🔍 Trying go back selector: ${selector}`);
              await page.waitForSelector(selector, { timeout: 3000 });
              await page.click(selector);
              goBackClicked = true;
              console.log('✅ Clicked "Go back to recraft" with selector:', selector);
              await sleep(3000);
              break;
            } catch (e) {
              console.log('⚠️ Go back selector failed:', selector, e.message);
            }
          }
          
          if (!goBackClicked) {
            console.log('🔄 Trying fallback method - searching all elements for exact text...');
            // Fallback: search all buttons for "go back" text
            const buttons = await page.$$('button, a');
            for (let i = 0; i < buttons.length; i++) {
              const button = buttons[i];
              const text = await page.evaluate(el => el.textContent || '', button);
              const href = await page.evaluate(el => el.href || '', button);
              const className = await page.evaluate(el => el.className || '', button);
              
              console.log(`🔍 Checking element ${i}: text="${text}", href="${href}", className="${className}"`);
              
              if (text && (text.toLowerCase().includes('go back') || text.toLowerCase().includes('go back to recraft'))) {
                console.log('✅ Clicked "Go back" by text:', text);
                await button.click();
                await sleep(3000);
                goBackClicked = true;
                break;
              }
            }
          }
          
          if (goBackClicked) {
            const newUrl = page.url();
            console.log('📍 URL after clicking "Go back":', newUrl);
            
            // Check if we're now on the login page
            if (newUrl.includes('/auth/login') || newUrl.includes('/login')) {
              console.log('✅ Successfully navigated to login page via "Go back" button');
              addDebugStep('Go Back Button', 'success', 'Successfully clicked "Go back to recraft" button and navigated to login page', `New URL: ${newUrl}`);
            } else {
              console.log('⚠️ Still not on login page after "Go back" click');
              addDebugStep('Go Back Button', 'warning', 'Clicked "Go back" button but still not on login page', `New URL: ${newUrl}`);
            }
            
            // Take screenshot after Go Back button
            await sleep(3000);
            const afterGoBackScreenshot = await addScreenshot('After Go Back Button Click');
            
          } else {
            console.log('⚠️ Could not find "Go back to recraft" button');
            addDebugStep('Go Back Button', 'error', 'Could not find "Go back to recraft" button');
            
            // Take screenshot of error page
            await sleep(2000);
            const errorPageScreenshot = await addScreenshot('Error Page - No Go Back Button');
          }
        } catch (e) {
          console.log('⚠️ Error handling "Go back" button:', e.message);
        }
      }
    }

    console.log('✍️ STEP 4: Filling email field...');
    
    // Check current URL again after potential "Go back" button click
    const finalUrl = page.url();
    console.log('📍 Final URL before email input:', finalUrl);
    
    // If we're still not on a login page, try to navigate to it manually
    if (!finalUrl.includes('/auth/login') && !finalUrl.includes('/login') && !finalUrl.includes('id.recraft.ai')) {
      console.log('🔄 Still not on login page, trying to navigate to login page manually...');
      try {
        await page.goto('https://id.recraft.ai/realms/recraft/protocol/openid-connect/auth?client_id=frontend-client&scope=openid%20email%20profile&response_type=code&redirect_uri=https%3A%2F%2Fwww.recraft.ai%2Fapi%2Fauth%2Fcallback%2Fkeycloak&grant_type=authorization_code&state=RmXXBVX5QQ-yw7gVJnQhM2a56j55TwJJzpl2MLlMQ6s&code_challenge=0xUu8RvStUZJZrXxoYEMwDJ40lZGhhZ96hqTbSc8rHI&code_challenge_method=S256', { 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        });
        console.log('✅ Manually navigated to login page');
        await sleep(3000);
      } catch (e) {
        console.log('⚠️ Manual navigation failed:', e.message);
      }
    }
    
    // Wait for email input and fill it - now on the authentication page
    try {
      // Use the correct selectors based on the actual HTML element
      const emailSelectors = [
        'input[name="username"]',  // Primary selector based on your HTML
        'input[placeholder="Email"]',
        'input[autocomplete="email"]',
        'input[type="text"]',
        'input[type="email"]',
        'input[name="email"]',
        'input[id="email"]',
        'input[class*="email"]'
      ];
      
      let emailFilled = false;
      for (const selector of emailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.type(selector, email, { delay: 25 });
          emailFilled = true;
          console.log('✅ Email filled with selector:', selector);
          break;
        } catch (e) {
          console.log('⚠️ Selector failed:', selector, e.message);
          // Try next selector
        }
      }
      
          if (!emailFilled) {
            addDebugStep('Email Input', 'error', 'Could not find email input field', null, 'No email input found with any selector');
            throw new Error('Could not find email input field with any selector');
          } else {
            addDebugStep('Email Input', 'success', 'Successfully filled email field', `Email: ${email}`);
            
            // Take screenshot after email input
            await sleep(2000);
            const afterEmailScreenshot = await addScreenshot('After Email Input');
          }
        } catch (error) {
          console.log('⚠️ Email input error:', error.message);
          addDebugStep('Email Input', 'error', 'Failed to fill email field', null, error.message);
          
          // Take screenshot even on error
          await sleep(2000);
          const errorScreenshot = await addScreenshot('Email Input Error State');
          throw error;
        }

    console.log('☑️ STEP 5: Checking verification checkbox...');
    
    // Look for and click verification checkbox (Cloudflare "Verify you are human")
    try {
      const checkboxSelectors = [
        'input[type="checkbox"][aria-label*="human"]',
        'input[type="checkbox"][aria-label*="verify"]',
        'input[type="checkbox"]:not([aria-label*="remember"])', // Exclude "Remember me" checkbox
        '.cf-challenge-running input[type="checkbox"]',
        '[data-ray] input[type="checkbox"]',
        'input[name="cf-turnstile-response"]',
        'input[aria-label*="human"]',
        'input[aria-label*="verify"]'
      ];
      
      let checkboxChecked = false;
      for (const selector of checkboxSelectors) {
        try {
          const checkbox = await page.$(selector);
          if (checkbox) {
            // Check if this is the "Remember me" checkbox and skip it
            const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || '', checkbox);
            const id = await page.evaluate(el => el.getAttribute('id') || '', checkbox);
            const name = await page.evaluate(el => el.getAttribute('name') || '', checkbox);
            
            if (ariaLabel.toLowerCase().includes('remember') || 
                id.toLowerCase().includes('remember') || 
                name.toLowerCase().includes('remember')) {
              console.log('⚠️ Skipping "Remember me" checkbox:', ariaLabel || id || name);
              continue;
            }
            
            await checkbox.click();
            checkboxChecked = true;
            console.log('✅ Clicked verification checkbox with selector:', selector, 'Label:', ariaLabel);
            await sleep(2000);
            break;
          }
        } catch (e) {
          console.log('⚠️ Checkbox selector failed:', selector, e.message);
          // Continue to next selector
        }
      }
      
          if (!checkboxChecked) {
            console.log('🔄 Trying fallback method - searching all checkboxes...');
            // Fallback: find all checkboxes and look for the verification one
            const allCheckboxes = await page.$$('input[type="checkbox"]');
            for (let i = 0; i < allCheckboxes.length; i++) {
              const checkbox = allCheckboxes[i];
              const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || '', checkbox);
              const id = await page.evaluate(el => el.getAttribute('id') || '', checkbox);
              const name = await page.evaluate(el => el.getAttribute('name') || '', checkbox);
              const parentText = await page.evaluate(el => el.parentElement?.textContent || '', checkbox);
              
              console.log(`🔍 Checkbox ${i}: aria-label="${ariaLabel}", id="${id}", name="${name}", parentText="${parentText}"`);
              
              // Skip "Remember me" checkbox
              if (ariaLabel.toLowerCase().includes('remember') || 
                  id.toLowerCase().includes('remember') || 
                  name.toLowerCase().includes('remember') ||
                  parentText.toLowerCase().includes('remember')) {
                console.log('⚠️ Skipping "Remember me" checkbox');
                continue;
              }
              
              // Look for verification/human checkbox
              if (ariaLabel.toLowerCase().includes('human') || 
                  ariaLabel.toLowerCase().includes('verify') ||
                  parentText.toLowerCase().includes('human') ||
                  parentText.toLowerCase().includes('verify')) {
                console.log('✅ Found verification checkbox by text content');
                await checkbox.click();
                checkboxChecked = true;
                await sleep(2000);
                break;
              }
            }
          }
          
          if (!checkboxChecked) {
            console.log('ℹ️ No verification checkbox found, continuing...');
            addDebugStep('Verification Checkbox', 'info', 'No verification checkbox found, continuing...');
          } else {
            addDebugStep('Verification Checkbox', 'success', 'Successfully clicked verification checkbox');
          }
        } catch (e) {
          console.log('ℹ️ Verification checkbox handling failed, continuing...');
          addDebugStep('Verification Checkbox', 'warning', 'Verification checkbox handling failed', null, e.message);
        }
        
        // Take screenshot after verification checkbox
        await sleep(2000);
        const afterCheckboxScreenshot = await addScreenshot('After Verification Checkbox');

    console.log('🚪 STEP 6: Clicking Continue button...');
    
    // Click Continue button
    try {
      const continueSelectors = [
        'button:has-text("Continue")',
        'button:has-text("continue")',
        'button[type="submit"]',
        '.continue-button'
      ];
      
      let continueClicked = false;
      for (const selector of continueSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          continueClicked = true;
          console.log('✅ Clicked Continue with selector:', selector);
          await sleep(3000);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!continueClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || '', button);
          if (text && text.toLowerCase().includes('continue')) {
            console.log('✅ Clicked Continue by text:', text);
            await button.click();
            await sleep(3000);
            continueClicked = true;
            break;
          }
        }
      }
      
          if (!continueClicked) {
            addDebugStep('Continue Button', 'error', 'Could not find Continue button', null, 'No Continue button found with any selector');
            throw new Error('Could not find Continue button');
          } else {
            addDebugStep('Continue Button', 'success', 'Successfully clicked Continue button');
            
            // Take screenshot after Continue button
            await sleep(3000);
            const afterContinueScreenshot = await addScreenshot('After Continue Button Click');
          }
        } catch (error) {
          console.log('⚠️ Could not click Continue button:', error.message);
          addDebugStep('Continue Button', 'error', 'Failed to click Continue button', null, error.message);
          
          // Take screenshot even on error
          await sleep(2000);
          const errorScreenshot = await addScreenshot('Continue Button Error State');
          throw error;
        }

    // Step 7: Click Discord button for OAuth authentication
    console.log('🎮 STEP 7: Looking for Discord button...');
    try {
      // Look for Discord button using the SVG path you provided
      const discordSelectors = [
        'button[aria-label*="Discord"]',
        'button:has-text("Discord")',
        'a[href*="discord"]',
        'button svg path[d*="M20.3303"]', // Your specific SVG path
        'button:has(svg path[d*="M20.3303"])',
        '[data-testid*="discord"]',
        'button[class*="discord"]'
      ];
      
      let discordClicked = false;
      for (const selector of discordSelectors) {
        try {
          console.log(`🎮 Trying Discord selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: 5000 });
          await page.click(selector);
          discordClicked = true;
          console.log('✅ Clicked Discord button with selector:', selector);
          await sleep(3000);
          break;
        } catch (e) {
          console.log('⚠️ Discord selector failed:', selector, e.message);
        }
      }
      
      if (!discordClicked) {
        // Fallback: search all buttons for Discord
        console.log('🔄 Trying fallback method for Discord button...');
        const buttons = await page.$$('button, a');
        for (let i = 0; i < buttons.length; i++) {
          const button = buttons[i];
          const text = await page.evaluate(el => el.textContent || '', button);
          const href = await page.evaluate(el => el.href || '', button);
          const innerHTML = await page.evaluate(el => el.innerHTML || '', button);
          
          if (text.toLowerCase().includes('discord') || 
              href.toLowerCase().includes('discord') ||
              innerHTML.includes('M20.3303')) {
            console.log(`✅ Found Discord button by content: "${text}"`);
            await button.click();
            await sleep(3000);
            discordClicked = true;
            break;
          }
        }
      }
      
      if (discordClicked) {
        addDebugStep('Discord Button', 'success', 'Successfully clicked Discord button');
        
        // Take screenshot after Discord button click
        const afterDiscordScreenshot = await addScreenshot('After Discord Button Click');
        
        // Wait for Discord OAuth popup to open
        console.log('⏳ Waiting for Discord OAuth popup...');
        await sleep(5000);
        
        // Check if we're on Discord OAuth page
        const currentUrl = page.url();
        console.log('📍 Current URL after Discord click:', currentUrl);
        
        if (currentUrl.includes('discord.com') && currentUrl.includes('oauth')) {
          console.log('✅ Successfully redirected to Discord OAuth page');
          addDebugStep('Discord OAuth Redirect', 'success', 'Successfully redirected to Discord OAuth page', `URL: ${currentUrl}`);
          
          // Take screenshot of OAuth page
          const oauthScreenshot = await addScreenshot('Discord OAuth Page');
          
          // Look for "Authorize" button on OAuth page
          try {
            const authorizeSelectors = [
              'button:has-text("Authorize")',
              'button:has-text("authorize")',
              'button:has-text("Allow")',
              'button:has-text("allow")',
              'button[type="submit"]',
              'button[class*="authorize"]',
              'button[class*="allow"]',
              'button[class*="green"]',
              'button[class*="primary"]'
            ];
            
            let authorized = false;
            for (const selector of authorizeSelectors) {
              try {
                console.log(`🔍 Trying authorize selector: ${selector}`);
                await page.waitForSelector(selector, { timeout: 5000 });
                await page.click(selector);
                authorized = true;
                console.log('✅ Clicked Authorize button with selector:', selector);
                await sleep(5000); // Wait longer for redirect back
                break;
              } catch (e) {
                console.log('⚠️ Authorize selector failed:', selector, e.message);
              }
            }
            
            if (authorized) {
              addDebugStep('Discord Authorization', 'success', 'Successfully authorized Discord login');
              const afterAuthScreenshot = await addScreenshot('After Discord Authorization');
              
              // Check if we're back on Recraft.ai
              const finalUrl = page.url();
              console.log('📍 Final URL after authorization:', finalUrl);
              
              if (finalUrl.includes('recraft.ai')) {
                console.log('✅ Successfully returned to Recraft.ai after Discord auth');
                addDebugStep('Return to Recraft', 'success', 'Successfully returned to Recraft.ai after Discord auth', `URL: ${finalUrl}`);
              } else {
                console.log('⚠️ Did not return to Recraft.ai after Discord auth');
                addDebugStep('Return to Recraft', 'warning', 'Did not return to Recraft.ai after Discord auth', `URL: ${finalUrl}`);
              }
            } else {
              addDebugStep('Discord Authorization', 'warning', 'Could not find Authorize button on OAuth page');
            }
          } catch (e) {
            console.log('⚠️ Discord authorization failed:', e.message);
            addDebugStep('Discord Authorization', 'error', 'Discord authorization failed', null, e.message);
          }
        } else if (currentUrl.includes('recraft.ai')) {
          console.log('✅ Already on Recraft.ai - Discord session may be established');
          addDebugStep('Discord Session Check', 'success', 'Already on Recraft.ai - Discord session may be established', `URL: ${currentUrl}`);
          
          // Check if we're already logged in to Recraft.ai
          const isLoggedIn = await page.evaluate(() => {
            // Look for elements that indicate we're logged in to Recraft.ai
            const userMenu = document.querySelector('[class*="user"]') || document.querySelector('[data-testid*="user"]');
            const dashboard = document.querySelector('[class*="dashboard"]') || document.querySelector('[data-testid*="dashboard"]');
            const credits = document.querySelector('[class*="credit"]') || document.querySelector('[class*="balance"]');
            
            return !!(userMenu || dashboard || credits);
          });
          
          if (isLoggedIn) {
            console.log('✅ Successfully logged into Recraft.ai via Discord!');
            addDebugStep('Recraft.ai Login', 'success', 'Successfully logged into Recraft.ai via Discord');
          } else {
            console.log('⚠️ Not logged into Recraft.ai yet, continuing with normal flow...');
            addDebugStep('Recraft.ai Login', 'warning', 'Not logged into Recraft.ai yet, continuing with normal flow');
          }
        } else {
          console.log('⚠️ Did not redirect to Discord OAuth page');
          addDebugStep('Discord OAuth Redirect', 'warning', 'Did not redirect to Discord OAuth page', `Current URL: ${currentUrl}`);
        }
        
      } else {
        addDebugStep('Discord Button', 'error', 'Could not find Discord button');
        console.log('⚠️ Could not find Discord button, continuing with email flow...');
      }
    } catch (e) {
      console.log('⚠️ Discord button handling failed:', e.message);
      addDebugStep('Discord Button', 'error', 'Discord button handling failed', null, e.message);
    }

    console.log('📧 STEP 8: Waiting for verification code page...');
    
    // Wait for verification code page
    await page.waitForSelector('input[type="text"], input[name="code"], input[placeholder*="code"]', { timeout: 30000 });
    
    // Take screenshot of verification page
    const verificationScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Verification page screenshot taken');
    
    addDebugStep('Verification Code Page', 'success', 'Successfully reached verification code page', `URL: ${page.url()}`, null, verificationScreenshot);

    console.log('⏳ STEP 9: Waiting for manual verification code entry...');
    
    // Wait for user to manually enter verification code
    // This is a limitation - we can't automatically read emails
    // The user will need to enter the code manually
    await sleep(10000); // Wait 10 seconds for user to enter code
    
    // Take screenshot after waiting for verification
    const afterVerificationWaitScreenshot = await addScreenshot('After Verification Wait');
    addDebugStep('Manual Verification Wait', 'info', 'Waited 10 seconds for manual verification code entry', null, null, afterVerificationWaitScreenshot);
    
    console.log('🔍 STEP 10: Checking if verification was successful...');
    
    // Check if we're on the dashboard or still on verification page
    const currentUrl = page.url();
    if (currentUrl.includes('verification') || currentUrl.includes('code')) {
      console.log('⚠️ Still on verification page - user needs to enter code manually');
      
      // Return verification required response
      res.status(200).json({
        ok: true,
        data: {
          rawText: 'Verification code required - please check your email and enter the code manually',
          credits_used: null,
          credits_total: null,
          credits_left: null,
          plugAndPlay_used: null,
          plugAndPlay_total: null,
          plugAndPlay_left: null,
          screenshotBase64: verificationScreenshot ? verificationScreenshot.toString('base64') : null,
          verificationRequired: true,
          message: 'Please check your email for the verification code and enter it manually in the browser'
        }
      });
      return;
    }

    console.log('📊 STEP 11: Navigating to dashboard...');
    
    // Navigate to dashboard if not already there
    if (!currentUrl.includes('/dashboard') && !currentUrl.includes('/app')) {
      await page.goto('https://www.recraft.ai/app', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
    }
    
    await sleep(3000);
    
    // Take screenshot after dashboard navigation
    const afterDashboardNavScreenshot = await addScreenshot('After Dashboard Navigation');
    addDebugStep('Dashboard Navigation', 'success', 'Successfully navigated to dashboard', `URL: ${page.url()}`, null, afterDashboardNavScreenshot);

    console.log('📸 STEP 12: Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 STEP 13: Extracting credit information...');
    
    // Extract credit information from the dashboard
    const creditInfo = await page.evaluate(() => {
      // Get all text from the page for comprehensive search
      const allText = document.body.innerText || '';
      console.log('Full page text (first 1000 chars):', allText.substring(0, 1000));
      
      // Look for credit patterns in the entire page text
      const creditPatterns = [
        /Credits?\s*:?\s*([0-9.,]+)/i,
        /Remaining\s*credits?\s*:?\s*([0-9.,]+)/i,
        /Credits?\s*left\s*:?\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*credits?/i,
        /([0-9.,]+)\s*remaining/i
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
        // Look for patterns like "100" near the word "credit"
        const creditContext = allText.match(/(?:credit|remaining)[^0-9]*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          console.log('Found credits in context:', creditContext);
        }
      }
      
      console.log('Final credits match:', creditsMatch);
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        credits_left: creditsMatch ? creditsMatch[1] : null,
        credits_total: null, // Recraft.ai might only show remaining credits
        credits_used: null
      };
    });

    console.log('✅ Credit info extracted:', creditInfo);
    
    // Take final screenshot after credit extraction
    const finalScreenshot = await addScreenshot('Final Credit Extraction');
    addDebugStep('Credit Extraction', 'success', 'Successfully extracted credit information', `Credits: ${creditInfo?.credits_left || 'N/A'}`, null, finalScreenshot);

    // Save debug data
    debugInfo.finalUrl = page.url();
    debugInfo.executionTime = Date.now() - startTime;
    debugInfo.ok = true;
    debugData.recraft = debugInfo;

    // Return success response
    res.status(200).json({
      ok: true,
      data: {
        rawText: creditInfo?.rawText || 'Could not extract credit information',
        credits_used: creditInfo?.credits_used,
        credits_total: creditInfo?.credits_total,
        credits_left: creditInfo?.credits_left,
        plugAndPlay_used: null, // Recraft.ai doesn't have Plug&Play tokens
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
});

// Function to scrape Latenode credits (extracted from the main endpoint)
async function scrapeLatenodeCredits(email, password) {
  let browser;
  let page;

  try {
    console.log('🚀 Starting real Latenode scraping...');
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

    console.log('🌐 Navigating to Latenode login page...');
    
    // Navigate to login page
    await page.goto('https://app.latenode.com/auth', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Take screenshot of login page
    const loginScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Login page screenshot taken');

    console.log('✍️ Filling email field...');
    
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

    console.log('➡️ Clicking next button...');
    
    // Click next/continue button
    await clickByText('Suivant|Next');
    await sleep(1200);

    console.log('🔒 Filling password field...');
    
    // Wait for password input and fill it
    await page.waitForSelector('input[type=password],#login,input[name=login]', { timeout: 30000 });
    await page.type('input[type=password],#login,input[name=login]', password, { delay: 25 });

    console.log('🚪 Clicking login button...');
    
    // Click login button
    (await clickByText('Connexion|Se connecter|Sign in')) || await clickByText('Login');
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    console.log('📊 Navigating to dashboard...');
    
    // Navigate to scenarios page to see the dashboard
    await page.goto('https://app.latenode.com/scenarios', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });
    await sleep(3000);

    console.log('📸 Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 Extracting credit information...');
    
    // Extract credit information from the sidebar
    const creditInfo = await page.evaluate(() => {
      // Get all text from the page for comprehensive search
      const allText = document.body.innerText || '';
      console.log('Full page text (first 1000 chars):', allText.substring(0, 1000));
      
      // Look for credit patterns in the entire page text
      // Try multiple patterns to catch different formats
      const creditPatterns = [
        /Credits?\s*left\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /Credits?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Credits/i,
        /Credits?\s*left\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*left/i
      ];
      
      const tokenPatterns = [
        /Plug[&]?Play\s*Tokens?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /Plug[&]?Play\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Plug[&]?Play/i,
        /Plug[&]?Play\s*Tokens?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i
      ];
      
      let creditsMatch = null;
      let tokensMatch = null;
      
      // Try each credit pattern
      for (let pattern of creditPatterns) {
        creditsMatch = allText.match(pattern);
        if (creditsMatch) {
          console.log('Found credits with pattern:', pattern);
          break;
        }
      }
      
      // Try each token pattern
      for (let pattern of tokenPatterns) {
        tokensMatch = allText.match(pattern);
        if (tokensMatch) {
          console.log('Found tokens with pattern:', pattern);
          break;
        }
      }
      
      // If no patterns match, try to find numbers that look like credits
      if (!creditsMatch) {
        // Look for patterns like "296/300" near the word "credit"
        const creditContext = allText.match(/credit[^0-9]*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          console.log('Found credits in context:', creditContext);
        }
      }
      
      if (!tokensMatch) {
        // Look for patterns like "0.82/0" near the word "plug" or "play"
        const tokenContext = allText.match(/(plug|play)[^0-9]*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
        if (tokenContext) {
          tokensMatch = tokenContext;
          console.log('Found tokens in context:', tokenContext);
        }
      }
      
      console.log('Final credits match:', creditsMatch);
      console.log('Final tokens match:', tokensMatch);
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        credits_left: creditsMatch ? creditsMatch[1] : null,
        credits_total: creditsMatch ? creditsMatch[2] : null,
        plugAndPlay_left: tokensMatch ? tokensMatch[1] : null,
        plugAndPlay_total: tokensMatch ? tokensMatch[2] : null
      };
    });

    console.log('✅ Credit info extracted:', creditInfo);

    // Return success response
    return {
      ok: true,
      rawText: creditInfo?.rawText || 'Could not extract credit information',
      credits_used: creditInfo?.credits_total && creditInfo?.credits_left ? 
        (parseFloat(creditInfo.credits_total) - parseFloat(creditInfo.credits_left)).toString() : null,
      credits_total: creditInfo?.credits_total,
      credits_left: creditInfo?.credits_left,
      plugAndPlay_used: creditInfo?.plugAndPlay_total && creditInfo?.plugAndPlay_left ? 
        (parseFloat(creditInfo.plugAndPlay_total) - parseFloat(creditInfo.plugAndPlay_left)).toString() : null,
      plugAndPlay_total: creditInfo?.plugAndPlay_total,
      plugAndPlay_left: creditInfo?.plugAndPlay_left,
      screenshotBase64: dashboardScreenshot ? dashboardScreenshot.toString('base64') : null
    };

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

    return {
      ok: false,
      error: error.message,
      screenshotBase64: errorScreenshot ? errorScreenshot.toString('base64') : null
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape Make.com credits (extracted from the main endpoint)
async function scrapeMakeCredits(email, password) {
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

    // Step 1: Handle cookie consent popup if present
    console.log('🍪 Checking for cookie consent popup...');
    try {
      // Wait a bit for cookie popup to appear
      await sleep(2000);
      
      // Look for cookie consent buttons
      const cookieSelectors = [
        'button:has-text("Accept All Cookies")',
        'button:has-text("Accept all cookies")',
        'button:has-text("Accept All")',
        'button:has-text("Accept all")',
        'button[data-testid="accept-all-cookies"]',
        'button[data-testid="accept-cookies"]',
        '.cookie-accept-all',
        '.accept-all-cookies'
      ];
      
      let cookieAccepted = false;
      for (const selector of cookieSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          cookieAccepted = true;
          console.log('✅ Accepted cookies with selector:', selector);
          await sleep(1000);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      // Fallback: try to find cookie button by text content
      if (!cookieAccepted) {
        const buttons = await page.$$('button');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || '', button);
          if (text && (text.toLowerCase().includes('accept all cookies') || 
                      text.toLowerCase().includes('accept all') ||
                      text.toLowerCase().includes('accept cookies'))) {
            console.log('✅ Accepted cookies by text:', text);
            await button.click();
            await sleep(1000);
            cookieAccepted = true;
            break;
          }
        }
      }
      
      if (cookieAccepted) {
        console.log('🍪 Cookie consent handled successfully');
      } else {
        console.log('ℹ️ No cookie popup detected or already handled');
      }
    } catch (e) {
      console.log('ℹ️ Cookie popup handling failed, continuing...');
    }

    // Step 2: Handle Cloudflare verification if present
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
    
    // Click login button - use proper CSS selectors
    try {
      // Try different selectors for the login button
      const loginSelectors = [
        'button[type="submit"]',
        'button[data-testid="sign-in-button"]',
        'button.sign-in-button',
        'input[type="submit"]',
        'button:has-text("Sign in")',
        'button:has-text("Sign In")',
        'button:has-text("Login")',
        'button:has-text("Log in")'
      ];
      
      let buttonClicked = false;
      for (const selector of loginSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          buttonClicked = true;
          console.log(`✅ Clicked login button with selector: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!buttonClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, input[type="submit"]');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.value, button);
          if (text && (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('login'))) {
            await button.click();
            buttonClicked = true;
            console.log(`✅ Clicked login button with text: ${text}`);
            break;
          }
        }
      }
      
      if (!buttonClicked) {
        throw new Error('Could not find login button');
      }
    } catch (error) {
      console.log('⚠️ Could not click login button, trying alternative approach...');
      // Try pressing Enter on the password field
      await page.keyboard.press('Enter');
    }
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    console.log('🎯 Handling post-login popups...');
    
    // Step 4: Handle modal popup if present
    try {
      // Wait a bit for any popups to appear
      await sleep(3000);
      
      // Look for common popup close buttons
      const popupSelectors = [
        'button[aria-label="Close"]',
        'button[title="Close"]',
        '.modal-close',
        '.popup-close',
        '[data-testid="close"]',
        '.close-button',
        'button[aria-label="×"]',
        'button[title="×"]'
      ];
      
      let popupClosed = false;
      for (const selector of popupSelectors) {
        try {
          const popup = await page.$(selector);
          if (popup) {
            console.log('🚫 Found popup, clicking close button...');
            await popup.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Fallback: try to find close button by text content
      if (!popupClosed) {
        const closeButtons = await page.$$('button, [role="button"]');
        for (const button of closeButtons) {
          const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', button);
          if (text && (text.includes('×') || text.includes('✕') || text.toLowerCase().includes('close'))) {
            console.log('🚫 Found popup close button by text:', text);
            await button.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        }
      }
      
      // Also try to press Escape key to close any modals
      await page.keyboard.press('Escape');
      await sleep(1000);
      
    } catch (e) {
      console.log('ℹ️ No popup detected or already closed');
    }

    console.log('📊 Navigating to dashboard...');
    
    // First, try to click on the Organization button to get to the proper dashboard
    try {
      console.log('🏢 Looking for Organization button...');
      
      // Wait for the page to load completely
      await sleep(3000);
      
      // Look for Organization button/link in the top navigation
      const orgSelectors = [
        'a[href*="/organization"]',
        'button:has-text("Organization")',
        'a:has-text("Organization")',
        '[data-testid*="organization"]',
        '.organization-link',
        'a[href*="/dashboard"]'
      ];
      
      let orgClicked = false;
      for (const selector of orgSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          orgClicked = true;
          console.log(`✅ Clicked Organization button with selector: ${selector}`);
          await sleep(2000);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      // Fallback: try to find Organization by text content
      if (!orgClicked) {
        const orgElements = await page.$$('a, button, [role="button"]');
        for (const element of orgElements) {
          const text = await page.evaluate(el => el.textContent || el.getAttribute('href') || '', element);
          if (text && (text.toLowerCase().includes('organization') || text.includes('/organization'))) {
            console.log('✅ Clicked Organization button by text:', text);
            await element.click();
            await sleep(2000);
            orgClicked = true;
            break;
          }
        }
      }
      
      if (orgClicked) {
        console.log('✅ Successfully clicked Organization button');
      } else {
        console.log('⚠️ Could not find Organization button, trying direct navigation...');
      }
    } catch (e) {
      console.log('⚠️ Error clicking Organization button:', e.message);
    }
    
    // Navigate to dashboard if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard') && !currentUrl.includes('/organization')) {
      await page.goto('https://eu2.make.com/organization/dashboard', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
    }
    
    // Wait for the page to be visually ready
    console.log('⏳ Waiting for page to be visually ready...');
    await sleep(5000); // Wait 5 seconds for initial load
    
    // Wait for specific elements that indicate the page is loaded
    try {
      // Wait for common dashboard elements
      await page.waitForSelector('[class*="credit"], [class*="balance"], [class*="usage"], [class*="quota"], .dashboard, .organization, [data-testid*="credit"], [data-testid*="balance"]', { 
        timeout: 15000 
      });
      console.log('✅ Dashboard elements found');
    } catch (e) {
      console.log('⚠️ Dashboard elements not found, continuing anyway...');
    }
    
    // Additional wait to ensure everything is rendered
    await sleep(3000);
    
    console.log('📸 Taking dashboard screenshot...');
    
    // Take screenshot of the dashboard
    const dashboardScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Dashboard screenshot taken');

    console.log('🔍 Extracting credit information...');
    
    // Wait a bit more to ensure all content is loaded
    await sleep(2000);
    
    // Extract credit information from the dashboard
    const creditInfo = await page.evaluate(() => {
      // Wait for any loading indicators to disappear
      const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="loader"]');
      if (loadingElements.length > 0) {
        console.log('Loading elements still present, waiting...');
        return { loading: true };
      }
      
      // Get all text from the page for comprehensive search
      const allText = document.body.innerText || '';
      console.log('Full page text (first 1000 chars):', allText.substring(0, 1000));
      
      // Check if we're on the right page (not an error page)
      if (allText.includes('Bad Request') || allText.includes('Invalid number') || allText.includes('organizationId')) {
        console.log('Error page detected, not extracting credits');
        return { error: 'Page not fully loaded or error detected' };
      }
      
      // Look for credit patterns in the entire page text
      const creditPatterns = [
        // Pattern 1: "Credits left: 3.251/10.000" (credits left / total)
        /Credits?\s*left\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Credits?\s*left/i,
        
        // Pattern 2: "~6.749/10.000 (67% used)" (credits used / total)
        /~?([0-9.,]+)\s*\/\s*([0-9.,]+)\s*\([0-9]+%\s*used\)/i,
        /Credits?\s*~?([0-9.,]+)\s*\/\s*([0-9.,]+)\s*\([0-9]+%\s*used\)/i,
        
        // Pattern 3: General "number/number" patterns
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Credits/i,
        /Credits?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*left/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*credits/i,
        /([0-9.,]+)\s*of\s*([0-9.,]+)\s*credits/i,
        /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*used/i
      ];
      
      let creditsMatch = null;
      let isCreditsLeft = false; // Track if we found credits left or credits used
      
      // Try each credit pattern
      for (let i = 0; i < creditPatterns.length; i++) {
        const pattern = creditPatterns[i];
        creditsMatch = allText.match(pattern);
        if (creditsMatch) {
          console.log('Found credits with pattern:', pattern);
          // Patterns 0-1 are "credits left" format, patterns 2+ are "credits used" format
          isCreditsLeft = (i <= 1);
          break;
        }
      }
      
      // If no patterns match, try to find numbers that look like credits
      if (!creditsMatch) {
        // Look for patterns like "8,699/10,000" near the word "credit"
        const creditContext = allText.match(/credit[^0-9]*([0-9.,]+)\s*\/\s*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          isCreditsLeft = true; // Assume it's credits left if found near "credit"
          console.log('Found credits in context:', creditContext);
        }
      }
      
      // Also try to find any number/number pattern that might be credits
      if (!creditsMatch) {
        const numberPattern = /([0-9.,]+)\s*\/\s*([0-9.,]+)/g;
        const matches = [...allText.matchAll(numberPattern)];
        if (matches.length > 0) {
          // Take the first reasonable match (not too small numbers)
          for (const match of matches) {
            const first = parseFloat(match[1].replace(/,/g, ''));
            const second = parseFloat(match[2].replace(/,/g, ''));
            if (first > 0 && second > 0 && first <= second && second > 100) { // Reasonable credit range
              creditsMatch = match;
              // If first number is much smaller than second, it's likely credits left
              // If first number is close to second, it's likely credits used
              isCreditsLeft = (first < second * 0.8);
              console.log('Found credits with number pattern:', match, 'isCreditsLeft:', isCreditsLeft);
              break;
            }
          }
        }
      }
      
      console.log('Final credits match:', creditsMatch, 'isCreditsLeft:', isCreditsLeft);
      
      let credits_left = null;
      let credits_total = null;
      let credits_used = null;
      
      if (creditsMatch) {
        const first = parseFloat(creditsMatch[1].replace(/,/g, ''));
        const second = parseFloat(creditsMatch[2].replace(/,/g, ''));
        
        if (isCreditsLeft) {
          // We found "credits left / total" format
          credits_left = creditsMatch[1];
          credits_total = creditsMatch[2];
          credits_used = (second - first).toString();
        } else {
          // We found "credits used / total" format
          credits_used = creditsMatch[1];
          credits_total = creditsMatch[2];
          credits_left = (second - first).toString();
        }
      }
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        credits_left: credits_left,
        credits_total: credits_total,
        credits_used: credits_used
      };
    });
    
    // If still loading, wait more and try again
    if (creditInfo.loading) {
      console.log('⏳ Page still loading, waiting more...');
      await sleep(5000);
      
      const creditInfoRetry = await page.evaluate(() => {
        const allText = document.body.innerText || '';
        console.log('Retry - Full page text (first 1000 chars):', allText.substring(0, 1000));
        
        if (allText.includes('Bad Request') || allText.includes('Invalid number') || allText.includes('organizationId')) {
          return { error: 'Page still not fully loaded' };
        }
        
        // Same credit extraction logic as above
        const creditPatterns = [
          /Credits?\s*left\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
          /Credits?\s*:?\s*([0-9.,]+)\s*\/\s*([0-9.,]+)/i,
          /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*Credits/i,
          /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*left/i,
          /([0-9.,]+)\s*\/\s*([0-9.,]+)\s*credits/i
        ];
        
        let creditsMatch = null;
        for (let pattern of creditPatterns) {
          creditsMatch = allText.match(pattern);
          if (creditsMatch) break;
        }
        
        return {
          rawText: allText.substring(0, 2000),
          credits_left: creditsMatch ? creditsMatch[1] : null,
          credits_total: creditsMatch ? creditsMatch[2] : null,
          credits_used: creditsMatch ? (parseFloat(creditsMatch[2].replace(/,/g, '')) - parseFloat(creditsMatch[1].replace(/,/g, ''))).toString() : null
        };
      });
      
      Object.assign(creditInfo, creditInfoRetry);
    }

    console.log('✅ Credit info extracted:', creditInfo);

    // Return success response
    return {
      ok: true,
      rawText: creditInfo?.rawText || 'Could not extract credit information',
      credits_used: creditInfo?.credits_used,
      credits_total: creditInfo?.credits_total,
      credits_left: creditInfo?.credits_left,
      plugAndPlay_used: null, // Make.com doesn't have Plug&Play tokens
      plugAndPlay_total: null,
      plugAndPlay_left: null,
      screenshotBase64: dashboardScreenshot ? dashboardScreenshot.toString('base64') : null
    };

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

    return {
      ok: false,
      error: error.message,
      screenshotBase64: errorScreenshot ? errorScreenshot.toString('base64') : null
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Function to scrape KIE.ai credits (extracted from the main endpoint)
async function scrapeKieCredits(email, password) {
  let browser;
  let page;

  try {
    console.log('🚀 Starting KIE.ai scraping...');
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

    console.log('🌐 Navigating to KIE.ai login page...');
    
    // Navigate to login page
    await page.goto('https://kie.ai/login', { 
      waitUntil: 'domcontentloaded', 
      timeout: 60000 
    });

    // Take screenshot of login page
    const loginScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
    console.log('📸 Login page screenshot taken');

    // Step 1: Handle any popups that might appear
    console.log('🎯 Checking for popups...');
    try {
      // Wait a bit for any popups to appear
      await sleep(2000);
      
      // Look for popup close buttons
      const popupSelectors = [
        'button[aria-label="Close"]',
        'button[title="Close"]',
        '.modal-close',
        '.popup-close',
        '[data-testid="close"]',
        '.close-button',
        'button[aria-label="×"]',
        'button[title="×"]'
      ];
      
      let popupClosed = false;
      for (const selector of popupSelectors) {
        try {
          const popup = await page.$(selector);
          if (popup) {
            console.log('🚫 Found popup, clicking close button...');
            await popup.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Fallback: try to find close button by text content
      if (!popupClosed) {
        const closeButtons = await page.$$('button, [role="button"]');
        for (const button of closeButtons) {
          const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', button);
          if (text && (text.includes('×') || text.includes('✕') || text.toLowerCase().includes('close'))) {
            console.log('🚫 Found popup close button by text:', text);
            await button.click();
            await sleep(1000);
            popupClosed = true;
            break;
          }
        }
      }
      
      // Also try to press Escape key to close any modals
      await page.keyboard.press('Escape');
      await sleep(1000);
      
    } catch (e) {
      console.log('ℹ️ No popup detected or already closed');
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
    
    // Click login button - use proper CSS selectors
    try {
      // Try different selectors for the login button
      const loginSelectors = [
        'button[type="submit"]',
        'button:has-text("Sign In")',
        'button:has-text("Sign in")',
        'button:has-text("Login")',
        'button:has-text("Log in")',
        '.sign-in-button',
        '.login-button'
      ];
      
      let buttonClicked = false;
      for (const selector of loginSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          buttonClicked = true;
          console.log(`✅ Clicked login button with selector: ${selector}`);
          break;
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!buttonClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, input[type="submit"]');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.value, button);
          if (text && (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('login'))) {
            await button.click();
            buttonClicked = true;
            console.log(`✅ Clicked login button with text: ${text}`);
            break;
          }
        }
      }
      
      if (!buttonClicked) {
        throw new Error('Could not find login button');
      }
    } catch (error) {
      console.log('⚠️ Could not click login button, trying alternative approach...');
      // Try pressing Enter on the password field
      await page.keyboard.press('Enter');
    }
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});

    console.log('📊 Navigating to dashboard...');
    
    // Navigate to dashboard if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard')) {
      await page.goto('https://kie.ai/dashboard', { 
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
        /Remaining\s*credits?\s*:?\s*([0-9.,]+)/i,
        /Credits?\s*left\s*:?\s*([0-9.,]+)/i,
        /Credits?\s*:?\s*([0-9.,]+)/i,
        /([0-9.,]+)\s*credits?\s*left/i,
        /([0-9.,]+)\s*remaining/i
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
        // Look for patterns like "62,5" near the word "credit" or "remaining"
        const creditContext = allText.match(/(?:credit|remaining)[^0-9]*([0-9.,]+)/i);
        if (creditContext) {
          creditsMatch = creditContext;
          console.log('Found credits in context:', creditContext);
        }
      }
      
      console.log('Final credits match:', creditsMatch);
      
      return {
        rawText: allText.substring(0, 2000), // First 2000 chars for debugging
        remaining_credits: creditsMatch ? creditsMatch[1] : null
      };
    });

    console.log('✅ Credit info extracted:', creditInfo);

    // Return success response
    return {
      ok: true,
      rawText: creditInfo?.rawText || 'Could not extract credit information',
      remaining_credits: creditInfo?.remaining_credits,
      screenshotBase64: dashboardScreenshot ? dashboardScreenshot.toString('base64') : null
    };

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

    return {
      ok: false,
      error: error.message,
      screenshotBase64: errorScreenshot ? errorScreenshot.toString('base64') : null
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// HTTP-based Latenode scraper endpoint - triggers Puppeteer scraper in background
app.post('/api/http/latenode', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      error: 'Email and password are required'
    });
  }

  try {
    console.log('🌐 HTTP Latenode scraping for:', email);
    
    // Call the Puppeteer scraper function directly
    const puppeteerData = await scrapeLatenodeCredits(email, password);
    
    if (puppeteerData.ok) {
      // Return the real data from Puppeteer scraper
      res.json({
        ok: true,
        credits_used: puppeteerData.credits_used,
        credits_total: puppeteerData.credits_total,
        credits_left: puppeteerData.credits_left,
        plugAndPlay_used: puppeteerData.plugAndPlay_used,
        plugAndPlay_total: puppeteerData.plugAndPlay_total,
        plugAndPlay_left: puppeteerData.plugAndPlay_left,
        rawText: puppeteerData.rawText,
        screenshotBase64: puppeteerData.screenshotBase64
      });
    } else {
      // Return error from Puppeteer scraper
      res.status(500).json({
        ok: false,
        error: puppeteerData.error || 'Scraping failed'
      });
    }
  } catch (error) {
    console.error('❌ HTTP Latenode error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// HTTP-based Make.com scraper endpoint - triggers Puppeteer scraper in background
app.post('/api/http/make', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      error: 'Email and password are required'
    });
  }

  try {
    console.log('🌐 HTTP Make.com scraping for:', email);
    
    // Call the Puppeteer scraper function directly
    const puppeteerData = await scrapeMakeCredits(email, password);
    
    if (puppeteerData.ok) {
      // Return the real data from Puppeteer scraper
      res.json({
        ok: true,
        credits_used: puppeteerData.credits_used,
        credits_total: puppeteerData.credits_total,
        credits_left: puppeteerData.credits_left,
        rawText: puppeteerData.rawText,
        screenshotBase64: puppeteerData.screenshotBase64
      });
    } else {
      // Return error from Puppeteer scraper
      res.status(500).json({
        ok: false,
        error: puppeteerData.error || 'Scraping failed'
      });
    }
  } catch (error) {
    console.error('❌ HTTP Make.com error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// HTTP-based KIE.ai scraper endpoint - triggers Puppeteer scraper in background
app.post('/api/http/kie', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      ok: false,
      error: 'Email and password are required'
    });
  }

  try {
    console.log('🌐 HTTP KIE.ai scraping for:', email);
    
    // Call the Puppeteer scraper function directly
    const puppeteerData = await scrapeKieCredits(email, password);
    
    if (puppeteerData.ok) {
      // Return the real data from Puppeteer scraper
      res.json({
        ok: true,
        remaining_credits: puppeteerData.remaining_credits,
        rawText: puppeteerData.rawText,
        screenshotBase64: puppeteerData.screenshotBase64
      });
    } else {
      // Return error from Puppeteer scraper
      res.status(500).json({
        ok: false,
        error: puppeteerData.error || 'Scraping failed'
      });
    }
  } catch (error) {
    console.error('❌ HTTP KIE.ai error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Add error handling for server startup
server.listen(PORT, '0.0.0.0', (err) => {
  if (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
  console.log(`🚀 Latenode Scraper running on port ${PORT}`);
  console.log(`🌐 Visit: http://localhost:${PORT}`);
  console.log(`📊 Available scrapers:`);
  console.log(`   - Latenode: /`);
  console.log(`   - Make.com: /make`);
  console.log(`✅ Server is ready and listening for connections`);
  console.log(`🔍 Health check available at: http://localhost:${PORT}/health`);
  console.log(`   - KIE.ai: /kie`);
  console.log(`   - Recraft.ai: /recraft`);
});

// Recraft.ai Login Test Route (separate from working scrapers)
const { scrapeRecraftLogin } = require('./recraft-scraper');

app.post('/api/recraft-login', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { googleEmail, googlePassword } = req.body;

  if (!googleEmail || !googlePassword) {
    return res.status(400).json({
      ok: false,
      error: 'Google email and password are required'
    });
  }

  try {
    console.log('🎮 Testing Recraft.ai Google login...');
    console.log('📧 Google Email:', googleEmail);
    
    // Call the separate Recraft.ai scraper
    const result = await scrapeRecraftLogin(googleEmail, googlePassword);
    
    // Ensure the response has the expected format
    const response = {
      ok: result.success,
      success: result.success,
      message: result.message || (result.success ? 'Login successful' : 'Login failed'),
      finalUrl: result.finalUrl,
      debugSteps: result.debugSteps,
      screenshots: result.screenshots,
      error: result.error
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ Recraft.ai login test error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Serve Recraft.ai test page
app.get('/recraft-test', (req, res) => {
  res.sendFile(path.join(__dirname, 'recraft-test.html'));
});

// Recraft.ai Live Debug Route (with live browser view)
const { scrapeRecraftLoginLive } = require('./recraft-live-debug');

// Recraft.ai AI-Guided Route (optional import to prevent crashes)
let scrapeRecraftWithAI = null;
try {
  const aiModule = require('./recraft-ai-scraper');
  scrapeRecraftWithAI = aiModule.scrapeRecraftWithAI;
  console.log('✅ AI module loaded successfully');
} catch (error) {
  console.log('⚠️ AI module not available:', error.message);
}

// Recraft.ai Simple Route (fallback for Railway)
const { scrapeRecraftSimple } = require('./recraft-simple-scraper');
const { scrapeRecraftWithSession, getSessionStatus, cleanupSession } = require('./recraft-session-scraper');
const { createLatenodeAccount } = require('./latenode-account-scraper');
const { createKieAccount, createKieAccountAI } = require('./kie-account-scraper');
const { 
  createKieAccountCollaborative, 
  setGuidance, 
  clearGuidance, 
  pauseAI, 
  resumeAI, 
  stopAI, 
  takeManualScreenshot,
  setGlobalPage
} = require('./kie-account-collaborative-scraper');
app.post('/api/recraft-live', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { discordToken, recraftEmail, sessionData } = req.body;

  if (!discordToken || !recraftEmail) {
    return res.status(400).json({
      ok: false,
      error: 'Discord token and Recraft.ai email are required'
    });
  }

  try {
    console.log('🎮 Testing Recraft.ai login with LIVE BROWSER VIEW...');
    console.log('🔑 Discord Token:', discordToken ? 'Provided' : 'Not provided');
    console.log('📧 Recraft Email:', recraftEmail);
    
    // Call the live debug scraper
    const result = await scrapeRecraftLoginLive(discordToken, recraftEmail, sessionData);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Recraft.ai live debug error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Serve Recraft.ai live debug page
app.get('/recraft-live', (req, res) => {
  res.sendFile(path.join(__dirname, 'recraft-live-debug.html'));
});

// Recraft.ai AI-Guided Route
app.post('/api/recraft-ai', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { googleEmail, googlePassword } = req.body;

  if (!googleEmail || !googlePassword) {
    return res.status(400).json({
      ok: false,
      error: 'Google email and password are required for AI-guided scraping'
    });
  }

  try {
    if (!scrapeRecraftWithAI) {
      return res.status(503).json({
        ok: false,
        error: 'AI module not available. Please check server logs.'
      });
    }
    
    console.log('🤖 Starting AI-guided Recraft.ai scraping...');
    console.log('📧 Google Email:', googleEmail);
    
    // Call the AI-guided scraper
    const result = await scrapeRecraftWithAI(googleEmail, googlePassword, io);
    
    res.json(result);
  } catch (error) {
    console.error('❌ AI-guided Recraft.ai error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Serve Recraft.ai AI test page
app.get('/recraft-ai', (req, res) => {
  res.sendFile(path.join(__dirname, 'recraft-ai-test.html'));
});

// Recraft.ai Simple Route (Railway-compatible)
app.post('/api/recraft-simple', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { googleEmail, googlePassword } = req.body;

  if (!googleEmail || !googlePassword) {
    return res.status(400).json({
      ok: false,
      error: 'Google email and password are required for simple scraping'
    });
  }

  try {
    console.log('🚀 Starting simple Recraft.ai scraping...');
    console.log('📧 Google Email:', googleEmail);
    
    // Call the simple scraper
    const result = await scrapeRecraftSimple(googleEmail, googlePassword, io);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Simple Recraft.ai error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Serve Recraft.ai simple test page
app.get('/recraft-simple', (req, res) => {
  res.sendFile(path.join(__dirname, 'recraft-simple-test.html'));
});

// Recraft Simple Real-time Route
app.get('/recraft-simple-realtime', (req, res) => {
  res.sendFile(path.join(__dirname, 'recraft-simple-realtime.html'));
});
// Session-based Recraft.ai Route
app.post('/api/recraft-session', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { googleEmail, googlePassword, prompt } = req.body;

  if (!googleEmail || !googlePassword) {
    return res.status(400).json({
      ok: false,
      error: 'Google email and password are required for session-based scraping'
    });
  }

  try {
    console.log('🚀 Starting session-based Recraft.ai scraping...');
    console.log('📧 Google Email:', googleEmail);
    console.log('🎨 Prompt:', prompt || 'banana bread in kitchen with sun light');
    
    const result = await scrapeRecraftWithSession(googleEmail, googlePassword, prompt, io);
    res.json(result);
  } catch (error) {
    console.error('❌ Session-based Recraft.ai error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Get session status
app.get('/api/recraft-session-status', (req, res) => {
  try {
    const status = getSessionStatus();
    res.json({ ok: true, ...status });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Cleanup session
app.post('/api/recraft-session-cleanup', async (req, res) => {
  try {
    const result = await cleanupSession();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Serve Recraft.ai session test page
app.get('/recraft-session', (req, res) => {
  res.sendFile(path.join(__dirname, 'recraft-session-test.html'));
});

// HTTP-based Latenode account creation endpoint (email optional - uses TempMail if not provided)
app.post('/api/latenode-account-create', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { email, password } = req.body;

  // Only password is required, email is optional (will use TempMail if not provided)
  if (!password) {
    return res.status(400).json({
      ok: false,
      error: 'Password is required. Email is optional (will use TempMail if not provided).'
    });
  }

  try {
    if (email) {
      console.log('🌐 HTTP Latenode account creation with provided email:', email);
    } else {
      console.log('🌐 HTTP Latenode account creation - will use TempMail for email');
    }
    
    // Set global io instance for the scraper
    global.io = io;
    
    // Reset global control flags
    globalScraperPaused = false;
    globalScraperStopped = false;
    global.globalScraperPaused = false;
    global.globalScraperStopped = false;
    
    // Call the Latenode account creation function
    // If email provided: createLatenodeAccount(io, email, password)
    // If no email: createLatenodeAccount(io, password) - will use TempMail
    const result = email 
      ? await createLatenodeAccount(io, email, password)
      : await createLatenodeAccount(io, password);
    
    res.json({
      ok: true,
      success: result.success,
      email: result.tempEmail || result.email || email || 'Generated from TempMail',
      password: result.password || password,
      tempEmail: result.tempEmail,
      confirmationCode: result.confirmationCode,
      credits: result.credits,
      webhookUrl: result.webhookUrl,
      message: result.message,
      debugSteps: result.debugSteps,
      screenshots: result.screenshots,
      error: result.error
    });
  } catch (error) {
    console.error('❌ HTTP Latenode account creation error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Legacy endpoint with typo (kept for backward compatibility)
app.post('/api/http/latenode-acount', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { email, password } = req.body;

  // Only password is required, email is optional (will use TempMail if not provided)
  if (!password) {
    return res.status(400).json({
      ok: false,
      error: 'Password is required. Email is optional (will use TempMail if not provided).'
    });
  }

  try {
    if (email) {
      console.log('🌐 HTTP Latenode account creation with provided email:', email);
    } else {
      console.log('🌐 HTTP Latenode account creation - will use TempMail for email');
    }
    
    // Set global io instance for the scraper
    global.io = io;
    
    // Reset global control flags
    globalScraperPaused = false;
    globalScraperStopped = false;
    global.globalScraperPaused = false;
    global.globalScraperStopped = false;
    
    // Call the Latenode account creation function
    // If email provided: createLatenodeAccount(io, email, password)
    // If no email: createLatenodeAccount(io, password) - will use TempMail
    const result = email 
      ? await createLatenodeAccount(io, email, password)
      : await createLatenodeAccount(io, password);
    
    res.json({
      ok: true,
      success: result.success,
      email: result.tempEmail || result.email || email || 'Generated from TempMail',
      password: result.password || password,
      tempEmail: result.tempEmail,
      confirmationCode: result.confirmationCode,
      credits: result.credits,
      webhookUrl: result.webhookUrl,
      message: result.message,
      debugSteps: result.debugSteps,
      screenshots: result.screenshots,
      error: result.error
    });
  } catch (error) {
    console.error('❌ HTTP Latenode account creation error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Serve Latenode account creation page
app.get('/latenode-account', (req, res) => {
  res.sendFile(path.join(__dirname, 'latenode-account-test.html'));
});

app.get('/kie-account', (req, res) => {
  res.sendFile(path.join(__dirname, 'kie-account-test.html'));
});

// Latenode Account Creation API
app.post('/api/latenode-account', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('🚀 Starting Latenode account creation...');
    
    // Set the global io instance for the scraper
    global.io = io;
    
    // Get password from request body or generate one
    const password = req.body.password || null;
    
    // Pass io instance and password to the scraper function
    const result = await createLatenodeAccount(io, password);
    
    res.json({
      ok: true,
      success: result.success,
      tempEmail: result.tempEmail,
      password: result.password,
      confirmationCode: result.confirmationCode,
      credits: result.credits,
      webhookUrl: result.webhookUrl,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ Latenode account creation error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Kie.ai Account Creation Route
app.post('/api/kie-account', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('🚀 Starting Kie.ai account creation...');
    
    // Set the global io instance for the scraper
    global.io = io;
    
    // Get email and password from request body
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: 'Email and password are required'
      });
    }
    
    // Reset global control flags
    globalScraperPaused = false;
    globalScraperStopped = false;
    
    // Set global variables for scraper access
    global.globalScraperPaused = false;
    global.globalScraperStopped = false;
    
    // Pass io instance and credentials to the scraper function
    const result = await createKieAccount(io, email, password);
    
    res.json({
      ok: true,
      success: result.success,
      email: result.email,
      password: result.password,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ Kie.ai account creation error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Kie.ai AI-Powered Account Creation Route
app.post('/api/kie-account-ai', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('🤖 Starting AI-powered Kie.ai account creation...');
    
    // Set the global io instance for the scraper
    global.io = io;
    
    // Get email and password from request body
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: 'Email and password are required'
      });
    }
    
    // Pass io instance and credentials to the AI scraper function
    const result = await createKieAccountAI(io, email, password);
    
    res.json({
      ok: true,
      success: result.success,
      email: result.email,
      password: result.password,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ AI-powered Kie.ai account creation error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Collaborative Kie.ai Account Creation Route
app.post('/api/kie-account-collaborative', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('🤖 Starting collaborative Kie.ai account creation...');
    
    // Set the global io instance for the scraper
    global.io = io;
    
    // Get email and password from request body
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: 'Email and password are required'
      });
    }
    
    // Pass io instance and credentials to the collaborative scraper function
    const result = await createKieAccountCollaborative(io, email, password);
    
    res.json({
      ok: true,
      success: result.success,
      email: result.email,
      password: result.password,
      message: result.message
    });
    
  } catch (error) {
    console.error('❌ Collaborative Kie.ai account creation error:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Serve collaborative Kie.ai page
app.get('/kie-collaborative', (req, res) => {
  res.sendFile(path.join(__dirname, 'kie-account-collaborative-test.html'));
});

// Serve Outlook account creation page
app.get('/outlook', (req, res) => {
  res.sendFile(path.join(__dirname, 'outlook-account-test.html'));
});

// AI Control Endpoints
app.post('/api/pause-ai', async (req, res) => {
  try {
    pauseAI();
    res.json({ success: true, message: 'AI paused successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/resume-ai', async (req, res) => {
  try {
    resumeAI();
    res.json({ success: true, message: 'AI resumed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/stop-ai', async (req, res) => {
  try {
    stopAI();
    res.json({ success: true, message: 'AI stopped successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Guidance Endpoint
app.post('/api/send-guidance', async (req, res) => {
  try {
    const { guidance } = req.body;
    
    if (!guidance || guidance.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Guidance message is required'
      });
    }
    
    setGuidance(guidance.trim());
    res.json({ success: true, message: 'Guidance sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Manual Screenshot Endpoint
app.post('/api/take-screenshot', async (req, res) => {
  try {
    console.log('📸 Manual screenshot requested');
    
    // Try to take a real screenshot using the global page reference
    const screenshot = await takeManualScreenshot(null); // null because we'll use globalPage
    
    if (screenshot) {
      res.json({ 
        success: true, 
        message: 'Manual screenshot taken successfully',
        screenshot: screenshot
      });
    } else {
      // If no global page, try to create a temporary browser session
      console.log('No global page available, creating temporary browser session...');
      const puppeteer = require('puppeteer');
      
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      
      const page = await browser.newPage();
      await page.goto('https://kie.ai/', { waitUntil: 'networkidle2', timeout: 10000 });
      
      const timestamp = Date.now();
      const filename = `manual-screenshot-${timestamp}.png`;
      const screenshotPath = require('path').join(__dirname, 'screenshots', filename);
      
      // Ensure screenshots directory exists
      const screenshotsDir = require('path').join(__dirname, 'screenshots');
      if (!require('fs').existsSync(screenshotsDir)) {
        require('fs').mkdirSync(screenshotsDir, { recursive: true });
      }
      
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await browser.close();
      
      res.json({ 
        success: true, 
        message: 'Manual screenshot taken successfully (temporary session)',
        screenshot: filename
      });
    }
  } catch (error) {
    console.error('❌ Manual screenshot error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Pause Scraper API
app.post('/api/pause-scraper', async (req, res) => {
  try {
    console.log('⏸️ Pause scraper requested');
    
    // Set global pause flag
    globalScraperPaused = true;
    global.globalScraperPaused = true;
    
    res.json({ 
      success: true, 
      message: 'Scraper paused successfully'
    });
  } catch (error) {
    console.error('❌ Pause scraper error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Resume Scraper API
app.post('/api/resume-scraper', async (req, res) => {
  try {
    console.log('▶️ Resume scraper requested');
    
    // Clear global pause flag
    globalScraperPaused = false;
    global.globalScraperPaused = false;
    
    res.json({ 
      success: true, 
      message: 'Scraper resumed successfully'
    });
  } catch (error) {
    console.error('❌ Resume scraper error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop Scraper API
app.post('/api/stop-scraper', async (req, res) => {
  try {
    console.log('⏹️ Stop scraper requested');
    
    // Set global stop flag
    globalScraperStopped = true;
    globalScraperPaused = false;
    global.globalScraperStopped = true;
    global.globalScraperPaused = false;
    
    // Close any active browser
    if (globalBrowser) {
      try {
        await globalBrowser.close();
        globalBrowser = null;
        globalPage = null;
        console.log('✅ Browser closed successfully');
      } catch (browserError) {
        console.error('❌ Error closing browser:', browserError);
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Scraper stopped successfully'
    });
  } catch (error) {
    console.error('❌ Stop scraper error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clean Browser API
app.post('/api/clean-browser', async (req, res) => {
  try {
    console.log('🧹 Clean browser requested');
    
    // Close any active browser and clean completely
    if (globalBrowser) {
      try {
        // Close all pages first
        const pages = await globalBrowser.pages();
        for (const page of pages) {
          try {
            await page.close();
          } catch (e) {
            // Ignore errors when closing pages
          }
        }
        
        // Clear browser data completely
        try {
          const context = globalBrowser.defaultBrowserContext();
          await context.clearCookies();
          await context.clearPermissions();
          await context.clearCache();
        } catch (e) {
          // Ignore errors when clearing data
        }
        
        await globalBrowser.close();
        globalBrowser = null;
        globalPage = null;
        console.log('✅ Browser cleaned and closed completely - no traces left');
      } catch (browserError) {
        console.error('❌ Error cleaning browser:', browserError);
        globalBrowser = null;
        globalPage = null;
      }
    }
    
    // Reset global flags
    globalScraperPaused = false;
    globalScraperStopped = false;
    global.globalScraperPaused = false;
    global.globalScraperStopped = false;
    
    res.json({ 
      success: true, 
      message: 'Browser cleaned completely - no traces left'
    });
  } catch (error) {
    console.error('❌ Clean browser error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Close Browser API
app.post('/api/close-browser', async (req, res) => {
  try {
    console.log('❌ Close browser requested');
    
    if (globalBrowser) {
      try {
        await globalBrowser.close();
        globalBrowser = null;
        globalPage = null;
        console.log('✅ Browser closed successfully');
      } catch (browserError) {
        console.error('❌ Error closing browser:', browserError);
        globalBrowser = null;
        globalPage = null;
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Browser closed successfully'
    });
  } catch (error) {
    console.error('❌ Close browser error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Go to Dashboard API
app.post('/api/go-to-dashboard', async (req, res) => {
  try {
    console.log('🏠 Go to dashboard requested');
    
    if (!globalBrowser) {
      return res.json({ success: false, message: 'No browser available. Please start the scraper first.' });
    }

    // Get the first available page or create a new one
    let page = globalPage;
    if (!page) {
      const pages = await globalBrowser.pages();
      if (pages.length > 0) {
        page = pages[0];
      } else {
        page = await globalBrowser.newPage();
      }
    }

    // Navigate to Kie.ai dashboard
    await page.goto('https://kie.ai/dashboard', { waitUntil: 'networkidle2' });
    
    // Take a screenshot to show the result
    const timestamp = Date.now();
    const screenshotPath = path.join(__dirname, 'screenshots', `dashboard-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    console.log('✅ Navigated to Kie.ai dashboard successfully');
    res.json({ 
      success: true, 
      message: 'Navigated to Kie.ai dashboard successfully',
      screenshot: `dashboard-${timestamp}.png`
    });
  } catch (error) {
    console.error('❌ Go to dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Outlook Account Creation Route
app.post('/api/outlook-account', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    console.log('🚀 Starting Outlook account creation...');
    
    // Import the Outlook scraper
    const { createOutlookAccount } = require('./outlook-account-scraper');
    
    // Reset global control flags
    globalScraperPaused = false;
    globalScraperStopped = false;
    
    // Start the account creation process
    const result = await createOutlookAccount(email, password, io);
    
    console.log('✅ Outlook account creation completed');
    res.json(result);
    
  } catch (error) {
    console.error('❌ Outlook account creation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Outlook account login endpoint
app.post('/api/outlook-login', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    console.log('🔐 Starting Outlook account login...');
    
    // Import the Outlook login scraper
    const { loginToOutlook } = require('./outlook-login-scraper');
    
    // Reset global control flags
    globalScraperPaused = false;
    globalScraperStopped = false;
    
    // Start the login process
    const result = await loginToOutlook(email, password, io);
    
           console.log('✅ Outlook account login completed');
           if (result.apiKey && result.apiKey !== 'Not Found') {
             console.log(`🔑 Extracted API Key: ${result.apiKey}`);
           }
           res.json(result);
    
  } catch (error) {
    console.error('❌ Outlook account login error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});
