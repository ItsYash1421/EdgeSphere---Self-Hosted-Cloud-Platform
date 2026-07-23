variable "environment" { type = string }

resource "aws_s3_bucket" "storage" {
  bucket = "edgesphere-storage-${var.environment}"
}

resource "aws_s3_bucket_ownership_controls" "storage" {
  bucket = aws_s3_bucket.storage.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "storage" {
  depends_on = [aws_s3_bucket_ownership_controls.storage]
  bucket = aws_s3_bucket.storage.id
  acl    = "private"
}

resource "aws_s3_bucket_versioning" "storage" {
  bucket = aws_s3_bucket.storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

output "bucket_name" { value = aws_s3_bucket.storage.id }
