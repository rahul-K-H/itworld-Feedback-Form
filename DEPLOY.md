# Deploying the IT Team Feedback Form

Repo: https://github.com/rahul-K-H/itworld-Feedback-Form

## Requirements
- Node.js >= 20.6
- A subdomain (example: `feedback.yourdomain.com`) pointing to the server
- nginx or Caddy for HTTPS
- The Zoho values for `.env` (shared separately, never via git)

## 1. Get the code
```bash
git clone https://github.com/rahul-K-H/itworld-Feedback-Form.git
cd itworld-Feedback-Form
npm install --omit=dev
```

## 2. Configure
```bash
cp .env.example .env
```
Edit `.env`:

| Key | Value |
|---|---|
| `APP_URL` | `https://feedback.yourdomain.com` |
| `PORT` | e.g. `3000` |
| `SESSION_SECRET` | new random string (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` | from the owner |
| `ZOHO_SHEET_RESOURCE_ID`, `ZOHO_WORKSHEET_NAME` | from the owner |
| `ZOHO_LOGIN_CLIENT_ID`, `ZOHO_LOGIN_CLIENT_SECRET` | from the owner |
| `ALLOWED_EMAIL_DOMAINS` | optional, e.g. `it-world.in` |

## 3. Zoho redirect URI
In https://api-console.zoho.in, open the login (server-based) client and add this
redirect URI exactly, otherwise sign-in fails:

```
https://feedback.yourdomain.com/auth/callback
```

## 4. Run with a process manager
```bash
npm install -g pm2
pm2 start npm --name feedback -- start
pm2 save
pm2 startup
```

## 5. Reverse proxy + HTTPS

DNS: create an `A` record for the subdomain pointing at the server IP.

**Caddy** (automatic HTTPS):
```
feedback.yourdomain.com {
    reverse_proxy localhost:3000
}
```

**nginx:**
```nginx
server {
    server_name feedback.yourdomain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Then: `sudo certbot --nginx -d feedback.yourdomain.com`

## 6. Verify
Open `https://feedback.yourdomain.com`, sign in with Zoho, and submit a test
response. Check that it appears in the Zoho Sheet.

## Updating
```bash
git pull
npm install --omit=dev
pm2 restart feedback
```

## Notes
- Never commit `.env`. It is git-ignored.
- Duplicate submissions are blocked using the Zoho Sheet itself: on startup the
  server loads the already-submitted Employee IDs from the sheet, so redeploying
  or moving servers loses nothing.
