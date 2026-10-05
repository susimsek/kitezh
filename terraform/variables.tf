variable "cluster_name" {
  description = "Local kind cluster name."
  type        = string
  default     = "local"
}

variable "kubernetes_version" {
  description = "kind node image tag."
  type        = string
  default     = "v1.33.1"
}

variable "namespace" {
  description = "Namespace for the application release."
  type        = string
  default     = "apps"
}

variable "ingress_namespace" {
  description = "Namespace for ingress-nginx."
  type        = string
  default     = "ingress-nginx"
}

variable "ingress_class_name" {
  description = "Ingress class name used by the application."
  type        = string
  default     = "nginx"
}

variable "ingress_host" {
  description = "Hostname exposed through ingress-nginx for the authorization server."
  type        = string
  default     = "kitezh.127.0.0.1.nip.io"
}

variable "ingress_nginx_chart_version" {
  description = "Pinned ingress-nginx Helm chart version for local infrastructure."
  type        = string
  default     = "4.15.1"
}

variable "ingress_http_host_port" {
  description = "Host port mapped to ingress-nginx HTTP."
  type        = number
  default     = 9090
}

variable "ingress_https_host_port" {
  description = "Host port mapped to ingress-nginx HTTPS."
  type        = number
  default     = 8443
}

variable "image_repository" {
  description = "Container image repository for the application."
  type        = string
  default     = "docker.io/suayb/kitezh"
}

variable "image_tag" {
  description = "Container image tag for the application."
  type        = string
  default     = "latest"
}

variable "spring_profile" {
  description = "Spring profile passed to the Helm release."
  type        = string
  default     = "prod"
}
