package io.github.susimsek.kitezh.web.account;

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
@RequestMapping("/api/account/notifications")
@RequiredArgsConstructor
@Tag(name = "Account - Notifications", description = "Durable account security notifications.")
@SecurityRequirement(name = OpenApiConfig.ACCOUNT_BEARER)
class AccountNotificationController {

    private final NotificationService notificationService;

    @GetMapping
    @Operation(
            summary = "List account notifications",
            description =
                    "Returns the authenticated user's paged notifications with per-user read"
                            + " state. The page size is capped at 100.")
    @ApiResponse(responseCode = "200", description = "Paged account notifications returned.")
    Page<NotificationDTO> notifications(
            Authentication authentication,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
                    Pageable pageable) {
        return notificationService.accountNotifications(authentication.getName(), pageable);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "Count unread account notifications")
    @ApiResponse(responseCode = "200", description = "Unread count returned.")
    long unreadCount(Authentication authentication) {
        return notificationService.accountUnreadCount(authentication.getName());
    }

    @PutMapping("/{id}/read")
    @Operation(
            summary = "Mark an account notification as read",
            description = "Marks a notification belonging to the authenticated account as read.")
    @ApiResponse(responseCode = "204", description = "Notification marked as read.")
    ResponseEntity<Void> markRead(Authentication authentication, @PathVariable String id) {
        notificationService.markAccountRead(authentication.getName(), id);
        return ResponseEntity.noContent().build();
    }
}
