# alex-0d18-simple-email-sender

A minimal one-page web app for sending an email with recipient, subject, and
message fields. The app has no login and no database.

## Development

Install dependencies:

```bash
npm install
```

Run the browser dev server:

```bash
npm run dev
```

Build the browser app and server:

```bash
npm run build
```

Run unit and end-to-end tests:

```bash
npm test
```

Start the production server:

```bash
npm start
```

The production server listens on `0.0.0.0:8080` by default and serves the built
client from `dist/client`.

## Production Readiness

The server exposes two operational endpoints:

- `GET /api/health` always returns process health and email configuration state.
- `GET /api/ready` returns `200` only when the email service is configured and
  `503` otherwise.

The production server sets baseline security headers, prevents caching of the
HTML app shell, and serves fingerprinted client assets with immutable caching.

## Email Service

The server sends mail through the Ideavibes email service. Zeroclaw injects
these server-side environment variables at deploy time:

- `MCTAI_EMAIL_URL`
- `MCTAI_EMAIL_APP_TOKEN`

If either value is missing, the email adapter reports that delivery is not
configured instead of crashing the request.
