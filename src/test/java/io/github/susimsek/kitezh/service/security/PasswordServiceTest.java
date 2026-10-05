package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserEntity;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordServiceTest {

    private final PasswordPolicyService policyService = mock();
    private final PasswordEncoder passwordEncoder = mock();
    private final PasswordService service = new PasswordService(policyService, passwordEncoder);

    @Test
    void matchesOnlyWhenBothPasswordValuesArePresent() {
        UserEntity user = new UserEntity();
        user.setPassword("encoded");
        when(passwordEncoder.matches("raw", "encoded")).thenReturn(true);

        assertThat(service.matchesCurrentPassword("raw", user)).isTrue();
        assertThat(service.matchesCurrentPassword(null, user)).isFalse();
        user.setPassword(null);
        assertThat(service.matchesCurrentPassword("raw", user)).isFalse();
    }

    @Test
    void setsInitialAndTemporaryPasswordsWithExpectedFlags() {
        UserEntity user = new UserEntity();
        when(passwordEncoder.encode("Strong1!")).thenReturn("encoded");

        service.setInitialPassword(user, "Strong1!");
        assertThat(user.getPassword()).isEqualTo("encoded");
        assertThat(user.getPasswordChangedAt()).isNotNull();
        assertThat(user.isMustChangePassword()).isFalse();
        assertThat(user.isTemporaryPassword()).isFalse();

        service.setTemporaryPassword(user, "Strong1!");
        assertThat(user.isMustChangePassword()).isTrue();
        assertThat(user.isTemporaryPassword()).isTrue();
        verify(policyService).recordChange(user, "encoded");
    }

    @Test
    void changesAnExistingPasswordAndClearsTemporaryFlags() {
        UserEntity user = new UserEntity();
        user.setPassword("old");
        user.setMustChangePassword(true);
        user.setTemporaryPassword(true);
        when(passwordEncoder.encode("New1!")).thenReturn("new-encoded");

        service.changePassword(user, "New1!");

        assertThat(user.getPassword()).isEqualTo("new-encoded");
        assertThat(user.getPasswordChangedAt()).isAfter(Instant.now().minusSeconds(2));
        assertThat(user.isMustChangePassword()).isFalse();
        assertThat(user.isTemporaryPassword()).isFalse();
        verify(policyService).recordChange(user, "old");
    }
}
