package io.github.susimsek.springauthserversamples.config.security;

import io.github.susimsek.springauthserversamples.repository.LdapFederationIdentityRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.LdapAuthenticationService;
import io.github.susimsek.springauthserversamples.service.security.EffectiveRoleService;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.FactorGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.stereotype.Component;

@Component
public class LdapAuthenticationProvider implements AuthenticationProvider {

    private final LdapAuthenticationService authenticationService;
    private final UserRepository userRepository;
    private final LdapFederationIdentityRepository identityRepository;

    public LdapAuthenticationProvider(
            LdapAuthenticationService authenticationService,
            UserRepository userRepository,
            LdapFederationIdentityRepository identityRepository) {
        this.authenticationService = authenticationService;
        this.userRepository = userRepository;
        this.identityRepository = identityRepository;
    }

    @Override
    public Authentication authenticate(Authentication authentication)
            throws AuthenticationException {
        if (!supports(authentication.getClass())) {
            return null;
        }
        String identifier = authentication.getName();
        if (userRepository.findForAuthenticationByIdentifier(identifier).isPresent()
                && !isFederatedUser(identifier)) {
            return null;
        }
        io.github.susimsek.springauthserversamples.domain.UserEntity user =
                authenticationService.authenticate(
                        identifier, String.valueOf(authentication.getCredentials()));
        if (user == null) {
            return null;
        }
        Set<GrantedAuthority> authorities =
                new HashSet<>(
                        EffectiveRoleService.effectiveRoleNames(user).stream()
                                .map(
                                        org.springframework.security.core.authority
                                                        .SimpleGrantedAuthority
                                                ::new)
                                .map(GrantedAuthority.class::cast)
                                .toList());
        authorities.add(
                FactorGrantedAuthority.withAuthority(FactorGrantedAuthority.PASSWORD_AUTHORITY)
                        .issuedAt(Instant.now())
                        .build());
        return UsernamePasswordAuthenticationToken.authenticated(
                User.withUsername(user.getUsername()).password("").authorities(authorities).build(),
                authentication.getCredentials(),
                authorities);
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }

    public boolean isFederatedUser(String username) {
        return userRepository
                .findForAuthenticationByIdentifier(username)
                .flatMap(user -> identityRepository.findByUserUsername(user.getUsername()))
                .isPresent();
    }
}
