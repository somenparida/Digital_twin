# Rubric Evidence Matrix

This document maps assessment criteria directly to implementation artifacts and verification evidence.

## 1. Version Control and Collaboration (8 Marks)

Implementation evidence:
- Git repository with tracked branch history and merge commits.
- Pull request template: .github/pull_request_template.md
- Ownership policy: .github/CODEOWNERS
- Dependency update collaboration: .github/dependabot.yml

Quick verification:
- `git log --oneline --decorate --graph -n 20`
- `git branch --all`

## 2. CI/CD Pipeline Implementation (7 Marks)

Implementation evidence:
- End-to-end workflow: .github/workflows/ci-cd.yml
- Backend test stage: `test-backend`
- Frontend build validation stage: `test-frontend-build`
- Image build stage: `build`
- Registry publish stage: `deploy`
- Runtime deployment stage: `deploy-to-ec2`

Quick verification:
- Open Actions tab and confirm stage sequence on latest `main` run.
- Confirm `deploy-to-ec2` runs only on `main` pushes.

## 3. Containerization and Deployment (8 Marks)

Implementation evidence:
- Multi-service Compose stack: docker-compose.yml
- Frontend and backend container definitions: frontend/Dockerfile, backend/Dockerfile
- Kubernetes manifests and orchestration: k8s/
- Kustomize deployment path: k8s/kustomization.yaml

Quick verification:
- `docker compose up -d --build`
- `docker compose ps`
- `kubectl apply -k k8s/`

## 4. Infrastructure as Code (IaC) (7 Marks)

Implementation evidence:
- Terraform provisioning: terraform/main.tf, terraform/variables.tf, terraform/outputs.tf
- Ansible automation: ansible/playbook.yml
- Example variable templates and inventory: terraform/terraform.tfvars.example, ansible/inventory.ini.example

Quick verification:
- `cd terraform && terraform init && terraform plan`
- `cd ansible && ansible-playbook -i inventory.ini playbook.yml --check`

## Deployment Secrets (GitHub Actions)

Required repository secrets:
- `EC2_HOST`
- `EC2_SSH_KEY`

Optional, depending on future registry strategy:
- Additional registry credentials if moving away from `GITHUB_TOKEN` for GHCR.
