# Live Campus Digital Twin Dashboard with DevOps Automation

## Project overview

This project is a **full-stack demo** of a live campus “digital twin” dashboard. A **FastAPI** backend simulates telemetry (temperature, occupancy, energy, alert level) on `GET /data`. A **React** dashboard polls that endpoint every **2 seconds**, shows color-coded alerts, and plots recent samples with **Chart.js**. **Docker** and **Docker Compose** run the stack locally. **Kubernetes** manifests provide a cluster deployment path, **GitHub Actions** builds images in CI, **Terraform** can provision an **EC2 t2.micro** in **ap-south-1**, and **Ansible** can install **Docker** on that instance.

## Architecture

```mermaid
flowchart LR
  subgraph browser [Browser]
    UI[React dashboard]
  end
  subgraph docker [Docker Compose / K8s]
    FE[Nginx :3000 + static SPA]
    BE[FastAPI :8000]
  end
  UI -->|GET /api/data every 2s| FE
  FE -->|proxy /api to backend| BE
```

- **Why `/api`?** The browser cannot resolve Docker/Kubernetes internal DNS names like `backend`. The frontend is built to call **`/api/data`**. **Nginx** in the frontend container proxies `/api/` to the backend service (`http://backend:8000/`), so the browser only talks to the same origin (e.g. `http://localhost:3000`), and the backend is reached **by service name inside the container network**, not `localhost`.

## Repository layout

```text
digital-twin-devops/
├── backend/                 # FastAPI app + pytest suite
├── frontend/                # React (Vite) + Chart.js + nginx
├── docs/screenshots/        # Screenshot placeholders (see README inside)
├── scripts/                 # Optional compose helpers (PowerShell + bash)
├── docker-compose.yml
├── Makefile                 # Unix/macOS shortcuts (compose, pytest, k8s)
├── k8s/
├── terraform/
├── ansible/
├── .github/workflows/
├── .github/dependabot.yml
├── LICENSE
└── README.md
```

## Setup — local (Python + Node)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL (e.g. `http://localhost:5173`). The dev server **proxies** `/api` to `http://127.0.0.1:8000`, so `/api/data` maps to backend `/data`.

**Node version:** **`frontend/.nvmrc`** pins Node **20** (optional; use `nvm use` if you use nvm).

### Backend tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest
```

Or from the repo root (requires `make`): `make test-backend`.

## Setup — Docker Compose

Requires **Docker Compose v2** (supports `depends_on: condition: service_healthy`).

From the repo root:

```bash
docker compose build
docker compose up -d
```

- Project name: **`digital-twin-devops`** (set in **`docker-compose.yml`**) so networks and containers are predictable.
- Services share an explicit bridge network **`campus`**; the frontend resolves the API at hostname **`backend`** (Compose DNS).
- Dashboard: **http://localhost:3000**
- API (direct): **http://localhost:8000/data**

The UI uses **http://localhost:3000/api/data** (proxied by nginx to the backend service).

Compose **healthchecks** wait until the API responds on `/health` before starting the frontend; backend checks use a **5s** `urlopen` timeout so slow starts do not hang forever.

**Verify integration** (after `up -d`):

- PowerShell: **`powershell -File scripts/verify-compose.ps1`**
- Bash: **`bash scripts/verify-compose.sh`**

## CI/CD

This repository is configured with a full CI/CD pipeline using GitHub Actions. On every push to the `main` branch, the following occurs:
1. Backend tests are run.
2. Docker images for the frontend and backend are built.
3. On `main` pushes, images are published to GitHub Container Registry (GHCR).
4. On `main` pushes, the application is deployed to an EC2 host via SSH and Docker Compose.

Quick start: **`scripts/compose-up.ps1`** (Windows) or **`scripts/compose-up.sh`** (Git Bash / Linux / macOS).

## Collaboration workflow

- Create feature branches from `main` (for example, `feat/<topic>` or `fix/<topic>`).
- Open a pull request for every change and request review before merge.
- Ensure CI passes before merging.
- Prefer squash merges to keep history clean and traceable.
## Database Integration — InfluxDB & MongoDB

### Overview

The backend now integrates with **two databases**:

- **InfluxDB** (port 8086): Time-series database for sensor telemetry (temperature, occupancy, energy)
- **MongoDB** (port 27017): Document store for alert history and metadata

Both databases are automatically provisioned in **`docker-compose.yml`** with persistent volumes.

### Configuration

Database credentials and URLs are configured via environment variables in the **`.env`** file (created at project root):

```env
# InfluxDB
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=my-admin-token
INFLUXDB_ORG=myorg
INFLUXDB_BUCKET=sensors

# MongoDB
MONGODB_URL=mongodb://admin:changeme@mongodb:27017/
MONGODB_DB=digital_twin
```

**⚠️ Production:** Change default credentials (`my-admin-token`, `changeme`) in `.env`.

### Backend Integration

The FastAPI backend automatically:

1. **Connects** to InfluxDB and MongoDB on startup
2. **Writes** telemetry data to InfluxDB with each `/data` request
3. **Stores** alerts in MongoDB for persistent audit trail
4. **Queries** MongoDB for historical alert retrieval via `/alerts` endpoint
5. **Reports** database connectivity status in the `/data` response

### Querying Data

#### InfluxDB

Access Web UI at **http://localhost:8086** (username: `admin`, password: `changeme`). Query historical temperature:

```sql
from(bucket: "sensors")
  |> range(start: -24h)
  |> filter(fn: (r) => r._measurement == "telemetry")
