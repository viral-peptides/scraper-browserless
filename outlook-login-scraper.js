const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Global variables for control
let globalBrowser = null;
let globalPage = null;
let globalScraperPaused = false;
let globalScraperStopped = false;
let globalIO = null;

// Debug logging function
async function addDebugStep(step, type, message, screenshot = null, error = null, page = null) {
  const timestamp = new Date().toLocaleString();
  
  // Take screenshot for important steps if page is provided
  if (page && !screenshot && (type === 'success' || type === 'error' || step.includes('Entry') || step.includes('Button'))) {
    try {
      screenshot = await takeScreenshot(`${step.replace(/\s+/g, '-')}-${type}`, page);
    } catch (e) {
      // Screenshot failed, continue without it
    }
  }
  
  const logEntry = {
    step,
    type,
    message,
    timestamp,
    screenshot,
    error
  };
  
  console.log(`[${timestamp}] ${step}: ${type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️'} ${message}`);
  if (screenshot) {
    console.log(`[${timestamp}] ${step}: Screenshot: ${screenshot}`);
  }
  
  // Emit to all connected clients
  if (globalIO) {
    globalIO.emit('log', logEntry);
  }
  
  return logEntry;
}

// Helper function to take screenshots
async function takeScreenshot(name, page) {
  try {
    // Check if page is still accessible before taking screenshot
    try {
      await page.evaluate(() => document.title);
    } catch (e) {
      addDebugStep('Screenshot', 'warning', `Page not accessible for screenshot ${name}: ${e.message}`);
      return null;
    }

    const timestamp = Date.now();
    const screenshotPath = path.join(__dirname, 'screenshots', `${name}-${timestamp}.png`);
    
    // Ensure screenshots directory exists
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Verify file was saved
    if (fs.existsSync(screenshotPath)) {
      const stats = fs.statSync(screenshotPath);
      const filename = `${name}-${timestamp}.png`;
      addDebugStep('Screenshot', 'success', `Screenshot saved: ${filename} (${stats.size} bytes)`);
      
      // Emit screenshot to clients
      if (globalIO) {
        globalIO.emit('screenshot', { filename: filename });
      }
      
      return filename;
    } else {
      addDebugStep('Screenshot', 'error', `Screenshot file not found: ${screenshotPath}`);
      return null;
    }
  } catch (error) {
    addDebugStep('Screenshot', 'error', `Screenshot failed: ${error.message}`);
    return null;
  }
}

// Helper function for human-like delays
async function randomHumanDelay(page, min = 1000, max = 3000) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  await page.waitForTimeout(delay);
}

