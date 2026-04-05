output "instance_id" {
  description = "EC2 instance ID for the DevOps demo host"
  value       = aws_instance.devops.id
}

output "public_ip" {
  description = "Public IPv4 — use in Ansible inventory for SSH"
  value       = aws_instance.devops.public_ip
}
