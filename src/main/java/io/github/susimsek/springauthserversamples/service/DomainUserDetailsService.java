package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.security.AccountLockService;
import io.github.susimsek.springauthserversamples.service.security.EffectiveRoleService;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DomainUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final AccountLockService accountLockService;
    private final LoginSettingsService loginSettingsService;

    @Transactional(readOnly = true)
    @Override
    public UserDetails loadUserByUsername(String username) {
        var query =
                loginSettingsService != null && loginSettingsService.isLoginWithEmailEnabled()
                        ? userRepository.findForAuthenticationByIdentifier(username)
                        : userRepository.findForAuthentication(username);
        return query.map(
                        user ->
                                User.withUsername(user.getUsername())
                                        .password(user.getPassword())
                                        .authorities(authorities(user))
                                        .disabled(
                                                user.isServiceAccount()
                                                        || !user.isEnabled()
                                                        || (loginSettingsService != null
                                                                && loginSettingsService
                                                                        .isVerifyEmailEnabled()
                                                                && user.getEmail() != null
                                                                && !user.isEmailVerified()))
                                        .accountLocked(
                                                accountLockService.isLocked(user, Instant.now()))
                                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("Invalid username or password"));
    }

    private static String[] authorities(UserEntity user) {
        return EffectiveRoleService.effectiveRoleNames(user).toArray(String[]::new);
    }
}
