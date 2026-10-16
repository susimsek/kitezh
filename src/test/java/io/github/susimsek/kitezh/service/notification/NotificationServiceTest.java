package io.github.susimsek.kitezh.service.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.NotificationAudience;
import io.github.susimsek.kitezh.domain.NotificationEntity;
import io.github.susimsek.kitezh.domain.NotificationReadReceiptEntity;
import io.github.susimsek.kitezh.domain.NotificationType;
import io.github.susimsek.kitezh.repository.NotificationReadReceiptRepository;
import io.github.susimsek.kitezh.repository.NotificationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock private NotificationRepository notificationRepository;
    @Mock private NotificationReadReceiptRepository receiptRepository;
    @Mock private UserRepository userRepository;
    @InjectMocks private NotificationService service;

    @Test
    void readsAccountNotificationsWithBoundedSortAndReadReceiptState() {
        givenAda();
        var unread = notification("unread", NotificationAudience.ACCOUNT, 7L);
        var read = notification("read", NotificationAudience.ACCOUNT, 7L);
        when(notificationRepository.findByAudienceAndRecipientUserId(
                        eq(NotificationAudience.ACCOUNT), eq(7L), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(unread, read)));
        when(notificationRepository.findReadNotificationIds(7L, List.of("unread", "read")))
                .thenReturn(List.of("read"));

        var page = service.accountNotifications("ada", PageRequest.of(2, 500));

        assertThat(page.getContent()).extracting("read").containsExactly(false, true);
        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(notificationRepository)
                .findByAudienceAndRecipientUserId(
                        eq(NotificationAudience.ACCOUNT), eq(7L), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(2);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(100);
        assertThat(pageable.getValue().getSort())
                .isEqualTo(Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    @Test
    void readsAdminNotificationsAndSkipsReadLookupForAnEmptyPage() {
        givenAda();
        when(notificationRepository.findByAudience(eq(NotificationAudience.ADMIN), any()))
                .thenReturn(new PageImpl<>(List.of()));

        assertThat(service.adminNotifications("ada", PageRequest.of(0, 20))).isEmpty();
        verify(notificationRepository, never()).findReadNotificationIds(any(), any());
    }

    @Test
    void countsUnreadNotificationsByAudience() {
        givenAda();
        when(notificationRepository.countUnread(NotificationAudience.ACCOUNT, 7L, 7L))
                .thenReturn(3L);
        when(notificationRepository.countUnread(NotificationAudience.ADMIN, null, 7L))
                .thenReturn(5L);

        assertThat(service.accountUnreadCount("ada")).isEqualTo(3L);
        assertThat(service.adminUnreadCount("ada")).isEqualTo(5L);
    }

    @Test
    void recordsAccountReadsAndDoesNotDuplicateAdministratorReceipts() {
        givenAda();
        var account = notification("account-1", NotificationAudience.ACCOUNT, 7L);
        when(notificationRepository.findByIdForUpdate("account-1"))
                .thenReturn(Optional.of(account));
        when(receiptRepository.findByNotificationIdAndUserId("account-1", 7L))
                .thenReturn(Optional.empty());
        service.markAccountRead("ada", "account-1");
        ArgumentCaptor<NotificationReadReceiptEntity> receipt =
                ArgumentCaptor.forClass(NotificationReadReceiptEntity.class);
        verify(receiptRepository).save(receipt.capture());
        assertThat(receipt.getValue().getNotificationId()).isEqualTo("account-1");
        assertThat(receipt.getValue().getUserId()).isEqualTo(7L);
        assertThat(receipt.getValue().getReadAt()).isNotNull();

        var admin = notification("admin-1", NotificationAudience.ADMIN, null);
        when(notificationRepository.findByIdForUpdate("admin-1")).thenReturn(Optional.of(admin));
        when(receiptRepository.findByNotificationIdAndUserId("admin-1", 7L))
                .thenReturn(Optional.of(new NotificationReadReceiptEntity()));
        service.markAdminRead("ada", "admin-1");
        verify(receiptRepository, never())
                .save(
                        org.mockito.ArgumentMatchers.argThat(
                                value -> "admin-1".equals(value.getNotificationId())));

        when(notificationRepository.findByIdForUpdate("wrong-audience"))
                .thenReturn(Optional.of(account));
        assertThatThrownBy(() -> service.markAdminRead("ada", "wrong-audience"))
                .isInstanceOf(ApiException.class);
        when(notificationRepository.findByIdForUpdate("missing")).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.markAccountRead("ada", "missing"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void publishesNotificationsForOneUserAndAllAdministrators() {
        givenAda();
        service.publishAccount("ada", NotificationType.ACCOUNT_PASSWORD_CHANGED);
        service.publishAdministrators(NotificationType.ADMIN_USER_REGISTERED);
        ArgumentCaptor<NotificationEntity> notifications =
                ArgumentCaptor.forClass(NotificationEntity.class);
        verify(notificationRepository, org.mockito.Mockito.times(2)).save(notifications.capture());
        assertThat(notifications.getAllValues())
                .extracting(NotificationEntity::getAudience)
                .containsExactly(NotificationAudience.ACCOUNT, NotificationAudience.ADMIN);
        assertThat(notifications.getAllValues())
                .extracting(NotificationEntity::getRecipientUserId)
                .containsExactly(7L, null);
        assertThat(notifications.getAllValues())
                .allSatisfy(value -> assertThat(value.getCreatedAt()).isNotNull());
    }

    @Test
    void rejectsUnknownUsers() {
        when(userRepository.findIdByUsername("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.accountUnreadCount("missing"))
                .isInstanceOf(ApiException.class);
    }

    private static NotificationEntity notification(
            String id, NotificationAudience audience, Long recipientId) {
        var notification = new NotificationEntity();
        notification.setId(id);
        notification.setAudience(audience);
        notification.setRecipientUserId(recipientId);
        notification.setType(NotificationType.ACCOUNT_MFA_ENABLED);
        notification.setCreatedAt(Instant.parse("2026-10-12T08:30:00Z"));
        return notification;
    }

    private void givenAda() {
        when(userRepository.findIdByUsername("ada")).thenReturn(Optional.of(7L));
    }
}
