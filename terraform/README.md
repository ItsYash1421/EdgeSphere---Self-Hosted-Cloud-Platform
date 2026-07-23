# EdgeSphere Terraform Infrastructure

This directory contains the complete Infrastructure-as-Code for EdgeSphere.

## Prerequisites
- Terraform >= 1.6.0
- AWS CLI configured with appropriate permissions
- `kubectl` installed for interacting with EKS

## Quick Start
```bash
# Initialize Terraform
terraform init

# Plan changes for dev
terraform plan -var-file=environments/dev/terraform.tfvars

# Apply changes for dev
terraform apply -var-file=environments/dev/terraform.tfvars
```

## How to deploy to Dev vs Prod
Deployments are separated by `.tfvars` files in the `environments/` directory.
- **Dev**: Use `environments/dev/terraform.tfvars`
- **Prod**: Use `environments/prod/terraform.tfvars`

Example for Prod:
```bash
terraform apply -var-file=environments/prod/terraform.tfvars
```

## How to destroy
To destroy the infrastructure for a specific environment:
```bash
terraform destroy -var-file=environments/dev/terraform.tfvars
```

## Cost Estimates
- **Dev**: Minimal instance sizes (`t3.medium`, `db.t3.micro`), expects ~\$100-\$150/month
- **Prod**: Larger instance sizes, multi-AZ RDS (`t3.xlarge`, `db.r6g.large`), expects ~\$500-\$1000/month (depends on exact node scale)
