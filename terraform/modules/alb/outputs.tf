output "dns_name"           { value = aws_lb.main.dns_name }
output "alb_sg_id"          { value = aws_security_group.alb.id }
output "https_listener_arn" { value = aws_lb_listener.https.arn }
output "backend_tg_arn"     { value = aws_lb_target_group.backend.arn }
output "frontend_tg_arn"    { value = aws_lb_target_group.frontend.arn }
