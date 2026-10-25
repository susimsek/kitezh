package io.github.susimsek.kitezh.web.account;

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

class AccountNotificationControllerTest {

    private final NotificationService notificationService = mock(NotificationService.class);
    private final AccountNotificationController controller =
            new AccountNotificationController(notificationService);

    @Test
    void delegatesListAndUnreadCountToCurrentAccount() {
        var authentication = new TestingAuthenticationToken("alice", null);
        var pageable = PageRequest.of(0, 20);
        Page<NotificationDTO> notifications = Page.empty(pageable);
        when(notificationService.accountNotifications("alice", pageable)).thenReturn(notifications);
        when(notificationService.accountUnreadCount("alice")).thenReturn(2L);

        assertThat(controller.notifications(authentication, pageable)).isSameAs(notifications);
        assertThat(controller.unreadCount(authentication)).isEqualTo(2L);
    }

    @Test
    void marksCurrentAccountsNotificationRead() {
        var authentication = new TestingAuthenticationToken("alice", null);

        assertThat(controller.markRead(authentication, "notification-1").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(notificationService).markAccountRead("alice", "notification-1");
    }
}
