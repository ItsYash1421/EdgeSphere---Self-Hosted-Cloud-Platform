variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}
variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}
variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "edgesphere-eks"
}
variable "node_instance_type" {
  description = "EC2 instance type for EKS nodes"
  type        = string
  default     = "t3.medium"
}
variable "node_desired_size" { type = number; default = 3 }
variable "node_min_size"     { type = number; default = 1 }
variable "node_max_size"     { type = number; default = 10 }
variable "db_instance_class" { type = string; default = "db.t3.medium" }
variable "redis_node_type"   { type = string; default = "cache.t3.micro" }
variable "vpc_cidr"          { type = string; default = "10.0.0.0/16" }
