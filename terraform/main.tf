# EC2 in ap-south-1 for DevOps demo (Docker host, Ansible target).
terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Minimal security group: SSH for Ansible; tighten ingress CIDR in production.
resource "aws_security_group" "devops" {
  name_prefix = "devops-project-"
  description = "SSH for DevOps demo instance"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_ingress_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "DevOpsProject"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_instance" "devops" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = "t2.micro"
  vpc_security_group_ids = [aws_security_group.devops.id]

  # Optional: set var.key_name to your EC2 key pair name for SSH access
  key_name = var.key_name != "" ? var.key_name : null

  tags = {
    Name = "DevOpsProject"
  }
}
