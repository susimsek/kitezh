package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOfflineSessionDTO;
import io.github.susimsek.kitezh.service.admin.AdminOfflineSessionService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/offline-sessions")
@RequiredArgsConstructor
@Tag(
        name = "Admin - Offline sessions",
        description = "Offline refresh-token session administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminOfflineSessionController {

    private final AdminOfflineSessionService service;

    @GetMapping
    @Operation(summary = "List offline sessions")
    @ApiResponse(responseCode = "200", description = "Paged offline sessions returned.")
    Page<AdminOfflineSessionDTO> sessions(
            @PageableDefault(
                            size = 20,
                            sort = "refreshTokenIssuedAt",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable) {
        return service.sessions(pageable);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Revoke offline session")
    @ApiResponse(responseCode = "204", description = "Offline session revoked.")
    ResponseEntity<Void> revoke(@PathVariable String id, Authentication authentication) {
        service.revoke(id, authentication.getName());
        return ResponseEntity.noContent().build();
    }
}
