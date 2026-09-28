package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.security.AccountLockService;
import io.github.susimsek.springauthserversamples.service.security.EffectiveRoleService;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DomainUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final AccountLockService accountLockService;
    private final LoginSettingsService loginSettingsService;

    @Autowired
    public DomainUserDetailsService(
            UserRepository userRepository,
            AccountLockService accountLockService,
            LoginSettingsService loginSettingsService) {
        this.userRepository = userRepository;
        this.accountLockService = accountLockService;
        this.loginSettingsService = loginSettingsService;
    }

    public DomainUserDetailsService(
            UserRepository userRepository, AccountLockService accountLockService) {
        this(userRepository, accountLockService, null);
    }

    @Transactional(readOnly = true)
    @Override
    public UserDetails loadUserByUsername(String username) {
        var query =
                loginSettingsService != null && loginSettingsService.isLoginWithEmailEnabled()
                        ? userRepository.findForAuthenticationByIdentifier(username)
                        : userRepository.findForAuthentication(username);
        return query.map(
                        user ->
                                user.isServiceAccount()
                                        ? throwServiceAccountLogin(user.getUsername())
                                        : User.withUsername(user.getUsername())
                                                .password(user.getPassword())
                                                .authorities(authorities(user))
                                                .disabled(
                                                        !user.isEnabled()
                                                                || (loginSettingsService != null
                                                                        && loginSettingsService
                                                                                .isVerifyEmailEnabled()
                                                                        && user.getEmail() != null
                                                                        && !user.isEmailVerified()))
                                                .accountLocked(
                                                        accountLockService.isLocked(
                                                                user, Instant.now()))
                                                .build())
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
    }

    private static UserDetails throwServiceAccountLogin(String username) {
        throw new UsernameNotFoundException("Service accounts cannot use form login: " + username);
    }

    private static String[] authorities(UserEntity user) {
        return EffectiveRoleService.effectiveRoleNames(user).toArray(String[]::new);
    }
}
