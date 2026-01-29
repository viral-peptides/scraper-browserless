const puppeteer = require('puppeteer');

// Recraft.ai Login Scraper - Google Login
async function scrapeRecraftLogin(googleEmail, googlePassword) {
  let browser;
  let page;
  const debugSteps = [];
  const screenshots = [];

  // Helper function to add debug step
  const addDebugStep = (title, status, description, details = null, error = null) => {
    const step = {
      title,
      status,
      description,
      details,
      error,
      timestamp: new Date().toISOString()
    };
    debugSteps.push(step);
    console.log(`📋 DEBUG STEP: ${title} - ${status.toUpperCase()}`);
  };

  // Helper function to take screenshot
  const takeScreenshot = async (title) => {
    try {
      if (page) {
        const screenshot = await page.screenshot({ fullPage: true });
        screenshots.push({
          title,
          data: screenshot.toString('base64'),
          timestamp: new Date().toISOString()
        });
        console.log(`📸 Screenshot taken: ${title}`);
        return screenshot;
      }
    } catch (e) {
      console.log(`❌ Failed to take screenshot: ${e.message}`);
    }
    return null;
  };

  try {
    console.log('🚀 Starting Recraft.ai Google Login Scraper...');
    console.log('📧 Google Email:', googleEmail);

    addDebugStep('Scraper Started', 'info', 'Initializing Recraft.ai login scraper');

    // Launch browser with stealth settings
    addDebugStep('Browser Launch', 'info', 'Launching Puppeteer browser with stealth settings');
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling',
        '--disable-client-side-phishing-detection',
        '--disable-sync',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Add stealth settings to avoid detection
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Mock permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    // Set realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Add extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    });
    
    addDebugStep('Browser Launch', 'success', 'Browser launched with stealth settings');

    // Navigate directly to Recraft.ai login page
    addDebugStep('Recraft Login Navigation', 'info', 'Navigating directly to Recraft.ai login page');
    console.log('🎯 Navigating directly to Recraft.ai login page...');
    
    await page.goto('https://www.recraft.ai/auth/login', { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    
    await sleep(5000);
    await takeScreenshot('Recraft.ai Login Page');
    addDebugStep('Recraft Login Navigation', 'success', 'Navigated to Recraft.ai login page');

    // Look for Google login button
    addDebugStep('Google Login Button', 'info', 'Looking for Google login button');
    console.log('🔍 Looking for Google login button...');
    
    try {
      // Wait for Google login link using the specific attributes
      await page.waitForSelector('a[data-provider="google"], a[href*="broker/google/login"], a:has(svg[viewBox="0 0 24 24"])', { timeout: 15000 });
      
      // Try to click Google button using the specific link
      const googleClicked = await page.evaluate(() => {
        // First, try to find the Google link by data-provider attribute
        const googleLink = document.querySelector('a[data-provider="google"]');
        if (googleLink) {
          googleLink.click();
          return true;
        }
        
        // Look for link with Google broker URL
        const googleBrokerLink = document.querySelector('a[href*="broker/google/login"]');
        if (googleBrokerLink) {
          googleBrokerLink.click();
          return true;
        }
        
        // Look for links containing the Google SVG
        const links = document.querySelectorAll('a');
        for (const link of links) {
          const svg = link.querySelector('svg[viewBox="0 0 24 24"]');
          if (svg) {
            const title = svg.querySelector('title');
            if (title && title.textContent.includes('Google')) {
              link.click();
              return true;
            }
          }
        }
        
        // Fallback selectors
        const selectors = [
          'a[class*="google"]',
          'a:has-text("Google")',
          '[data-testid*="google"]',
          '[class*="google"]',
          'svg[viewBox*="24"]',
          'a[aria-label*="Google"]'
        ];
        
        for (const selector of selectors) {
          try {
            const element = document.querySelector(selector);
            if (element) {
              element.click();
              return true;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        return false;
      });

      if (googleClicked) {
        addDebugStep('Google Login Button', 'success', 'Clicked Google login button');
        console.log('✅ Google login button clicked');
      } else {
        addDebugStep('Google Login Button', 'error', 'Could not find or click Google login button');
        console.log('❌ Could not find Google login button');
      }
    } catch (error) {
      addDebugStep('Google Login Button', 'error', 'Error finding Google login button', null, error.message);
      console.log('❌ Error finding Google login button:', error.message);
    }

    await sleep(5000);
    await takeScreenshot('After Google Button Click');
    addDebugStep('Google Login Button', 'success', 'Navigated to Google login page');

    // Wait for Google login page to load
    addDebugStep('Google Login Page', 'info', 'Waiting for Google login page');
    console.log('⏳ Waiting for Google login page to load...');
    
    await sleep(5000);
    await takeScreenshot('Google Login Page');

    // Wait for Google email input field
    addDebugStep('Google Email Input', 'info', 'Waiting for Google email input field');
    console.log('📧 Waiting for Google email input field...');
    
    try {
      await page.waitForSelector('input[type="email"], input[name="identifier"], input[id="identifierId"], input[placeholder*="email"], input[placeholder*="Email"]', { timeout: 15000 });
      addDebugStep('Google Email Input', 'success', 'Found Google email input field');
      console.log('✅ Found Google email input field');
    } catch (error) {
      addDebugStep('Google Email Input', 'error', 'Could not find Google email input field', null, error.message);
      console.log('❌ Could not find Google email input field:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Google Email Input Found');

    // Clear and fill Google email with human-like behavior
    addDebugStep('Google Email Entry', 'info', 'Clearing and filling Google email field with human-like behavior');
    console.log('✍️ Clearing and filling Google email field with human-like behavior...');
    
    try {
      // Find the email input field
      const emailInput = await page.$('input[type="email"], input[name="identifier"], input[id="identifierId"], input[placeholder*="email"], input[placeholder*="Email"]');
      
      if (emailInput) {
        // Move mouse to the input field (human-like)
        const box = await emailInput.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
          await sleep(500);
        }
        
        // Click the field
        await emailInput.click();
        await sleep(1000);
        
        // Clear the field
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyA');
        await page.keyboard.up('Control');
        await page.keyboard.press('Delete');
        await sleep(500);
        
        // Type the email with human-like delays
        for (const char of googleEmail) {
          await page.keyboard.type(char);
          await sleep(50 + Math.random() * 100); // Random delay between 50-150ms
        }
        
        // Wait for the email to be processed
        await sleep(3000);
        
        addDebugStep('Google Email Entry', 'success', 'Google email filled successfully');
        console.log('✅ Google email filled successfully');
      } else {
        throw new Error('Email input field not found');
      }
    } catch (error) {
      addDebugStep('Google Email Entry', 'error', 'Failed to fill Google email', null, error.message);
      console.log('❌ Failed to fill Google email:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Google Email Filled');

    // Click Next button for email (using specific ID and text)
    addDebugStep('Google Email Next', 'info', 'Looking for Next button after email');
    console.log('➡️ Looking for Next button after email...');
    
    try {
      // Smart button detection - wait for ANY button to appear
      await page.waitForSelector('button, input[type="submit"], input[type="button"]', { timeout: 15000 });
      
      const nextClicked = await page.evaluate(() => {
        console.log('Starting smart button detection...');
        
        // Get ALL buttons on the page
        const allButtons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
        console.log(`Found ${allButtons.length} buttons on the page`);
        
        // Log all buttons for debugging
        for (let i = 0; i < allButtons.length; i++) {
          const button = allButtons[i];
          const text = button.innerText || button.textContent || '';
          const classes = button.className || '';
          const id = button.id || '';
          console.log(`Button ${i}: text="${text.trim()}", classes="${classes}", id="${id}"`);
        }
        
        // Strategy 1: Look for button with "Next" text (case insensitive)
        for (const button of allButtons) {
          const text = (button.innerText || button.textContent || '').trim().toLowerCase();
          if (text === 'next') {
            console.log('Found Next button by exact text match');
            button.click();
            return true;
          }
        }
        
        // Strategy 2: Look for button containing "Next" text
        for (const button of allButtons) {
          const text = (button.innerText || button.textContent || '').trim().toLowerCase();
          if (text.includes('next')) {
            console.log('Found Next button by partial text match:', text);
            button.click();
            return true;
          }
        }
        
        // Strategy 3: Look for span with "Next" text inside buttons
        for (const button of allButtons) {
          const spans = button.querySelectorAll('span');
          for (const span of spans) {
            const text = (span.innerText || span.textContent || '').trim().toLowerCase();
            if (text === 'next') {
              console.log('Found Next button by span text match');
              button.click();
              return true;
            }
          }
        }
        
        // Strategy 4: Look for Google-specific button classes
        for (const button of allButtons) {
          if (button.className.includes('VfPpkd-LgbsSe') || button.getAttribute('jsname') === 'LgbsSe') {
            console.log('Found Google button by classes');
            button.click();
            return true;
          }
        }
        
        // Strategy 5: If only one button, click it
        if (allButtons.length === 1) {
          console.log('Only one button found, clicking it');
          allButtons[0].click();
          return true;
        }
        
        // Strategy 6: Look for blue/primary buttons (Google Next buttons are usually blue)
        for (const button of allButtons) {
          const style = window.getComputedStyle(button);
          const backgroundColor = style.backgroundColor;
          const color = style.color;
          
          // Check if it's a blue button (Google Next buttons are typically blue)
          if (backgroundColor.includes('rgb(11, 87, 208)') || backgroundColor.includes('rgb(11, 87, 208)') || 
              backgroundColor.includes('blue') || button.className.includes('primary')) {
            console.log('Found blue/primary button, clicking it');
            button.click();
            return true;
          }
        }
        
        // Strategy 7: Look for buttons with specific Google attributes
        for (const button of allButtons) {
          if (button.getAttribute('jsname') || button.getAttribute('jscontroller') || button.getAttribute('jsaction')) {
            console.log('Found button with Google attributes, clicking it');
            button.click();
            return true;
          }
        }
        
        // Strategy 8: Click the first clickable button with human-like behavior
        for (const button of allButtons) {
          if (button.offsetParent !== null && !button.disabled) { // Visible and enabled
            console.log('Found visible enabled button, clicking it');
            
            // Scroll to button if needed
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Click the button
            button.click();
            return true;
          }
        }
        
        console.log('No suitable button found');
        return false;
      });

      if (nextClicked) {
        addDebugStep('Google Email Next', 'success', 'Clicked Next button after email');
        console.log('✅ Next button clicked after email');
        
        // Wait longer for Google to process the request
        console.log('⏳ Waiting for Google to process the email...');
        await sleep(5000);
        
        // Take screenshot to see what happened
        await takeScreenshot('After Next Button Click');
        
        // Wait a bit more for potential redirects
        await sleep(3000);
      } else {
        addDebugStep('Google Email Next', 'error', 'Could not find or click Next button - STOPPING HERE');
        console.log('❌ Could not find Next button - STOPPING HERE');
        throw new Error('Could not find Next button - cannot proceed to password step');
      }
    } catch (error) {
      addDebugStep('Google Email Next', 'error', 'Error finding Next button - STOPPING HERE', null, error.message);
      console.log('❌ Error finding Next button - STOPPING HERE:', error.message);
      throw error; // Stop execution here
    }

    await sleep(5000);
    await takeScreenshot('After Email Next Click');

    // Verify we're on the password page before proceeding
    addDebugStep('Password Page Verification', 'info', 'Verifying we are on the password page');
    console.log('🔍 Verifying we are on the password page...');
    
    const passwordPageCheck = await page.evaluate(() => {
      const currentUrl = window.location.href;
      const hasPasswordField = !!document.querySelector('input[type="password"]');
      const hasPasswordText = document.body.innerText.toLowerCase().includes('password');
      const hasNextButton = !!document.querySelector('#passwordNext');
      
      return {
        currentUrl,
        hasPasswordField,
        hasPasswordText,
        hasNextButton,
        pageTitle: document.title
      };
    });
    
    console.log('Password page check:', passwordPageCheck);
    addDebugStep('Password Page Verification', 'info', 'Checking if we reached password page', passwordPageCheck);
    
    if (!passwordPageCheck.hasPasswordField) {
      addDebugStep('Password Page Verification', 'error', 'Not on password page - missing password field');
      console.log('❌ Not on password page - missing password field');
      throw new Error('Not on password page - cannot proceed');
    }

    // Wait for Google password input field
    addDebugStep('Google Password Input', 'info', 'Waiting for Google password input field');
    console.log('🔒 Waiting for Google password input field...');
    
    try {
      await page.waitForSelector('input[type="password"], input[name="password"], input[id="password"], input[placeholder*="password"], input[placeholder*="Password"]', { timeout: 15000 });
      addDebugStep('Google Password Input', 'success', 'Found Google password input field');
      console.log('✅ Found Google password input field');
    } catch (error) {
      addDebugStep('Google Password Input', 'error', 'Could not find Google password input field', null, error.message);
      console.log('❌ Could not find Google password input field:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Google Password Input Found');

    // Clear and fill Google password
    addDebugStep('Google Password Entry', 'info', 'Clearing and filling Google password field');
    console.log('🔐 Clearing and filling Google password field...');
    
    try {
      // Clear the field first
      await page.click('input[type="password"], input[name="password"], input[id="password"], input[placeholder*="password"], input[placeholder*="Password"]');
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Delete');
      
      // Type the password
      await page.type('input[type="password"], input[name="password"], input[id="password"], input[placeholder*="password"], input[placeholder*="Password"]', googlePassword, { delay: 100 });
      
      // Wait a moment for the password to be processed
      await sleep(2000);
      
      addDebugStep('Google Password Entry', 'success', 'Google password filled successfully');
      console.log('✅ Google password filled successfully');
    } catch (error) {
      addDebugStep('Google Password Entry', 'error', 'Failed to fill Google password', null, error.message);
      console.log('❌ Failed to fill Google password:', error.message);
    }

    await sleep(2000);
    await takeScreenshot('Google Password Filled');

    // Click Next button for password (using specific ID)
    addDebugStep('Google Password Next', 'info', 'Looking for Next button after password');
    console.log('➡️ Looking for Next button after password...');
    
    try {
      // Smart button detection - wait for ANY button to appear
      await page.waitForSelector('button, input[type="submit"], input[type="button"]', { timeout: 15000 });
      
      const nextClicked = await page.evaluate(() => {
        console.log('Starting smart password button detection...');
        
        // Get ALL buttons on the page
        const allButtons = document.querySelectorAll('button, input[type="submit"], input[type="button"]');
        console.log(`Found ${allButtons.length} buttons on the password page`);
        
        // Log all buttons for debugging
        for (let i = 0; i < allButtons.length; i++) {
          const button = allButtons[i];
          const text = button.innerText || button.textContent || '';
          const classes = button.className || '';
          const id = button.id || '';
          console.log(`Password Button ${i}: text="${text.trim()}", classes="${classes}", id="${id}"`);
        }
        
        // Strategy 1: Look for button with "Next" text (case insensitive)
        for (const button of allButtons) {
          const text = (button.innerText || button.textContent || '').trim().toLowerCase();
          if (text === 'next') {
            console.log('Found Next button by exact text match');
            button.click();
            return true;
          }
        }
        
        // Strategy 2: Look for button containing "Next" text
        for (const button of allButtons) {
          const text = (button.innerText || button.textContent || '').trim().toLowerCase();
          if (text.includes('next')) {
            console.log('Found Next button by partial text match:', text);
            button.click();
            return true;
          }
        }
        
        // Strategy 3: Look for span with "Next" text inside buttons
        for (const button of allButtons) {
          const spans = button.querySelectorAll('span');
          for (const span of spans) {
            const text = (span.innerText || span.textContent || '').trim().toLowerCase();
            if (text === 'next') {
              console.log('Found Next button by span text match');
              button.click();
              return true;
            }
          }
        }
        
        // Strategy 4: Look for Google-specific button classes
        for (const button of allButtons) {
          if (button.className.includes('VfPpkd-LgbsSe') || button.getAttribute('jsname') === 'LgbsSe') {
            console.log('Found Google button by classes');
            button.click();
            return true;
          }
        }
        
        // Strategy 5: Look for passwordNext button specifically
        const passwordNext = document.querySelector('#passwordNext');
        if (passwordNext) {
          console.log('Found passwordNext button by ID');
          passwordNext.click();
          return true;
        }
        
        // Strategy 6: If only one button, click it
        if (allButtons.length === 1) {
          console.log('Only one button found, clicking it');
          allButtons[0].click();
          return true;
        }
        
        // Strategy 7: Look for blue/primary buttons (Google Next buttons are usually blue)
        for (const button of allButtons) {
          const style = window.getComputedStyle(button);
          const backgroundColor = style.backgroundColor;
          
          // Check if it's a blue button (Google Next buttons are typically blue)
          if (backgroundColor.includes('rgb(11, 87, 208)') || backgroundColor.includes('blue') || button.className.includes('primary')) {
            console.log('Found blue/primary button, clicking it');
            button.click();
            return true;
          }
        }
        
        // Strategy 8: Click the first clickable button
        for (const button of allButtons) {
          if (button.offsetParent !== null && !button.disabled) { // Visible and enabled
            console.log('Found visible enabled button, clicking it');
            button.click();
            return true;
          }
        }
        
        console.log('No suitable button found');
        return false;
      });

      if (nextClicked) {
        addDebugStep('Google Password Next', 'success', 'Clicked Next button after password');
        console.log('✅ Next button clicked after password');
        
        // Wait longer for Google to process the password
        console.log('⏳ Waiting for Google to process the password...');
        await sleep(5000);
        
        // Take screenshot to see what happened
        await takeScreenshot('After Password Next Click');
        
        // Wait a bit more for potential redirects
        await sleep(3000);
      } else {
        addDebugStep('Google Password Next', 'error', 'Could not find or click Next button - STOPPING HERE');
        console.log('❌ Could not find Next button - STOPPING HERE');
        throw new Error('Could not find Next button - cannot proceed to Recraft.ai');
      }
    } catch (error) {
      addDebugStep('Google Password Next', 'error', 'Error finding Next button - STOPPING HERE', null, error.message);
      console.log('❌ Error finding Next button - STOPPING HERE:', error.message);
      throw error; // Stop execution here
    }

    await sleep(10000);
    await takeScreenshot('After Password Next Click');

    // Check for Google welcome page and click "IK begrijp het" button
    addDebugStep('Google Welcome Page', 'info', 'Checking for Google welcome page and "IK begrijp het" button');
    console.log('🔍 Checking for Google welcome page and "IK begrijp het" button...');
    
    try {
      // Wait for any button to appear (the "IK begrijp het" button)
      await page.waitForSelector('button, a, input[type="submit"]', { timeout: 15000 });
      
      // Wait a bit more for the page to fully load
      await sleep(3000);
      
      const welcomeButtonClicked = await page.evaluate(() => {
        console.log('Starting smart welcome page button detection...');
        
        // Get ALL buttons on the page
        const allButtons = document.querySelectorAll('button, a, input[type="submit"]');
        console.log(`Found ${allButtons.length} buttons on the welcome page`);
        
        // Log all buttons for debugging
        for (let i = 0; i < allButtons.length; i++) {
          const button = allButtons[i];
          const text = button.innerText || button.textContent || '';
          const classes = button.className || '';
          const id = button.id || '';
          console.log(`Welcome Button ${i}: text="${text.trim()}", classes="${classes}", id="${id}"`);
        }
        
        // Strategy 1: Look for "IK begrijp het" button (exact text)
        for (const button of allButtons) {
          const text = (button.innerText || button.textContent || '').trim();
          if (text === 'IK begrijp het') {
            console.log('Found "IK begrijp het" button by exact text match');
            button.click();
            return true;
          }
        }
        
        // Strategy 2: Look for "Ik begrijp het" button (case variation)
        for (const button of allButtons) {
          const text = (button.innerText || button.textContent || '').trim();
          if (text === 'Ik begrijp het') {
            console.log('Found "Ik begrijp het" button by exact text match (lowercase i)');
            button.click();
            return true;
          }
        }
        
        // Strategy 3: Look for button containing "begrijp" (partial text)
        for (const button of allButtons) {
          const text = (button.innerText || button.textContent || '').trim();
          if (text.includes('begrijp')) {
            console.log('Found button by partial text match:', text);
            button.click();
            return true;
          }
        }
        
        // Strategy 4: Look for button containing "IK" (partial text)
        for (const button of allButtons) {
          const text = (button.innerText || button.textContent || '').trim();
          if (text.includes('IK')) {
            console.log('Found button by partial text match:', text);
            button.click();
            return true;
          }
        }
        
        // Strategy 5: Look for button containing "Ik" (partial text, lowercase)
        for (const button of allButtons) {
          const text = (button.innerText || button.textContent || '').trim();
          if (text.includes('Ik')) {
            console.log('Found button by partial text match:', text);
            button.click();
            return true;
          }
        }
        
        // Strategy 6: Look for blue/primary buttons (Google buttons are usually blue)
        for (const button of allButtons) {
          const style = window.getComputedStyle(button);
          const backgroundColor = style.backgroundColor;
          
          // Check if it's a blue button
          if (backgroundColor.includes('rgb(26, 115, 232)') || backgroundColor.includes('blue') || button.className.includes('primary')) {
            console.log('Found blue/primary button, clicking it');
            button.click();
            return true;
          }
        }
        
        // Strategy 7: Look for any button with "begrijp" in any case
        for (const button of allButtons) {
          const text = (button.innerText || button.textContent || '').trim().toLowerCase();
          if (text.includes('begrijp')) {
            console.log('Found button by case-insensitive partial text match:', text);
            button.click();
            return true;
          }
        }
        
        // Strategy 8: If only one button, click it
        if (allButtons.length === 1) {
          console.log('Only one button found, clicking it');
          allButtons[0].click();
          return true;
        }
        
        // Strategy 9: Click the first clickable button
        for (const button of allButtons) {
          if (button.offsetParent !== null && !button.disabled) { // Visible and enabled
            console.log('Found visible enabled button, clicking it');
            button.click();
            return true;
          }
        }
        
        console.log('No suitable button found');
        return false;
      });

      if (welcomeButtonClicked) {
        addDebugStep('Google Welcome Page', 'success', 'Clicked "IK begrijp het" button');
        console.log('✅ "IK begrijp het" button clicked');
        
        // Wait for navigation
        await sleep(5000);
        await takeScreenshot('After Accepting Google Terms');
      } else {
        addDebugStep('Google Welcome Page', 'warning', 'Could not find "IK begrijp het" button, continuing...');
        console.log('⚠️ Could not find "IK begrijp het" button, continuing...');
      }
    } catch (error) {
      addDebugStep('Google Welcome Page', 'warning', 'Error finding welcome page button, continuing...', null, error.message);
      console.log('⚠️ Error finding welcome page button, continuing...');
    }

    // Check if we're redirected back to Recraft.ai
    const redirectCheck = await page.evaluate(() => {
      const currentUrl = window.location.href;
      const isRecraft = currentUrl.includes('recraft.ai');
      const isGoogle = currentUrl.includes('google.com') || currentUrl.includes('accounts.google.com');
      
      return {
        currentUrl,
        isRecraft,
        isGoogle,
        pageTitle: document.title
      };
    });

    console.log('Redirect check:', redirectCheck);
    addDebugStep('Redirect Check', 'info', 'Checking if redirected back to Recraft.ai', redirectCheck);

    if (redirectCheck.isRecraft) {
      addDebugStep('Recraft.ai Redirect', 'success', 'Successfully redirected back to Recraft.ai');
      console.log('✅ Successfully redirected back to Recraft.ai');
    } else if (redirectCheck.isGoogle) {
      addDebugStep('Google Redirect', 'warning', 'Still on Google page, may need additional steps');
      console.log('⚠️ Still on Google page, may need additional steps');
    } else {
      addDebugStep('Unknown Redirect', 'warning', 'Unknown redirect location');
      console.log('⚠️ Unknown redirect location');
    }

    await sleep(5000);
    await takeScreenshot('Final State');

    // Final status
    const finalStatus = await page.evaluate(() => {
      return {
        currentUrl: window.location.href,
        pageTitle: document.title,
        hasRecraftElements: !!document.querySelector('[class*="recraft"], [id*="recraft"]'),
        hasGoogleElements: !!document.querySelector('[class*="google"], [id*="google"]'),
        bodyText: document.body.innerText.substring(0, 200)
      };
    });

    console.log('Final status:', finalStatus);
    addDebugStep('Final Status', 'info', 'Google login process completed', finalStatus);

    return {
      success: true,
      message: 'Recraft.ai login process completed',
      finalUrl: finalStatus.currentUrl,
      debugSteps,
      screenshots
    };

  } catch (error) {
    console.error('❌ Recraft.ai login error:', error);
    addDebugStep('Error', 'error', 'Login process failed', null, error.message);
    
    return {
      success: false,
      error: error.message,
      debugSteps,
      screenshots
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Helper function for sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = { scrapeRecraftLogin };
