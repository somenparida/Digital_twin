# Netlify Frontend Deployment

This project is configured to deploy the frontend from `frontend/` to Netlify.

## 1. Push latest changes

```bash
git add netlify.toml frontend/.env.production.example
git commit -m "chore: add Netlify frontend deployment config"
git push origin main
```

## 2. Create Netlify site from Git

1. In Netlify, click **Add new site** -> **Import an existing project**.
2. Connect GitHub and select this repository.
3. Netlify will read `netlify.toml` automatically.

Build settings used:
- Base directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`
- Node: `20`

## 3. Set API env variable

In Netlify site settings, add environment variable:

- Key: `VITE_API_BASE_URL`
- Value: your backend public URL (for example Render/Fly/Railway URL)

Example:

```text
VITE_API_BASE_URL=https://campus-digital-twin-backend.onrender.com
```

Then trigger **Deploy site** again.

## 4. Verify

Open your Netlify URL and check:
- Dashboard loads
- No API 504 banner
- Data cards update every few seconds

## Notes

- Frontend is static on Netlify.
- Backend must be hosted separately.
- The app reads `VITE_API_BASE_URL` at build time.
