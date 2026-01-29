const puppeteer = require('puppeteer');

// Real-Time Recraft.ai Login Scraper with Live Browser View
async function scrapeRecraftLoginLive(discordToken, recraftEmail, sessionData = null) {
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
    console.log('🚀 Starting Recraft.ai Login Scraper with LIVE BROWSER VIEW...');
    console.log('🔑 Discord Token:', discordToken ? 'Provided' : 'Not provided');
    console.log('📧 Recraft Email:', recraftEmail);

    addDebugStep('Scraper Started', 'info', 'Initializing Recraft.ai login scraper with live browser view');

    // Launch browser in NON-HEADLESS mode for live viewing
    addDebugStep('Browser Launch', 'info', 'Launching Puppeteer browser in LIVE MODE (non-headless)');
    browser = await puppeteer.launch({
      headless: false, // 🔴 LIVE MODE - You'll see the browser window!
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
        '--disable-renderer-backgrounding',
        '--window-size=1440,900', // Set window size
        '--start-maximized' // Start maximized for better viewing
      ]
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    addDebugStep('Browser Launch', 'success', 'Browser launched in LIVE MODE - you can see the browser window!');

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // STEP 1: Login to Discord FIRST with token
    console.log('🔐 STEP 1: Logging into Discord FIRST with token...');
    addDebugStep('Discord Login First', 'info', 'Logging into Discord first to establish session');

    // Validate token first
    console.log('🔍 Validating Discord token...');
    const tokenValidation = await page.evaluate(async (token) => {
      try {
        const response = await fetch('https://discord.com/api/v9/users/@me', {
          headers: {
            'Authorization': token,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          return { success: true, user: userData };
        } else {
          return { success: false, status: response.status };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    }, discordToken);

    console.log('Token validation result:', tokenValidation);
    addDebugStep('Token Validation', tokenValidation.success ? 'success' : 'error', 
      tokenValidation.success ? `Token valid for user: ${tokenValidation.user?.username}` : 'Token validation failed', tokenValidation);

    if (!tokenValidation.success) {
      console.log('⚠️ Discord token validation failed, but continuing with Recraft.ai flow...');
      addDebugStep('Token Validation', 'warning', 'Discord token validation failed, but continuing with Recraft.ai flow');
    }

    // Try Discord session storage + token injection approach
    console.log('🔐 Attempting Discord session storage + token injection...');
    addDebugStep('Discord Session + Token', 'info', 'Attempting Discord session storage + token injection');

    try {
      // Navigate to Discord app first
      await page.goto('https://discord.com/app', { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      await sleep(3000);
      await takeScreenshot('Discord App Initial');
      addDebugStep('Discord App Navigation', 'success', 'Navigated to Discord app');

      // Try multiple injection methods
      console.log('🔑 Attempting comprehensive token injection...');
      const injectionResult = await page.evaluate((token, sessionData) => {
        const results = {
          localStorage: { success: false, error: null },
          sessionStorage: { success: false, error: null },
          cookies: { success: false, error: null },
          windowObject: { success: false, error: null }
        };

        try {
          // Method 1: localStorage
          localStorage.setItem('token', token);
          localStorage.setItem('auth_token', token);
          localStorage.setItem('discord_token', token);
          localStorage.setItem('access_token', token);
          localStorage.setItem('authorization', token);
          results.localStorage.success = true;
        } catch (e) {
          results.localStorage.error = e.message;
        }

        try {
          // Method 2: sessionStorage
          sessionStorage.setItem('token', token);
          sessionStorage.setItem('auth_token', token);
          sessionStorage.setItem('discord_token', token);
          sessionStorage.setItem('access_token', token);
          sessionStorage.setItem('authorization', token);
          results.sessionStorage.success = true;
        } catch (e) {
          results.sessionStorage.error = e.message;
        }

        try {
          // Method 3: Cookies
          document.cookie = `token=${token}; domain=.discord.com; path=/; secure; samesite=none`;
          document.cookie = `auth_token=${token}; domain=.discord.com; path=/; secure; samesite=none`;
          document.cookie = `discord_token=${token}; domain=.discord.com; path=/; secure; samesite=none`;
          document.cookie = `access_token=${token}; domain=.discord.com; path=/; secure; samesite=none`;
          results.cookies.success = true;
        } catch (e) {
          results.cookies.error = e.message;
        }

        try {
          // Method 4: Window object
          window.discordToken = token;
          window.authToken = token;
          window.accessToken = token;
          results.windowObject.success = true;
        } catch (e) {
          results.windowObject.error = e.message;
        }

        // Inject session data if provided
        if (sessionData) {
          try {
            // Inject BIS data
            if (sessionData.bisData) {
              try {
                const bisData = JSON.parse(sessionData.bisData);
                localStorage.setItem('bis_data', JSON.stringify(bisData));
                sessionStorage.setItem('bis_data', JSON.stringify(bisData));
                console.log('✅ BIS data injected');
              } catch (e) {
                console.log('❌ BIS data injection failed:', e.message);
              }
            }
            
            // Inject click coordinates
            if (sessionData.clickX !== undefined) {
              localStorage.setItem('click-x', sessionData.clickX.toString());
              sessionStorage.setItem('click-x', sessionData.clickX.toString());
            }
            if (sessionData.clickY !== undefined) {
              localStorage.setItem('click-y', sessionData.clickY.toString());
              sessionStorage.setItem('click-y', sessionData.clickY.toString());
            }
            
            // Inject move coordinates
            if (sessionData.moveX !== undefined) {
              localStorage.setItem('move-x', sessionData.moveX.toString());
              sessionStorage.setItem('move-x', sessionData.moveX.toString());
            }
            if (sessionData.moveY !== undefined) {
              localStorage.setItem('move-y', sessionData.moveY.toString());
              sessionStorage.setItem('move-y', sessionData.moveY.toString());
            }
            
            // Inject referral properties
            if (sessionData.referralProperties) {
              try {
                const referralProps = JSON.parse(sessionData.referralProperties);
                localStorage.setItem('referralProperties', JSON.stringify(referralProps));
                sessionStorage.setItem('referralProperties', JSON.stringify(referralProps));
                console.log('✅ Referral properties injected');
              } catch (e) {
                console.log('❌ Referral properties injection failed:', e.message);
              }
            }
            
            console.log('✅ Session data injection completed');
          } catch (e) {
            console.log('❌ Session data injection failed:', e.message);
          }
        }

        return results;
      }, discordToken, sessionData);

      console.log('Token injection results:', injectionResult);
      addDebugStep('Token Injection', 'info', 'Comprehensive token injection attempted', injectionResult);

      // Refresh page to apply tokens
      console.log('🔄 Refreshing Discord page to apply tokens...');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(5000);
      await takeScreenshot('Discord App After Token Injection');

      // Check if any injection worked
      const injectionStatus = await page.evaluate(() => {
        return {
          hasLocalStorage: !!(localStorage.getItem('token') || localStorage.getItem('auth_token')),
          hasSessionStorage: !!(sessionStorage.getItem('token') || sessionStorage.getItem('auth_token')),
          hasCookies: document.cookie.includes('token') || document.cookie.includes('auth_token'),
          hasWindowObject: !!(window.discordToken || window.authToken),
          currentUrl: window.location.href,
          pageTitle: document.title
        };
      });

      console.log('Injection status:', injectionStatus);
      addDebugStep('Injection Status', 'info', 'Checking if any injection method worked', injectionStatus);

      // Check for Discord login success
      const discordLoginStatus = await page.evaluate(() => {
        const userElements = document.querySelectorAll('[class*="user"], [class*="avatar"], [class*="profile"]');
        const channelElements = document.querySelectorAll('[class*="channel"], [class*="server"]');
        const sidebarElements = document.querySelectorAll('[class*="sidebar"], [class*="guild"]');
        const loginElements = document.querySelectorAll('[class*="login"], [class*="signin"]');
        
        return {
          userElementsFound: userElements.length > 0,
          channelElementsFound: channelElements.length > 0,
          sidebarElementsFound: sidebarElements.length > 0,
          loginElementsFound: loginElements.length > 0,
          currentUrl: window.location.href,
          pageTitle: document.title
        };
      });

      console.log('Discord login status:', discordLoginStatus);
      
      if (discordLoginStatus.userElementsFound || discordLoginStatus.channelElementsFound || discordLoginStatus.sidebarElementsFound) {
        console.log('✅ Discord login successful!');
        addDebugStep('Discord Login', 'success', 'Discord login successful', discordLoginStatus);
      } else if (discordLoginStatus.loginElementsFound) {
        console.log('⚠️ Still on Discord login page');
        addDebugStep('Discord Login', 'warning', 'Still on Discord login page', discordLoginStatus);
      } else {
        console.log('⚠️ Discord login status unclear');
        addDebugStep('Discord Login', 'warning', 'Discord login status unclear', discordLoginStatus);
      }

      await takeScreenshot('Discord Login Final Status');

    } catch (e) {
      console.log('⚠️ Discord session + token injection failed:', e.message);
      addDebugStep('Discord Session + Token', 'warning', 'Discord session + token injection failed', null, e.message);
    }

    // Continue to Recraft.ai regardless
    console.log('🌐 Proceeding to Recraft.ai...');
    addDebugStep('Recraft Proceed', 'info', 'Proceeding to Recraft.ai flow');

    // STEP 2: Navigate to Recraft.ai
    console.log('🌐 STEP 2: Navigating to Recraft.ai...');
    addDebugStep('Recraft Navigation', 'info', 'Navigating to Recraft.ai');

    try {
      await page.goto('https://www.recraft.ai/', { 
        waitUntil: 'domcontentloaded', 
        timeout: 60000 
      });
      
      await sleep(3000);
      await takeScreenshot('Recraft.ai Homepage');
      addDebugStep('Recraft Navigation', 'success', 'Successfully navigated to Recraft.ai', `URL: ${page.url()}`);

    } catch (e) {
      console.log('❌ Failed to navigate to Recraft.ai:', e.message);
      addDebugStep('Recraft Navigation', 'error', 'Failed to navigate to Recraft.ai', null, e.message);
      await takeScreenshot('Recraft Navigation Error');
    }

    // STEP 3: Handle cookie consent
    console.log('🍪 STEP 3: Handling cookie consent...');
    addDebugStep('Cookie Consent', 'info', 'Checking for cookie consent popup');

    try {
      await sleep(2000);
      
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
          const cookieButton = await page.$(selector);
          if (cookieButton) {
            console.log('🍪 Found cookie consent, clicking accept...');
            await cookieButton.click();
            await sleep(1000);
            cookieAccepted = true;
            addDebugStep('Cookie Consent', 'success', 'Cookie consent accepted');
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      if (!cookieAccepted) {
        console.log('ℹ️ No cookie consent popup found');
        addDebugStep('Cookie Consent', 'info', 'No cookie consent popup found');
      }
      
      await takeScreenshot('After Cookie Handling');

    } catch (e) {
      console.log('ℹ️ Cookie consent handling failed:', e.message);
      addDebugStep('Cookie Consent', 'warning', 'Cookie consent handling failed', null, e.message);
    }

    // STEP 4: Click Sign In button
    console.log('🔑 STEP 4: Looking for Sign In button...');
    addDebugStep('Sign In Button', 'info', 'Looking for Sign In button');

    try {
      const signInSelectors = [
        'a[data-testid="main-page-login"]',
        'a[href*="/auth/login"]',
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
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          signInClicked = true;
          console.log('✅ Sign in button clicked with selector:', selector);
          addDebugStep('Sign In Button', 'success', 'Sign in button clicked', `Selector: ${selector}`);
          break;
        } catch (e) {
          console.log('⚠️ Sign in selector failed:', selector, e.message);
        }
      }
      
      if (!signInClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, a, [role="button"]');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', button);
          if (text && (text.toLowerCase().includes('sign in') || text.toLowerCase().includes('login'))) {
            console.log('✅ Found Sign in button by text:', text);
            await button.click();
            signInClicked = true;
            addDebugStep('Sign In Button', 'success', 'Sign in button clicked by text', `Text: ${text}`);
            break;
          }
        }
      }
      
      if (!signInClicked) {
        throw new Error('Could not find Sign In button');
      }
      
      await sleep(3000);
      await takeScreenshot('After Sign In Click');

    } catch (e) {
      console.log('❌ Could not click Sign In button:', e.message);
      addDebugStep('Sign In Button', 'error', 'Could not click Sign In button', null, e.message);
      await takeScreenshot('Sign In Error');
    }

    // STEP 5: Handle "Sorry, nothing to see here" error page
    console.log('🚫 STEP 5: Checking for error page...');
    addDebugStep('Error Page Check', 'info', 'Checking for error page');

    try {
      const isErrorPage = await page.evaluate(() => {
        const pageText = document.body.innerText || '';
        return pageText.includes('Sorry, nothing to see here') || 
               pageText.includes('Go back to recraft') ||
               pageText.includes('error') ||
               pageText.includes('Error');
      });
      
      if (isErrorPage) {
        console.log('🚫 Found error page, looking for "Go back to recraft" button...');
        addDebugStep('Error Page', 'warning', 'Found error page, looking for Go back button');
        
        const goBackSelectors = [
          'a[href="/projects"]',
          'a.c-bZNrxE',
          'a[class*="c-bZNrxE"]',
          'a[class*="c-cfmRqm"]',
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
            await page.waitForSelector(selector, { timeout: 3000 });
            await page.click(selector);
            goBackClicked = true;
            console.log('✅ Go back button clicked with selector:', selector);
            addDebugStep('Go Back Button', 'success', 'Go back button clicked', `Selector: ${selector}`);
            break;
          } catch (e) {
            console.log('⚠️ Go back selector failed:', selector, e.message);
          }
        }
        
        if (goBackClicked) {
          await sleep(3000);
          await takeScreenshot('After Go Back Button');
        } else {
          console.log('⚠️ Could not find Go back button');
          addDebugStep('Go Back Button', 'error', 'Could not find Go back button');
        }
      } else {
        console.log('✅ No error page detected');
        addDebugStep('Error Page Check', 'success', 'No error page detected');
      }
      
    } catch (e) {
      console.log('ℹ️ Error page check failed:', e.message);
      addDebugStep('Error Page Check', 'warning', 'Error page check failed', null, e.message);
    }

    // STEP 6: Fill email and continue
    console.log('📧 STEP 6: Filling email address...');
    addDebugStep('Email Entry', 'info', 'Filling in email address');

    try {
      await sleep(3000);
      
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="Email" i]',
        'input[autocomplete="email"]',
        '#email',
        '.email-input'
      ];
      
      let emailFilled = false;
      for (const selector of emailSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.type(selector, recraftEmail, { delay: 50 });
          emailFilled = true;
          console.log('✅ Email filled with selector:', selector);
          addDebugStep('Email Entry', 'success', 'Email filled successfully', `Selector: ${selector}`);
          break;
        } catch (e) {
          console.log('⚠️ Email selector failed:', selector, e.message);
        }
      }
      
      if (!emailFilled) {
        throw new Error('Could not find email input field');
      }
      
      await sleep(1000);
      await takeScreenshot('After Email Entry');

    } catch (e) {
      console.log('❌ Could not fill email:', e.message);
      addDebugStep('Email Entry', 'error', 'Could not fill email', null, e.message);
      await takeScreenshot('Email Entry Error');
    }

    // STEP 7: Check Cloudflare verification checkbox (skip "Remember me")
    console.log('🤖 STEP 7: Checking Cloudflare verification checkbox...');
    addDebugStep('Cloudflare Verification', 'info', 'Checking Cloudflare verification checkbox (skipping Remember me)');

    try {
      // First, let's see all checkboxes on the page
      const allCheckboxes = await page.$$('input[type="checkbox"]');
      console.log(`Found ${allCheckboxes.length} checkboxes on the page`);
      
      let cloudflareChecked = false;
      let rememberMeFound = false;
      
      for (let i = 0; i < allCheckboxes.length; i++) {
        const checkbox = allCheckboxes[i];
        const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || '', checkbox);
        const id = await page.evaluate(el => el.getAttribute('id') || '', checkbox);
        const name = await page.evaluate(el => el.getAttribute('name') || '', checkbox);
        const parentText = await page.evaluate(el => el.parentElement?.textContent || '', checkbox);
        const isChecked = await page.evaluate(el => el.checked, checkbox);
        
        console.log(`Checkbox ${i}: aria-label="${ariaLabel}", id="${id}", name="${name}", parentText="${parentText}", checked=${isChecked}`);
        
        // Skip "Remember me" checkbox
        if (ariaLabel.toLowerCase().includes('remember') || 
            id.toLowerCase().includes('remember') || 
            name.toLowerCase().includes('remember') ||
            parentText.toLowerCase().includes('remember me')) {
          console.log('⚠️ Skipping "Remember me" checkbox');
          rememberMeFound = true;
          continue;
        }
        
        // Look for Cloudflare verification checkbox
        if (ariaLabel.toLowerCase().includes('verify') || 
            ariaLabel.toLowerCase().includes('human') ||
            parentText.toLowerCase().includes('verify') ||
            parentText.toLowerCase().includes('cloudflare') ||
            id.toLowerCase().includes('verify') ||
            name.toLowerCase().includes('verify')) {
          console.log('✅ Found Cloudflare verification checkbox');
          if (!isChecked) {
            await checkbox.click();
            cloudflareChecked = true;
            console.log('✅ Cloudflare verification checkbox checked');
            addDebugStep('Cloudflare Verification', 'success', 'Cloudflare verification checkbox checked', `Checkbox ${i}: ${ariaLabel || id || name}`);
            break;
          } else {
            console.log('ℹ️ Cloudflare verification checkbox already checked');
            addDebugStep('Cloudflare Verification', 'info', 'Cloudflare verification checkbox already checked');
            cloudflareChecked = true;
            break;
          }
        }
      }
      
      if (!cloudflareChecked) {
        console.log('⚠️ Could not find Cloudflare verification checkbox');
        addDebugStep('Cloudflare Verification', 'warning', 'Could not find Cloudflare verification checkbox');
      }
      
      if (rememberMeFound) {
        console.log('✅ "Remember me" checkbox found and skipped');
        addDebugStep('Remember Me Skip', 'success', 'Remember me checkbox found and skipped');
      }
      
      await sleep(1000);
      await takeScreenshot('After Cloudflare Verification');

    } catch (e) {
      console.log('ℹ️ Cloudflare verification checkbox handling failed:', e.message);
      addDebugStep('Cloudflare Verification', 'warning', 'Cloudflare verification checkbox handling failed', null, e.message);
    }

    // STEP 8: Click Continue button
    console.log('➡️ STEP 8: Clicking Continue button...');
    addDebugStep('Continue Button', 'info', 'Clicking Continue button');

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
          console.log('✅ Continue button clicked with selector:', selector);
          addDebugStep('Continue Button', 'success', 'Continue button clicked', `Selector: ${selector}`);
          break;
        } catch (e) {
          console.log('⚠️ Continue selector failed:', selector, e.message);
        }
      }
      
      if (!continueClicked) {
        // Fallback: try to find button by text content
        const buttons = await page.$$('button, input[type="submit"]');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || el.value || '', button);
          if (text && text.toLowerCase().includes('continue')) {
            console.log('✅ Continue button clicked by text:', text);
            await button.click();
            continueClicked = true;
            addDebugStep('Continue Button', 'success', 'Continue button clicked by text', `Text: ${text}`);
            break;
          }
        }
      }
      
      if (!continueClicked) {
        throw new Error('Could not find Continue button');
      }
      
      await sleep(3000);
      await takeScreenshot('After Continue Click');

    } catch (e) {
      console.log('❌ Could not click Continue button:', e.message);
      addDebugStep('Continue Button', 'error', 'Could not click Continue button', null, e.message);
      await takeScreenshot('Continue Button Error');
    }

    // STEP 9: Look for Discord button
    console.log('🎮 STEP 9: Looking for Discord button...');
    addDebugStep('Discord Button', 'info', 'Looking for Discord login button');

    try {
      await sleep(3000);
      
      const discordSelectors = [
        'button[aria-label*="Discord"]',
        'button:has-text("Discord")',
        'a[href*="discord"]',
        'button svg path[d*="M20.3303"]',
        'button:has(svg path[d*="M20.3303"])',
        '[data-testid*="discord"]',
        'button[class*="discord"]'
      ];
      
      let discordClicked = false;
      for (const selector of discordSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 3000 });
          await page.click(selector);
          discordClicked = true;
          console.log('✅ Discord button clicked with selector:', selector);
          addDebugStep('Discord Button', 'success', 'Discord button clicked', `Selector: ${selector}`);
          break;
        } catch (e) {
          console.log('⚠️ Discord selector failed:', selector, e.message);
        }
      }
      
      if (!discordClicked) {
        // Fallback: search all buttons for Discord
        const buttons = await page.$$('button, a');
        for (const button of buttons) {
          const text = await page.evaluate(el => el.textContent || '', button);
          const innerHTML = await page.evaluate(el => el.innerHTML || '', button);
          
          if (text.toLowerCase().includes('discord') || innerHTML.includes('M20.3303')) {
            console.log('✅ Found Discord button by content:', text);
            await button.click();
            discordClicked = true;
            addDebugStep('Discord Button', 'success', 'Discord button clicked by content', `Text: ${text}`);
            break;
          }
        }
      }
      
      if (discordClicked) {
        await sleep(3000);
        await takeScreenshot('After Discord Button Click');
        
        // Check if we're on Discord OAuth page
        const currentUrl = page.url();
        console.log('📍 Current URL after Discord click:', currentUrl);
        addDebugStep('Discord OAuth Check', 'info', 'Checking if redirected to Discord OAuth page', `URL: ${currentUrl}`);
        
        if (currentUrl.includes('discord.com') && currentUrl.includes('oauth')) {
          console.log('✅ Successfully redirected to Discord OAuth page');
          addDebugStep('Discord OAuth Redirect', 'success', 'Successfully redirected to Discord OAuth page', `URL: ${currentUrl}`);
          
          await takeScreenshot('Discord OAuth Page');
          
          // Wait for OAuth page to fully load
          await sleep(2000);
          
          // Look for Authorize button with comprehensive logging
          console.log('🔍 Looking for Discord Authorize button...');
          addDebugStep('Discord Authorization', 'info', 'Looking for Discord Authorize button');
          
          try {
            // First, let's see all buttons on the page
            const allButtons = await page.$$('button, input[type="submit"], input[type="button"]');
            console.log(`Found ${allButtons.length} buttons on Discord OAuth page`);
            
            let authorized = false;
            let authorizeButtonFound = false;
            
            for (let i = 0; i < allButtons.length; i++) {
              const button = allButtons[i];
              const text = await page.evaluate(el => el.textContent || el.value || '', button);
              const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || '', button);
              const className = await page.evaluate(el => el.className || '', button);
              const id = await page.evaluate(el => el.id || '', button);
              
              console.log(`Button ${i}: text="${text}", aria-label="${ariaLabel}", class="${className}", id="${id}"`);
              
              if (text && (text.toLowerCase().includes('authorize') || 
                         text.toLowerCase().includes('allow') || 
                         text.toLowerCase().includes('continue') ||
                         text.toLowerCase().includes('approve') ||
                         text.toLowerCase().includes('accept') ||
                         text.toLowerCase().includes('confirm'))) {
                console.log(`✅ Found potential authorize button by text: "${text}"`);
                authorizeButtonFound = true;
                try {
                  await button.click();
                  authorized = true;
                  console.log('✅ Authorize button clicked by text:', text);
                  addDebugStep('Discord Authorization', 'success', 'Authorize button clicked by text', `Text: ${text}`);
                  break;
                } catch (e) {
                  console.log('⚠️ Failed to click button by text:', e.message);
                }
              }
            }
            
            if (authorized) {
              console.log('✅ Discord authorization initiated, waiting for redirect...');
              addDebugStep('Discord Authorization', 'success', 'Discord authorization initiated');
              
              // Wait for redirect with longer timeout
              await sleep(5000);
              await takeScreenshot('After Discord Authorization');
              
              // Check if we're back on Recraft.ai
              const finalUrl = page.url();
              console.log('📍 Final URL after authorization:', finalUrl);
              addDebugStep('Return to Recraft', 'info', 'Checking if returned to Recraft.ai after Discord auth', `URL: ${finalUrl}`);
              
              if (finalUrl.includes('recraft.ai')) {
                console.log('✅ Successfully returned to Recraft.ai after Discord auth');
                addDebugStep('Return to Recraft', 'success', 'Successfully returned to Recraft.ai after Discord auth', `URL: ${finalUrl}`);
              } else if (finalUrl.includes('discord.com')) {
                console.log('⚠️ Still on Discord - authorization may have failed');
                addDebugStep('Return to Recraft', 'warning', 'Still on Discord - authorization may have failed', `URL: ${finalUrl}`);
              } else {
                console.log('⚠️ Unexpected redirect location');
                addDebugStep('Return to Recraft', 'warning', 'Unexpected redirect location', `URL: ${finalUrl}`);
              }
            } else {
              addDebugStep('Discord Authorization', 'error', 'Could not find or click Authorize button on OAuth page');
            }
          } catch (e) {
            console.log('❌ Discord authorization failed:', e.message);
            addDebugStep('Discord Authorization', 'error', 'Discord authorization failed', null, e.message);
            await takeScreenshot('Discord Authorization Error');
          }
        } else if (currentUrl.includes('recraft.ai')) {
          console.log('✅ Already on Recraft.ai - Discord session may be established');
          addDebugStep('Discord Session Check', 'success', 'Already on Recraft.ai - Discord session may be established', `URL: ${currentUrl}`);
        } else {
          console.log('⚠️ Did not redirect to Discord OAuth page');
          addDebugStep('Discord OAuth Redirect', 'warning', 'Did not redirect to Discord OAuth page', `Current URL: ${currentUrl}`);
        }
      } else {
        addDebugStep('Discord Button', 'error', 'Could not find Discord button');
        console.log('⚠️ Could not find Discord button');
      }
      
    } catch (e) {
      console.log('⚠️ Discord button handling failed:', e.message);
      addDebugStep('Discord Button', 'error', 'Discord button handling failed', null, e.message);
      await takeScreenshot('Discord Button Error');
    }

    // STEP 10: Check if we're logged in to Recraft.ai
    console.log('🔍 STEP 10: Checking Recraft.ai login status...');
    addDebugStep('Recraft Login Check', 'info', 'Checking if logged into Recraft.ai');

    try {
      const isLoggedIn = await page.evaluate(() => {
        const userMenu = document.querySelector('[class*="user"]') || document.querySelector('[data-testid*="user"]');
        const dashboard = document.querySelector('[class*="dashboard"]') || document.querySelector('[data-testid*="dashboard"]');
        const credits = document.querySelector('[class*="credit"]') || document.querySelector('[class*="balance"]');
        
        return !!(userMenu || dashboard || credits);
      });
      
      if (isLoggedIn) {
        console.log('✅ Successfully logged into Recraft.ai!');
        addDebugStep('Recraft Login Check', 'success', 'Successfully logged into Recraft.ai');
      } else {
        console.log('⚠️ Not logged into Recraft.ai yet');
        addDebugStep('Recraft Login Check', 'warning', 'Not logged into Recraft.ai yet');
      }
      
      await takeScreenshot('Final Recraft.ai Status');
      
    } catch (e) {
      console.log('⚠️ Recraft.ai login check failed:', e.message);
      addDebugStep('Recraft Login Check', 'error', 'Recraft.ai login check failed', null, e.message);
    }

    // Return success response with debug data
    return {
      ok: true,
      message: 'Recraft.ai login process completed with LIVE BROWSER VIEW',
      finalUrl: page.url(),
      debugSteps: debugSteps,
      screenshots: screenshots
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
      debugSteps: debugSteps,
      screenshots: screenshots,
      errorScreenshot: errorScreenshot ? errorScreenshot.toString('base64') : null
    };
  } finally {
    // Don't close browser immediately - let user see the result
    console.log('🔴 LIVE MODE: Browser window will remain open for you to inspect');
    console.log('🔴 Press Ctrl+C to close the browser when done');
    
    // Keep browser open for 30 seconds so user can see the result
    await sleep(30000);
    
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = { scrapeRecraftLoginLive };
