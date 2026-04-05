# Kubernetes manifests

## Namespace

**`namespace.yaml`** defines the **`campus-digital-twin`** namespace.

**`kustomization.yaml`** applies that namespace to all workloads and can be used to deploy everything in one step (recommended).

## Prerequisites

- Cluster access (`kubectl` configured)
- Images loaded or pulled:

  ```bash
  cd ..   # repo root
  docker compose build
  # minikube example:
  minikube image load digital-twin-devops-backend:latest
  minikube image load digital-twin-devops-frontend:latest
  ```

  Image names must match `image:` fields in `*-deployment.yaml`.

## Apply (recommended: Kustomize)

From the **`k8s/`** directory:

```bash
kubectl apply -k .
```

This creates the namespace and applies Deployments/Services into **`campus-digital-twin`**.

## Apply (individual files)

From **`k8s/`** (resources go to the **default** namespace unless you add `metadata.namespace` yourself):

```bash
kubectl apply -f namespace.yaml
kubectl apply -f backend-deployment.yaml -f backend-service.yaml -f frontend-deployment.yaml -f frontend-service.yaml
```

## Access

- **Frontend NodePort:** `30080` (container port 3000)
- **Backend NodePort:** `30800` (container port 8000)

Use your node’s IP/DNS, e.g. `http://<node-ip>:30080`. The UI calls `/api/data`; nginx in the frontend pod proxies to the `backend` Service.

If you used **`kubectl apply -k .`**, add the namespace to kubectl commands as needed, e.g. `kubectl get pods -n campus-digital-twin`.

## Backend replicas

`backend-deployment.yaml` sets **2** replicas for the API Deployment.
