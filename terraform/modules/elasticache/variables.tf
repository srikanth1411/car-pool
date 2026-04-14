variable "name"               { type = string }
variable "vpc_id"             { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "allowed_sg_id"      { type = string }
