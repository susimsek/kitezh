package io.github.susimsek.kitezh.service.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.AuthorizationConsentRepository;
import io.github.susimsek.kitezh.repository.UserActionTokenRepository;
import io.github.susimsek.kitezh.repository.UserAvatarRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.UserAccessInvalidationService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class AccountDeletionServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AuthorizationConsentRepository authorizationConsentRepository;
    @Mock private UserActionTokenRepository userActionTokenRepository;
    @Mock private UserAvatarRepository userAvatarRepository;
    @Mock private UserAccessInvalidationService userAccessInvalidationService;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AdminAuditEventService auditEventService;

    @Test
    void deletesTheAccountAndItsAccessDataAfterPasswordConfirmation() {
        UserEntity user = user();
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("password-123", "encoded-password")).thenReturn(true);
        when(userAvatarRepository.findById(7L)).thenReturn(Optional.empty());

        service().deleteAccount("alice", "password-123");

        verify(userAccessInvalidationService).invalidate("alice");
        verify(authorizationConsentRepository).deleteByIdPrincipalName("alice");
        verify(userActionTokenRepository).deleteByUserId(7L);
        verify(userAvatarRepository).findById(7L);
        verify(userRepository).delete(user);
        verify(auditEventService).record("user.account.deleted", "user", "7");
        assertThat(user.getAuthorities()).isEmpty();
        assertThat(user.getGroups()).isEmpty();
    }

    @Test
    void rejectsDeletionWhenThePasswordIsIncorrect() {
        UserEntity user = user();
        when(userRepository.findByUsername("alice")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong", "encoded-password")).thenReturn(false);

        assertThatThrownBy(() -> service().deleteAccount("alice", "wrong"))
                .isInstanceOf(ApiException.class)
                .extracting(exception -> ((ApiException) exception).getErrorCode())
                .isEqualTo(ApiErrorCode.INVALID_CURRENT_PASSWORD);
        verify(userRepository, never()).delete(user);
        verify(userAccessInvalidationService, never()).invalidate("alice");
    }

    private AccountDeletionService service() {
        return new AccountDeletionService(
                userRepository,
                authorizationConsentRepository,
                userActionTokenRepository,
                userAvatarRepository,
                userAccessInvalidationService,
                passwordEncoder,
                auditEventService);
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("alice");
        user.setPassword("encoded-password");
        user.setAuthorities(Set.of(new AuthorityEntity()));
        user.setGroups(Set.of(new GroupEntity()));
        return user;
    }
}
