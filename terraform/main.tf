# VPC Module
module "vpc" {
  source       = "./modules/vpc"
  environment  = var.environment
  vpc_cidr     = var.vpc_cidr
  cluster_name = var.cluster_name
}

# EKS Cluster
module "eks" {
  source             = "./modules/eks"
  cluster_name       = var.cluster_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnets    = module.vpc.private_subnet_ids
  node_instance_type = var.node_instance_type
  node_desired_size  = var.node_desired_size
  node_min_size      = var.node_min_size
  node_max_size      = var.node_max_size
}

# RDS PostgreSQL (TimescaleDB)
module "rds" {
  source         = "./modules/rds"
  environment    = var.environment
  vpc_id         = module.vpc.vpc_id
  db_subnets     = module.vpc.private_subnet_ids
  instance_class = var.db_instance_class
}

# ElastiCache Redis
module "elasticache" {
  source      = "./modules/elasticache"
  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnets     = module.vpc.private_subnet_ids
  node_type   = var.redis_node_type
}

# S3 Buckets (for MinIO replacement in production)
module "s3" {
  source      = "./modules/s3"
  environment = var.environment
}
