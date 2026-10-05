package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminClientCreatedDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientMapperDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientMapperRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientScopeAssignmentRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientScopeEvaluationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminClientSecretDTO;
import io.github.susimsek.kitezh.dto.admin.AdminConsentDTO;
import io.github.susimsek.kitezh.dto.admin.AdminEventDTO;
import io.github.susimsek.kitezh.dto.admin.AdminScopeAssignmentsDTO;
import io.github.susimsek.kitezh.dto.admin.AdminServiceAccountDTO;
import io.github.susimsek.kitezh.dto.admin.AdminServiceAccountRolesRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSessionDTO;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.AdminClientMapperService;
import io.github.susimsek.kitezh.service.admin.AdminClientScopeEvaluationService;
import io.github.susimsek.kitezh.service.admin.AdminClientScopeService;
import io.github.susimsek.kitezh.service.admin.AdminClientService;
import io.github.susimsek.kitezh.service.admin.AdminConsentService;
import io.github.susimsek.kitezh.service.admin.AdminServiceAccountService;
import io.github.susimsek.kitezh.service.admin.AdminSessionService;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.beans.factory.annotation.Autowired;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/clients")
@Tag(
        name = "Admin - Clients",
        description = "Keycloak-style registered OAuth2/OIDC client management.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminClientController {

    private final AdminClientService adminClientService;
    private final AdminClientMapperService adminClientMapperService;
    private final AdminClientScopeService adminClientScopeService;
    private final AdminSessionService adminSessionService;
    private final AdminConsentService adminConsentService;
    private final AdminAuditEventService adminAuditEventService;
    private final AdminClientScopeEvaluationService scopeEvaluationService;
    private final AdminServiceAccountService serviceAccountService;

    @Autowired
    public AdminClientController(
            AdminClientService adminClientService,
            AdminClientMapperService adminClientMapperService,
            AdminClientScopeService adminClientScopeService,
            AdminSessionService adminSessionService,
            AdminConsentService adminConsentService,
            AdminAuditEventService adminAuditEventService,
            AdminClientScopeEvaluationService scopeEvaluationService,
            AdminServiceAccountService serviceAccountService) {
        this.adminClientService = adminClientService;
        this.adminClientMapperService = adminClientMapperService;
        this.adminClientScopeService = adminClientScopeService;
        this.adminSessionService = adminSessionService;
        this.adminConsentService = adminConsentService;
        this.adminAuditEventService = adminAuditEventService;
        this.scopeEvaluationService = scopeEvaluationService;
        this.serviceAccountService = serviceAccountService;
    }

    public AdminClientController(
            AdminClientService adminClientService,
            AdminClientScopeService adminClientScopeService,
            AdminSessionService adminSessionService,
            AdminConsentService adminConsentService,
            AdminAuditEventService adminAuditEventService) {
        this(
                adminClientService,
                null,
                adminClientScopeService,
                adminSessionService,
                adminConsentService,
                adminAuditEventService,
                null,
                null);
    }

    @GetMapping
    @Operation(
            summary = "Search clients",
            description = "Returns a paged client list. `size` is capped at 100.")
    @ApiResponse(responseCode = "200", description = "Paged registered clients returned.")
    Page<AdminClientDTO> findAll(
            @Parameter(description = "Optional client ID or name search text.", example = "account")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "clientId") Pageable pageable) {
        return adminClientService.findAll(q, pageable);
    }

    @GetMapping("/{id}")
    @Operation(
            summary = "Get client",
            description = "Returns one registered client by its internal identifier.")
    @ApiResponse(responseCode = "200", description = "Registered client returned.")
    ResponseEntity<AdminClientDTO> findById(
            @Parameter(
                            description = "Internal client identifier.",
                            example = "b0a80123-4567-89ab-cdef-0123456789ab",
                            required = true)
                    @PathVariable
                    String id) {
        AdminClientDTO client = adminClientService.findById(id);
        return client == null ? ResponseEntity.notFound().build() : ResponseEntity.ok(client);
    }

    @PostMapping
    @Operation(summary = "Create client", description = "Creates a registered OAuth2/OIDC client.")
    @ApiResponse(
            responseCode = "201",
            description = "Client created; the plain-text secret is returned once.")
    ResponseEntity<AdminClientCreatedDTO> create(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Client configuration.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminClientRequestDTO request) {
        AdminClientCreatedDTO created = adminClientService.create(request);
        return ResponseEntity.created(URI.create("/api/admin/clients/" + created.client().id()))
                .body(created);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update client", description = "Updates a registered OAuth2/OIDC client.")
    @ApiResponse(responseCode = "200", description = "Updated registered client returned.")
    AdminClientDTO update(
            @Parameter(
                            description = "Internal client identifier.",
                            example = "b0a80123-4567-89ab-cdef-0123456789ab",
                            required = true)
                    @PathVariable
                    String id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Replacement client configuration.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminClientRequestDTO request) {
        return adminClientService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(
            summary = "Delete client",
            description = "Deletes a registered client and its assignments.")
    @ApiResponse(responseCode = "204", description = "Client deleted.")
    ResponseEntity<Void> delete(
            @Parameter(
                            description = "Internal client identifier.",
                            example = "b0a80123-4567-89ab-cdef-0123456789ab",
                            required = true)
                    @PathVariable
                    String id) {
        adminClientService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/secret")
    @Operation(
            summary = "Regenerate client secret",
            description = "Returns the replacement client secret once.")
    @ApiResponse(responseCode = "200", description = "Replacement secret returned once.")
    AdminClientSecretDTO regenerateSecret(
            @Parameter(
                            description = "Internal client identifier.",
                            example = "b0a80123-4567-89ab-cdef-0123456789ab",
                            required = true)
                    @PathVariable
                    String id) {
        return new AdminClientSecretDTO(adminClientService.regenerateSecret(id));
    }

    @GetMapping("/{id}/mappers")
    @Operation(
            summary = "List client mappers",
            description = "Returns the allow-listed claim mappers configured for a client.")
    @ApiResponse(responseCode = "200", description = "Paged client mappers returned.")
    Page<AdminClientMapperDTO> mappers(
            @PathVariable String id,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return adminClientMapperService.findAll(id, q, pageable);
    }

    @PostMapping("/{id}/mappers")
    @Operation(summary = "Create client mapper")
    AdminClientMapperDTO createMapper(
            @PathVariable String id, @Valid @RequestBody AdminClientMapperRequestDTO request) {
        return adminClientMapperService.create(id, request);
    }

    @PutMapping("/{id}/mappers/{mapperId}")
    @Operation(summary = "Update client mapper")
    AdminClientMapperDTO updateMapper(
            @PathVariable String id,
            @PathVariable Long mapperId,
            @Valid @RequestBody AdminClientMapperRequestDTO request) {
        return adminClientMapperService.update(mapperId, id, request);
    }

    @DeleteMapping("/{id}/mappers/{mapperId}")
    @Operation(summary = "Delete client mapper")
    @ApiResponse(responseCode = "204", description = "Client mapper deleted.")
    ResponseEntity<Void> deleteMapper(@PathVariable String id, @PathVariable Long mapperId) {
        adminClientMapperService.delete(mapperId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/scope-assignments")
    @Operation(
            summary = "Get client scope assignments",
            description = "Returns the default, optional, and available scopes for a client.")
    @ApiResponse(responseCode = "200", description = "Client scope assignments returned.")
    AdminScopeAssignmentsDTO scopeAssignments(
            @Parameter(
                            description = "Internal client identifier.",
                            example = "b0a80123-4567-89ab-cdef-0123456789ab",
                            required = true)
                    @PathVariable
                    String id) {
        return adminClientScopeService.assignments(id);
    }

    @GetMapping("/{id}/scope-evaluation")
    @Operation(
            summary = "Evaluate client scopes",
            description =
                    "Previews effective scopes, mapped claims, and subject roles without issuing a"
                            + " token.")
    @ApiResponse(responseCode = "200", description = "Client scope evaluation returned.")
    AdminClientScopeEvaluationDTO scopeEvaluation(
            @PathVariable String id,
            @RequestParam(defaultValue = "") String scopes,
            @RequestParam(defaultValue = "") String subject) {
        if (scopeEvaluationService == null) {
            throw io.github.susimsek.kitezh.service.error.ApiException.notFound(
                    "Scope evaluation is unavailable");
        }
        return scopeEvaluationService.evaluate(id, scopes, subject);
    }

    @GetMapping("/{id}/service-account")
    @Operation(
            summary = "Get client service account",
            description =
                    "Returns the service-account identity, application roles, and effective client"
                            + " roles.")
    @ApiResponse(responseCode = "200", description = "Service account returned.")
    AdminServiceAccountDTO serviceAccount(@PathVariable String id) {
        return serviceAccountService.find(id);
    }

    @PutMapping("/{id}/service-account/roles")
    @Operation(
            summary = "Replace service-account roles",
            description =
                    "Replaces the application and client roles assigned to the service account.")
    @ApiResponse(responseCode = "200", description = "Service-account roles updated.")
    AdminServiceAccountDTO serviceAccountRoles(
            @PathVariable String id,
            @Valid @RequestBody AdminServiceAccountRolesRequestDTO request) {
        return serviceAccountService.replaceRoles(id, request);
    }

    @PostMapping("/{id}/service-account/revoke")
    @Operation(
            summary = "Revoke service-account tokens",
            description = "Revokes active OAuth2 authorizations issued to the service account.")
    @ApiResponse(responseCode = "204", description = "Service-account tokens revoked.")
    ResponseEntity<Void> revokeServiceAccountTokens(@PathVariable String id) {
        serviceAccountService.revokeTokens(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/scope-assignments")
    @Operation(
            summary = "Update client scope assignments",
            description = "Replaces the complete default and optional scope assignment sets.")
    @ApiResponse(responseCode = "200", description = "Updated client scope assignments returned.")
    AdminScopeAssignmentsDTO updateScopeAssignments(
            @Parameter(
                            description = "Internal client identifier.",
                            example = "b0a80123-4567-89ab-cdef-0123456789ab",
                            required = true)
                    @PathVariable
                    String id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Complete scope assignment sets.",
                            required = true)
                    @Valid
                    @RequestBody
                    AdminClientScopeAssignmentRequestDTO request) {
        return adminClientScopeService.updateAssignments(id, request);
    }

    @GetMapping("/{id}/sessions")
    @Operation(
            summary = "List client sessions",
            description = "Returns browser sessions associated with the client.")
    @ApiResponse(responseCode = "200", description = "Paged client sessions returned.")
    Page<AdminSessionDTO> sessions(
            @Parameter(
                            description = "Internal client identifier.",
                            example = "b0a80123-4567-89ab-cdef-0123456789ab",
                            required = true)
                    @PathVariable
                    String id,
            @PageableDefault(
                            size = 20,
                            sort = "lastAccessTime",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable) {
        return adminSessionService.clientSessions(id, pageable);
    }

    @GetMapping("/{id}/consents")
    @Operation(
            summary = "List client consents",
            description = "Returns user consents granted to the client.")
    @ApiResponse(responseCode = "200", description = "Paged client consents returned.")
    Page<AdminConsentDTO> consents(
            @Parameter(
                            description = "Internal client identifier.",
                            example = "b0a80123-4567-89ab-cdef-0123456789ab",
                            required = true)
                    @PathVariable
                    String id,
            @PageableDefault(size = 20, sort = "id.principalName") Pageable pageable) {
        return adminConsentService.clientConsents(id, pageable);
    }

    @GetMapping("/{id}/events")
    @Operation(
            summary = "List client events",
            description = "Returns administrative audit events for the client.")
    @ApiResponse(responseCode = "200", description = "Paged client audit events returned.")
    Page<AdminEventDTO> events(
            @Parameter(
                            description = "Internal client identifier.",
                            example = "b0a80123-4567-89ab-cdef-0123456789ab",
                            required = true)
                    @PathVariable
                    String id,
            @PageableDefault(
                            size = 20,
                            sort = "occurredAt",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable) {
        if (adminClientService.findById(id) == null) {
            throw ApiException.notFound("Client not found");
        }
        return adminAuditEventService.clientEvents(id, pageable);
    }
}
