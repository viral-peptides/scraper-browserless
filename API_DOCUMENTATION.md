# HTTP API Endpoints Documentation

## Overview
This scraper provides HTTP-based API endpoints for Latenode, Make.com, and KIE.ai credit checking. These endpoints accept JSON requests and return credit information without using browser automation.

## Base URL
- **Local**: `http://localhost:8080`
- **Production**: `https://scraper-latnode-production.up.railway.app`

## Endpoints

### 1. Latenode Credits
**Endpoint**: `POST /api/http/latenode`

**Request Body**:
```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response**:
```json
{
  "ok": true,
  "credits_used": "150",
  "credits_total": "1000",
  "credits_left": "850",
  "plugAndPlay_used": "25",
  "plugAndPlay_total": "100",
  "plugAndPlay_left": "75",
  "rawText": "Credits left: 850 / 1000, Plug & Play Tokens: 75 / 100",
  "screenshotBase64": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### 2. Make.com Credits
**Endpoint**: `POST /api/http/make`

**Request Body**:
```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response**:
```json
{
  "ok": true,
  "credits_used": "200",
  "credits_total": "500",
  "credits_left": "300",
  "rawText": "Credits left: 300 / 500"
}
```

### 3. KIE.ai Credits
**Endpoint**: `POST /api/http/kie`

**Request Body**:
```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

**Response**:
```json
{
  "ok": true,
  "remaining_credits": "450",
  "rawText": "Remaining credits: 450",
  "screenshotBase64": "iVBORw0KGgoAAAANSUhEUgAA..."
}
```

## Usage Examples

### cURL Examples

**Latenode**:
```bash
curl -X POST https://scraper-latnode-production.up.railway.app/api/http/latenode \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com", "password": "your-password"}'
```

**Make.com**:
```bash
curl -X POST https://scraper-latnode-production.up.railway.app/api/http/make \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com", "password": "your-password"}'
```

**KIE.ai**:
```bash
curl -X POST https://scraper-latnode-production.up.railway.app/api/http/kie \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com", "password": "your-password"}'
```

### JavaScript Examples

**Latenode**:
```javascript
const response = await fetch('https://scraper-latnode-production.up.railway.app/api/http/latenode', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'your-email@example.com',
    password: 'your-password'
  })
});

const data = await response.json();
console.log(data);
```

**Make.com**:
```javascript
const response = await fetch('https://scraper-latnode-production.up.railway.app/api/http/make', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'your-email@example.com',
    password: 'your-password'
  })
});

const data = await response.json();
console.log(data);
```

**KIE.ai**:
```javascript
const response = await fetch('https://scraper-latnode-production.up.railway.app/api/http/kie', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'your-email@example.com',
    password: 'your-password'
  })
});

const data = await response.json();
console.log(data);
```

### Python Examples

**Latenode**:
```python
import requests

url = "https://scraper-latnode-production.up.railway.app/api/http/latenode"
data = {
    "email": "your-email@example.com",
    "password": "your-password"
}

response = requests.post(url, json=data)
result = response.json()
print(result)
```

**Make.com**:
```python
import requests

url = "https://scraper-latnode-production.up.railway.app/api/http/make"
data = {
    "email": "your-email@example.com",
    "password": "your-password"
}

response = requests.post(url, json=data)
result = response.json()
print(result)
```

**KIE.ai**:
```python
import requests

url = "https://scraper-latnode-production.up.railway.app/api/http/kie"
data = {
    "email": "your-email@example.com",
    "password": "your-password"
}

response = requests.post(url, json=data)
result = response.json()
print(result)
```

## Error Responses

All endpoints return error responses in this format:

```json
{
  "ok": false,
  "error": "Error message description"
}
```

**Common Error Codes**:
- `400`: Bad Request (missing email or password)
- `500`: Internal Server Error

## Notes

- **Real Data**: All endpoints now trigger the existing Puppeteer scrapers in the background and return real credit data
- **Background Processing**: The HTTP endpoints call the working Puppeteer scrapers internally
- **Screenshots**: All endpoints include screenshot data for verification
- **CORS Support**: All endpoints support cross-origin requests
- **No Authentication**: No authentication required for the API endpoints themselves
- **Reliability**: Uses the proven Puppeteer scrapers that are already working
