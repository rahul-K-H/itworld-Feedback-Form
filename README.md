# IT Team Feedback Form

A web form for collecting IT team meeting feedback. Employees sign in with Zoho,
fill in the form, and each response is saved as a row in a Zoho Sheet.

## Features
- Zoho sign-in (SSO), optionally restricted to specific email domains
- Employee ID is checked against the `Employees` tab; name and role are pre-filled
- One submission per Employee ID (duplicates are blocked)
- Store/location and role lists come from the `Stores` and `Employees` tabs
- Responses are saved to the `Responses` tab
- "Thanks for submitting!" popup after a successful submit

## Tech
Node.js (>= 20.6) and Express, with a plain HTML/JS front end in `public/`.
Data is stored in Zoho Sheet through the Zoho Sheet API.

## Project layout
| File | Purpose |
|---|---|
| `server.js` | Express server and API routes |
| `auth.js` | Zoho sign-in (SSO) |
| `zoho.js` | Zoho Sheet client (tokens, read/write) |
| `get-token.js` | One-time script to get the Zoho refresh token |
| `setup-sheet.js` | Writes the header row into the `Responses` tab |
| `public/index.html` | The form |
| `public/form-config.js` | Questions and options shown on the form |
| `zoho-sheet-template.csv` | Header template for the `Responses` tab |

## Zoho Sheet setup
The spreadsheet needs three tabs, named exactly:
- `Responses` (row 1 holds the headers; see `zoho-sheet-template.csv`)
- `Employees`
- `Stores`

## Run locally
```bash
npm install
cp .env.example .env     # then fill in the values
npm start
```
Open http://localhost:3000.

Useful scripts:
```bash
npm run get-token -- <grant_code>   # get the Zoho refresh token
npm run setup-sheet                 # write headers to the Responses tab
```

## Configuration
All settings live in `.env` (copy from `.env.example`). Never commit `.env`;
it is git-ignored.

## Deploying
See [DEPLOY.md](DEPLOY.md) for server setup, subdomain, HTTPS and pm2.
