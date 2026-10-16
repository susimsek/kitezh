package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.github.susimsek.kitezh.domain.NotificationAudience;
import io.github.susimsek.kitezh.domain.NotificationEntity;
import io.github.susimsek.kitezh.domain.NotificationType;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.NotificationReadReceiptRepository;
import io.github.susimsek.kitezh.repository.NotificationRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.JwtRequestPostProcessor;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class NotificationEndpointsIT {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private NotificationReadReceiptRepository receiptRepository;

    @Test
    void accountNotificationsArePrivatePagedAndReadStateIsIdempotent() throws Exception {
        String username = "notification-it-" + UUID.randomUUID();
        UserEntity user = userRepository.save(user(username));
        NotificationEntity notification =
                notification(
                        NotificationAudience.ACCOUNT,
                        user.getId(),
                        NotificationType.ACCOUNT_MFA_ENABLED);
        notificationRepository.save(notification);
        try {
            mockMvc.perform(
                            get("/api/account/notifications")
                                    .with(account(username))
                                    .param("size", "1000"))
                    .andExpect(status().isOk())
                    .andExpect(
                            jsonPath("$.content[0].messageKey")
                                    .value("notificationAccountMfaEnabled"))
                    .andExpect(jsonPath("$.content[0].read").value(false))
                    .andExpect(jsonPath("$.size").value(100));

            mockMvc.perform(
                            put("/api/account/notifications/{id}/read", notification.getId())
                                    .with(account(username)))
                    .andExpect(status().isNoContent());
            mockMvc.perform(
                            put("/api/account/notifications/{id}/read", notification.getId())
                                    .with(account(username)))
                    .andExpect(status().isNoContent());

            mockMvc.perform(get("/api/account/notifications/unread-count").with(account(username)))
                    .andExpect(status().isOk())
                    .andExpect(
                            org.springframework.test.web.servlet.result.MockMvcResultMatchers
                                    .content()
                                    .string("0"));
            mockMvc.perform(get("/api/account/notifications").with(account(username)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].read").value(true));
            assertThat(
                            receiptRepository.findByNotificationIdAndUserId(
                                    notification.getId(), user.getId()))
                    .isPresent();
        } finally {
            userRepository.deleteById(user.getId());
        }
    }

    @Test
    void accountCannotReadAnotherUsersNotification() throws Exception {
        String ownerName = "notification-owner-" + UUID.randomUUID();
        String otherName = "notification-other-" + UUID.randomUUID();
        UserEntity owner = userRepository.save(user(ownerName));
        UserEntity other = userRepository.save(user(otherName));
        NotificationEntity notification =
                notification(
                        NotificationAudience.ACCOUNT,
                        owner.getId(),
                        NotificationType.ACCOUNT_PASSWORD_CHANGED);
        notificationRepository.save(notification);
        try {
            mockMvc.perform(
                            put("/api/account/notifications/{id}/read", notification.getId())
                                    .with(account(otherName)))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/account/notifications").with(account(otherName)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content").isEmpty());
        } finally {
            userRepository.deleteById(owner.getId());
            userRepository.deleteById(other.getId());
        }
    }

    @Test
    void adminReadStateIsPerAdminAndNonAdminCannotReadTheFeed() throws Exception {
        String firstName = "notification-admin-" + UUID.randomUUID();
        String secondName = "notification-admin-" + UUID.randomUUID();
        UserEntity first = userRepository.save(user(firstName));
        UserEntity second = userRepository.save(user(secondName));
        NotificationEntity notification =
                notification(
                        NotificationAudience.ADMIN, null, NotificationType.ADMIN_USER_REGISTERED);
        notificationRepository.save(notification);
        try {
            mockMvc.perform(get("/api/admin/notifications").with(admin(firstName)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].read").value(false));
            mockMvc.perform(get("/api/admin/notifications/unread-count").with(admin(firstName)))
                    .andExpect(status().isOk())
                    .andExpect(
                            org.springframework.test.web.servlet.result.MockMvcResultMatchers
                                    .content()
                                    .string("1"));
            mockMvc.perform(
                            put("/api/admin/notifications/{id}/read", notification.getId())
                                    .with(admin(firstName)))
                    .andExpect(status().isNoContent());
            mockMvc.perform(get("/api/admin/notifications/unread-count").with(admin(firstName)))
                    .andExpect(status().isOk())
                    .andExpect(
                            org.springframework.test.web.servlet.result.MockMvcResultMatchers
                                    .content()
                                    .string("0"));
            mockMvc.perform(get("/api/admin/notifications").with(admin(secondName)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].read").value(false));
            mockMvc.perform(
                            get("/api/admin/notifications")
                                    .with(
                                            jwt().authorities(
                                                            new SimpleGrantedAuthority(
                                                                    "ROLE_EVENT_VIEWER"))))
                    .andExpect(status().isForbidden());
        } finally {
            notificationRepository.deleteById(notification.getId());
            userRepository.deleteById(first.getId());
            userRepository.deleteById(second.getId());
        }
    }

    private static UserEntity user(String username) {
        return new UserEntity(null, username, "{noop}Notification-test12!", true, Set.of());
    }

    private static NotificationEntity notification(
            NotificationAudience audience, Long userId, NotificationType type) {
        NotificationEntity notification = new NotificationEntity();
        notification.setId(UUID.randomUUID().toString());
        notification.setAudience(audience);
        notification.setRecipientUserId(userId);
        notification.setType(type);
        notification.setCreatedAt(Instant.now());
        return notification;
    }

    private static JwtRequestPostProcessor account(String username) {
        return jwt().jwt(token -> token.subject(username))
                .authorities(new SimpleGrantedAuthority("SCOPE_account-api"));
    }

    private static JwtRequestPostProcessor admin(String username) {
        return jwt().jwt(token -> token.subject(username))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }
}
