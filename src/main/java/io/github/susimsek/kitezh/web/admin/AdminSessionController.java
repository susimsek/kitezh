package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminSessionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminSessionDetailDTO;
import io.github.susimsek.kitezh.service.admin.AdminSessionService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Admin - Sessions", description = "Browser session administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminSessionController {

    private final AdminSessionService adminSessionService;

    @GetMapping("/users/{id}/sessions")
    @Operation(
            summary = "List user sessions",
            description = "Returns active browser sessions for the specified user.")
    @ApiResponse(responseCode = "200", description = "Paged user sessions returned.")
    Page<AdminSessionDTO> userSessions(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @PageableDefault(
                            size = 20,
                            sort = "lastAccessTime",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable,
            Authentication authentication) {
        return adminSessionService.userSessions(id, authentication.getName(), pageable);
    }

    @GetMapping("/sessions")
    @Operation(
            summary = "Search browser sessions",
            description = "Searches browser sessions by username, client, and activity status.")
    @ApiResponse(responseCode = "200", description = "Paged matching sessions returned.")
    Page<AdminSessionDTO> sessions(
            @Parameter(description = "Optional username or session search text.", example = "user")
                    @RequestParam(defaultValue = "")
                    String q,
            @Parameter(
                            description = "Registered client identifier filter.",
                            example = "account-console")
                    @RequestParam(defaultValue = "")
                    String clientId,
            @Parameter(
                            description = "Session status filter: `active` or `expired`.",
                            example = "active")
                    @RequestParam(defaultValue = "active")
                    String status,
            @PageableDefault(
                            size = 20,
                            sort = "lastAccessTime",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable) {
        return adminSessionService.sessions(q, clientId, status, pageable);
    }

    @GetMapping("/sessions/{id}")
    @Operation(
            summary = "Get browser session",
            description = "Returns a browser session and its associated OAuth2 authorizations.")
    @ApiResponse(responseCode = "200", description = "Session details returned.")
    AdminSessionDetailDTO session(
            @Parameter(
                            description = "Opaque session identifier.",
                            example = "6f9b4dd0-2ed2-4af8-9e89-6ef3d4dd8c12",
                            required = true)
                    @PathVariable
                    String id,
            Authentication authentication) {
        return adminSessionService.session(id, authentication.getName());
    }

    @DeleteMapping("/sessions/{id}")
    @Operation(
            summary = "Delete browser session",
            description = "Terminates the selected browser session.")
    @ApiResponse(responseCode = "204", description = "Browser session deleted.")
    ResponseEntity<Void> deleteSession(
            @Parameter(
                            description = "Opaque session identifier.",
                            example = "6f9b4dd0-2ed2-4af8-9e89-6ef3d4dd8c12",
                            required = true)
                    @PathVariable
                    String id,
            Authentication authentication) {
        adminSessionService.deleteSession(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{username}/sessions")
    @Operation(
            summary = "Delete all sessions for a user",
            description = "Terminates every browser session belonging to the specified user.")
    @ApiResponse(responseCode = "204", description = "All user sessions deleted.")
    ResponseEntity<Void> deleteUserSessions(
            @Parameter(
                            description = "Username whose sessions should be terminated.",
                            example = "user",
                            required = true)
                    @PathVariable
                    String username,
            Authentication authentication) {
        adminSessionService.deleteUserSessions(username, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
