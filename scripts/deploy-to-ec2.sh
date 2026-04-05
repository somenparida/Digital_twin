#!/bin/bash
# Deploy Campus Digital Twin to EC2 instance using Terraform + Ansible
# Usage: ./deploy-to-ec2.sh [aws-region] [ssh-cidr]

set -e

echo "🚀 Campus Digital Twin DevOps Deployment Script"
echo "================================================"

# Configuration
AWS_REGION="${1:-ap-south-1}"
SSH_CIDR="${2:-0.0.0.0/0}"  # ⚠️ Restrict in production!
TERRAFORM_DIR="./terraform"
ANSIBLE_DIR="./ansible"

# Validate prerequisites
echo "✓ Checking prerequisites..."
command -v terraform >/dev/null 2>&1 || { echo "❌ terraform not found"; exit 1; }
command -v ansible-playbook >/dev/null 2>&1 || { echo "❌ ansible-playbook not found"; exit 1; }

# Step 1: Initialize Terraform
echo ""
echo "📋 Step 1: Initializing Terraform..."
cd "$TERRAFORM_DIR"
terraform init

# Step 2: Create terraform.tfvars
echo ""
echo "⚙️  Step 2: Creating terraform.tfvars..."
cat > terraform.tfvars <<EOF
aws_region        = "$AWS_REGION"
ssh_ingress_cidr  = "$SSH_CIDR"
key_name          = ""  # Set your EC2 key pair name here
EOF
echo "Created terraform.tfvars with AWS region: $AWS_REGION"

# Step 3: Plan and apply Terraform
echo ""
echo "🏭 Step 3: Planning Terraform infrastructure..."
terraform plan -out=tfplan

echo ""
echo "🚀 Step 4: Applying Terraform infrastructure..."
terraform apply tfplan

# Step 4: Get EC2 public IP
echo ""
echo "📍 Step 5: Retrieving EC2 instance details..."
EC2_PUBLIC_IP=$(terraform output -raw public_ip)
EC2_INSTANCE_ID=$(terraform output -raw instance_id)
echo "✓ EC2 Instance ID: $EC2_INSTANCE_ID"
echo "✓ EC2 Public IP: $EC2_PUBLIC_IP"

# Step 5: Create/update Ansible inventory
echo ""
echo "📝 Step 6: Creating Ansible inventory..."
cd "../$ANSIBLE_DIR"
cat > inventory.ini <<EOF
[campus_servers]
$EC2_PUBLIC_IP ansible_user=ec2-user ansible_ssh_private_key_file=~/.ssh/your-key.pem
EOF
echo "Created inventory.ini with EC2 IP: $EC2_PUBLIC_IP"

# Step 6: Run Ansible playbook
echo ""
echo "⏳ Step 7: Waiting for EC2 instance to be ready (30 seconds)..."
sleep 30

echo ""
echo "🎯 Step 8: Running Ansible deployment playbook..."
echo "⚠️  You may need to add the EC2 key fingerprint to known_hosts."
ansible-playbook -i inventory.ini playbook.yml -v

# Summary
echo ""
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "🌐 Access your services:"
echo "   Frontend:   http://$EC2_PUBLIC_IP:3000"
echo "   Backend:    http://$EC2_PUBLIC_IP:8000"
echo "   Prometheus: http://$EC2_PUBLIC_IP:9090"
echo "   Grafana:    http://$EC2_PUBLIC_IP:3001 (admin/admin)"
echo ""
echo "📝 Next steps:"
echo "   1. Update your DNS records to point to $EC2_PUBLIC_IP"
echo "   2. Configure SSL/TLS certificate for production"
echo "   3. Restrict SSH_CIDR to your IP range in terraform.tfvars"
echo ""