// Main login function
async function loginToOutlook(email, password, io) {
  globalIO = io;
  globalScraperPaused = false;
  globalScraperStopped = false;
  
  let browser = null;
  let page = null;
  
  try {
    // Step 1: Launch browser
    addDebugStep('Browser', 'info', 'Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      protocolTimeout: 120000, // 2 minutes timeout
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
    
    globalBrowser = browser;
    
    addDebugStep('Browser', 'success', 'Browser launched successfully');
    
    // Step 2: Create new page
    addDebugStep('Browser', 'info', 'Creating new page...');
    page = await browser.newPage();
    globalPage = page;
    
    // Set viewport
    await page.setViewport({ width: 1366, height: 768 });
    addDebugStep('Browser', 'success', 'Page created and viewport set');
    
    // Step 3: Navigate to Microsoft login
    addDebugStep('Navigation', 'info', 'Navigating to Microsoft login...');
    await page.goto('https://login.microsoftonline.com/', { waitUntil: 'networkidle2' });
    await takeScreenshot('Microsoft-Login-Initial', page);
    await addDebugStep('Navigation', 'success', 'Successfully navigated to Microsoft login', null, null, page);
    
    // Wait for page to load and check if it's still accessible
    await randomHumanDelay(page, 2000, 3000);
    
    // Check if page is still accessible
    try {
      const pageTitle = await page.title();
      const pageUrl = await page.url();
      addDebugStep('Page Check', 'info', `Page loaded - Title: ${pageTitle}, URL: ${pageUrl}`);
    } catch (e) {
      addDebugStep('Page Check', 'error', `Page not accessible: ${e.message}`);
      throw new Error(`Page became inaccessible: ${e.message}`);
    }
    
    // Step 4: Enter email
    addDebugStep('Email Entry', 'info', 'Entering email...');
    
    // Wait for email input field to be available
    try {
      await page.waitForSelector('input[name="loginfmt"]', { visible: true, timeout: 10000 });
      await page.click('input[name="loginfmt"]');
      await page.type('input[name="loginfmt"]', email, { delay: 100 });
    } catch (e) {
      addDebugStep('Email Entry', 'warning', `Primary email selector failed: ${e.message}`);
      
      // Try alternative selectors
      const alternativeSelectors = [
        'input[type="email"]',
        'input[name="username"]', 
        'input[id="i0116"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="phone" i]'
      ];
      
      let emailEntered = false;
      for (const selector of alternativeSelectors) {
        try {
          await addDebugStep('Email Entry', 'info', `Trying alternative selector: ${selector}`);
          await page.waitForSelector(selector, { visible: true, timeout: 3000 });
          await page.click(selector);
          await page.type(selector, email, { delay: 100 });
          emailEntered = true;
          addDebugStep('Email Entry', 'success', `Email entered using selector: ${selector}`);
          break;
        } catch (selectorError) {
          addDebugStep('Email Entry', 'info', `Selector ${selector} failed: ${selectorError.message}`);
        }
      }
      
      if (!emailEntered) {
        throw new Error('No email input field found with any selector');
      }
    }
    
    await takeScreenshot('Email-Entered', page);
    await addDebugStep('Email Entry', 'success', 'Email entered successfully', null, null, page);
    
    // Step 5: Click Next button
    addDebugStep('Email Entry', 'info', 'Clicking Next button...');
    
    try {
      await page.waitForSelector('input[type="submit"][id="idSIButton9"]', { visible: true, timeout: 5000 });
      await page.click('input[type="submit"][id="idSIButton9"]');
      await takeScreenshot('Email-Next-Clicked', page);
      await addDebugStep('Email Entry', 'success', 'Next button clicked', null, null, page);
    } catch (e) {
      addDebugStep('Email Entry', 'warning', `Primary Next button selector failed: ${e.message}`);
      
      // Try alternative Next button selectors
      const nextButtonSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'button:contains("Next")',
        'input[value="Next"]',
        'button:contains("Sign in")',
        'input[value="Sign in"]'
      ];
      
      let nextClicked = false;
      for (const selector of nextButtonSelectors) {
        try {
          await addDebugStep('Email Entry', 'info', `Trying Next button selector: ${selector}`);
          await page.waitForSelector(selector, { visible: true, timeout: 3000 });
          await page.click(selector);
          nextClicked = true;
          await takeScreenshot('Email-Next-Clicked', page);
          await addDebugStep('Email Entry', 'success', `Next button clicked using selector: ${selector}`, null, null, page);
          break;
        } catch (selectorError) {
          await addDebugStep('Email Entry', 'info', `Next button selector ${selector} failed: ${selectorError.message}`);
        }
      }
      
      if (!nextClicked) {
        throw new Error('No Next button found with any selector');
      }
    }
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 6: Enter password
    addDebugStep('Password Entry', 'info', 'Entering password...');
    
    try {
      await page.waitForSelector('input[name="passwd"]', { visible: true, timeout: 10000 });
      await page.click('input[name="passwd"]');
      await page.type('input[name="passwd"]', password, { delay: 100 });
    } catch (e) {
      addDebugStep('Password Entry', 'warning', `Primary password selector failed: ${e.message}`);
      
      // Try alternative password selectors
      const passwordSelectors = [
        'input[type="password"]',
        'input[name="password"]',
        'input[id="passwordEntry"]',
        'input[placeholder*="password" i]'
      ];
      
      let passwordEntered = false;
      for (const selector of passwordSelectors) {
        try {
          await addDebugStep('Password Entry', 'info', `Trying password selector: ${selector}`);
          await page.waitForSelector(selector, { visible: true, timeout: 3000 });
          await page.click(selector);
          await page.type(selector, password, { delay: 100 });
          passwordEntered = true;
          addDebugStep('Password Entry', 'success', `Password entered using selector: ${selector}`);
          break;
        } catch (selectorError) {
          addDebugStep('Password Entry', 'info', `Password selector ${selector} failed: ${selectorError.message}`);
        }
      }
      
      if (!passwordEntered) {
        throw new Error('No password input field found with any selector');
      }
    }
    
    await takeScreenshot('Password-Entered', page);
    await addDebugStep('Password Entry', 'success', 'Password entered successfully', null, null, page);
    
    // Step 7: Click Next button for password
    addDebugStep('Password Entry', 'info', 'Clicking Next button...');
    await page.click('button[type="submit"][data-testid="primaryButton"]');
    
    // Wait for navigation after password submission
    try {
      await page.waitForNavigation({ timeout: 10000 });
      await takeScreenshot('Password-Next-Clicked', page);
      await addDebugStep('Password Entry', 'success', 'Next button clicked and navigated', null, null, page);
    } catch (navError) {
      addDebugStep('Password Entry', 'warning', `Navigation timeout: ${navError.message}`);
      // Try to take screenshot anyway
      try {
        await takeScreenshot('Password-Next-Clicked', page);
      } catch (screenshotError) {
        addDebugStep('Password Entry', 'warning', `Screenshot failed: ${screenshotError.message}`);
      }
    }
    
    // Check for "Let's protect your account" page and handle "Skip for now"
    try {
      await addDebugStep('Account Protection', 'info', 'Checking for account protection page...');
      
      const pageInfo = await page.evaluate(() => {
        const url = window.location.href;
        const title = document.title;
        const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
        
        const isProtectAccountPage = title.toLowerCase().includes("let's protect your account") ||
                                   bodyText.includes("let's protect your account") ||
                                   bodyText.includes('add another way to verify') ||
                                   bodyText.includes('security info') ||
                                   url.includes('proofs/Add');
        
        // Find "Skip for now" links
        const skipLinks = Array.from(document.querySelectorAll('a, button'));
        const hasSkipLink = skipLinks.some(link => {
          const text = link.textContent?.toLowerCase() || '';
          return text.includes('skip for now') || text.includes('skip') || text.includes('later');
        });
        
        return {
          isProtectAccountPage: isProtectAccountPage,
          hasSkipLink: hasSkipLink,
          url: url,
          title: title
        };
      });
      
      if (pageInfo.isProtectAccountPage) {
        await addDebugStep('Account Protection', 'success', `Protect account page detected: ${pageInfo.url}`);
        
        if (pageInfo.hasSkipLink) {
          await addDebugStep('Account Protection', 'info', 'Looking for Skip for now link...');
          
          // Try to find and click "Skip for now" link
          const skipClicked = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a, button'));
            const skipLink = links.find(link => {
              const text = link.textContent?.toLowerCase() || '';
              return text.includes('skip for now') || text.includes('skip') || text.includes('later');
            });
            
            if (skipLink && skipLink.offsetParent !== null) {
              skipLink.click();
              return { success: true, text: skipLink.textContent };
            }
            return { success: false };
          });
          
          if (skipClicked.success) {
            await addDebugStep('Account Protection', 'success', `Skip link clicked: ${skipClicked.text}`);
            await randomHumanDelay(page, 2000, 3000);
            
            // Wait for navigation after skip
            try {
              await page.waitForNavigation({ timeout: 10000 });
              await takeScreenshot('Account-Protection-Skipped', page);
              await addDebugStep('Account Protection', 'success', 'Successfully skipped account protection', null, null, page);
            } catch (navError) {
              await addDebugStep('Account Protection', 'warning', `Navigation after skip timeout: ${navError.message}`);
            }
          } else {
            await addDebugStep('Account Protection', 'warning', 'Skip link not found or not clickable');
          }
        } else {
          await addDebugStep('Account Protection', 'warning', 'No skip link found on protect account page');
        }
      } else {
        await addDebugStep('Account Protection', 'info', 'No account protection page detected');
      }
    } catch (e) {
      await addDebugStep('Account Protection', 'warning', `Account protection check failed: ${e.message}`);
    }
    
    // Wait for page transition
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 8: Handle "Stay signed in?" prompt
    addDebugStep('Stay Signed In', 'info', 'Handling stay signed in prompt...');
    
    try {
      // Look for "Yes" button
      await page.waitForSelector('button[type="submit"][data-testid="primaryButton"]', { timeout: 10000 });
      await page.click('button[type="submit"][data-testid="primaryButton"]');
      
      // Wait for navigation after stay signed in
      try {
        await page.waitForNavigation({ timeout: 10000 });
        await takeScreenshot('Stay-Signed-In-Yes', page);
        await addDebugStep('Stay Signed In', 'success', 'Stay signed in confirmed and navigated', null, null, page);
      } catch (navError) {
        addDebugStep('Stay Signed In', 'warning', `Navigation timeout: ${navError.message}`);
        // Try to take screenshot anyway
        try {
          await takeScreenshot('Stay-Signed-In-Yes', page);
        } catch (screenshotError) {
          addDebugStep('Stay Signed In', 'warning', `Screenshot failed: ${screenshotError.message}`);
        }
      }
    } catch (e) {
      addDebugStep('Stay Signed In', 'info', 'Stay signed in prompt not found or already handled');
    }
    
    // Wait for navigation
    await randomHumanDelay(page, 3000, 5000);
    
    // Step 9: Handle any popups that appear
    addDebugStep('Popup Handling', 'info', 'Checking for popups...');
    
    try {
      // Look for close button (X) in popups
      const closeButton = await page.$('svg[aria-hidden="true"]');
      if (closeButton) {
        await closeButton.click();
        await takeScreenshot('Popup-Closed', page);
        await addDebugStep('Popup Handling', 'success', 'Popup closed successfully', null, null, page);
      } else {
        addDebugStep('Popup Handling', 'info', 'No popup found to close');
      }
    } catch (e) {
      addDebugStep('Popup Handling', 'info', 'No popup found or already closed');
    }
    
    // Step 10: Verify login success
    addDebugStep('Login Verification', 'info', 'Verifying login success...');
    
    // Wait for page to load completely
    try {
      await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 });
    } catch (e) {
      addDebugStep('Login Verification', 'warning', `Page load timeout: ${e.message}`);
    }
    
    // Take final screenshot to verify login state
    await takeScreenshot('Login-Final-Verification', page);
    
    // Try to navigate to Outlook specifically
    addDebugStep('Login Verification', 'info', 'Attempting to navigate to Outlook...');
    try {
      await page.goto('https://outlook.com', { waitUntil: 'networkidle2', timeout: 30000 });
      await takeScreenshot('Outlook-Redirect', page);
      await addDebugStep('Login Verification', 'success', 'Successfully navigated to Outlook', null, null, page);
    } catch (outlookError) {
      addDebugStep('Login Verification', 'warning', `Could not navigate to Outlook: ${outlookError.message}`);
    }
    
    // Check if we're on a Microsoft dashboard or Outlook
    const currentUrl = page.url();
    const pageTitle = await page.title();
    
    addDebugStep('Login Verification', 'info', `Current URL: ${currentUrl}`);
    addDebugStep('Login Verification', 'info', `Page Title: ${pageTitle}`);
    
    // Check if we're on Microsoft marketing page instead of actual Outlook
    if (currentUrl.includes('microsoft.com') && !currentUrl.includes('outlook.live.com')) {
      await addDebugStep('Login Verification', 'info', 'Detected Microsoft marketing page - handling cookie consent and redirecting...');
      
      // Handle cookie consent if present
      try {
        await addDebugStep('Cookie Consent', 'info', 'Looking for cookie consent banner...');
        
        // Try multiple cookie accept selectors
        const cookieSelectors = [
          '[data-testid*="accept"]',
          '[data-testid*="Accept"]',
          'button[class*="accept"]',
          'button[class*="Accept"]',
          'button[aria-label*="Accept"]',
          'button[aria-label*="accept"]',
          'button[type="button"]'
        ];
        
        let cookieAccepted = false;
        for (const selector of cookieSelectors) {
          try {
            const cookieButton = await page.waitForSelector(selector, { visible: true, timeout: 2000 });
            if (cookieButton) {
              // Check if button text contains "Accept"
              const buttonText = await page.evaluate(el => el.textContent, cookieButton);
              if (buttonText && (buttonText.toLowerCase().includes('accept') || buttonText.toLowerCase().includes('accept all'))) {
                await addDebugStep('Cookie Consent', 'info', `Found cookie button: ${selector} with text: ${buttonText}`);
                await cookieButton.click();
                await randomHumanDelay(page, 1000, 2000);
                await takeScreenshot('Cookie-Consent-Accepted', page);
                cookieAccepted = true;
                break;
              }
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        // If no specific accept button found, try to find any button with "Accept" text
        if (!cookieAccepted) {
          try {
            const acceptButtons = await page.$$x('//button[contains(text(), "Accept") or contains(text(), "Accept all") or contains(text(), "Accept All")]');
            if (acceptButtons.length > 0) {
              await addDebugStep('Cookie Consent', 'info', `Found ${acceptButtons.length} Accept button(s) using XPath`);
              await acceptButtons[0].click();
              await randomHumanDelay(page, 1000, 2000);
              await takeScreenshot('Cookie-Consent-Accepted', page);
              cookieAccepted = true;
            }
          } catch (e) {
            // XPath also failed
          }
        }
        
        if (!cookieAccepted) {
          await addDebugStep('Cookie Consent', 'info', 'No cookie consent banner found or already accepted');
        }
      } catch (cookieError) {
        await addDebugStep('Cookie Consent', 'warning', `Cookie handling failed: ${cookieError.message}`);
      }
      
      // Now navigate directly to Outlook Live
      await addDebugStep('Login Verification', 'info', 'Navigating directly to Outlook Live...');
      try {
        await page.goto('https://outlook.live.com/', { waitUntil: 'networkidle2', timeout: 30000 });
        await randomHumanDelay(page, 3000, 5000);
        await takeScreenshot('Outlook-Live-Redirect', page);
        
        const finalUrl = page.url();
        await addDebugStep('Login Verification', 'info', `Final URL after redirect: ${finalUrl}`);
        
        if (finalUrl.includes('outlook.live.com')) {
          await addDebugStep('Login Verification', 'success', 'Successfully navigated to Outlook Live');
        } else {
          await addDebugStep('Login Verification', 'warning', `Still not on Outlook Live - current URL: ${finalUrl}`);
        }
      } catch (redirectError) {
        await addDebugStep('Login Verification', 'warning', `Failed to redirect to Outlook Live: ${redirectError.message}`);
      }
    }
    
    // Check for login success indicators
    const isLoggedIn = currentUrl.includes('office.com') || 
                      currentUrl.includes('outlook.com') || 
                      currentUrl.includes('m365.cloud.microsoft') ||
                      currentUrl.includes('portal.office.com') ||
                      pageTitle.toLowerCase().includes('outlook') || 
                      pageTitle.toLowerCase().includes('microsoft') ||
                      pageTitle.toLowerCase().includes('office');
    
    if (isLoggedIn) {
      await addDebugStep('Login Verification', 'success', 'Successfully logged into Microsoft account!', null, null, page);
      
      // Step 11: Wait for Outlook to fully load, then navigate to Kie.ai
      await addDebugStep('Kie.ai Login', 'info', 'Waiting for Outlook login to complete...');
      
      // Wait longer to ensure Outlook is fully loaded and any modals are handled
      await randomHumanDelay(page, 5000, 7000);
      
      // Check if we're still on Outlook and wait for it to be ready
      const currentUrl = page.url();
      if (currentUrl.includes('outlook.live.com') || currentUrl.includes('outlook.com')) {
        await addDebugStep('Kie.ai Login', 'info', 'Outlook is loaded, waiting for any modals to clear...');
        await randomHumanDelay(page, 3000, 5000);
      }
      
      await addDebugStep('Kie.ai Login', 'info', 'Starting Kie.ai login process...');
      
      let apiKey = 'Not Found'; // Initialize API key variable
      
      try {
        // Navigate to Kie.ai
        await addDebugStep('Kie.ai Login', 'info', 'Navigating to Kie.ai...');
        await page.goto('https://kie.ai/', { waitUntil: 'networkidle2', timeout: 30000 });
        await takeScreenshot('Kie-ai-Initial', page);
        await addDebugStep('Kie.ai Login', 'success', 'Successfully navigated to Kie.ai', null, null, page);
        
        // Wait for page to load
        await randomHumanDelay(page, 2000, 3000);
        
        // Check for and handle "Unleash AI Power" modal popup
        await addDebugStep('Kie.ai Login', 'info', 'Checking for modal popups...');
        try {
          // Look for the "Unleash AI Power" modal
          const modalSelectors = [
            'div[class*="modal"]',
            'div[class*="popup"]',
            'div[class*="dialog"]',
            'div[role="dialog"]',
            'div[class*="overlay"]'
          ];
          
          let modalFound = false;
          for (const selector of modalSelectors) {
            try {
              const modal = await page.waitForSelector(selector, { visible: true, timeout: 3000 });
              if (modal) {
                // Check if it contains "Unleash AI Power" text
                const modalText = await page.evaluate(el => el.textContent, modal);
                if (modalText && modalText.includes('Unleash AI Power')) {
                  await addDebugStep('Kie.ai Login', 'info', 'Found "Unleash AI Power" modal popup');
                  await takeScreenshot('Kie-ai-Modal-Detected', page);
                  
                  // Look for close button (X) in the modal
                  const closeButton = await modal.$('button[aria-label*="close"], button[aria-label*="Close"], svg[aria-hidden="true"], button:has(svg)');
                  if (closeButton) {
                    await addDebugStep('Kie.ai Login', 'info', 'Closing modal popup...');
                    await closeButton.click();
                    await randomHumanDelay(page, 1000, 2000);
                    await takeScreenshot('Kie-ai-Modal-Closed', page);
                    await addDebugStep('Kie.ai Login', 'success', 'Modal popup closed successfully', null, null, page);
                  } else {
                    // Try to click outside the modal or press Escape
                    await addDebugStep('Kie.ai Login', 'info', 'No close button found, trying to close modal...');
                    await page.keyboard.press('Escape');
                    await randomHumanDelay(page, 1000, 2000);
                    await takeScreenshot('Kie-ai-Modal-Escape', page);
                  }
                  modalFound = true;
                  break;
                }
              }
            } catch (e) {
              // Continue to next selector
            }
          }
          
          if (!modalFound) {
            await addDebugStep('Kie.ai Login', 'info', 'No modal popup found');
          }
        } catch (modalError) {
          await addDebugStep('Kie.ai Login', 'warning', `Modal handling failed: ${modalError.message}`);
        }
        
        // Click on "Get Started" button
        await addDebugStep('Kie.ai Login', 'info', 'Looking for Get Started button...');
        try {
          await page.waitForSelector('button:contains("Get Started")', { timeout: 10000 });
          await page.click('button:contains("Get Started")');
          await takeScreenshot('Get-Started-Clicked', page);
          await addDebugStep('Kie.ai Login', 'success', 'Clicked Get Started button', null, null, page);
        } catch (e) {
          // Try alternative selectors
          const getStartedSelectors = [
            'button[class*="Get Started"]',
            'a[class*="Get Started"]',
            '[data-testid*="get-started"]',
            'button:contains("Get Started")',
            'a:contains("Get Started")'
          ];
          
          let clicked = false;
          for (const selector of getStartedSelectors) {
            try {
              if (selector.includes(':contains')) {
                const xpath = selector.includes('button') ? 
                  '//button[contains(text(), "Get Started")]' : 
                  '//a[contains(text(), "Get Started")]';
                await page.waitForXPath(xpath, { timeout: 3000 });
                const [button] = await page.$x(xpath);
                if (button) {
                  await button.click();
                  clicked = true;
                  break;
                }
              } else {
                await page.waitForSelector(selector, { timeout: 3000 });
                await page.click(selector);
                clicked = true;
                break;
              }
            } catch (selectorError) {
              continue;
            }
          }
          
          if (clicked) {
            await takeScreenshot('Get-Started-Clicked', page);
            await addDebugStep('Kie.ai Login', 'success', 'Clicked Get Started button with alternative method', null, null, page);
          } else {
            await addDebugStep('Kie.ai Login', 'warning', 'Could not find Get Started button');
          }
        }
        
        // Wait for popup to appear and use comprehensive detection like Kie.ai scraper
        await randomHumanDelay(page, 2000, 3000);
        
        // Check for "Sign in with Microsoft" popup (sometimes appears at bottom of page)
        await addDebugStep('Kie.ai Login', 'info', 'Looking for Sign in with Microsoft popup...');
        
        // First check if popup is visible without scrolling
        let microsoftPopupFound = false;
        try {
          // Use proper XPath selectors for Microsoft popup detection
          await page.waitForXPath('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]', { timeout: 3000 });
          await addDebugStep('Kie.ai Login', 'success', 'Sign in with Microsoft popup detected at top', null, null, page);
          await takeScreenshot('Microsoft-Popup-Top', page);
          microsoftPopupFound = true;
        } catch (topError) {
          await addDebugStep('Kie.ai Login', 'info', 'No Microsoft popup found at top - scrolling down to check bottom of page');
          
          // Scroll down to look for popup at bottom of page
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          await randomHumanDelay(page, 2000, 3000);
          await takeScreenshot('Scrolled-Down-Looking-For-Popup', page);
          
          // Check again after scrolling with multiple methods
          try {
            // Try XPath first
            await page.waitForXPath('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]', { timeout: 3000 });
            await addDebugStep('Kie.ai Login', 'success', 'Sign in with Microsoft popup detected at bottom after scrolling', null, null, page);
            await takeScreenshot('Microsoft-Popup-Bottom', page);
            microsoftPopupFound = true;
          } catch (bottomError) {
            // Try alternative detection methods
            await addDebugStep('Kie.ai Login', 'info', 'XPath detection failed, trying alternative methods...');
            
            // Check for any popup or modal elements
            const popupDetected = await page.evaluate(() => {
              // Look for common popup indicators
              const popups = document.querySelectorAll('[role="dialog"], [class*="popup"], [class*="modal"], [class*="overlay"], [class*="popup"], [class*="dialog"]');
              if (popups.length > 0) {
                return {
                  found: true,
                  count: popups.length,
                  elements: Array.from(popups).map(el => ({
                    tagName: el.tagName,
                    className: el.className,
                    textContent: el.textContent?.substring(0, 100)
                  }))
                };
              }
              
              // Look for Microsoft-related text anywhere on page
              const microsoftElements = document.querySelectorAll('*');
              for (const el of microsoftElements) {
                const text = el.textContent?.toLowerCase() || '';
                if (text.includes('sign in with microsoft') || text.includes('inloggen met microsoft') || text.includes('microsoft')) {
                  return {
                    found: true,
                    element: {
                      tagName: el.tagName,
                      className: el.className,
                      textContent: el.textContent?.substring(0, 100)
                    }
                  };
                }
              }
              
              return { found: false };
            });
            
            if (popupDetected.found) {
              await addDebugStep('Kie.ai Login', 'success', `Microsoft popup detected using alternative method: ${JSON.stringify(popupDetected)}`, null, null, page);
              await takeScreenshot('Microsoft-Popup-Alternative', page);
              microsoftPopupFound = true;
            } else {
              await addDebugStep('Kie.ai Login', 'info', 'No Microsoft popup found at bottom either');
            }
          }
        }
        
        if (microsoftPopupFound) {
          // Click "Sign in with Microsoft" button using proper selectors
          await addDebugStep('Kie.ai Login', 'info', 'Clicking Sign in with Microsoft button...');
          
          try {
            // Try XPath first
            await page.waitForXPath('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]', { timeout: 5000 });
            await page.click('//button[contains(text(), "Sign in with Microsoft")] | //button[contains(text(), "Inloggen met Microsoft")] | //*[contains(@data-testid, "microsoft")] | //*[contains(@class, "microsoft")]');
            await addDebugStep('Kie.ai Login', 'success', 'Clicked Sign in with Microsoft button using XPath', null, null, page);
          } catch (xpathError) {
            // Fallback to evaluate method
            await addDebugStep('Kie.ai Login', 'info', 'XPath click failed, trying evaluate method...');
            
            const clicked = await page.evaluate(() => {
              // Look for Microsoft button by text content
              const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
              for (const button of buttons) {
                const text = button.textContent?.toLowerCase() || '';
                if (text.includes('sign in with microsoft') || text.includes('inloggen met microsoft') || text.includes('microsoft')) {
                  button.click();
                  return true;
                }
              }
              return false;
            });
            
            if (clicked) {
              await addDebugStep('Kie.ai Login', 'success', 'Clicked Sign in with Microsoft button using evaluate method', null, null, page);
            } else {
              await addDebugStep('Kie.ai Login', 'warning', 'Could not click Microsoft button with any method');
            }
          }
          
          await takeScreenshot('Microsoft-Signin-Clicked', page);
          
          // Wait for popup to appear and analyze what opens
          await addDebugStep('Kie.ai Login', 'info', 'Waiting for Microsoft login popup to appear...');
          await randomHumanDelay(page, 3000, 5000);
          
          // Check what pages/tabs are now open
          await addDebugStep('Kie.ai Login', 'info', 'Analyzing all open pages after Microsoft login click...');
          
          try {
            const allPages = await Promise.race([
              browser.pages(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Browser pages timeout')), 5000))
            ]);
            await addDebugStep('Kie.ai Login', 'info', `Total pages open: ${allPages.length}`);
            
            for (let i = 0; i < allPages.length; i++) {
              const currentPage = allPages[i];
              try {
                const pageInfo = await Promise.race([
                  currentPage.evaluate(() => {
                    return {
                      url: window.location.href,
                      title: document.title,
                      domain: window.location.hostname,
                      pathname: window.location.pathname,
                      hasEmailInput: document.querySelectorAll('input[name="loginfmt"], input[id="i0116"], input[type="email"]').length > 0,
                      hasPasswordInput: document.querySelectorAll('input[name="passwd"], input[type="password"]').length > 0,
                      buttonCount: document.querySelectorAll('button, a, [role="button"]').length,
                      inputCount: document.querySelectorAll('input, textarea, select').length,
                      visibleText: document.body.textContent?.substring(0, 200) || '',
                      isMicrosoftLogin: window.location.hostname.includes('login.live.com') || 
                                     window.location.hostname.includes('microsoft.com') ||
                                     document.body.textContent.toLowerCase().includes('microsoft') ||
                                     document.querySelectorAll('input[name="loginfmt"]').length > 0
                    };
                  }),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('Page analysis timeout')), 3000))
                ]);
                
                await addDebugStep('Kie.ai Login', 'info', `Page ${i + 1}:`);
                await addDebugStep('Kie.ai Login', 'info', `  - URL: ${pageInfo.url}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Title: ${pageInfo.title}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Domain: ${pageInfo.domain}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Buttons: ${pageInfo.buttonCount}, Inputs: ${pageInfo.inputCount}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Email Input: ${pageInfo.hasEmailInput}, Password Input: ${pageInfo.hasPasswordInput}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Is Microsoft Login: ${pageInfo.isMicrosoftLogin}`);
                await addDebugStep('Kie.ai Login', 'info', `  - Text: "${pageInfo.visibleText}"`);
                
                // If this is a Microsoft login page, switch to it
                if (pageInfo.isMicrosoftLogin && currentPage !== page) {
                  await addDebugStep('Kie.ai Login', 'success', `Found Microsoft login page, switching to it...`);
                  page = currentPage;
                  await takeScreenshot('Microsoft-Login-Page-Detected', page);
                  
                  // Handle the Microsoft OAuth login (this is normal - each app needs separate auth)
                  await addDebugStep('Kie.ai Login', 'info', 'Handling Microsoft OAuth login (this is normal - each app needs separate auth)...');
                  
                  // Wait for email input to be visible
                  await addDebugStep('Kie.ai Login', 'info', 'Waiting for email input field...');
                  await page.waitForSelector('input[type="email"], input[name="loginfmt"], input[placeholder*="email" i]', { visible: true, timeout: 10000 });
                  
                  // Clear any existing text and fill in email
                  await addDebugStep('Kie.ai Login', 'info', `Filling in email: ${email}`);
                  await page.click('input[type="email"], input[name="loginfmt"], input[placeholder*="email" i]');
                  await page.keyboard.down('Control');
                  await page.keyboard.press('a');
                  await page.keyboard.up('Control');
                  await page.type('input[type="email"], input[name="loginfmt"], input[placeholder*="email" i]', email, { delay: 100 });
                  
                  // Click Next button
                  await addDebugStep('Kie.ai Login', 'info', 'Clicking Next button...');
                  try {
                    await page.click('input[type="submit"], button[type="submit"], input[value="Next"]');
                  } catch (e) {
                    // Try XPath for Next button
                    await page.evaluate(() => {
                      const nextButton = document.evaluate("//button[contains(text(), 'Next')] | //input[@value='Next']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                      if (nextButton) nextButton.click();
                    });
                  }
                  
                  // Wait for password page
                  await addDebugStep('Kie.ai Login', 'info', 'Waiting for password page...');
                  await page.waitForSelector('input[type="password"], input[name="passwd"]', { visible: true, timeout: 10000 });
                  
                  // Fill in password
                  await addDebugStep('Kie.ai Login', 'info', 'Filling in password...');
                  await page.click('input[type="password"], input[name="passwd"]');
                  await page.keyboard.down('Control');
                  await page.keyboard.press('a');
                  await page.keyboard.up('Control');
                  await page.type('input[type="password"], input[name="passwd"]', password, { delay: 100 });
                  
                  // Click Sign in button
                  await addDebugStep('Kie.ai Login', 'info', 'Clicking Sign in button...');
                  try {
                    await page.click('input[type="submit"], button[type="submit"], input[value="Sign in"]');
                  } catch (e) {
                    // Try XPath for Sign in button
                    await page.evaluate(() => {
                      const signInButton = document.evaluate("//button[contains(text(), 'Sign in')] | //input[@value='Sign in']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                      if (signInButton) signInButton.click();
                    });
                  }
                  
                  // Wait for navigation
                  await addDebugStep('Kie.ai Login', 'info', 'Waiting for OAuth login to complete...');
                  await page.waitForNavigation({ timeout: 15000 });
                  
                  break;
                }
              } catch (pageError) {
                await addDebugStep('Kie.ai Login', 'warning', `Could not analyze page ${i + 1}: ${pageError.message}`);
              }
            }
          } catch (browserError) {
            await addDebugStep('Kie.ai Login', 'warning', `Could not get browser pages: ${browserError.message}`);
          }
          
        } else {
          await addDebugStep('Kie.ai Login', 'warning', 'No Microsoft popup found, continuing without Microsoft login');
        }
        
        // Wait for Microsoft consent page
        await randomHumanDelay(page, 3000, 5000);
        
        // Handle Microsoft pages dynamically (consent, stay signed in, etc.)
        await addDebugStep('Kie.ai Login', 'info', 'Handling Microsoft pages dynamically...');
        try {
          // Wait for page to be ready after navigation
          await addDebugStep('Kie.ai Login', 'info', 'Waiting for page to be ready after navigation...');
          // Wait for page to be ready (Puppeteer equivalent of waitForLoadState)
          await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 }).catch(() => {});
          await randomHumanDelay(page, 2000, 3000);
          
          // Wait for any Microsoft page to load
          await addDebugStep('Kie.ai Login', 'info', 'Waiting for Microsoft page to load...');
          
          let microsoftPageHandled = false;
          
          for (let i = 0; i < 30; i++) { // Try for 30 seconds
            try {
              // Add small delay to ensure page is ready
              await randomHumanDelay(page, 500, 1000);
              
              const pageInfo = await page.evaluate(() => {
                const url = window.location.href;
                const title = document.title;
                const bodyText = document.body.innerText.toLowerCase();
                
                // Detect different Microsoft page types
                const isConsentPage = url.includes('account.live.com') || 
                                    url.includes('consent') ||
                                    title.toLowerCase().includes('let this app') ||
                                    bodyText.includes('let this app');
                
                const isProtectAccountPage = title.toLowerCase().includes("let's protect your account") ||
                                           bodyText.includes("let's protect your account") ||
                                           bodyText.includes('add another way to verify') ||
                                           bodyText.includes('security info') ||
                                           url.includes('proofs/Add');
                
                const isStaySignedInPage = title.toLowerCase().includes('stay signed in') ||
                                         bodyText.includes('stay signed in') ||
                                         bodyText.includes('do you want to stay signed in');
                
                const isSignInPage = url.includes('login.microsoftonline.com') ||
                                   title.toLowerCase().includes('sign in') ||
                                   bodyText.includes('sign in to your account');
                
                // Find available buttons and links
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                const buttonTexts = buttons.map(btn => btn.textContent?.toLowerCase().trim() || btn.value?.toLowerCase().trim() || '');
                
                // Find "Skip for now" links
                const skipLinks = Array.from(document.querySelectorAll('a, button'));
                const hasSkipLink = skipLinks.some(link => {
                  const text = link.textContent?.toLowerCase() || '';
                  return text.includes('skip for now') || text.includes('skip') || text.includes('later');
                });
                
                return {
                  url: url,
                  title: title,
                  bodyText: bodyText,
                  isConsentPage: isConsentPage,
                  isProtectAccountPage: isProtectAccountPage,
                  isStaySignedInPage: isStaySignedInPage,
                  isSignInPage: isSignInPage,
                  hasConsentButton: !!document.querySelector('button[data-testid="appConsentPrimaryButton"]'),
                  hasAcceptButton: buttonTexts.includes('accept'),
                  hasYesButton: buttonTexts.includes('yes'),
                  hasNextButton: buttonTexts.includes('next'),
                  hasSignInButton: buttonTexts.includes('sign in'),
                  hasSkipLink: hasSkipLink,
                  availableButtons: buttonTexts.filter(text => text.length > 0)
                };
              });
              
              await addDebugStep('Kie.ai Login', 'info', `Page check ${i+1}/30: URL=${pageInfo.url}, Title=${pageInfo.title}`);
              await addDebugStep('Kie.ai Login', 'info', `Page type: Consent=${pageInfo.isConsentPage}, ProtectAccount=${pageInfo.isProtectAccountPage}, StaySignedIn=${pageInfo.isStaySignedInPage}, SignIn=${pageInfo.isSignInPage}`);
              await addDebugStep('Kie.ai Login', 'info', `Available buttons: ${pageInfo.availableButtons.join(', ')}, HasSkipLink: ${pageInfo.hasSkipLink}`);
              
              // Handle different page types
              if (pageInfo.isProtectAccountPage) {
                await addDebugStep('Kie.ai Login', 'success', `Protect account page detected: ${pageInfo.url}`);
                
                // Try to find and click "Skip for now" link
                try {
                  await addDebugStep('Kie.ai Login', 'info', 'Looking for Skip for now link...');
                  
                  // Approach 1: Try to find "Skip for now" link directly
                  const skipClicked = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a, button'));
                    const skipLink = links.find(link => {
                      const text = link.textContent?.toLowerCase() || '';
                      return text.includes('skip for now') || text.includes('skip') || text.includes('later');
                    });
                    
                    if (skipLink && skipLink.offsetParent !== null) {
                      skipLink.click();
                      return { success: true, text: skipLink.textContent };
                    }
                    return { success: false };
                  });
                  
                  if (skipClicked.success) {
                    await addDebugStep('Kie.ai Login', 'success', `Skip link clicked: ${skipClicked.text}`);
                    await randomHumanDelay(page, 2000, 3000);
                    microsoftPageHandled = true;
                    break;
                  } else {
                    await addDebugStep('Kie.ai Login', 'info', 'No skip link found, trying Next button...');
                    
                    // Approach 2: Try Next button if no skip link
                    try {
                      await page.waitForSelector('button:contains("Next"), input[type="submit"]', { visible: true, timeout: 3000 });
                      await page.click('button:contains("Next"), input[type="submit"]');
                      await addDebugStep('Kie.ai Login', 'success', 'Next button clicked on protect account page');
                      await randomHumanDelay(page, 2000, 3000);
                      microsoftPageHandled = true;
                      break;
                    } catch (nextError) {
                      await addDebugStep('Kie.ai Login', 'warning', `Next button not found: ${nextError.message}`);
                    }
                  }
                } catch (skipError) {
                  await addDebugStep('Kie.ai Login', 'warning', `Skip link handling failed: ${skipError.message}`);
                  microsoftPageHandled = true;
                  break;
                }
              } else if (pageInfo.isConsentPage || pageInfo.hasConsentButton) {
                await addDebugStep('Kie.ai Login', 'success', `Consent page detected: ${pageInfo.url}`);
                
                // Try to click Accept button
                try {
                  await addDebugStep('Kie.ai Login', 'info', 'Looking for Accept button...');
                  
                  // Approach 1: Try specific data-testid selector
                  try {
                    await page.waitForSelector('button[data-testid="appConsentPrimaryButton"]', { 
                      visible: true, 
                      timeout: 3000 
                    });
                    await page.click('button[data-testid="appConsentPrimaryButton"]');
                    await addDebugStep('Kie.ai Login', 'success', 'Accept button clicked using data-testid');
                  } catch (e) {
                    await addDebugStep('Kie.ai Login', 'info', `data-testid selector failed: ${e.message}`);
                  }
                  
                  // Approach 2: Try text-based selectors
                  try {
                    const textSelectors = [
                      'button:contains("Accept")',
                      'button:contains("Yes")', 
                      'button:contains("Continue")',
                      'button:contains("Allow")'
                    ];
                    
                    for (const selector of textSelectors) {
                      try {
                        await page.waitForSelector(selector, { visible: true, timeout: 2000 });
                        await page.click(selector);
                        await addDebugStep('Kie.ai Login', 'success', `Accept button clicked using: ${selector}`);
                        break;
                      } catch (selectorError) {
                        await addDebugStep('Kie.ai Login', 'info', `Selector ${selector} failed: ${selectorError.message}`);
                      }
                    }
                  } catch (e) {
                    await addDebugStep('Kie.ai Login', 'info', `Text-based selectors failed: ${e.message}`);
                  }
                  
                  // Approach 3: Use page.evaluate for more reliable clicking
                  try {
                    await addDebugStep('Kie.ai Login', 'info', 'Trying evaluate method for Accept button...');
                    const clicked = await page.evaluate(() => {
                      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                      const acceptButton = buttons.find(btn => {
                        const text = btn.textContent?.toLowerCase() || '';
                        const value = btn.value?.toLowerCase() || '';
                        return text.includes('accept') || text.includes('yes') || 
                               text.includes('continue') || text.includes('allow') ||
                               value.includes('accept') || value.includes('yes');
                      });
                      
                      if (acceptButton && acceptButton.offsetParent !== null) {
                        acceptButton.click();
                        return true;
                      }
                      return false;
                    });
                    
                    if (clicked) {
                      await addDebugStep('Kie.ai Login', 'success', 'Accept button clicked using evaluate method');
                    }
                  } catch (e) {
                    await addDebugStep('Kie.ai Login', 'info', `Evaluate method failed: ${e.message}`);
                  }
                  
                  await randomHumanDelay(page, 2000, 3000);
                  microsoftPageHandled = true;
                  break;
                } catch (buttonError) {
                  await addDebugStep('Kie.ai Login', 'warning', `Accept button click failed: ${buttonError.message}`);
                  microsoftPageHandled = true;
                  break;
                }
              } else if (pageInfo.isStaySignedInPage) {
                await addDebugStep('Kie.ai Login', 'info', `Stay signed in page detected: ${pageInfo.url}`);
                microsoftPageHandled = true;
                break;
              } else if (pageInfo.isSignInPage) {
                await addDebugStep('Kie.ai Login', 'info', `Still on sign in page, waiting for navigation...`);
              }
              
            } catch (e) {
              if (e.message.includes('Requesting main frame too early')) {
                await addDebugStep('Kie.ai Login', 'info', 'Page not ready yet, waiting longer...');
                await randomHumanDelay(page, 2000, 3000);
              } else if (e.message.includes('Session closed')) {
                await addDebugStep('Kie.ai Login', 'warning', 'Session closed, page may have navigated away');
                // Try to get current page info
                try {
                  const currentUrl = await page.url();
                  await addDebugStep('Kie.ai Login', 'info', `Current URL after session close: ${currentUrl}`);
                } catch (urlError) {
                  await addDebugStep('Kie.ai Login', 'warning', `Could not get current URL: ${urlError.message}`);
                }
                break; // Exit the loop since session is closed
              } else {
                await addDebugStep('Kie.ai Login', 'warning', `Page evaluation error: ${e.message}`);
              }
            }
            
            await randomHumanDelay(page, 1000, 1000);
          }
          
          if (!microsoftPageHandled) {
            await addDebugStep('Kie.ai Login', 'warning', 'Microsoft page not detected, waiting longer...');
            // Wait a bit more and try again
            await randomHumanDelay(page, 3000, 5000);
            
            // Try one more time to detect the page
            try {
              const finalCheck = await page.evaluate(() => {
                const url = window.location.href;
                const title = document.title;
                const bodyText = document.body.innerText.toLowerCase();
                
                return {
                  url: url,
                  title: title,
                  isConsentPage: url.includes('account.live.com') || url.includes('consent'),
                  isStaySignedInPage: title.toLowerCase().includes('stay signed in'),
                  hasButtons: document.querySelectorAll('button, input[type="submit"]').length > 0
                };
              });
              
              await addDebugStep('Kie.ai Login', 'info', `Final check - URL: ${finalCheck.url}, Title: ${finalCheck.title}`);
              await addDebugStep('Kie.ai Login', 'info', `Consent: ${finalCheck.isConsentPage}, StaySignedIn: ${finalCheck.isStaySignedInPage}, HasButtons: ${finalCheck.hasButtons}`);
              
              if (finalCheck.isConsentPage || finalCheck.isStaySignedInPage) {
                microsoftPageHandled = true;
                await addDebugStep('Kie.ai Login', 'success', 'Microsoft page detected on final check');
              }
            } catch (e) {
              await addDebugStep('Kie.ai Login', 'warning', `Final check failed: ${e.message}`);
            }
          }
          
          await takeScreenshot('Microsoft-Consent-Page', page);
          await addDebugStep('Kie.ai Login', 'success', 'Microsoft consent page loaded', null, null, page);
          
          // Scroll down to find Accept button
          await addDebugStep('Kie.ai Login', 'info', 'Scrolling down to find Accept button...');
          
          // Try multiple scroll positions to find the button
          const scrollPositions = [
            () => window.scrollTo(0, document.body.scrollHeight), // Bottom
            () => window.scrollTo(0, document.body.scrollHeight * 0.8), // 80% down
            () => window.scrollTo(0, document.body.scrollHeight * 0.6), // 60% down
            () => window.scrollTo(0, 0) // Top
          ];
          
          for (const scrollFunc of scrollPositions) {
            await page.evaluate(scrollFunc);
            await randomHumanDelay(page, 1000, 1500);
            
            // Check if Accept button is visible after scrolling
            const hasAcceptButton = await page.evaluate(() => {
              const buttons = document.querySelectorAll('button, input[type="submit"]');
              for (const button of buttons) {
                const text = (button.textContent || button.value || button.getAttribute('aria-label') || '').toLowerCase();
                if (text.includes('accept') || text.includes('allow') || text.includes('continue') || text.includes('yes')) {
                  return true;
                }
              }
              return false;
            });
            
            if (hasAcceptButton) {
              await addDebugStep('Kie.ai Login', 'info', 'Accept button found after scrolling');
              break;
            }
          }
          
          // Smart button detection and clicking based on page type
          await addDebugStep('Kie.ai Login', 'info', 'Looking for appropriate button...');
          
          let buttonClicked = false;
          let acceptClicked = false;
          
          // Method 1: Try specific data-testid selector for consent page
          try {
            await addDebugStep('Kie.ai Login', 'info', 'Looking for appConsentPrimaryButton...');
            await page.waitForSelector('button[data-testid="appConsentPrimaryButton"]', { visible: true, timeout: 5000 });
            const consentButton = await page.$('button[data-testid="appConsentPrimaryButton"]');
            if (consentButton) {
              await addDebugStep('Kie.ai Login', 'info', 'Found appConsentPrimaryButton, clicking...');
              await consentButton.click();
              await addDebugStep('Kie.ai Login', 'success', 'Clicked Accept button using data-testid', null, null, page);
              buttonClicked = true;
            }
          } catch (e) {
            await addDebugStep('Kie.ai Login', 'info', `data-testid selector failed: ${e.message}, trying alternatives...`);
          }
          
          // Method 2: Smart button detection using page.evaluate
          if (!buttonClicked) {
            try {
              await addDebugStep('Kie.ai Login', 'info', 'Using smart button detection...');
              const clicked = await page.evaluate(() => {
                // Get all buttons and their text
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
                
                // Priority order for button text
                const buttonPriorities = [
                  'accept',
                  'yes', 
                  'continue',
                  'next',
                  'sign in',
                  'allow',
                  'ok'
                ];
                
                // Try to find and click the most appropriate button
                for (const priority of buttonPriorities) {
                  const button = buttons.find(btn => {
                    const text = (btn.textContent || btn.value || '').toLowerCase().trim();
                    return text.includes(priority);
                  });
                  
                  if (button && button.offsetParent !== null) { // Check if visible
                    button.click();
                    return { success: true, button: priority };
                  }
                }
                
                return { success: false, availableButtons: buttons.map(btn => (btn.textContent || btn.value || '').trim()).filter(t => t.length > 0) };
              });
              
              if (clicked.success) {
                buttonClicked = true;
                await addDebugStep('Kie.ai Login', 'success', `Clicked button: ${clicked.button}`);
              } else {
                await addDebugStep('Kie.ai Login', 'info', `Available buttons: ${clicked.availableButtons.join(', ')}`);
              }
            } catch (e) {
              await addDebugStep('Kie.ai Login', 'info', `Smart detection failed: ${e.message}`);
            }
          }
          
          // Method 3: Try XPath for Accept button
          if (!buttonClicked) {
            try {
              const acceptXPaths = [
                '//button[contains(text(), "Accept")]',
                '//button[contains(text(), "Allow")]',
                '//button[contains(text(), "Continue")]',
                '//button[contains(text(), "Yes")]',
                '//input[@type="submit" and contains(@value, "Accept")]',
                '//input[@type="submit" and contains(@value, "Allow")]'
              ];
              
              for (const xpath of acceptXPaths) {
                try {
                  await page.waitForXPath(xpath, { visible: true, timeout: 3000 });
                  const [button] = await page.$x(xpath);
                  if (button) {
                    await button.click();
                    await addDebugStep('Kie.ai Login', 'success', `Clicked Accept button using XPath: ${xpath}`, null, null, page);
                    acceptClicked = true;
                    break;
                  }
                } catch (xpathError) {
                  continue;
                }
              }
            } catch (e) {
              await addDebugStep('Kie.ai Login', 'info', 'XPath methods failed, trying CSS selectors...');
            }
          }
          
          // Method 3: Try CSS selectors
          if (!acceptClicked) {
            const acceptSelectors = [
              'button[type="submit"]',
              'button[class*="primary"]',
              'button[class*="accept"]',
              'button[class*="allow"]',
              'button[class*="continue"]',
              'input[type="submit"]',
              'button[data-testid*="accept"]',
              'button[data-testid*="allow"]',
              'button[data-testid*="primary"]'
            ];
            
            for (const selector of acceptSelectors) {
              try {
                await page.waitForSelector(selector, { visible: true, timeout: 3000 });
                const button = await page.$(selector);
                if (button) {
                  // Check if button text contains Accept/Allow/Continue
                  const buttonText = await page.evaluate(el => el.textContent || el.value, button);
                  if (buttonText && (buttonText.toLowerCase().includes('accept') || 
                                    buttonText.toLowerCase().includes('allow') || 
                                    buttonText.toLowerCase().includes('continue') ||
                                    buttonText.toLowerCase().includes('yes'))) {
                    await button.click();
                    await addDebugStep('Kie.ai Login', 'success', `Clicked Accept button using CSS selector: ${selector} (text: ${buttonText})`, null, null, page);
                    acceptClicked = true;
                    break;
                  }
                }
              } catch (selectorError) {
                continue;
              }
            }
          }
          
          // Method 4: Try to find any button and check its text
          if (!acceptClicked) {
            try {
              const allButtons = await page.$$('button, input[type="submit"]');
              for (const button of allButtons) {
                const buttonText = await page.evaluate(el => el.textContent || el.value || el.getAttribute('aria-label'), button);
                if (buttonText && (buttonText.toLowerCase().includes('accept') || 
                                  buttonText.toLowerCase().includes('allow') || 
                                  buttonText.toLowerCase().includes('continue') ||
                                  buttonText.toLowerCase().includes('yes'))) {
                  await button.click();
                  await addDebugStep('Kie.ai Login', 'success', `Clicked Accept button by text matching: ${buttonText}`, null, null, page);
                  acceptClicked = true;
                  break;
                }
              }
            } catch (e) {
              await addDebugStep('Kie.ai Login', 'warning', 'Text matching method failed');
            }
          }
          
          if (acceptClicked) {
            await takeScreenshot('Accept-Button-Clicked', page);
          } else {
            await addDebugStep('Kie.ai Login', 'warning', 'Could not find Accept button - taking screenshot for debugging');
            await takeScreenshot('Accept-Button-Not-Found', page);
          }
          
          // Wait for navigation back to Kie.ai
          await randomHumanDelay(page, 3000, 5000);
          
        } catch (consentError) {
          await addDebugStep('Kie.ai Login', 'warning', `Microsoft consent page handling failed: ${consentError.message}`);
          
          // Try to handle the consent page anyway by looking for any Accept button
          await addDebugStep('Kie.ai Login', 'info', 'Trying fallback consent handling...');
          try {
            // Look for any button that might be an Accept button
            const allButtons = await page.$$('button, input[type="submit"], a[role="button"]');
            let fallbackClicked = false;
            
            for (const button of allButtons) {
              try {
                const buttonText = await page.evaluate(el => {
                  return (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase();
                }, button);
                
                if (buttonText.includes('accept') || buttonText.includes('allow') || 
                    buttonText.includes('continue') || buttonText.includes('yes') ||
                    buttonText.includes('ok') || buttonText.includes('confirm')) {
                  
                  await addDebugStep('Kie.ai Login', 'info', `Trying fallback button: ${buttonText}`);
                  await button.click();
                  await randomHumanDelay(page, 2000, 3000);
                  await takeScreenshot('Fallback-Button-Clicked', page);
                  await addDebugStep('Kie.ai Login', 'success', `Clicked fallback button: ${buttonText}`, null, null, page);
                  fallbackClicked = true;
                  break;
                }
              } catch (e) {
                continue;
              }
            }
            
            if (!fallbackClicked) {
              await addDebugStep('Kie.ai Login', 'warning', 'No fallback button found');
            }
          } catch (fallbackError) {
            await addDebugStep('Kie.ai Login', 'warning', `Fallback consent handling failed: ${fallbackError.message}`);
          }
        }
        
        // Check if we're still on a Microsoft page that needs handling
        try {
          const currentUrl = page.url();
          const isStillOnMicrosoft = currentUrl.includes('login.microsoftonline.com') || 
                                   currentUrl.includes('account.live.com') || 
                                   currentUrl.includes('microsoft.com');
          
          if (isStillOnMicrosoft) {
            await addDebugStep('Kie.ai Login', 'warning', 'Still on Microsoft page, waiting for navigation to complete...');
            await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
            await randomHumanDelay(page, 2000, 3000);
          }
        } catch (e) {
          await addDebugStep('Kie.ai Login', 'info', `Navigation check failed: ${e.message}`);
        }
        
        // Switch back to Kie.ai page and handle human verification
        await addDebugStep('Kie.ai Login', 'info', 'Switching back to Kie.ai page...');
        try {
          // Get all open pages and find Kie.ai page
          const pages = await browser.pages();
          let kiePage = null;
          
          for (const p of pages) {
            try {
              const url = p.url();
              if (url.includes('kie.ai')) {
                kiePage = p;
                break;
              }
            } catch (e) {
              continue;
            }
          }
          
          if (kiePage) {
            page = kiePage;
            await takeScreenshot('Kie-ai-After-Consent', page);
            await addDebugStep('Kie.ai Login', 'success', 'Switched back to Kie.ai page', null, null, page);
          } else {
            // Navigate back to Kie.ai
            await page.goto('https://kie.ai/', { waitUntil: 'networkidle2', timeout: 30000 });
            await takeScreenshot('Kie-ai-After-Consent', page);
            await addDebugStep('Kie.ai Login', 'success', 'Navigated back to Kie.ai page', null, null, page);
          }
          
          // Check if we're actually logged into Kie.ai
          await addDebugStep('Kie.ai Login', 'info', 'Checking if logged into Kie.ai...');
          const isLoggedIntoKie = await page.evaluate(() => {
            // Look for signs that we're logged in
            const bodyText = document.body.innerText.toLowerCase();
            const hasLoginIndicators = bodyText.includes('dashboard') || 
                                     bodyText.includes('api key') || 
                                     bodyText.includes('logout') ||
                                     bodyText.includes('profile') ||
                                     bodyText.includes('account') ||
                                     bodyText.includes('settings');
            
            // Check if we're on a logged-in page
            const currentUrl = window.location.href;
            const isLoggedInUrl = currentUrl.includes('/dashboard') || 
                                 currentUrl.includes('/api-key') ||
                                 currentUrl.includes('/profile') ||
                                 currentUrl.includes('/account');
            
            return hasLoginIndicators || isLoggedInUrl;
          });
          
          if (isLoggedIntoKie) {
            await addDebugStep('Kie.ai Login', 'success', 'Successfully logged into Kie.ai!', null, null, page);
          } else {
            await addDebugStep('Kie.ai Login', 'warning', 'Not logged into Kie.ai yet, continuing with login process...');
          }
          
          // Wait for human verification popup
          await addDebugStep('Kie.ai Login', 'info', 'Looking for human verification popup...');
          await randomHumanDelay(page, 2000, 3000);
          
          // Wait for hCaptcha to load (it might take time)
          await addDebugStep('Kie.ai Login', 'info', 'Waiting for hCaptcha to load...');
          await randomHumanDelay(page, 5000, 8000);
          
          try {
            // Look for human verification checkbox with more specific detection
            await addDebugStep('Kie.ai Login', 'info', 'Waiting for human verification checkbox...');
            
            // First, scroll down to find the checkbox
            await addDebugStep('Kie.ai Login', 'info', 'Scrolling down to find human verification checkbox...');
            await page.evaluate(() => {
              window.scrollTo(0, document.body.scrollHeight);
            });
            await randomHumanDelay(page, 1000, 2000);
            
            // Try scrolling up a bit to see if checkbox is in middle area
            await addDebugStep('Kie.ai Login', 'info', 'Scrolling up to check middle area...');
            await page.evaluate(() => {
              window.scrollTo(0, document.body.scrollHeight / 2);
            });
            await randomHumanDelay(page, 1000, 2000);
            
            // Try to find checkbox with multiple approaches
            let checkboxFound = false;
            
            // Approach 1: Try to find any checkbox-like element
            try {
              await addDebugStep('Kie.ai Login', 'info', 'Looking for any checkbox-like element...');
              await page.waitForSelector('div#checkbox[role="checkbox"], [role="checkbox"], input[type="checkbox"], [aria-checked]', { visible: true, timeout: 5000 });
              checkboxFound = true;
            } catch (e) {
              await addDebugStep('Kie.ai Login', 'info', `Standard selectors failed: ${e.message}`);
            }
            
            // Approach 2: Look for elements with "human" or "verification" in text
            if (!checkboxFound) {
              try {
                await addDebugStep('Kie.ai Login', 'info', 'Looking for human verification text...');
                const humanElements = await page.evaluate(() => {
                  const elements = Array.from(document.querySelectorAll('*'));
                  return elements.filter(el => {
                    const text = el.textContent?.toLowerCase() || '';
                    return text.includes('human') || text.includes('verification') || text.includes('checkbox');
                  });
                });
                
                if (humanElements && humanElements.length > 0) {
                  await addDebugStep('Kie.ai Login', 'info', `Found ${humanElements.length} elements with human/verification text`);
                  checkboxFound = true;
                } else {
                  await addDebugStep('Kie.ai Login', 'info', 'No elements found with human/verification text');
                }
              } catch (e) {
                await addDebugStep('Kie.ai Login', 'info', `Text search failed: ${e.message}`);
              }
            }
            
            // Approach 3: Look for any clickable element that might be a checkbox
            if (!checkboxFound) {
              try {
                await addDebugStep('Kie.ai Login', 'info', 'Looking for any clickable checkbox-like element...');
                const clickableElements = await page.evaluate(() => {
                  const elements = Array.from(document.querySelectorAll('[role="checkbox"], input[type="checkbox"], [aria-checked], [tabindex="0"]'));
                  return elements.filter(el => el.offsetParent !== null); // Only visible elements
                });
                
                if (clickableElements && clickableElements.length > 0) {
                  await addDebugStep('Kie.ai Login', 'info', `Found ${clickableElements.length} clickable checkbox-like elements`);
                  checkboxFound = true;
                } else {
                  await addDebugStep('Kie.ai Login', 'info', 'No clickable checkbox-like elements found');
                }
              } catch (e) {
                await addDebugStep('Kie.ai Login', 'info', `Clickable search failed: ${e.message}`);
              }
            }
            
            // Approach 4: Wait for hCaptcha iframe to load and check for visible elements
            if (!checkboxFound) {
              try {
                await addDebugStep('Kie.ai Login', 'info', 'Waiting for hCaptcha iframe to load...');
                await page.waitForSelector('iframe[src*="hcaptcha"], iframe[title*="hCaptcha"], .h-captcha iframe', { timeout: 10000 });
                await addDebugStep('Kie.ai Login', 'success', 'hCaptcha iframe found, waiting for checkbox to appear...');
                await randomHumanDelay(page, 3000, 5000);
                
                // Check if hCaptcha is actually visible and interactive
                const hcaptchaStatus = await page.evaluate(() => {
                  // Look for hCaptcha container
                  const hcaptchaContainer = document.querySelector('.h-captcha, [data-sitekey], [data-hcaptcha-widget-id]');
                  const iframe = document.querySelector('iframe[src*="hcaptcha"]');
                  
                  if (hcaptchaContainer && iframe) {
                    // Check if iframe is visible
                    const iframeRect = iframe.getBoundingClientRect();
                    const isVisible = iframeRect.width > 0 && iframeRect.height > 0 && 
                                    iframe.offsetParent !== null;
                    
                    return {
                      hasContainer: !!hcaptchaContainer,
                      hasIframe: !!iframe,
                      isVisible: isVisible,
                      iframeWidth: iframeRect.width,
                      iframeHeight: iframeRect.height
                    };
                  }
                  
                  return { hasContainer: false, hasIframe: false, isVisible: false };
                });
                
                await addDebugStep('Kie.ai Login', 'info', `hCaptcha status: Container=${hcaptchaStatus.hasContainer}, Iframe=${hcaptchaStatus.hasIframe}, Visible=${hcaptchaStatus.isVisible}, Size=${hcaptchaStatus.iframeWidth}x${hcaptchaStatus.iframeHeight}`);
                
                if (hcaptchaStatus.isVisible) {
                  // Try to find checkbox again after iframe loads
                  const iframeCheckbox = await page.evaluate(() => {
                    const selectors = ['div#checkbox[role="checkbox"]', '[role="checkbox"]', 'input[type="checkbox"]'];
                    for (const selector of selectors) {
                      const element = document.querySelector(selector);
                      if (element && element.offsetParent !== null) {
                        return true;
                      }
                    }
                    return false;
                  });
                  
                  if (iframeCheckbox) {
                    checkboxFound = true;
                    await addDebugStep('Kie.ai Login', 'success', 'Checkbox found after iframe loaded');
                  } else {
                    await addDebugStep('Kie.ai Login', 'info', 'hCaptcha iframe is visible but checkbox not found');
                  }
                } else {
                  await addDebugStep('Kie.ai Login', 'info', 'hCaptcha iframe found but not visible or interactive');
                }
              } catch (e) {
                await addDebugStep('Kie.ai Login', 'info', `hCaptcha iframe search failed: ${e.message}`);
              }
            }
            
            // Approach 5: Check if verification is already completed or not needed
            if (!checkboxFound) {
              try {
                await addDebugStep('Kie.ai Login', 'info', 'Checking if verification is already completed...');
                const verificationStatus = await page.evaluate(() => {
                  const bodyText = document.body.innerText.toLowerCase();
                  return {
                    hasVerificationText: bodyText.includes('verification') || bodyText.includes('human'),
                    hasCompletedText: bodyText.includes('verified') || bodyText.includes('completed') || bodyText.includes('success'),
                    hasErrorText: bodyText.includes('error') || bodyText.includes('failed') || bodyText.includes('try again')
                  };
                });
                
                if (verificationStatus.hasCompletedText) {
                  await addDebugStep('Kie.ai Login', 'success', 'Verification appears to be already completed');
                  checkboxFound = true;
                } else if (verificationStatus.hasErrorText) {
                  await addDebugStep('Kie.ai Login', 'warning', 'Verification error detected, continuing anyway');
                  checkboxFound = true;
                } else if (!verificationStatus.hasVerificationText) {
                  await addDebugStep('Kie.ai Login', 'info', 'No verification text found, may not be required');
                  checkboxFound = true;
                }
              } catch (e) {
                await addDebugStep('Kie.ai Login', 'info', `Verification status check failed: ${e.message}`);
              }
            }
            
            if (!checkboxFound) {
              await addDebugStep('Kie.ai Login', 'warning', 'No checkbox found with any approach, continuing anyway...');
              // Don't throw error, just continue
            }
            
            // Try multiple methods to click the checkbox (only if we found one)
            let checkboxClicked = false;
            
            if (checkboxFound) {
              // Method 1: Smart checkbox detection and clicking
            try {
              await addDebugStep('Kie.ai Login', 'info', 'Using smart checkbox detection...');
              const clicked = await page.evaluate(() => {
                // Try multiple selectors in order of specificity
                const selectors = [
                  'div#checkbox[role="checkbox"]',
                  'div[id="checkbox"][role="checkbox"]',
                  'div[role="checkbox"][aria-checked="false"]',
                  'div[role="checkbox"]',
                  'input[type="checkbox"]',
                  '[aria-checked="false"]',
                  '[role="checkbox"]'
                ];
                
                for (const selector of selectors) {
                  const element = document.querySelector(selector);
                  if (element && element.offsetParent !== null) { // Check if visible
                    element.click();
                    return { success: true, selector: selector };
                  }
                }
                return { success: false };
              });
              
              if (clicked.success) {
                checkboxClicked = true;
                await addDebugStep('Kie.ai Login', 'success', `Clicked checkbox using: ${clicked.selector}`);
              }
            } catch (e) {
              await addDebugStep('Kie.ai Login', 'info', `Smart checkbox detection failed: ${e.message}`);
            }
            
            // Method 2: Use page.evaluate for more reliable clicking
            if (!checkboxClicked) {
              try {
                await addDebugStep('Kie.ai Login', 'info', 'Trying evaluate method for checkbox...');
                const clicked = await page.evaluate(() => {
                  // Try multiple selectors in order of specificity
                  const selectors = [
                    'div#checkbox[role="checkbox"]',
                    'div[id="checkbox"][role="checkbox"]',
                    'div[role="checkbox"][aria-checked="false"]',
                    'div[role="checkbox"]',
                    'input[type="checkbox"]'
                  ];
                  
                  for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.offsetParent !== null) { // Check if visible
                      element.click();
                      return true;
                    }
                  }
                  return false;
                });
                
                if (clicked) {
                  checkboxClicked = true;
                  await addDebugStep('Kie.ai Login', 'success', 'Clicked checkbox using evaluate method');
                }
              } catch (e) {
                await addDebugStep('Kie.ai Login', 'info', `Evaluate method failed: ${e.message}`);
              }
            }
            
            // Method 3: Try alternative selectors
            if (!checkboxClicked) {
              const checkboxSelectors = [
                'div[role="checkbox"]',
                'input[type="checkbox"]',
                'div[id*="checkbox"]',
                'div[aria-checked="false"]',
                '[role="checkbox"]'
              ];
              
              for (const selector of checkboxSelectors) {
                try {
                  await addDebugStep('Kie.ai Login', 'info', `Trying selector: ${selector}`);
                  await page.waitForSelector(selector, { visible: true, timeout: 2000 });
                  await page.click(selector);
                  checkboxClicked = true;
                  await addDebugStep('Kie.ai Login', 'success', `Clicked checkbox with selector: ${selector}`);
                  break;
                } catch (selectorError) {
                  await addDebugStep('Kie.ai Login', 'info', `Selector ${selector} failed: ${selectorError.message}`);
                }
              }
            }
            
              if (checkboxClicked) {
                await takeScreenshot('Human-Verification-Checked', page);
                await addDebugStep('Kie.ai Login', 'success', 'Human verification checkbox clicked successfully', null, null, page);
              } else {
                await addDebugStep('Kie.ai Login', 'warning', 'Could not find or click human verification checkbox');
              }
            } else {
              await addDebugStep('Kie.ai Login', 'info', 'No checkbox found, skipping verification step');
            }
            
          } catch (e) {
            await addDebugStep('Kie.ai Login', 'warning', `Human verification failed: ${e.message}`);
          }
          
          // Wait for login to complete
          await randomHumanDelay(page, 3000, 5000);
          
          // Navigate to dashboard with better error handling
          await addDebugStep('Kie.ai Login', 'info', 'Navigating to Kie.ai dashboard...');
          try {
            await page.goto('https://kie.ai/dashboard', { waitUntil: 'networkidle2', timeout: 30000 });
            await takeScreenshot('Kie-ai-Dashboard', page);
            await addDebugStep('Kie.ai Login', 'success', 'Successfully navigated to Kie.ai dashboard', null, null, page);
          } catch (navError) {
            await addDebugStep('Kie.ai Login', 'warning', `Dashboard navigation failed: ${navError.message}`);
            
            // Try alternative navigation methods
            try {
              await addDebugStep('Kie.ai Login', 'info', 'Trying alternative navigation to dashboard...');
              await page.goto('https://kie.ai/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 });
              await takeScreenshot('Kie-ai-Dashboard-Fallback', page);
              await addDebugStep('Kie.ai Login', 'success', 'Successfully navigated to dashboard with fallback method', null, null, page);
            } catch (fallbackError) {
              await addDebugStep('Kie.ai Login', 'warning', `Fallback navigation also failed: ${fallbackError.message}`);
              
              // Try to navigate to the current page's dashboard link
              try {
                await addDebugStep('Kie.ai Login', 'info', 'Trying to find and click dashboard link...');
                const dashboardClicked = await page.evaluate(() => {
                  const links = Array.from(document.querySelectorAll('a[href*="dashboard"], a[href="/dashboard"]'));
                  const dashboardLink = links.find(link => link.offsetParent !== null);
                  if (dashboardLink) {
                    dashboardLink.click();
                    return true;
                  }
                  return false;
                });
                
                if (dashboardClicked) {
                  await randomHumanDelay(page, 3000, 5000);
                  await takeScreenshot('Kie-ai-Dashboard-Link', page);
                  await addDebugStep('Kie.ai Login', 'success', 'Successfully clicked dashboard link', null, null, page);
                } else {
                  await addDebugStep('Kie.ai Login', 'warning', 'No dashboard link found, staying on current page');
                }
              } catch (linkError) {
                await addDebugStep('Kie.ai Login', 'warning', `Dashboard link click failed: ${linkError.message}`);
              }
            }
          }
          
          // Step 12: Click API Key button
          await addDebugStep('Kie.ai API Key', 'info', 'Clicking API Key button...');
          try {
            const apiKeyButtonSelector = 'a[href="/api-key"]';
            await page.waitForSelector(apiKeyButtonSelector, { visible: true, timeout: 10000 });
            await page.click(apiKeyButtonSelector);
            
            // Wait for navigation with shorter timeout and fallback
            try {
              await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
            } catch (navError) {
              // Fallback: just wait for URL change
              await page.waitForFunction(() => window.location.href.includes('/api-key'), { timeout: 10000 });
            }
            
            await takeScreenshot('Kie-ai-API-Key-Page', page);
            await addDebugStep('Kie.ai API Key', 'success', 'Successfully navigated to API Key page', null, null, page);
            await randomHumanDelay(page, 2000, 3000);
          } catch (e) {
            await addDebugStep('Kie.ai API Key', 'warning', `API Key button click failed, trying direct navigation: ${e.message}`);
            // Fallback: try direct navigation
            try {
              await page.goto('https://kie.ai/api-key', { waitUntil: 'networkidle2', timeout: 15000 });
              await takeScreenshot('Kie-ai-API-Key-Direct', page);
              await addDebugStep('Kie.ai API Key', 'success', 'Successfully navigated to API Key page directly', null, null, page);
            } catch (directError) {
              await addDebugStep('Kie.ai API Key', 'error', `Direct navigation also failed: ${directError.message}`, null, directError, page);
            }
          }

          // Step 13: Extract API Key with smart logic
          await addDebugStep('Kie.ai API Key', 'info', 'Looking for API Key and Copy button...');
          
          try {
            // Skip DOM extraction - always use copy button for full API key
            await addDebugStep('Kie.ai API Key', 'info', 'Skipping DOM extraction - using copy button method for full API key...');
            
            // Try to find and click the copy button
            const copyButtonSelectors = [
              'button:has(svg.lucide-copy)',
              'button[aria-label*="copy"]',
              'button[title*="copy"]',
              'button:contains("Copy")',
              'svg.lucide-copy',
              '[role="gridcell"] button:has(svg.lucide-copy)',
              'button[class*="copy"]',
              'button[class*="Copy"]'
            ];
            
            let copyButton = null;
            for (const selector of copyButtonSelectors) {
              try {
                if (selector.includes(':has') || selector.includes(':contains')) {
                  // Use XPath for complex selectors
                  const xpath = selector.includes(':has') ? 
                    '//button[.//svg[contains(@class, "lucide-copy")]]' :
                    '//button[contains(text(), "Copy")]';
                  const [element] = await page.waitForXPath(xpath, { visible: true, timeout: 2000 });
                  if (element) {
                    copyButton = element;
                    break;
                  }
                } else {
                  const element = await page.waitForSelector(selector, { visible: true, timeout: 2000 });
                  if (element) {
                    copyButton = element;
                    break;
                  }
                }
              } catch (selectorError) {
                continue;
              }
            }

            if (copyButton) {
              // Hover over the copy button first
              await addDebugStep('Kie.ai API Key', 'info', 'Hovering over copy button...');
              await copyButton.hover();
              await randomHumanDelay(page, 500, 1000);
              
              await copyButton.click();
              await takeScreenshot('Kie-ai-API-Key-Copied', page);
              await addDebugStep('Kie.ai API Key', 'success', 'Clicked Copy button', null, null, page);
              await randomHumanDelay(page, 1000, 2000);

              // Try to extract API Key using API Updates page method
              await addDebugStep('Kie.ai API Key', 'info', 'Using API Updates page method to extract API key...');
              
              try {
                // Click on API Updates button
                await addDebugStep('Kie.ai API Key', 'info', 'Clicking on API Updates button...');
                const apiUpdatesButton = await page.waitForSelector('a[href="/api-updates"]', { visible: true, timeout: 10000 });
                await apiUpdatesButton.click();
                await randomHumanDelay(page, 2000, 3000);
                
                // Wait for API Updates page to load
                await page.waitForFunction(() => window.location.href.includes('/api-updates'), { timeout: 10000 });
                await addDebugStep('Kie.ai API Key', 'success', 'Successfully navigated to API Updates page');
                
                // Find the search input field
                await addDebugStep('Kie.ai API Key', 'info', 'Looking for search input field...');
                const searchInput = await page.waitForSelector('input[placeholder*="Search for updates"]', { visible: true, timeout: 10000 });
                
                // Click on the search input to focus it
                await searchInput.click();
                await randomHumanDelay(page, 500, 1000);
                
                // Paste the copied API key into the search field
                await addDebugStep('Kie.ai API Key', 'info', 'Pasting API key into search field...');
                await page.keyboard.down('Control');
                await page.keyboard.press('v');
                await page.keyboard.up('Control');
                
                await randomHumanDelay(page, 1000, 1500);
                
                // Select all text in the search field
                await page.keyboard.down('Control');
                await page.keyboard.press('a');
                await page.keyboard.up('Control');
                
                await randomHumanDelay(page, 500, 1000);
                
                // Copy the selected text
                await page.keyboard.down('Control');
                await page.keyboard.press('c');
                await page.keyboard.up('Control');
                
                await randomHumanDelay(page, 1000, 1500);
                
                // Extract the API key from the search field value
                await addDebugStep('Kie.ai API Key', 'info', 'Extracting API key from search field...');
                
                // Try multiple methods to get the full API key
                apiKey = await page.evaluate(() => {
                  const searchInput = document.querySelector('input[placeholder*="Search for updates"]');
                  if (!searchInput) return null;
                  
                  // Method 1: Get the value directly
                  let value = searchInput.value;
                  if (value && value.length > 20) {
                    return value;
                  }
                  
                  // Method 2: Get the text content if value is masked
                  const textContent = searchInput.textContent;
                  if (textContent && textContent.length > 20) {
                    return textContent;
                  }
                  
                  // Method 3: Get the innerHTML and extract text
                  const innerHTML = searchInput.innerHTML;
                  if (innerHTML && innerHTML.length > 20) {
                    return innerHTML;
                  }
                  
                  // Method 4: Check if it's in a data attribute
                  const dataValue = searchInput.getAttribute('data-value') || searchInput.getAttribute('value');
                  if (dataValue && dataValue.length > 20) {
                    return dataValue;
                  }
                  
                  // Method 5: Look for the actual text in the DOM
                  const allText = document.body.innerText;
                  const apiKeyMatch = allText.match(/[a-f0-9]{32,}/i);
                  if (apiKeyMatch) {
                    return apiKeyMatch[0];
                  }
                  
                  return value; // Return whatever we found
                });
                
                // If we still don't have a full key, try to get it from the visible text
                if (!apiKey || apiKey.length < 30) {
                  await addDebugStep('Kie.ai API Key', 'info', 'Trying to extract from visible text...');
                  
                  // Get all visible text and look for API key pattern
                  const fullApiKey = await page.evaluate(() => {
                    // Look for 32-character hex string (typical API key length)
                    const text = document.body.innerText;
                    const matches = text.match(/[a-f0-9]{32,}/gi);
                    if (matches && matches.length > 0) {
                      // Return the longest match (most likely the API key)
                      return matches.sort((a, b) => b.length - a.length)[0];
                    }
                    return null;
                  });
                  
                  if (fullApiKey && fullApiKey.length >= 30) {
                    apiKey = fullApiKey;
                    await addDebugStep('Kie.ai API Key', 'success', `Full API Key extracted from visible text: ${apiKey}`, null, null, page);
                  } else {
                    throw new Error('Could not extract full API key from visible text');
                  }
                } else {
                  await addDebugStep('Kie.ai API Key', 'success', `API Key extracted via API Updates page: ${apiKey}`, null, null, page);
                }
                
              } catch (apiUpdatesError) {
                await addDebugStep('Kie.ai API Key', 'warning', `API Updates method failed: ${apiUpdatesError.message}`);
                
                // Fallback: try direct clipboard extraction
                try {
                  apiKey = await page.evaluate(() => navigator.clipboard.readText());
                  if (apiKey && apiKey.length > 10) {
                    await addDebugStep('Kie.ai API Key', 'success', `API Key extracted from clipboard: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`, null, null, page);
                  } else {
                    throw new Error('Empty or invalid API key from clipboard');
                  }
                } catch (clipboardError) {
                  await addDebugStep('Kie.ai API Key', 'warning', `Clipboard extraction also failed: ${clipboardError.message}`);
                  await addDebugStep('Kie.ai API Key', 'warning', 'Could not extract API Key using any method');
                }
              }
            } else {
              await addDebugStep('Kie.ai API Key', 'warning', 'Could not find Copy button', null, null, page);
            }
          } catch (e) {
            await addDebugStep('Kie.ai API Key', 'error', `Failed to extract API Key: ${e.message}`, null, e, page);
          }
          
        } catch (switchError) {
          await addDebugStep('Kie.ai Login', 'warning', `Failed to switch back to Kie.ai: ${switchError.message}`);
        }
        
      } catch (kieError) {
        await addDebugStep('Kie.ai Login', 'error', `Kie.ai login failed: ${kieError.message}`);
      }
      
      return {
        success: true,
        message: 'Successfully logged into Microsoft account and Kie.ai',
        email: email,
        password: password, // Include password as requested
        name: 'Microsoft User',
        url: currentUrl,
        title: pageTitle,
        apiKey: apiKey || 'Not Found' // Include API key
      };
    } else {
      await addDebugStep('Login Verification', 'warning', `Unexpected page after login: ${currentUrl}`, null, null, page);
      
      return {
        success: true,
        message: 'Login completed but redirected to unexpected page',
        email: email,
        password: password, // Include password as requested
        name: 'Microsoft User',
        url: currentUrl,
        title: pageTitle,
        apiKey: 'Not Found' // No API key if login failed
      };
    }
    
  } catch (error) {
    addDebugStep('Login Process', 'error', `Login failed: ${error.message}`, null, null, page);
    return {
      success: false,
      error: error.message,
      email: email
    };
  } finally {
    // Clean up
    if (browser) {
      await browser.close();
      globalBrowser = null;
      globalPage = null;
    }
  }
}

module.exports = { loginToOutlook };
