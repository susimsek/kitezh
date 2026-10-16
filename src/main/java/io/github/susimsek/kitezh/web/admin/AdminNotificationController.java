package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.notification.NotificationDTO;
import io.github.susimsek.kitezh.service.notification.NotificationService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequestMapping("/api/admin/notifications")
@RequiredArgsConstructor
@Tag(name = "Admin - Notifications", description = "Durable administrative notifications.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminNotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @Operation(
            summary = "List administrative notifications",
            description =
                    "Returns a paged administrative notification feed with per-user read state."
                            + " The page size is capped at 100.")
    @ApiResponse(responseCode = "200", description = "Paged administrative notifications returned.")
    Page<NotificationDTO> notifications(
            Authentication authentication,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
                    Pageable pageable) {
        return notificationService.adminNotifications(authentication.getName(), pageable);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Count unread administrative notifications")
    @ApiResponse(responseCode = "200", description = "Unread count returned.")
    long unreadCount(Authentication authentication) {
        return notificationService.adminUnreadCount(authentication.getName());
    }

    @PutMapping("/{id}/read")
    @Operation(
            summary = "Mark an administrative notification as read",
            description = "Marks an administrative notification as read for the current admin.")
    @ApiResponse(responseCode = "204", description = "Notification marked as read.")
    ResponseEntity<Void> markRead(Authentication authentication, @PathVariable String id) {
        notificationService.markAdminRead(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
