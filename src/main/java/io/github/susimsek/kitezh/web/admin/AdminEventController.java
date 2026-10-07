package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminEventDTO;
import io.github.susimsek.kitezh.dto.admin.AdminEventSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.AdminEventSettingsRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.AdminEventSettingsService;
import io.github.susimsek.kitezh.service.admin.AdminUserService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Tag(name = "Admin - Events", description = "Administrative audit events.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminEventController {

    private final AdminAuditEventService adminAuditEventService;
    private final AdminUserService adminUserService;
    private final AdminEventSettingsService adminEventSettingsService;

    @GetMapping("/events")
    @Operation(
            summary = "Search administrative events",
            description =
                    "Searches audit events using optional text, action, target, and time-range"
                            + " filters.")
    @ApiResponse(responseCode = "200", description = "Paged matching audit events returned.")
    Page<AdminEventDTO> events(
            @Parameter(description = "Free-text actor or target search.", example = "admin")
                    @RequestParam(defaultValue = "")
                    String q,
            @Parameter(description = "Stable action filter.", example = "user.updated")
                    @RequestParam(defaultValue = "")
                    String action,
            @Parameter(description = "Target resource type filter.", example = "user")
                    @RequestParam(defaultValue = "")
                    String targetType,
            @Parameter(description = "Target resource identifier filter.", example = "2")
                    @RequestParam(defaultValue = "")
                    String targetId,
            @Parameter(
                            description = "Inclusive start timestamp in ISO-8601 format.",
                            example = "2026-09-01T00:00:00Z")
                    @RequestParam(required = false)
                    Instant from,
            @Parameter(
                            description = "Inclusive end timestamp in ISO-8601 format.",
                            example = "2026-09-04T23:59:59Z")
                    @RequestParam(required = false)
                    Instant to,
            @PageableDefault(
                            size = 20,
                            sort = "occurredAt",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable) {
        return adminAuditEventService.events(q, action, targetType, targetId, from, to, pageable);
    }

    @GetMapping("/users/{id}/events")
    @Operation(
            summary = "List user events",
            description = "Returns audit events whose target is the specified user.")
    @ApiResponse(responseCode = "200", description = "Paged user audit events returned.")
    Page<AdminEventDTO> userEvents(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @PageableDefault(
                            size = 20,
                            sort = "occurredAt",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable,
            Authentication authentication) {
        adminUserService.requireManageableUser(id, authentication.getName());
        return adminAuditEventService.userEvents(id, pageable);
    }

    @DeleteMapping("/events")
    @Operation(
            summary = "Delete all administrative events",
            description = "Deletes every stored administrative audit event.")
    @ApiResponse(responseCode = "204", description = "Administrative audit events deleted.")
    @ApiResponse(responseCode = "403", description = "The administrator cannot manage events.")
    ResponseEntity<Void> deleteAllEvents() {
        adminAuditEventService.deleteAll();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/events/config")
    @Operation(
            summary = "Get event settings",
            description = "Returns administrative audit event recording and retention settings.")
    @ApiResponse(
            responseCode = "200",
            description = "Event settings returned.",
            content = @Content(schema = @Schema(implementation = AdminEventSettingsDTO.class)))
    @ApiResponse(responseCode = "403", description = "The administrator cannot view events.")
    AdminEventSettingsDTO eventSettings() {
        return adminEventSettingsService.get();
    }

    @PutMapping("/events/config")
    @Operation(
            summary = "Update event settings",
            description = "Updates administrative audit event recording and retention settings.")
    @ApiResponse(
            responseCode = "200",
            description = "Event settings updated.",
            content = @Content(schema = @Schema(implementation = AdminEventSettingsDTO.class)))
    @ApiResponse(responseCode = "400", description = "The event settings are invalid.")
    @ApiResponse(responseCode = "403", description = "The administrator cannot manage events.")
    AdminEventSettingsDTO updateEventSettings(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            required = true,
                            description = "Event settings to apply.",
                            content =
                                    @Content(
                                            schema =
                                                    @Schema(
                                                            implementation =
                                                                    AdminEventSettingsRequestDTO
                                                                            .class)))
                    @Valid
                    @RequestBody
                    AdminEventSettingsRequestDTO request) {
        return adminEventSettingsService.update(request);
    }
}
