package io.github.susimsek.kitezh.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.UserAction;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.AccountProfileDTO;
import io.github.susimsek.kitezh.dto.account.AccountProfileRequestDTO;
import io.github.susimsek.kitezh.mapper.AccountProfileMapper;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.LdapFederationWriteService;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.PasswordService;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AccountProfileServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AccountProfileMapper accountProfileMapper;
    @Mock private PasswordService passwordService;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @Mock private UserActionService userActionService;
    @Mock private LoginSettingsService loginSettingsService;
    @Mock private LdapFederationWriteService ldapFederationWriteService;

    @Test
    void normalizesAndUpdatesProfile() {
        UserEntity user = user();
        var request = new AccountProfileRequestDTO(" Alice ", " User ", " alice@example.test ");
        var expected =
                new AccountProfileDTO("alice", "Alice", "User", "alice@example.test", null, null);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(accountProfileMapper.normalize(request))
                .thenReturn(new AccountProfileRequestDTO("Alice", "User", "alice@example.test"));
        when(accountProfileMapper.toDTO(user)).thenReturn(expected);
        when(loginSettingsService.emailUpdateReauthenticationAge())
                .thenReturn(Duration.ofDays(365_000));

        assertThat(service().updateProfile("alice", request)).isEqualTo(expected);

        ArgumentCaptor<AccountProfileRequestDTO> normalized =
                ArgumentCaptor.forClass(AccountProfileRequestDTO.class);
        verify(accountProfileMapper)
                .updateNames(normalized.capture(), org.mockito.Mockito.same(user));
        assertThat(normalized.getValue())
                .isEqualTo(new AccountProfileRequestDTO("Alice", "User", "alice@example.test"));
        verify(auditEventService).record("account.profile.updated", "user", "7");
    }

    @Test
    void readsProfileAndDelegatesVerificationEmail() {
        UserEntity user = user();
        AccountProfileDTO profile =
                new AccountProfileDTO("alice", "Alice", "User", "alice@example.test", null, null);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(accountProfileMapper.toDTO(user)).thenReturn(profile);

        assertThat(service().profile("alice")).isEqualTo(profile);
        service().sendVerificationEmail("alice", java.util.Locale.of("tr"));

        verify(userActionService)
                .sendForCurrentUser("alice", UserAction.VERIFY_EMAIL, java.util.Locale.of("tr"));
    }

    @Test
    void changesPasswordAfterVerifyingCurrentPassword() {
        UserEntity user = user();
        user.setPassword("encoded-old");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordService.matchesCurrentPassword("old-password", user)).thenReturn(true);
        org.mockito.Mockito.doAnswer(
                        invocation -> {
                            user.setPassword("encoded-new");
                            return null;
                        })
                .when(passwordService)
                .changePassword(user, "new-password");

        service().changePassword("alice", "old-password", "new-password");

        assertThat(user.getPassword()).isEqualTo("encoded-new");
        verify(auditEventService).record("account.password.updated", "user", "7");
    }

    @Test
    void rejectsAnInvalidCurrentPassword() {
        UserEntity user = user();
        user.setPassword("encoded-old");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> service().changePassword("alice", "wrong", "new-password"))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.INVALID_CURRENT_PASSWORD);
    }

    @Test
    void requiresReauthenticationWhenEmailChangeAuthenticationIsStale() {
        UserEntity user = user();
        user.setEmail("old@example.test");
        var request = new AccountProfileRequestDTO("Alice", "User", "new@example.test");
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(accountProfileMapper.normalize(request)).thenReturn(request);
        when(loginSettingsService.emailUpdateReauthenticationAge())
                .thenReturn(Duration.ofMinutes(5));

        assertThatThrownBy(
                        () ->
                                serviceWithSettings()
                                        .updateProfile(
                                                "alice",
                                                request,
                                                Instant.now().minus(Duration.ofMinutes(6))))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.REAUTHENTICATION_REQUIRED);
    }

    @Test
    void acceptsCurrentPasswordForStaleEmailChange() {
        UserEntity user = user();
        user.setEmail("old@example.test");
        var request =
                new AccountProfileRequestDTO("Alice", "User", "new@example.test", "old-password");
        var expected =
                new AccountProfileDTO("alice", "Alice", "User", "old@example.test", null, null);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(accountProfileMapper.normalize(request)).thenReturn(request);
        when(loginSettingsService.emailUpdateReauthenticationAge())
                .thenReturn(Duration.ofMinutes(5));
        when(passwordService.matchesCurrentPassword("old-password", user)).thenReturn(true);
        when(accountProfileMapper.toDTO(user)).thenReturn(expected);

        assertThat(
                        serviceWithSettings()
                                .updateProfile(
                                        "alice",
                                        request,
                                        Instant.now().minus(Duration.ofMinutes(6))))
                .isEqualTo(expected);
        verify(userActionService)
                .executeActionsEmail(7L, UserAction.UPDATE_EMAIL, null, java.util.Locale.ENGLISH);
    }

    private AccountProfileService service() {
        return new AccountProfileService(
                userRepository,
                accountProfileMapper,
                passwordService,
                auditEventService,
                userAccessInvalidationService,
                userActionService,
                loginSettingsService,
                ldapFederationWriteService);
    }

    private AccountProfileService serviceWithSettings() {
        return new AccountProfileService(
                userRepository,
                accountProfileMapper,
                passwordService,
                auditEventService,
                userAccessInvalidationService,
                userActionService,
                loginSettingsService,
                ldapFederationWriteService);
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        return user;
    }
}
