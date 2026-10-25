# Local Kubernetes infrastructure

Terraform creates a local kind cluster, ingress-nginx, and two independent Helm releases in the `apps` namespace:

- `kitezh` from `helm/kitezh` (Authorization Server and PostgreSQL)
- `kitezh-mcp` from `helm/kitezh-mcp` (stateless MCP service)

The backend's MCP resource audience is set to the MCP ingress URL so OAuth audience validation agrees. MCP reaches the authorization server and API over the in-cluster service DNS name, while the issuer remains the externally visible Authorization Server URL. MCP forwards the inbound bearer token to the API, which enforces its read-only endpoint and role rules.

## Apply

Copy `terraform.tfvars.example` to `terraform.tfvars` and adjust image tags and ingress hosts:

```bash
terraform init
terraform apply
```

The Terraform output `mcp_server_ingress_url` gives the MCP endpoint. The backend is available from `authorization_server_ingress_url`. Configure the same MCP URL as the backend's `app.mcp.resourceAudience`, the MCP service's security audience, and its public URL. For the default local values these are `http://mcp.kitezh.127.0.0.1.nip.io:9090/mcp`.

## Destroy

```bash
terraform destroy
```

This removes the local kind cluster and both Helm releases.
