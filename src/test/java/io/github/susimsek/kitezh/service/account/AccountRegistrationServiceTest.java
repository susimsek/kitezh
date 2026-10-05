package io.github.susimsek.kitezh.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.UserAction;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.mapper.AccountRegistrationMapper;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.EmailSettingsService;
import io.github.susimsek.kitezh.service.LoginSettingsService;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.service.security.PasswordService;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AccountRegistrationServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AuthorityRepository authorityRepository;
    @Mock private PasswordService passwordService;
    @Mock private UserActionService userActionService;
    @Mock private AdminAuditEventService auditEventService;
    @Mock private ApplicationProperties applicationProperties;
    @Mock private EmailSettingsService emailSettingsService;
    @Mock private LoginSettingsService loginSettingsService;

    @Test
    void registersAnEnabledUserWithTheDefaultRole() {
        AuthorityEntity userRole = new AuthorityEntity();
        userRole.setName(AuthoritiesConstants.USER);
        when(userRepository.findByUsername("alice")).thenReturn(Optional.empty());
        when(userRepository.existsByEmailIgnoreCase("alice@example.test")).thenReturn(false);
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(userRole));
        org.mockito.Mockito.doAnswer(
                        invocation -> {
                            invocation.<UserEntity>getArgument(0).setPassword("encoded-password");
                            return null;
                        })
                .when(passwordService)
                .setInitialPassword(any(UserEntity.class), org.mockito.Mockito.eq("password-123"));
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity user = invocation.getArgument(0);
                            user.setId(7L);
                            return user;
                        });
        when(applicationProperties.mail())
                .thenReturn(new ApplicationProperties.Mail(false, "", ""));

        service()
                .register(
                        " alice ",
                        " Ada ",
                        " Lovelace ",
                        " ALICE@EXAMPLE.TEST ",
                        "password-123",
                        "password-123",
                        Locale.ENGLISH);

        ArgumentCaptor<UserEntity> captor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(captor.capture());
        UserEntity saved = captor.getValue();
        assertThat(saved.getUsername()).isEqualTo("alice");
        assertThat(saved.getFirstName()).isEqualTo("Ada");
        assertThat(saved.getLastName()).isEqualTo("Lovelace");
        assertThat(saved.getEmail()).isEqualTo("alice@example.test");
        assertThat(saved.isEnabled()).isTrue();
        assertThat(saved.isEmailVerified()).isFalse();
        assertThat(saved.getPassword()).isEqualTo("encoded-password");
        assertThat(saved.getAuthorities()).containsExactly(userRole);
        verify(auditEventService).record("user.registered", "user", "7");
        verify(userActionService, never()).sendForCurrentUser(any(), any(), any());
    }

    @Test
    void rejectsInvalidRegistrationInputsAndDuplicates() {
        assertThatThrownBy(
                        () ->
                                service()
                                        .register(
                                                " ",
                                                "Ada",
                                                "Lovelace",
                                                "ada@example.test",
                                                "pw",
                                                "pw",
                                                Locale.ENGLISH))
                .isInstanceOf(ApiException.class);
        assertThatThrownBy(
                        () ->
                                service()
                                        .register(
                                                "alice",
                                                "Ada",
                                                "Lovelace",
                                                "ada@example.test",
                                                "pw",
                                                "different",
                                                Locale.ENGLISH))
                .isInstanceOf(ApiException.class);

        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(new UserEntity()));
        assertThatThrownBy(
                        () ->
                                service()
                                        .register(
                                                "alice",
                                                "Ada",
                                                "Lovelace",
                                                "ada@example.test",
                                                "pw",
                                                "pw",
                                                Locale.ENGLISH))
                .isInstanceOf(ApiException.class);

        when(userRepository.findByUsername("bob")).thenReturn(Optional.empty());
        when(userRepository.existsByEmailIgnoreCase("bob@example.test")).thenReturn(false);
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.empty());
        assertThatThrownBy(
                        () ->
                                service()
                                        .register(
                                                "bob",
                                                "Bob",
                                                "Builder",
                                                "bob@example.test",
                                                "password",
                                                "password",
                                                Locale.ENGLISH))
                .isInstanceOf(IllegalStateException.class);

        when(userRepository.findByUsername("duplicate-email")).thenReturn(Optional.empty());
        when(userRepository.existsByEmailIgnoreCase("duplicate@example.test")).thenReturn(true);
        assertThatThrownBy(
                        () ->
                                service()
                                        .register(
                                                "duplicate-email",
                                                "Duplicate",
                                                "Email",
                                                "duplicate@example.test",
                                                "password",
                                                "password",
                                                Locale.ENGLISH))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void sendsVerificationEmailWhenRegistrationMailIsEnabled() {
        AuthorityEntity userRole = new AuthorityEntity();
        userRole.setName(AuthoritiesConstants.USER);
        when(userRepository.findByUsername("bob")).thenReturn(Optional.empty());
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(userRole));
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity user = invocation.getArgument(0);
                            user.setId(8L);
                            return user;
                        });
        when(applicationProperties.mail()).thenReturn(new ApplicationProperties.Mail(true, "", ""));

        service().register(" bob ", null, null, " ", "password", "password", null);

        verify(userActionService)
                .sendForCurrentUser("bob", UserAction.VERIFY_EMAIL, Locale.ENGLISH);
    }

    @Test
    void respectsConfiguredEmailAndLoginSettingsWhenSendingVerificationEmail() {
        AuthorityEntity userRole = new AuthorityEntity();
        userRole.setName(AuthoritiesConstants.USER);
        when(userRepository.findByUsername("carol")).thenReturn(Optional.empty());
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(userRole));
        when(userRepository.save(any(UserEntity.class)))
                .thenAnswer(
                        invocation -> {
                            UserEntity user = invocation.getArgument(0);
                            user.setId(9L);
                            return user;
                        });
        when(emailSettingsService.current())
                .thenReturn(
                        new EmailSettingsService.EmailConfiguration(
                                true, "", "", "", 0, "", "", false, false, false));
        when(loginSettingsService.isVerifyEmailEnabled()).thenReturn(false);

        new AccountRegistrationService(
                        userRepository,
                        authorityRepository,
                        passwordService,
                        userActionService,
                        auditEventService,
                        applicationProperties,
                        emailSettingsService,
                        loginSettingsService,
                        Mappers.getMapper(AccountRegistrationMapper.class),
                        null)
                .register("carol", "Carol", "", null, "password", "password", Locale.ENGLISH);

        verify(userActionService, never()).sendForCurrentUser(any(), any(), any());
    }

    private AccountRegistrationService service() {
        return new AccountRegistrationService(
                userRepository,
                authorityRepository,
                passwordService,
                userActionService,
                auditEventService,
                applicationProperties,
                null,
                null,
                Mappers.getMapper(AccountRegistrationMapper.class),
                null);
    }
}