```

#### MongoDB

Connect via Compass or shell:

```bash
mongosh "mongodb://admin:changeme@localhost:27017/digital_twin"
```

List recent alerts:

```javascript
db.alerts.find().sort({ stored_at: -1 }).limit(10)
```
If the frontend stays in **“Waiting”**, ensure Compose v2 is current and wait for the backend **`start_period`** (40s on first boot); run **`docker compose ps`** and **`docker compose logs backend`**.

## Screenshots

See **`docs/screenshots/README.md`** for filenames and ideas. Example:

| File | Description |
|------|-------------|
| `docs/screenshots/dashboard.png` | Dark dashboard with metrics and chart |
| `docs/screenshots/docker-compose.png` | `docker compose ps` or running containers |

### CI Evidence Checklist (for assessment)

Capture and include these screenshots so evaluators can verify CI/CD quickly:

1. **Workflow run summary**
  - Suggested file: `docs/screenshots/ci-run-summary.png`
  - Must show: one full successful run on `main`.
2. **Backend tests passed**
  - Suggested file: `docs/screenshots/ci-backend-tests.png`
  - Must show: `test-backend` job completed successfully.
3. **Frontend build passed**
  - Suggested file: `docs/screenshots/ci-frontend-build.png`
  - Must show: `test-frontend-build` job completed successfully.
4. **Image publish stage**
  - Suggested file: `docs/screenshots/ci-ghcr-push.png`
  - Must show: `deploy` job pushed backend and frontend images to GHCR.
5. **Runtime deployment stage**
  - Suggested file: `docs/screenshots/ci-ec2-deploy.png`
  - Must show: `deploy-to-ec2` job completed and `docker compose` restart output.

## CI/CD (GitHub Actions)

Workflow: **`.github/workflows/ci-cd.yml`**

1. **Checkout** the repository.
2. **Python 3.12:** install **`backend/requirements-dev.txt`** and run **`pytest`** (`test-backend` job).
3. **Docker Buildx** for caching (runs after tests pass).
4. **Build** backend and frontend images in CI.
5. **Push to GHCR** on `main` using `GITHUB_TOKEN`.
6. **Deploy to EC2** on `main` via SSH by pulling updated images and restarting `docker compose`.

**Dependabot:** **`.github/dependabot.yml`** opens weekly update PRs for **pip** (backend), **npm** (frontend), and **GitHub Actions**.

### Required GitHub secrets for deployment

- `EC2_HOST`: Public IP or DNS of the target EC2 instance.
- `EC2_SSH_KEY`: Private SSH key content for the deployment user.

## Kubernetes deployment

Files in **`k8s/`** — see **`k8s/README.md`** for **`kubectl apply -k .`** (namespace **`campus-digital-twin`**) vs applying YAML files individually.

| File | Purpose |
|------|---------|
| `namespace.yaml` | Namespace **`campus-digital-twin`** |
| `kustomization.yaml` | Kustomize bundle (sets namespace for workloads) |
| `backend-deployment.yaml` | **2 replicas** of the API |
| `backend-service.yaml` | **NodePort** `30800` → port 8000 |
| `frontend-deployment.yaml` | Single replica of nginx + static UI |
| `frontend-service.yaml` | **NodePort** `30080` → port 3000 |

**Load images into your cluster** (example with minikube):

```bash
docker compose build
# Image names match folder-based compose project name, e.g. digital-twin-devops-backend:latest
minikube image load digital-twin-devops-backend:latest
minikube image load digital-twin-devops-frontend:latest
kubectl apply -f k8s/
```

The frontend nginx config uses upstream host **`backend`** (Kubernetes **Service** name), matching **`backend-service.yaml`** (`metadata.name: backend`).

Access via a node IP and NodePort, e.g. `http://<node-ip>:30080`.

## Terraform (AWS EC2)

Directory: **`terraform/`**

- **Region:** `ap-south-1` (default in `variables.tf`)
- **Instance:** `t2.micro`
- **Tag:** `Name = DevOpsProject` on the instance and security group

```bash
cd terraform
terraform init
# Optional: copy terraform.tfvars.example to terraform.tfvars and set region / SSH CIDR / key_name
terraform apply
```

Outputs (`instance_id`, `public_ip`) are defined in **`terraform/outputs.tf`**. Optional variables: `ssh_ingress_cidr` (default open — **restrict in production**), `key_name` (EC2 key pair for SSH). See **`terraform/terraform.tfvars.example`**.

## Ansible

**`ansible/playbook.yml`** installs Docker on Amazon Linux 2023 targets.

1. Copy **`ansible/inventory.ini.example`** to **`ansible/inventory.ini`** and set the Terraform **public IP** and SSH key path.
2. Run (uses **`ansible/ansible.cfg`** if run from the `ansible/` directory):

```bash
cd ansible
ansible-playbook -i inventory.ini playbook.yml
```

## Alert colors (UI)

| Alert | Color |
|-------|--------|
| Normal | Green |
| Warning | Yellow |
| Critical | Red |

## License

This project is released under the **MIT License** — see **[LICENSE](LICENSE)**.
