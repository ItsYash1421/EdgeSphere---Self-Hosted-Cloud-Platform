variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "db_subnets" { type = list(string) }
variable "instance_class" { type = string }

resource "aws_security_group" "rds" {
  name        = "edgesphere-rds-sg-${var.environment}"
  description = "Security group for RDS"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"] # Should restrict to VPC CIDR
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "edgesphere-db-subnet-group-${var.environment}"
  subnet_ids = var.db_subnets
}

resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "edgesphere-db-password-${var.environment}"
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_db_instance" "edgesphere" {
  identifier = "edgesphere-${var.environment}"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.instance_class
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true
  
  db_name  = "edgesphere"
  username = "edgesphere"
  password = random_password.db_password.result
  
  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  
  multi_az               = var.environment == "prod" ? true : false
  backup_retention_period = var.environment == "prod" ? 7 : 1
  deletion_protection    = var.environment == "prod" ? true : false
  
  performance_insights_enabled = true
  monitoring_interval = 60
  
  tags = { Name = "edgesphere-${var.environment}" }
  
  skip_final_snapshot = var.environment != "prod"
}

output "db_endpoint" { value = aws_db_instance.edgesphere.endpoint }
