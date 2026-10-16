package io.github.susimsek.kitezh.service.notification;

import io.github.susimsek.kitezh.domain.NotificationAudience;
import io.github.susimsek.kitezh.domain.NotificationEntity;
import io.github.susimsek.kitezh.domain.NotificationReadReceiptEntity;
import io.github.susimsek.kitezh.domain.NotificationType;
import io.github.susimsek.kitezh.dto.notification.NotificationDTO;
import io.github.susimsek.kitezh.repository.NotificationReadReceiptRepository;
import io.github.susimsek.kitezh.repository.NotificationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final int MAX_PAGE_SIZE = 100;

    private final NotificationRepository notificationRepository;
    private final NotificationReadReceiptRepository receiptRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public Page<NotificationDTO> accountNotifications(String username, Pageable pageable) {
        Long userId = userId(username);
        Page<NotificationEntity> page =
                notificationRepository.findByAudienceAndRecipientUserId(
                        NotificationAudience.ACCOUNT, userId, bounded(pageable));
        return toPage(page, userId);
    }

    @Transactional(readOnly = true)
    public Page<NotificationDTO> adminNotifications(String username, Pageable pageable) {
        Long userId = userId(username);
        Page<NotificationEntity> page =
                notificationRepository.findByAudience(
                        NotificationAudience.ADMIN, bounded(pageable));
        return toPage(page, userId);
    }

    @Transactional(readOnly = true)
    public long accountUnreadCount(String username) {
        Long userId = userId(username);
        return notificationRepository.countUnread(NotificationAudience.ACCOUNT, userId, userId);
    }

    @Transactional(readOnly = true)
    public long adminUnreadCount(String username) {
        Long userId = userId(username);
        return notificationRepository.countUnread(NotificationAudience.ADMIN, null, userId);
    }

    @Transactional
    public void markAccountRead(String username, String notificationId) {
        Long userId = userId(username);
        markRead(userId, notificationId, NotificationAudience.ACCOUNT, userId);
    }

    @Transactional
    public void markAdminRead(String username, String notificationId) {
        Long userId = userId(username);
        markRead(userId, notificationId, NotificationAudience.ADMIN, null);
    }

    @Transactional
    public void publishAccount(String username, NotificationType type) {
        Long userId = userId(username);
        NotificationEntity notification =
                newNotification(NotificationAudience.ACCOUNT, userId, type);
        notificationRepository.save(notification);
    }

    @Transactional
    public void publishAdministrators(NotificationType type) {
        notificationRepository.save(newNotification(NotificationAudience.ADMIN, null, type));
    }

    private void markRead(
            Long userId,
            String notificationId,
            NotificationAudience audience,
            Long recipientUserId) {
        NotificationEntity notification =
                notificationRepository
                        .findByIdForUpdate(notificationId)
                        .filter(
                                item ->
                                        item.getAudience() == audience
                                                && java.util.Objects.equals(
                                                        item.getRecipientUserId(), recipientUserId))
                        .orElseThrow(() -> ApiException.notFound("Notification was not found"));
        if (receiptRepository
                .findByNotificationIdAndUserId(notification.getId(), userId)
                .isPresent()) {
            return;
        }
        NotificationReadReceiptEntity receipt = new NotificationReadReceiptEntity();
        receipt.setId(UUID.randomUUID().toString());
        receipt.setNotificationId(notification.getId());
        receipt.setUserId(userId);
        receipt.setReadAt(Instant.now());
        receiptRepository.save(receipt);
    }

    private Page<NotificationDTO> toPage(Page<NotificationEntity> page, Long userId) {
        List<String> ids = page.getContent().stream().map(NotificationEntity::getId).toList();
        var readIds =
                ids.isEmpty()
                        ? java.util.Set.<String>of()
                        : java.util.Set.copyOf(
                                notificationRepository.findReadNotificationIds(userId, ids));
        List<NotificationDTO> content =
                page.getContent().stream()
                        .map(
                                item ->
                                        new NotificationDTO(
                                                item.getId(),
                                                item.getType().getMessageKey(),
                                                item.getCreatedAt(),
                                                readIds.contains(item.getId())))
                        .toList();
        return new PageImpl<>(content, page.getPageable(), page.getTotalElements());
    }

    private Long userId(String username) {
        return userRepository
                .findIdByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User was not found"));
    }

    private static NotificationEntity newNotification(
            NotificationAudience audience, Long recipientUserId, NotificationType type) {
        NotificationEntity notification = new NotificationEntity();
        notification.setId(UUID.randomUUID().toString());
        notification.setAudience(audience);
        notification.setRecipientUserId(recipientUserId);
        notification.setType(type);
        notification.setCreatedAt(Instant.now());
        return notification;
    }

    private static Pageable bounded(Pageable pageable) {
        return PageRequest.of(
                pageable.getPageNumber(),
                Math.min(pageable.getPageSize(), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt"));
    }
}
