resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.name}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "redis" {
  name   = "${var.name}-redis-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.allowed_sg_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.name}-redis"
  description          = "Redis for carpool app"

  engine               = "redis"
  engine_version       = "7.1"
  node_type            = "cache.t3.micro"   # cost-effective
  num_cache_clusters   = 1                   # single node, no replica for cost saving
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = false  # set true if using TLS

  automatic_failover_enabled = false  # requires num_cache_clusters > 1
}
