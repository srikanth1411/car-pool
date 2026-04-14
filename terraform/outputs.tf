output "alb_dns_name" {
  description = "Public DNS name of the ALB"
  value       = module.alb.dns_name
}

output "ecr_backend_url" {
  description = "ECR URL for backend image"
  value       = module.ecr.backend_repo_url
}

output "ecr_frontend_url" {
  description = "ECR URL for frontend image"
  value       = module.ecr.frontend_repo_url
}

output "rds_endpoint" {
  description = "RDS endpoint (private)"
  value       = module.rds.endpoint
}

output "redis_endpoint" {
  description = "ElastiCache primary endpoint"
  value       = module.elasticache.primary_endpoint
}
