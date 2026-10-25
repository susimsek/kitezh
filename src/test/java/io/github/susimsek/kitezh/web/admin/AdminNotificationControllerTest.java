package io.github.susimsek.kitezh.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.dto.notification.NotificationDTO;
import io.github.susimsek.kitezh.service.notification.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.TestingAuthenticationToken;

class AdminNotificationControllerTest {

    private final NotificationService notificationService = mock(NotificationService.class);
    private final AdminNotificationController controller =
            new AdminNotificationController(notificationService);

    @Test
    void delegatesListAndUnreadCountToCurrentAdministrator() {
        var authentication = new TestingAuthenticationToken("admin", null);
        var pageable = PageRequest.of(0, 20);
        Page<NotificationDTO> notifications = Page.empty(pageable);
        when(notificationService.adminNotifications("admin", pageable)).thenReturn(notifications);
        when(notificationService.adminUnreadCount("admin")).thenReturn(3L);

        assertThat(controller.notifications(authentication, pageable)).isSameAs(notifications);
        assertThat(controller.unreadCount(authentication)).isEqualTo(3L);
    }

    @Test
    void marksCurrentAdministratorsNotificationRead() {
        var authentication = new TestingAuthenticationToken("admin", null);

        assertThat(controller.markRead(authentication, "notification-1").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(notificationService).markAdminRead("admin", "notification-1");
    }
}
