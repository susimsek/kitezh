package io.github.susimsek.kitezh.service.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.domain.PasswordHistoryEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.mapper.PasswordHistoryMapper;
import io.github.susimsek.kitezh.repository.PasswordHistoryRepository;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class PasswordPolicyServiceTest {

    @Mock private PasswordHistoryRepository historyRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ApplicationProperties applicationProperties;

    @Test
    void enforcesComplexityAndLength() {
        when(applicationProperties.security()).thenReturn(security());
        when(historyRepository.findByUserIdOrderByCreatedAtDesc(7L)).thenReturn(List.of());
        UserEntity user = user();

        assertThatThrownBy(() -> service().validateForNewPassword(user, "alllowercase123!"))
                .isInstanceOf(ApiException.class);

        service().validateForNewPassword(user, "StrongPassword1!");
    }

    @Test
    void rejectsEachIndividualPasswordComplexityRequirement() {
        UserEntity user = user();

        assertThatThrownBy(
                        () ->
                                serviceWithPolicy(
                                                new ApplicationProperties.PasswordPolicy(
                                                        1, 128, 1, 0, 0, 0, false, false, false, 0,
                                                        0, ""))
                                        .validateForNewPassword(user, "lowercase1!"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("uppercase");
        assertThatThrownBy(
                        () ->
                                serviceWithPolicy(
                                                new ApplicationProperties.PasswordPolicy(
                                                        1, 128, 0, 1, 0, 0, false, false, false, 0,
                                                        0, ""))
                                        .validateForNewPassword(user, "UPPERCASE1!"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("lowercase");
        assertThatThrownBy(
                        () ->
                                serviceWithPolicy(
                                                new ApplicationProperties.PasswordPolicy(
                                                        1, 128, 0, 0, 1, 0, false, false, false, 0,
                                                        0, ""))
                                        .validateForNewPassword(user, "NoDigit!"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("digits");
        assertThatThrownBy(
                        () ->
                                serviceWithPolicy(
                                                new ApplicationProperties.PasswordPolicy(
                                                        1, 128, 0, 0, 0, 1, false, false, false, 0,
                                                        0, ""))
                                        .validateForNewPassword(user, "NoSpecial1"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("special");
        assertThatThrownBy(
                        () ->
                                serviceWithPolicy(
                                                new ApplicationProperties.PasswordPolicy(
                                                        12, 4, 0, 0, 0, 0, false, false, false, 0,
                                                        0, ""))
                                        .validateForNewPassword(user, "short"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("length");
    }

    @Test
    void rejectsRecentPasswordFromHistory() {
        when(applicationProperties.security()).thenReturn(security());
        when(historyRepository.findByUserIdOrderByCreatedAtDesc(7L))
                .thenReturn(List.of(history("old-hash")));
        when(passwordEncoder.matches("StrongPassword1!", "current-hash")).thenReturn(false);
        when(passwordEncoder.matches("StrongPassword1!", "old-hash")).thenReturn(true);

        assertThatThrownBy(() -> service().validateForNewPassword(user(), "StrongPassword1!"))
                .isInstanceOf(ApiException.class)
                .hasMessage("Password was recently used");
    }

    @Test
    void rejectsUsernameEmailCommonAndCurrentPasswords() {
        ApplicationProperties.PasswordPolicy policy =
                new ApplicationProperties.PasswordPolicy(
                        1, 128, 0, 0, 0, 0, true, true, true, 0, 0, "password");
        when(applicationProperties.security())
                .thenReturn(
                        new ApplicationProperties.Security(
                                policy, new ApplicationProperties.BruteForce()));
        UserEntity user = user();

        assertThatThrownBy(() -> service().validateForNewPassword(user, "alice"))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service().validateForNewPassword(user, "alice@example.test"))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service().validateForNewPassword(user, "password"))
                .isInstanceOf(ApiException.class);

        when(passwordEncoder.matches("DifferentPassword", "current-hash")).thenReturn(true);
        assertThatThrownBy(() -> service().validateForNewPassword(user, "DifferentPassword"))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void acceptsPolicyWithoutCurrentPasswordOrHistoryAndReportsUnexpiredPassword() {
        ApplicationProperties.PasswordPolicy policy =
                new ApplicationProperties.PasswordPolicy(
                        1, 128, 0, 0, 0, 0, false, false, false, 0, 0, "");
        when(applicationProperties.security())
                .thenReturn(
                        new ApplicationProperties.Security(
                                policy, new ApplicationProperties.BruteForce()));
        UserEntity user = user();
        user.setPasswordChangedAt(Instant.now());

        service().validate(user, "ok");
        service().recordChange(user, null);

        org.assertj.core.api.Assertions.assertThat(service().isExpired(user)).isFalse();
    }

    @Test
    void detectsExpiredPasswordsAndTrimsHistory() {
        ApplicationProperties.PasswordPolicy policy =
                new ApplicationProperties.PasswordPolicy(
                        12, 128, 1, 1, 1, 1, true, true, true, 1, 90, "password");
        when(applicationProperties.security())
                .thenReturn(
                        new ApplicationProperties.Security(
                                policy, new ApplicationProperties.BruteForce()));
        when(historyRepository.findByUserIdOrderByCreatedAtDesc(7L))
                .thenReturn(List.of(history("one"), history("two")));

        UserEntity user = user();
        user.setPasswordChangedAt(Instant.now().minus(91, ChronoUnit.DAYS));

        service().recordChange(user, "new-hash");

        verify(historyRepository).save(any(PasswordHistoryEntity.class));
        verify(historyRepository).deleteAll(any());
        org.assertj.core.api.Assertions.assertThat(service().isExpired(user)).isTrue();
    }

    @Test
    void coversNullCredentialsHistoryBoundariesAndMissingPasswordTimestamp() {
        ApplicationProperties.PasswordPolicy policy =
                new ApplicationProperties.PasswordPolicy(
                        1, 128, 0, 0, 0, 0, true, true, false, 0, 90, "");
        when(applicationProperties.security())
                .thenReturn(
                        new ApplicationProperties.Security(
                                policy, new ApplicationProperties.BruteForce()));
        UserEntity user = user();
        user.setId(null);
        user.setEmail(null);
        user.setPassword(null);

        service().validate(user, "valid-password");
        service().recordChange(user, "previous-hash");
        verify(historyRepository).findByUserIdOrderByCreatedAtDesc(null);
        org.assertj.core.api.Assertions.assertThat(service().isExpired(user)).isTrue();

        ApplicationProperties.PasswordPolicy noExpiry =
                new ApplicationProperties.PasswordPolicy(
                        1, 128, 0, 0, 0, 0, false, false, false, 0, 0, "");
        serviceWithPolicy(noExpiry).isExpired(user);
    }

    private PasswordPolicyService service() {
        return new PasswordPolicyService(
                historyRepository,
                passwordEncoder,
                applicationProperties,
                Mappers.getMapper(PasswordHistoryMapper.class),
                null);
    }

    private PasswordPolicyService serviceWithPolicy(ApplicationProperties.PasswordPolicy policy) {
        when(applicationProperties.security())
                .thenReturn(
                        new ApplicationProperties.Security(
                                policy, new ApplicationProperties.BruteForce()));
        return service();
    }

    private static ApplicationProperties.Security security() {
        return new ApplicationProperties.Security(
                new ApplicationProperties.PasswordPolicy(), new ApplicationProperties.BruteForce());
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.setEmail("alice@example.test");
        user.setPassword("current-hash");
        return user;
    }

    private static PasswordHistoryEntity history(String hash) {
        PasswordHistoryEntity history = new PasswordHistoryEntity();
        history.setPasswordHash(hash);
        return history;
    }
}
