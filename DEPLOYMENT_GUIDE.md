# ✅ Deployment Guide

This guide covers deploying the Campus Digital Twin to production using **Terraform**, **Ansible**, and **GitHub Actions CI/CD**.

---

## 🎯 Deployment Options

### Option 1: Local Docker Compose (Development)
```bash
docker compose up -d
```
**Access**: http://localhost:3000, http://localhost:8000, http://localhost:9090, http://localhost:3001

---

### Option 2: AWS EC2 with Terraform + Ansible (Production)

#### Prerequisites
- AWS account with credentials configured (`aws configure`)
- Terraform installed (`terraform --version`)
- Ansible installed (`ansible --version`)
- EC2 key pair created in your AWS region
- SSH key file at `~/.ssh/your-key.pem`

#### Step-by-Step Deployment

**1. Update Deployment Script Configuration**

Edit `terraform/terraform.tfvars`:
```hcl
aws_region        = "ap-south-1"      # Your AWS region
ssh_ingress_cidr  = "YOUR_IP/32"      # Your IP (restrict for security!)
key_name          = "your-key-pair"   # Your EC2 key pair name
```

**2. Run Deployment Script**

**Linux/macOS:**
```bash
chmod +x ./scripts/deploy-to-ec2.sh
./scripts/deploy-to-ec2.sh ap-south-1 "YOUR_IP/32"
```

**Windows (PowerShell):**
```powershell
.\scripts\deploy-to-ec2.ps1 -AwsRegion "ap-south-1" -SshCidr "YOUR_IP/32"
```

**Or manually:**
```bash
cd terraform
terraform init
terraform apply

# Get EC2 IP
EC2_IP=$(terraform output -raw public_ip)

# Create Ansible inventory
echo "[$EC2_IP] ansible_user=ec2-user ansible_ssh_private_key_file=~/.ssh/your-key.pem" > ../ansible/inventory.ini

# Deploy with Ansible
cd ../ansible
ansible-playbook -i inventory.ini playbook.yml
```

**3. Access Services**

Once deployment completes, services are available at:
- **Frontend**: http://<EC2_IP>:3000
- **Backend**: http://<EC2_IP>:8000
- **Prometheus**: http://<EC2_IP>:9090
- **Grafana**: http://<EC2_IP>:3001 (admin/admin)

---

### Option 3: GitHub Actions Auto-Deployment (CI/CD)

#### Setup CI/CD Secrets

In your GitHub repository, add these secrets:

**Settings → Secrets and variables → Actions**

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |
| `EC2_HOST` | EC2 instance public IP or DNS |
| `EC2_SSH_KEY` | EC2 key pair private key (multi-line) |

#### How It Works

1. **Push to `main` branch** → GitHub Actions trigger
2. **Test stage**: Run pytest on backend
3. **Build stage**: Build & push Docker images to Docker Hub
4. **Deploy stage**: SSH into EC2, pull images, restart docker-compose

**View CI/CD Logs**: GitHub → Actions tab

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│          GitHub Repository (Your Code)                 │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓ (on push to main)
┌─────────────────────────────────────────────────────────┐
│     GitHub Actions (Test → Build → Deploy)             │
│  - Run pytest                                           │
│  - Build Docker images                                  │
│  - Push to Docker Hub                                   │
│  - Deploy to EC2 via SSH                               │
└────────────────────┬────────────────────────────────────┘
                     │
                     ↓ (SSH deployment)
┌─────────────────────────────────────────────────────────┐
│          AWS EC2 Instance (Amazon Linux 2023)          │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Docker Compose Stack                    │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │   │
│  │  │ Frontend │  │ Backend  │  │ Prometheus   │   │   │
│  │  │ (Nginx)  │  │(FastAPI) │  │              │   │   │
│  │  └──────────┘  └──────────┘  └──────────────┘   │   │
│  │  ┌──────────┐                                    │   │
│  │  │ Grafana  │                                    │   │
│  │  └──────────┘                                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Best Practices

1. **Restrict SSH CIDR**: Set `ssh_ingress_cidr = "YOUR_IP/32"` in `terraform.tfvars`
2. **Use GitHub Secrets**: Never commit credentials
3. **EC2 Key Pair**: Keep private key safe (~/.ssh/your-key.pem)
4. **Firewall Rules**: Currently opens ports 3000, 8000, 9090, 3001 to 0.0.0.0/0
5. **Production SSL**: Use AWS Certificate Manager or Let's Encrypt for HTTPS

---

## 🐛 Troubleshooting

### Terraform State Lock
If `terraform apply` fails due to lock:
```bash
cd terraform
terraform force-unlock <LOCK_ID>
```

### Ansible Connection Timeout
Ensure:
- EC2 key pair matches `ansible_ssh_private_key_file`
- Security group allows SSH (port 22) from your IP
- EC2 instance is fully initialized (wait 2-3 minutes after creation)

```bash
# Test SSH manually
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_IP>
```

### Docker Compose Not Starting
```bash
# SSH into EC2 and check logs
ssh -i ~/.ssh/your-key.pem ec2-user@<EC2_IP>
cd Digital_twin
docker compose logs --tail=50
```

### Services Not Healthy
```bash
# Check individual service health
docker compose ps
docker compose logs backend
docker compose logs frontend
```

---

## 🧹 Cleanup

**Destroy AWS infrastructure:**
```bash
cd terraform
terraform destroy
```

**Stop local Docker services:**
```bash
docker compose down
```

---

## 📚 Additional Resources

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest)
- [Ansible Documentation](https://docs.ansible.com/)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
