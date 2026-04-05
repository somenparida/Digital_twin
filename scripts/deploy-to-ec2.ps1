# Deploy Campus Digital Twin to EC2 instance using Terraform + Ansible (Windows)
# Usage: .\deploy-to-ec2.ps1 -AwsRegion "ap-south-1" -SshCidr "0.0.0.0/0"

param(
    [string]$AwsRegion = "ap-south-1",
    [string]$SshCidr = "0.0.0.0/0"  # ⚠️ Restrict in production!
)

$ErrorActionPreference = "Stop"
$TerraformDir = ".\terraform"
$AnsibleDir = ".\ansible"

Write-Host "🚀 Campus Digital Twin DevOps Deployment Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# Validate prerequisites
Write-Host "`n✓ Checking prerequisites..." -ForegroundColor Green
$tools = @("terraform", "ansible-playbook")
foreach ($tool in $tools) {
    $null = Get-Command $tool -ErrorAction SilentlyContinue
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ $tool found" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $tool not found" -ForegroundColor Red
        exit 1
    }
}

# Step 1: Initialize Terraform
Write-Host "`n📋 Step 1: Initializing Terraform..." -ForegroundColor Yellow
Push-Location $TerraformDir
terraform init
Pop-Location

# Step 2: Create terraform.tfvars
Write-Host "`n⚙️  Step 2: Creating terraform.tfvars..." -ForegroundColor Yellow
$tfvars = @"
aws_region        = "$AwsRegion"
ssh_ingress_cidr  = "$SshCidr"
key_name          = ""  # Set your EC2 key pair name here
"@
Set-Content -Path "$TerraformDir\terraform.tfvars" -Value $tfvars
Write-Host "Created terraform.tfvars with AWS region: $AwsRegion" -ForegroundColor Green

# Step 3: Plan and apply Terraform
Write-Host "`n🏭 Step 3: Planning Terraform infrastructure..." -ForegroundColor Yellow
Push-Location $TerraformDir
terraform plan -out=tfplan
Write-Host "`n🚀 Step 4: Applying Terraform infrastructure..." -ForegroundColor Yellow
terraform apply tfplan

# Step 4: Get EC2 public IP
Write-Host "`n📍 Step 5: Retrieving EC2 instance details..." -ForegroundColor Yellow
$EC2_PUBLIC_IP = terraform output -raw public_ip
$EC2_INSTANCE_ID = terraform output -raw instance_id
Write-Host "✓ EC2 Instance ID: $EC2_INSTANCE_ID" -ForegroundColor Green
Write-Host "✓ EC2 Public IP: $EC2_PUBLIC_IP" -ForegroundColor Green
Pop-Location

# Step 5: Create/update Ansible inventory
Write-Host "`n📝 Step 6: Creating Ansible inventory..." -ForegroundColor Yellow
$inventory = @"
[campus_servers]
$EC2_PUBLIC_IP ansible_user=ec2-user ansible_ssh_private_key_file=~/.ssh/your-key.pem
"@
Set-Content -Path "$AnsibleDir\inventory.ini" -Value $inventory
Write-Host "Created inventory.ini with EC2 IP: $EC2_PUBLIC_IP" -ForegroundColor Green

# Step 6: Run Ansible playbook
Write-Host "`n⏳ Step 7: Waiting for EC2 instance to be ready (30 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

Write-Host "`n🎯 Step 8: Running Ansible deployment playbook..." -ForegroundColor Yellow
Write-Host "⚠️  You may need to add the EC2 key fingerprint to known_hosts." -ForegroundColor Yellow
Push-Location $AnsibleDir
ansible-playbook -i inventory.ini playbook.yml -v
Pop-Location

# Summary
Write-Host "`n✅ Deployment Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host "`n🌐 Access your services:" -ForegroundColor Cyan
Write-Host "   Frontend:   http://$EC2_PUBLIC_IP`:3000"
Write-Host "   Backend:    http://$EC2_PUBLIC_IP`:8000"
Write-Host "   Prometheus: http://$EC2_PUBLIC_IP`:9090"
Write-Host "   Grafana:    http://$EC2_PUBLIC_IP`:3001 (admin/admin)"
Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Update your DNS records to point to $EC2_PUBLIC_IP"
Write-Host "   2. Configure SSL/TLS certificate for production"
Write-Host "   3. Restrict SSH_CIDR to your IP range in terraform.tfvars"
Write-Host ""
