package io.github.susimsek.kitezh.web.authz;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminAuthorizationResourceDTO;
import io.github.susimsek.kitezh.dto.authz.UmaPermissionRequestDTO;
import io.github.susimsek.kitezh.dto.authz.UmaPermissionTicketDTO;
import io.github.susimsek.kitezh.dto.authz.UmaResourceRegistrationRequestDTO;
import io.github.susimsek.kitezh.service.authz.UmaProtectionService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
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
@RequestMapping("/api/authz/protection")
@Tag(
        name = "UMA Protection API",
        description = "Resource-server registration and permission tickets.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class UmaProtectionController {

    private final UmaProtectionService protectionService;

    public UmaProtectionController(UmaProtectionService protectionService) {
        this.protectionService = protectionService;
    }

    @GetMapping("/resources")
    @Operation(summary = "List this resource server's resources")
    @ApiResponse(responseCode = "200", description = "Paged resource registrations returned.")
    Page<AdminAuthorizationResourceDTO> resources(
            @AuthenticationPrincipal Jwt token,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return protectionService.resources(token, pageable);
    }

    @GetMapping("/resources/{id}")
    @Operation(summary = "Get a resource registration")
    @ApiResponse(responseCode = "200", description = "Resource registration returned.")
    AdminAuthorizationResourceDTO resource(
            @AuthenticationPrincipal Jwt token,
            @Parameter(
                            description = "Resource identifier.",
                            example = "6c6651a4-8b51-4aa9-8ddc-54694db9dafe")
                    @PathVariable
                    String id) {
        return protectionService.resource(token, id);
    }

    @PostMapping("/resources")
    @Operation(summary = "Register a protected resource")
    @ApiResponse(responseCode = "201", description = "Resource registration created.")
    ResponseEntity<AdminAuthorizationResourceDTO> createResource(
            @AuthenticationPrincipal Jwt token,
            @Valid @RequestBody UmaResourceRegistrationRequestDTO request) {
        AdminAuthorizationResourceDTO created = protectionService.createResource(token, request);
        return ResponseEntity.created(URI.create("/api/authz/protection/resources/" + created.id()))
                .body(created);
    }

    @PutMapping("/resources/{id}")
    @Operation(summary = "Update a resource registration")
    @ApiResponse(responseCode = "200", description = "Resource registration updated.")
    AdminAuthorizationResourceDTO updateResource(
            @AuthenticationPrincipal Jwt token,
            @PathVariable String id,
            @Valid @RequestBody UmaResourceRegistrationRequestDTO request) {
        return protectionService.updateResource(token, id, request);
    }

    @DeleteMapping("/resources/{id}")
    @Operation(summary = "Delete a resource registration")
    @ApiResponse(responseCode = "204", description = "Resource registration deleted.")
    ResponseEntity<Void> deleteResource(
            @AuthenticationPrincipal Jwt token, @PathVariable String id) {
        protectionService.deleteResource(token, id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/permission")
    @Operation(summary = "Issue a UMA permission ticket")
    @ApiResponse(responseCode = "200", description = "Short-lived permission ticket issued.")
    UmaPermissionTicketDTO issueTicket(
            @AuthenticationPrincipal Jwt token,
            @Valid @RequestBody UmaPermissionRequestDTO request) {
        return protectionService.issueTicket(token, request);
    }
}
