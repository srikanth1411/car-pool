terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for remote state
  # backend "s3" {
  #   bucket = "your-tf-state-bucket"
  #   key    = "carpool/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = "carpool"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "vpc" {
  source      = "./modules/vpc"
  name        = local.name_prefix
  environment = var.environment
}

module "ecr" {
  source      = "./modules/ecr"
  name_prefix = local.name_prefix
}

module "rds" {
  source              = "./modules/rds"
  name                = local.name_prefix
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  allowed_sg_id       = module.ecs.ecs_sg_id
  db_name             = "carpool_db"
  db_username         = var.db_username
  db_password         = var.db_password
}

module "elasticache" {
  source             = "./modules/elasticache"
  name               = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  allowed_sg_id      = module.ecs.ecs_sg_id
}

module "alb" {
  source            = "./modules/alb"
  name              = local.name_prefix
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
}

module "ecs" {
  source = "./modules/ecs"

  name              = local.name_prefix
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids

  # ALB
  alb_listener_arn           = module.alb.https_listener_arn
  alb_security_group_id      = module.alb.alb_sg_id
  backend_target_group_arn   = module.alb.backend_tg_arn
  frontend_target_group_arn  = module.alb.frontend_tg_arn

  # Images
  backend_image  = "${module.ecr.backend_repo_url}:${var.backend_image_tag}"
  frontend_image = "${module.ecr.frontend_repo_url}:${var.frontend_image_tag}"

  # Backend env
  db_url      = "jdbc:postgresql://${module.rds.endpoint}:5432/carpool_db"
  db_username = var.db_username
  db_password = var.db_password
  jwt_secret  = var.jwt_secret

  # Redis
  redis_host = module.elasticache.primary_endpoint

  # CPU/Memory — cost-effective Fargate sizes
  backend_cpu    = 512
  backend_memory = 1024
  frontend_cpu   = 256
  frontend_memory = 512
}
