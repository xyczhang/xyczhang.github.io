# Vector flight tracker

Vector is a responsive HTML/CSS/JavaScript flight tracker deployed with Vercel Functions. It does not require Flask or a continuously running server.

The browser calls same-origin `/api` endpoints. Those functions add the Aviationstack key on Vercel, so the key is never embedded in the HTML, JavaScript bundle, browser storage, or browser requests.

## Run in demo mode

Install the [Vercel CLI](https://vercel.com/docs/cli), then run:

```bash
vercel dev
```

The site works immediately with clearly labeled sample data.

## Add the private Aviationstack key

1. [Open Aviationstack and create an account](https://aviationstack.com/?utm_source=Github&utm_medium=Referral&utm_campaign=Public-apis-repo-Best-sellers).
2. Copy the access key from the Aviationstack dashboard.
3. In Vercel, open **Project → Settings → Environment Variables**.
4. Create `AVIATIONSTACK_API_KEY`, choose **Secret**, and enable it for Production and Preview.
5. Redeploy the project so the new value is available to the functions.

For local live-data testing, copy `.env.example` to `.env.local` and add the real value. Both `.env` and `.env.local` are ignored by Git and excluded from Vercel uploads.

Never put the real key in `index.html`, `app.js`, `vercel.json`, or any committed file.

## Deploy

You can import this folder into the Vercel dashboard, connect its Git repository, or deploy with:

```bash
vercel
```

Vercel serves `index.html`, `styles.css`, and `app.js` as the frontend. Files in `api/` become serverless endpoints automatically.

## Verify

```bash
npm test
```

The checks cover demo mode, input validation, private-key proxying, and accidental key leakage in API responses.
