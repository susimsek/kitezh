package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingType;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationExecutionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationExecutionRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowBindingDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowBindingRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowCopyRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowDetailDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowNodeMoveRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowRequestDTO;
import io.github.susimsek.kitezh.service.admin.AuthenticationFlowService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/authentication")
@RequiredArgsConstructor
@Tag(
        name = "Admin - Authentication flows",
        description = "Keycloak-style authentication flow, execution, and binding administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminAuthenticationFlowController {

    private final AuthenticationFlowService service;

    @GetMapping("/flows")
    @Operation(
            summary = "List top-level authentication flows",
            description =
                    "Returns application-wide top-level flows for the single configured issuer.")
    @ApiResponse(responseCode = "200", description = "Authentication flows returned.")
    Page<AdminAuthenticationFlowDTO> flows(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return service.topLevelFlows(pageable);
    }

    @GetMapping("/flows/{flowId}")
    @Operation(summary = "Get an authentication flow graph")
    @ApiResponse(
            responseCode = "200",
            description = "Flow executions and immediate sub-flows returned.")
    AdminAuthenticationFlowDetailDTO flow(
            @Parameter(description = "Flow identifier.", example = "1", required = true)
                    @PathVariable
                    Long flowId) {
        return service.flow(flowId);
    }

    @PostMapping("/flows")
    @Operation(summary = "Create a top-level authentication flow")
    @ApiResponse(responseCode = "200", description = "Authentication flow created.")
    AdminAuthenticationFlowDTO create(
            @Valid @RequestBody AdminAuthenticationFlowRequestDTO request) {
        return service.create(request);
    }

    @PostMapping("/flows/{flowId}/sub-flows")
    @Operation(summary = "Create a sub-flow")
    @ApiResponse(responseCode = "200", description = "Sub-flow created.")
    AdminAuthenticationFlowDTO createSubFlow(
            @PathVariable Long flowId,
            @Valid @RequestBody AdminAuthenticationFlowRequestDTO request) {
        return service.createSubFlow(flowId, request);
    }

    @PutMapping("/flows/{flowId}")
    @Operation(summary = "Update an authentication flow")
    @ApiResponse(responseCode = "200", description = "Authentication flow updated.")
    AdminAuthenticationFlowDTO update(
            @PathVariable Long flowId,
            @Valid @RequestBody AdminAuthenticationFlowRequestDTO request) {
        return service.update(flowId, request);
    }

    @PostMapping("/flows/{flowId}/copy")
    @Operation(summary = "Duplicate an authentication flow")
    @ApiResponse(responseCode = "200", description = "Authentication flow duplicated.")
    AdminAuthenticationFlowDTO duplicate(
            @PathVariable Long flowId,
            @Valid @RequestBody AdminAuthenticationFlowCopyRequestDTO request) {
        return service.duplicate(flowId, request);
    }

    @DeleteMapping("/flows/{flowId}")
    @Operation(summary = "Delete an empty custom authentication flow")
    @ApiResponse(responseCode = "204", description = "Authentication flow deleted.")
    ResponseEntity<Void> delete(@PathVariable Long flowId) {
        service.delete(flowId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/flows/{flowId}/executions")
    @Operation(summary = "Add an authenticator execution")
    @ApiResponse(responseCode = "200", description = "Authenticator execution created.")
    AdminAuthenticationExecutionDTO createExecution(
            @PathVariable Long flowId,
            @Valid @RequestBody AdminAuthenticationExecutionRequestDTO request) {
        return service.createExecution(flowId, request);
    }

    @PutMapping("/flows/{flowId}/executions/{executionId}")
    @Operation(summary = "Update an authenticator execution")
    @ApiResponse(responseCode = "200", description = "Authenticator execution updated.")
    AdminAuthenticationExecutionDTO updateExecution(
            @PathVariable Long flowId,
            @PathVariable Long executionId,
            @Valid @RequestBody AdminAuthenticationExecutionRequestDTO request) {
        return service.updateExecution(flowId, executionId, request);
    }

    @DeleteMapping("/flows/{flowId}/executions/{executionId}")
    @Operation(summary = "Delete an authenticator execution")
    @ApiResponse(responseCode = "204", description = "Authenticator execution deleted.")
    ResponseEntity<Void> deleteExecution(
            @PathVariable Long flowId, @PathVariable Long executionId) {
        service.deleteExecution(flowId, executionId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/flows/{flowId}/nodes/{nodeType}/{nodeId}/position")
    @Operation(summary = "Reorder an execution or sub-flow")
    @ApiResponse(responseCode = "200", description = "Flow graph returned after reordering.")
    AdminAuthenticationFlowDetailDTO moveNode(
            @PathVariable Long flowId,
            @PathVariable String nodeType,
            @PathVariable Long nodeId,
            @Valid @RequestBody AdminAuthenticationFlowNodeMoveRequestDTO request) {
        if (!"EXECUTION".equalsIgnoreCase(nodeType) && !"SUB_FLOW".equalsIgnoreCase(nodeType)) {
            throw ApiException.badRequest(ApiErrorCode.INVALID_REQUEST, "Node type is invalid");
        }
        return service.moveNode(flowId, nodeType, nodeId, request);
    }

    @GetMapping("/bindings")
    @Operation(summary = "List authentication flow bindings")
    @ApiResponse(responseCode = "200", description = "Authentication bindings returned.")
    List<AdminAuthenticationFlowBindingDTO> bindings() {
        return service.bindings();
    }

    @PutMapping("/bindings/{bindingType}")
    @Operation(summary = "Bind a top-level flow to an authentication entry point")
    @ApiResponse(responseCode = "200", description = "Authentication binding updated.")
    AdminAuthenticationFlowBindingDTO bind(
            @PathVariable String bindingType,
            @Valid @RequestBody AdminAuthenticationFlowBindingRequestDTO request) {
        return service.bind(parseBindingType(bindingType), request);
    }

    @DeleteMapping("/bindings/{bindingType}")
    @Operation(summary = "Remove an authentication entry-point binding")
    @ApiResponse(responseCode = "200", description = "Authentication binding removed.")
    AdminAuthenticationFlowBindingDTO unbind(@PathVariable String bindingType) {
        return service.unbind(parseBindingType(bindingType));
    }

    @GetMapping("/execution-providers")
    @Operation(summary = "List supported authenticator providers")
    @ApiResponse(responseCode = "200", description = "Supported provider identifiers returned.")
    List<String> executionProviders() {
        return service.executionProviders();
    }

    private static AuthenticationFlowBindingType parseBindingType(String value) {
        try {
            return AuthenticationFlowBindingType.valueOf(value.toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException _) {
            throw ApiException.badRequest(ApiErrorCode.INVALID_REQUEST, "Binding type is invalid");
        }
    }
}
