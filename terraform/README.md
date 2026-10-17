# Local Kubernetes infrastructure

Terraform creates a local kind cluster, ingress-nginx, and two independent Helm releases in the `apps` namespace:

- `kitezh` from `helm/kitezh` (Authorization Server and PostgreSQL)
- `kitezh-mcp` from `helm/kitezh-mcp` (stateless MCP service)

The backend's MCP resource audience is set to the MCP ingress URL so OAuth audience validation and token exchange agree. MCP reaches the authorization server and API over the in-cluster service DNS name, while the issuer remains the externally visible Authorization Server URL.

## Apply

Copy `terraform.tfvars.example` to `terraform.tfvars` and adjust image tags and ingress hosts. The MCP chart references a Kubernetes Secret; create it after Terraform creates the cluster and before the MCP pod can start:

```bash
terraform init
terraform apply
kubectl --kubeconfig=./kubeconfig -n apps create secret generic kitezh-mcp-client-secret \
  --from-literal=client-secret="$KITEZH_MCP_CLIENT_SECRET"
```

The Terraform output `mcp_server_ingress_url` gives the MCP endpoint. The backend is available from `authorization_server_ingress_url`. Configure the same MCP URL as the backend's `app.mcp.resourceAudience`, the MCP service's security audience, and its public URL. For the default local values these are `http://mcp.kitezh.127.0.0.1.nip.io:9090/mcp`.

Terraform intentionally accepts only the Kubernetes Secret name, never its value, to keep credentials out of Terraform state and plan output. The OAuth secret must match the registered `mcp-server` confidential client.

## Destroy

```bash
terraform destroy
```

This removes the local kind cluster and both Helm releases.
