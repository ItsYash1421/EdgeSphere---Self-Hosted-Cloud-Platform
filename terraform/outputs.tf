output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
  sensitive   = true
}
output "eks_cluster_name" {
  value = module.eks.cluster_name
}
output "rds_endpoint" {
  value     = module.rds.db_endpoint
  sensitive = true
}
output "redis_endpoint" {
  value     = module.elasticache.redis_endpoint
  sensitive = true
}
output "kubeconfig_command" {
  value = "aws eks update-kubeconfig --name ${module.eks.cluster_name} --region ${var.aws_region}"
}
