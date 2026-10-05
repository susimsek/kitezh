package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.security.AccountLockService;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("java:S5778")
class DomainUserDetailsServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private AccountLockService accountLockService;

    @Test
    void loadsEnabledUser() {
        when(userRepository.findForAuthentication("admin"))
                .thenReturn(
                        Optional.of(
                                user(true, AuthoritiesConstants.ADMIN, AuthoritiesConstants.USER)));

        var userDetails = service().loadUserByUsername("admin");

        assertThat(userDetails.getUsername()).isEqualTo("admin");
        assertThat(userDetails.getPassword()).isEqualTo("hash");
        assertThat(userDetails.isEnabled()).isTrue();
        assertThat(userDetails.getAuthorities())
                .extracting(Object::toString)
                .containsExactlyInAnyOrder(AuthoritiesConstants.ADMIN, AuthoritiesConstants.USER);
    }

    @Test
    void loadsDisabledUser() {
        when(userRepository.findForAuthentication("admin"))
                .thenReturn(Optional.of(user(false, AuthoritiesConstants.ADMIN)));

        var userDetails = service().loadUserByUsername("admin");

        assertThat(userDetails.isEnabled()).isFalse();
    }

    @Test
    void inheritsAuthoritiesFromParentGroups() {
        GroupEntity parent = new GroupEntity();
        parent.setAuthorities(Set.of(new AuthorityEntity(1L, AuthoritiesConstants.ADMIN)));
        GroupEntity child = new GroupEntity();
        child.setParent(parent);
        UserEntity user = user(true, AuthoritiesConstants.USER);
        user.setGroups(Set.of(child));
        when(userRepository.findForAuthentication("admin")).thenReturn(Optional.of(user));

        var userDetails = service().loadUserByUsername("admin");

        assertThat(userDetails.getAuthorities())
                .extracting(Object::toString)
                .containsExactlyInAnyOrder(AuthoritiesConstants.ADMIN, AuthoritiesConstants.USER);
    }

    @Test
    void rejectsMissingUser() {
        when(userRepository.findForAuthentication("missing")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().loadUserByUsername("missing"))
                .isInstanceOf(UsernameNotFoundException.class)
                .hasMessage("Invalid username or password");
    }

    @Test
    void loadsByEmailAndDisablesUnverifiedLockedServiceAccounts() {
        LoginSettingsService loginSettingsService = mock(LoginSettingsService.class);
        UserEntity account = user(true, AuthoritiesConstants.USER);
        account.setEmail("admin@example.com");
        account.setEmailVerified(false);
        when(loginSettingsService.isLoginWithEmailEnabled()).thenReturn(true);
        when(loginSettingsService.isVerifyEmailEnabled()).thenReturn(true);
        when(userRepository.findForAuthenticationByIdentifier("admin@example.com"))
                .thenReturn(Optional.of(account));
        when(accountLockService.isLocked(any(UserEntity.class), any())).thenReturn(true);

        UserDetails userDetails =
                new DomainUserDetailsService(
                                userRepository, accountLockService, loginSettingsService)
                        .loadUserByUsername("admin@example.com");

        assertThat(userDetails)
                .extracting(UserDetails::isEnabled, UserDetails::isAccountNonLocked)
                .containsExactly(false, false);
    }

    @Test
    void keepsVerifiedEmailUserEnabledWhenNotLocked() {
        LoginSettingsService loginSettingsService = mock(LoginSettingsService.class);
        UserEntity account = user(true, AuthoritiesConstants.USER);
        account.setEmail("admin@example.com");
        account.setEmailVerified(true);
        when(loginSettingsService.isLoginWithEmailEnabled()).thenReturn(true);
        when(loginSettingsService.isVerifyEmailEnabled()).thenReturn(true);
        when(userRepository.findForAuthenticationByIdentifier("admin@example.com"))
                .thenReturn(Optional.of(account));
        when(accountLockService.isLocked(any(UserEntity.class), any())).thenReturn(false);

        UserDetails userDetails =
                new DomainUserDetailsService(
                                userRepository, accountLockService, loginSettingsService)
                        .loadUserByUsername("admin@example.com");

        assertThat(userDetails.isEnabled()).isTrue();
        assertThat(userDetails.isAccountNonLocked()).isTrue();
    }

    private DomainUserDetailsService service() {
        return new DomainUserDetailsService(userRepository, accountLockService, null);
    }

    private static UserEntity user(boolean enabled, String... authorities) {
        Set<AuthorityEntity> authoritySet = new HashSet<>();
        for (int i = 0; i < authorities.length; i++) {
            authoritySet.add(new AuthorityEntity((long) i + 1, authorities[i]));
        }
        return new UserEntity(1L, "admin", "hash", enabled, authoritySet);
    }
}
