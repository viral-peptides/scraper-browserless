# Latenode Credit Scraper

A web scraper that automatically logs into your Latenode account and extracts your credit information.

## Features

- 🔐 Secure credential handling
- 🤖 Automated browser interaction with Puppeteer
- 📊 Credit balance extraction
- 📸 Screenshot capture for debugging
- 🌐 Web interface for easy use
- ☁️ Vercel deployment ready

## Deployment

### Option 1: Deploy to Vercel (Recommended)

1. **Fork this repository** to your GitHub account
2. **Connect to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with your GitHub account
   - Click "New Project"
   - Import your forked repository
   - Deploy!

3. **Your scraper will be available at:** `https://your-project-name.vercel.app`

### Option 2: Local Development

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd latenode-scraper
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run locally:**
   ```bash
   npm run dev
   ```

## Usage

1. Open the web interface
2. Enter your Latenode email and password
3. Click "Check Credits"
4. View your credit information and screenshot

## Security Notes

- Credentials are only used for the scraping session
- No data is stored permanently
- Screenshots are only captured for debugging purposes
- All requests are processed server-side

## API Endpoint

The scraper also provides a REST API endpoint:

**POST** `/api/scrape`

**Request Body:**
```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "credits_left": "150",
    "credits_total": "200",
    "credits_used": "50",
    "plugAndPlay_left": "10",
    "plugAndPlay_total": "15",
    "plugAndPlay_used": "5",
    "rawText": "Credits left: 150/200...",
    "screenshotBase64": "iVBORw0KGgoAAAANSUhEUgAA..."
  }
}
```

## Troubleshooting

If the scraper fails:

1. Check the error message in the response
2. View the screenshot to see what went wrong
3. Ensure your credentials are correct
4. Try again after a few minutes (rate limiting)

## Requirements

- Node.js 18+
- Vercel account (for deployment)
- Valid Latenode account credentials
