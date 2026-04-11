# Render Deployment Guide

## 1. Push latest code

```bash
git add render.yaml frontend/src/api.ts
git commit -m "feat: add Render deployment blueprint"
git push origin main
```

## 2. Create Blueprint in Render

1. Open Render Dashboard.
2. Click New + -> Blueprint.
3. Connect your GitHub repo and choose this repository.
4. Render will detect `render.yaml` and create:
   - `campus-digital-twin-backend` (web service)
   - `campus-digital-twin-frontend` (static site)

## 3. Set frontend API URL

After backend is created, copy its public URL from Render and set:

- Service: `campus-digital-twin-frontend`
- Environment variable: `VITE_API_BASE_URL`
- Value: `https://<your-backend-service>.onrender.com`

Then trigger a frontend redeploy.

## 4. Verify

- Frontend: `https://<frontend-service>.onrender.com`
- Backend health: `https://<backend-service>.onrender.com/health`
- Backend data: `https://<backend-service>.onrender.com/data`

## Notes

- This setup works without nginx proxying because frontend calls backend URL directly.
- InfluxDB/MongoDB env vars are left as defaults; backend will still run in simulation mode if they are unreachable.
