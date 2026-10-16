package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPermissionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPermissionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPolicyDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationPolicyRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationResourceDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationResourceRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminAuthorizationServicesService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class AdminAuthorizationServicesControllerTest {

    @Mock private AdminAuthorizationServicesService service;

    @Test
    void delegatesResourceCrudAndReturnsCreatedLocationAndNoContent() {
        AdminAuthorizationServicesController controller =
                new AdminAuthorizationServicesController(service);
        AdminAuthorizationResourceDTO resource =
                new AdminAuthorizationResourceDTO(
                        "resource-1",
                        "orders-api",
                        "Orders",
                        null,
                        null,
                        "alice",
                        false,
                        List.of("read"));
        AdminAuthorizationResourceRequestDTO request =
                new AdminAuthorizationResourceRequestDTO(
                        "orders-api", "Orders", null, null, "alice", false, List.of("read"));
        PageRequest pageable = PageRequest.of(0, 20);
        when(service.resources("orders", pageable)).thenReturn(new PageImpl<>(List.of(resource)));
        assertThat(controller.resources("orders", pageable).getContent()).containsExactly(resource);
        when(service.resource("resource-1")).thenReturn(resource);
        assertThat(controller.resource("resource-1")).isEqualTo(resource);

        when(service.createResource(request)).thenReturn(resource);
        var created = controller.createResource(request);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getHeaders().getLocation().toString())
                .isEqualTo("/api/admin/authorization/resources/resource-1");
        assertThat(created.getBody()).isEqualTo(resource);
        when(service.updateResource("resource-1", request)).thenReturn(resource);
        assertThat(controller.updateResource("resource-1", request)).isEqualTo(resource);
        assertThat(controller.deleteResource("resource-1").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).deleteResource("resource-1");
    }

    @Test
    void delegatesPolicyAndPermissionCrud() {
        AdminAuthorizationServicesController controller =
                new AdminAuthorizationServicesController(service);
        AdminAuthorizationPolicyDTO policy =
                new AdminAuthorizationPolicyDTO(
                        "policy-1", "orders-api", "Owner", "OWNER", null, "ALLOW");
        AdminAuthorizationPolicyRequestDTO policyRequest =
                new AdminAuthorizationPolicyRequestDTO(
                        "orders-api", "Owner", "OWNER", null, "ALLOW");
        PageRequest pageable = PageRequest.of(0, 20);
        when(service.policies("owner", pageable)).thenReturn(new PageImpl<>(List.of(policy)));
        assertThat(controller.policies("owner", pageable).getContent()).containsExactly(policy);
        when(service.createPolicy(policyRequest)).thenReturn(policy);
        var createdPolicy = controller.createPolicy(policyRequest);
        assertThat(createdPolicy.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(createdPolicy.getHeaders().getLocation().toString())
                .isEqualTo("/api/admin/authorization/policies/policy-1");
        when(service.updatePolicy("policy-1", policyRequest)).thenReturn(policy);
        assertThat(controller.updatePolicy("policy-1", policyRequest)).isEqualTo(policy);
        assertThat(controller.deletePolicy("policy-1").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);

        AdminAuthorizationPermissionDTO permission =
                new AdminAuthorizationPermissionDTO(
                        "permission-1",
                        "resource-1",
                        "Read",
                        "read",
                        "AFFIRMATIVE",
                        List.of("policy-1"));
        AdminAuthorizationPermissionRequestDTO permissionRequest =
                new AdminAuthorizationPermissionRequestDTO(
                        "resource-1", "Read", "read", "AFFIRMATIVE", List.of("policy-1"));
        when(service.permissions(pageable)).thenReturn(new PageImpl<>(List.of(permission)));
        assertThat(controller.permissions(pageable).getContent()).containsExactly(permission);
        when(service.createPermission(permissionRequest)).thenReturn(permission);
        var createdPermission = controller.createPermission(permissionRequest);
        assertThat(createdPermission.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(createdPermission.getHeaders().getLocation().toString())
                .isEqualTo("/api/admin/authorization/permissions/permission-1");
        when(service.updatePermission("permission-1", permissionRequest)).thenReturn(permission);
        assertThat(controller.updatePermission("permission-1", permissionRequest))
                .isEqualTo(permission);
        assertThat(controller.deletePermission("permission-1").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).deletePolicy("policy-1");
        verify(service).deletePermission("permission-1");
    }
}
