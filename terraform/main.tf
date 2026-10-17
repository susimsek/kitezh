locals {
  kubeconfig_path          = "${path.module}/kubeconfig"
  kubeconfig_absolute_path = abspath(local.kubeconfig_path)
  node_image               = "kindest/node:${var.kubernetes_version}"
}

provider "kind" {}

resource "kind_cluster" "local" {
  name            = var.cluster_name
  node_image      = local.node_image
  kubeconfig_path = local.kubeconfig_path
  wait_for_ready  = true

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"

      extra_port_mappings {
        container_port = 80
        host_port      = var.ingress_http_host_port
        listen_address = "127.0.0.1"
        protocol       = "TCP"
      }

      extra_port_mappings {
        container_port = 443
        host_port      = var.ingress_https_host_port
        listen_address = "127.0.0.1"
        protocol       = "TCP"
      }
    }

    node {
      role = "worker"
    }
  }
}

provider "kubernetes" {
  host                   = kind_cluster.local.endpoint
  client_certificate     = kind_cluster.local.client_certificate
  client_key             = kind_cluster.local.client_key
  cluster_ca_certificate = kind_cluster.local.cluster_ca_certificate
}

provider "helm" {
  kubernetes = {
    host                   = kind_cluster.local.endpoint
    client_certificate     = kind_cluster.local.client_certificate
    client_key             = kind_cluster.local.client_key
    cluster_ca_certificate = kind_cluster.local.cluster_ca_certificate
  }
}

resource "kubernetes_namespace_v1" "app" {
  metadata {
    name = var.namespace
  }
}

resource "kubernetes_namespace_v1" "ingress" {
  metadata {
    name = var.ingress_namespace
  }
}

resource "helm_release" "ingress_nginx" {
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  version          = var.ingress_nginx_chart_version
  namespace        = kubernetes_namespace_v1.ingress.metadata[0].name
  create_namespace = false
  wait             = true
  timeout          = 600

  values = [
    yamlencode({
      controller = {
        hostPort = {
          enabled = true
        }
        publishService = {
          enabled = false
        }
        service = {
          type = "ClusterIP"
        }
        nodeSelector = {
          "kubernetes.io/hostname" = "${var.cluster_name}-control-plane"
        }
        tolerations = [
          {
            key      = "node-role.kubernetes.io/control-plane"
            operator = "Exists"
            effect   = "NoSchedule"
          },
          {
            key      = "node-role.kubernetes.io/master"
            operator = "Exists"
            effect   = "NoSchedule"
          }
        ]
      }
    })
  ]

  depends_on = [kind_cluster.local]
}

resource "helm_release" "kitezh" {
  name              = "kitezh"
  chart             = "${path.module}/../helm/kitezh"
  namespace         = kubernetes_namespace_v1.app.metadata[0].name
  dependency_update = true
  wait              = true
  timeout           = 600

  values = [
    yamlencode({
      ingress = {
        enabled   = true
        className = var.ingress_class_name
        annotations = {
          "nginx.ingress.kubernetes.io/ssl-redirect" = "false"
        }
        hosts = [
          {
            host = var.ingress_host
            paths = [
              {
                path     = "/"
                pathType = "Prefix"
              }
            ]
          }
        ]
      }
      app = {
        authorizationServer = {
          issuer = "http://${var.ingress_host}:${var.ingress_http_host_port}"
        }
        mcp = {
          resourceAudience = "http://${var.mcp_ingress_host}:${var.ingress_http_host_port}/mcp"
        }
      }
    })
  ]

  set = [
    {
      name  = "image.repository"
      value = var.image_repository
    },
    {
      name  = "image.tag"
      value = var.image_tag
    },
    {
      name  = "spring.profiles.active"
      value = var.spring_profile
    }
  ]

  depends_on = [
    kind_cluster.local,
    helm_release.ingress_nginx
  ]
}

resource "helm_release" "kitezh_mcp" {
  name      = "kitezh-mcp"
  chart     = "${path.module}/../helm/kitezh-mcp"
  namespace = kubernetes_namespace_v1.app.metadata[0].name
  # The OAuth client secret is supplied out-of-band after the local cluster exists.
  wait    = false
  timeout = 600

  values = [
    yamlencode({
      image = {
        repository = var.mcp_image_repository
        tag        = var.mcp_image_tag
      }
      existingSecret = {
        name = var.mcp_client_secret_name
      }
      ingress = {
        enabled   = true
        className = var.ingress_class_name
        annotations = {
          "nginx.ingress.kubernetes.io/ssl-redirect" = "false"
        }
        hosts = [
          {
            host = var.mcp_ingress_host
            paths = [
              {
                path     = "/"
                pathType = "Prefix"
              }
            ]
          }
        ]
      }
      app = {
        security = {
          issuerUri = "http://${var.ingress_host}:${var.ingress_http_host_port}"
          jwkSetUri = "http://kitezh.${var.namespace}.svc.cluster.local:9090/oauth2/jwks"
          tokenUri  = "http://kitezh.${var.namespace}.svc.cluster.local:9090/oauth2/token"
          audience  = "http://${var.mcp_ingress_host}:${var.ingress_http_host_port}/mcp"
        }
        api = {
          baseUrl = "http://kitezh.${var.namespace}.svc.cluster.local:9090"
        }
        mcp = {
          publicUrl = "http://${var.mcp_ingress_host}:${var.ingress_http_host_port}/mcp"
        }
      }
    })
  ]

  depends_on = [
    kind_cluster.local,
    helm_release.ingress_nginx,
    helm_release.kitezh
  ]
}
