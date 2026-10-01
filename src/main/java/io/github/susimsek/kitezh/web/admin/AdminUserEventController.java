package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.domain.UserEventType;
import io.github.susimsek.kitezh.dto.admin.UserEventDTO;
import io.github.susimsek.kitezh.dto.admin.UserEventSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.UserEventSettingsRequestDTO;
import io.github.susimsek.kitezh.service.admin.UserEventSearchCriteria;
import io.github.susimsek.kitezh.service.admin.UserEventService;
import io.github.susimsek.kitezh.service.admin.UserEventSettingsService;
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
@RequestMapping("/api/admin/user-events")
@RequiredArgsConstructor
@Tag(name = "Admin - User events", description = "User authentication event administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminUserEventController {

    private final UserEventService userEventService;
    private final UserEventSettingsService userEventSettingsService;

    @GetMapping
    @Operation(
            summary = "Search user events",
            description = "Returns a paged user authentication event history.")
    @ApiResponse(responseCode = "200", description = "Paged user events returned.")
    Page<UserEventDTO> events(
            @Parameter(description = "Free-text username, type, or IP search.", example = "user")
                    @RequestParam(defaultValue = "")
                    String q,
            @Parameter(description = "User authentication event type.", example = "LOGIN_FAILURE")
                    @RequestParam(required = false)
                    UserEventType type,
            @Parameter(description = "Exact username filter.", example = "user")
                    @RequestParam(defaultValue = "")
                    String username,
            @Parameter(
                            description = "Exact OAuth client identifier filter.",
                            example = "admin-console")
                    @RequestParam(defaultValue = "")
                    String clientId,
            @Parameter(description = "Exact source IP address filter.", example = "192.0.2.10")
                    @RequestParam(defaultValue = "")
                    String ipAddress,
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
        return userEventService.events(
                new UserEventSearchCriteria(q, type, username, clientId, ipAddress, from, to),
                pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get user event", description = "Returns one user authentication event.")
    @ApiResponse(
            responseCode = "200",
            description = "User event returned.",
            content = @Content(schema = @Schema(implementation = UserEventDTO.class)))
    UserEventDTO event(@PathVariable String id) {
        return userEventService.event(id);
    }

    @DeleteMapping
    @Operation(
            summary = "Delete all user events",
            description = "Deletes every stored user authentication event.")
    @ApiResponse(responseCode = "204", description = "User events deleted.")
    ResponseEntity<Void> deleteAll() {
        userEventService.deleteAll();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/config")
    @Operation(
            summary = "Get user event settings",
            description = "Returns user event recording, type, and retention settings.")
    @ApiResponse(
            responseCode = "200",
            description = "User event settings returned.",
            content = @Content(schema = @Schema(implementation = UserEventSettingsDTO.class)))
    UserEventSettingsDTO settings() {
        return userEventSettingsService.get();
    }

    @PutMapping("/config")
    @Operation(
            summary = "Update user event settings",
            description = "Updates user event recording, type, and retention settings.")
    @ApiResponse(
            responseCode = "200",
            description = "User event settings updated.",
            content = @Content(schema = @Schema(implementation = UserEventSettingsDTO.class)))
    UserEventSettingsDTO updateSettings(@Valid @RequestBody UserEventSettingsRequestDTO request) {
        return userEventSettingsService.update(request);
    }
}
