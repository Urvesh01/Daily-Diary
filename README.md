# Daily Assessment Diary

Angular frontend + Express/MongoDB API in **one project**, ready for Vercel.

```
api/index.js          Vercel serverless entry (exports the Express app)
server/               Express app, MongoDB models, local dev server
src/                  Angular app (src/pdf.ts = PDF generator)
public/assets/        Logos, watermark and fonts used inside the PDF
vercel.json           Build + routing config for Vercel
```

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` and fill `MONGODB_URI` and `JWT_SECRET`.
3. `npm run dev` → open http://localhost:4200 (API runs on :4000, proxied automatically).

`npm run test:pdf` writes sample PDFs to `tmp/` using the same engine as the app.

## Deploy on Vercel
1. **MongoDB Atlas** (free tier): create a cluster → Database Access: add a user → Network Access: **Allow 0.0.0.0/0** (Vercel has no fixed IP) → Connect → copy the connection string and put the database name in it (`.../diary?...`).
2. Push this folder to a GitHub repository (`.env` is git-ignored – never commit it).
3. Vercel → **Add New → Project** → import the repo. Leave the settings as detected (they come from `vercel.json`).
4. Add **Environment Variables**: `MONGODB_URI`, `JWT_SECRET` (generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
5. Deploy. Check `https://YOUR-APP.vercel.app/api/health` returns `{"ok":true}`.

If you change env vars later, redeploy. Login errors like "MONGODB_URI is missing" or "Cannot reach the database" mean step 1 or 4 needs fixing.

## Security note
The old `.env` that was inside the zip contained a weak `JWT_SECRET` and database settings. Treat them as exposed: use a new secret and a new Atlas password.
