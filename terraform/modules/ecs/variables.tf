variable "name"                    { type = string }
variable "environment"             { type = string }
variable "vpc_id"                  { type = string }
variable "private_subnet_ids"      { type = list(string) }
variable "alb_listener_arn"        { type = string }
variable "alb_security_group_id"   { type = string }
variable "backend_target_group_arn"  { type = string }
variable "frontend_target_group_arn" { type = string }
variable "backend_image"           { type = string }
variable "frontend_image"          { type = string }
variable "db_url"                  { type = string }
variable "db_username"             { type = string }
variable "db_password"             { type = string; sensitive = true }
variable "jwt_secret"              { type = string; sensitive = true }
variable "redis_host"              { type = string }
variable "backend_cpu"             { type = number; default = 512 }
variable "backend_memory"          { type = number; default = 1024 }
variable "frontend_cpu"            { type = number; default = 256 }
variable "frontend_memory"         { type = number; default = 512 }
