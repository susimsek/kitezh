package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.UserEventDTO;
import io.github.susimsek.kitezh.service.admin.UserEventService;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/users/{id}/user-events")
@RequiredArgsConstructor
@Tag(name = "Admin - User events", description = "User authentication event administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminUserEventHistoryController {

    private final UserEventService userEventService;

    @GetMapping
    @Operation(
            summary = "List a user's events",
            description = "Returns user authentication events for one user.")
    @ApiResponse(responseCode = "200", description = "Paged user events returned.")
    Page<UserEventDTO> events(
            @Parameter(description = "Internal user identifier.", example = "2", required = true)
                    @PathVariable
                    Long id,
            @PageableDefault(
                            size = 20,
                            sort = "occurredAt",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable) {
        return userEventService.userEvents(id, pageable);
    }
}
