package io.github.susimsek.kitezh.domain;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum NotificationType {
    ACCOUNT_PASSWORD_CHANGED("notificationAccountPasswordChanged"),
    ACCOUNT_MFA_ENABLED("notificationAccountMfaEnabled"),
    ACCOUNT_MFA_DISABLED("notificationAccountMfaDisabled"),
    ACCOUNT_OFFLINE_SESSION_REVOKED("notificationAccountSessionRevoked"),
    ADMIN_USER_REGISTERED("notificationAdminUserRegistered");

    private final String messageKey;
}
