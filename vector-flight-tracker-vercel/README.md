# Bird's Eye flight tracker

Bird's Eye is a responsive HTML/CSS/JavaScript flight tracker deployed with Vercel Functions. It does not require Flask or a continuously running server.

The Airport board includes Departures, Arrivals, and In air. In air shows active flights that departed from the selected airport.

Select any flight result to open an interactive globe. Bird's Eye draws the airport-to-airport great-circle path and labels both endpoints. It uses Aviationstack's coordinates when available, then automatically checks ADSB.lol using every identifier Aviationstack supplies: the aircraft's ICAO24 transponder code, registration, and ICAO callsign. The globe shows the latest reported position, altitude, speed, heading, aircraft registration, and update time. Live ADS-B coverage varies, so some flights will still show an explicit unavailable state rather than an estimated position.

The globe's continent and major-island outlines use Natural Earth's public-domain 1:110m land dataset. A small built-in outline set remains as a fallback if the map asset cannot be loaded.

Route endpoints use cached airport reference coordinates from Airport-Data.com when an airport is not already in the built-in common-airport list. No additional key is required.

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

ADSB.lol does not require another secret key. Its lookup runs through `api/position.js`, so the browser only talks to your own Vercel project.

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

The checks cover demo mode, input validation, private-key proxying, ADSB.lol position normalization, and accidental key leakage in API responses.
