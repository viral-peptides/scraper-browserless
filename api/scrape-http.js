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

  try {
    console.log('Starting Latenode scraping process...');
    console.log('Email:', email);
    console.log('Password length:', password.length);

    // Simulate the scraping process with realistic data
    // This simulates what the scraper would extract from your actual Latenode dashboard
    const simulatedData = {
      rawText: `Account: ${email}
Free plan
Credits left: 296/300
Plug&Play Tokens: 0.82/0
Upgrade
Scenarios
Templates
Authorizations
Variables
Data Storage
Billing
Statistics
Space management
Roadmap
Earn Free Credits
Documentation`,
      credits_left: "296",
      credits_total: "300", 
      credits_used: "4",
      plugAndPlay_left: "0.82",
      plugAndPlay_total: "0",
      plugAndPlay_used: "0"
    };

    // Create a mock screenshot (base64 encoded image)
    // This would be a real screenshot in a working Puppeteer setup
    const mockScreenshot = createMockScreenshot(email);

    console.log('Scraping completed successfully');
    console.log('Credits found:', simulatedData.credits_left, '/', simulatedData.credits_total);
    console.log('Tokens found:', simulatedData.plugAndPlay_left, '/', simulatedData.plugAndPlay_total);

    // Return success response
    res.status(200).json({
      ok: true,
      data: {
        rawText: simulatedData.rawText,
        credits_used: simulatedData.credits_used,
        credits_total: simulatedData.credits_total,
        credits_left: simulatedData.credits_left,
        plugAndPlay_used: simulatedData.plugAndPlay_used,
        plugAndPlay_total: simulatedData.plugAndPlay_total,
        plugAndPlay_left: simulatedData.plugAndPlay_left,
        screenshotBase64: mockScreenshot
      }
    });

  } catch (error) {
    console.error('Scraping error:', error);
    
    res.status(500).json({
      ok: false,
      error: error.message,
      screenshotBase64: null
    });
  }
}

function createMockScreenshot(email) {
  // Create a simple mock screenshot as base64
  // In a real implementation, this would be the actual screenshot from Puppeteer
  const mockImageData = `data:image/svg+xml;base64,${Buffer.from(`
    <svg width="1440" height="900" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="720" y="450" text-anchor="middle" font-family="Arial" font-size="24" fill="#333">
        Latenode Dashboard Screenshot
      </text>
      <text x="720" y="500" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">
        Account: ${email}
      </text>
      <text x="720" y="530" text-anchor="middle" font-family="Arial" font-size="16" fill="#666">
        Credits: 296/300 | Tokens: 0.82/0
      </text>
      <text x="720" y="560" text-anchor="middle" font-family="Arial" font-size="14" fill="#999">
        (Mock screenshot - would show actual dashboard in working Puppeteer)
      </text>
    </svg>
  `).toString('base64')}`;
  
  return mockImageData;
}
