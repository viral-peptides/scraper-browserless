const OpenAI = require('openai');

// Initialize OpenAI client (disabled - no API key needed)
// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY
// });

/**
 * Analyze a screenshot and get AI guidance on what to do next
 * @param {Buffer} screenshot - Screenshot buffer
 * @param {Object} pageInfo - Current page information
 * @param {string} currentStep - Current step description
 * @returns {Object} AI response with action and details
 */
async function getAIGuidance(screenshot, pageInfo, currentStep) {
  // AI guidance disabled - no API key needed
  return {
    success: false,
    message: 'AI guidance disabled - no API key configured',
    suggestedAction: 'Continue with manual scraping',
    confidence: 0
  };
  
  /* DISABLED - No API key needed
  try {
    console.log('🤖 Getting AI guidance for step:', currentStep);
    
    // Convert screenshot to base64
    const base64Image = screenshot.toString('base64');
    
    // Prepare the prompt for AI
    const prompt = `
You are an expert web scraping assistant. Analyze this screenshot and provide guidance on what to do next.

CURRENT STEP: ${currentStep}
PAGE URL: ${pageInfo.url}
PAGE TITLE: ${pageInfo.title}

AVAILABLE BUTTONS:
${pageInfo.buttons.map((btn, i) => `${i + 1}. "${btn.text}" (visible: ${btn.visible})`).join('\n')}

INSTRUCTIONS:
1. Look at the screenshot carefully
2. Identify what page we're on (Google login, Recraft.ai, etc.)
3. Find the next button/element to click
4. Provide the exact action to take

RESPONSE FORMAT (JSON only):
{
  "action": "click|wait|type|scroll|error",
  "selector": "CSS selector or button text",
  "reason": "Why this action is needed",
  "confidence": 0.0-1.0,
  "nextStep": "What should happen after this action"
}

IMPORTANT:
- If you see "IK begrijp het" button, click it
- If you see "Next" button, click it
- If you see Google login form, fill it
- If you see Recraft.ai dashboard, we're done
- Always provide a valid CSS selector or button text
- Be specific and actionable
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Updated to use the new model
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    });

    const aiResponse = JSON.parse(response.choices[0].message.content);
    console.log('🤖 AI Response:', aiResponse);
    
    return aiResponse;
    
  } catch (error) {
    console.error('❌ AI Guidance Error:', error);
    return {
      action: "error",
      selector: null,
      reason: `AI analysis failed: ${error.message}`,
      confidence: 0.0,
      nextStep: "Fallback to manual detection"
    };
  }
  */ // END DISABLED SECTION
}

/**
 * Execute AI-guided action on the page
 * @param {Object} page - Puppeteer page object
 * @param {Object} aiResponse - AI response with action details
 * @returns {boolean} Success status
 */
async function executeAIAction(page, aiResponse) {
  try {
    console.log(`🎯 Executing AI action: ${aiResponse.action}`);
    console.log(`📍 Selector: ${aiResponse.selector}`);
    console.log(`💡 Reason: ${aiResponse.reason}`);
    
    switch (aiResponse.action) {
      case 'click':
        if (aiResponse.selector) {
          // Try CSS selector first
          try {
            await page.click(aiResponse.selector);
            console.log('✅ Clicked using CSS selector');
            return true;
          } catch (error) {
            // Try finding by text if CSS selector fails
            const buttonFound = await page.evaluate((text) => {
              const buttons = Array.from(document.querySelectorAll('button, a, input[type="submit"]'));
              for (const button of buttons) {
                if (button.innerText.includes(text) || button.textContent.includes(text)) {
                  button.click();
                  return true;
                }
              }
              return false;
            }, aiResponse.selector);
            
            if (buttonFound) {
              console.log('✅ Clicked using text search');
              return true;
            }
          }
        }
        break;
        
      case 'wait':
        console.log('⏳ Waiting as suggested by AI...');
        await page.waitForTimeout(3000);
        return true;
        
      case 'type':
        if (aiResponse.selector && aiResponse.text) {
          await page.type(aiResponse.selector, aiResponse.text);
          console.log('✅ Typed text as suggested by AI');
          return true;
        }
        break;
        
      case 'scroll':
        await page.evaluate(() => window.scrollBy(0, 500));
        console.log('✅ Scrolled as suggested by AI');
        return true;
        
      case 'error':
        console.log('❌ AI detected an error:', aiResponse.reason);
        return false;
        
      default:
        console.log('⚠️ Unknown AI action:', aiResponse.action);
        return false;
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ Error executing AI action:', error);
    return false;
  }
}

module.exports = {
  getAIGuidance,
  executeAIAction
};
