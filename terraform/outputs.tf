output "cluster_name" {
  description = "kind cluster name."
  value       = kind_cluster.local.name
}

output "kubeconfig_path" {
  description = "Generated kubeconfig path for this cluster."
  value       = local.kubeconfig_absolute_path
}

output "authorization_server_ingress_host" {
  description = "Hostname exposed through ingress-nginx."
  value       = var.ingress_host
}

output "authorization_server_ingress_url" {
  description = "Ingress endpoint for the authorization server."
  value       = "http://${var.ingress_host}:${var.ingress_http_host_port}"
}

output "openid_configuration_url" {
  description = "OpenID Provider metadata URL."
  value       = "http://${var.ingress_host}:${var.ingress_http_host_port}/.well-known/openid-configuration"
}

output "port_forward_command" {
  description = "Fallback command to expose the ClusterIP service on localhost:9090."
  value       = "kubectl --kubeconfig=${local.kubeconfig_absolute_path} -n ${var.namespace} port-forward svc/kitezh 9090:9090"
}
