variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "subnets" { type = list(string) }
variable "node_type" { type = string }

resource "aws_security_group" "redis" {
  name        = "edgesphere-redis-sg-${var.environment}"
  description = "Security group for Redis"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "edgesphere-redis-subnet-${var.environment}"
  subnet_ids = var.subnets
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "edgesphere-redis-${var.environment}"
  engine               = "redis"
  node_type            = var.node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  engine_version       = "7.0"
  port                 = 6379
  
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]
}

output "redis_endpoint" { value = aws_elasticache_cluster.redis.cache_nodes[0].address }
