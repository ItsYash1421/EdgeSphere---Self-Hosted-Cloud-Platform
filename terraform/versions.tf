terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }
  backend "s3" {
    bucket         = "edgesphere-terraform-state"
    key            = "edgesphere/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "edgesphere-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "EdgeSphere"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
