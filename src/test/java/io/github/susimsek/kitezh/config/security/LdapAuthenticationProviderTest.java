package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.LdapFederationIdentityEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.LdapFederationIdentityRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.LdapAuthenticationService;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.FactorGrantedAuthority;

class LdapAuthenticationProviderTest {

    @Test
    void returnsNullForUnsupportedAuthenticationTypes() {
        LdapAuthenticationProvider provider = provider(mock(LdapAuthenticationService.class));

        assertThat(provider.authenticate(mock(Authentication.class))).isNull();
    }

    @Test
    void supportsUsernamePasswordAuthentication() {
        LdapAuthenticationProvider provider = provider(mock(LdapAuthenticationService.class));

        assertThat(provider.supports(UsernamePasswordAuthenticationToken.class)).isTrue();
        assertThat(provider.supports(Authentication.class)).isFalse();
    }

    @Test
    void doesNotDelegateARegularLocalUserToLdap() {
        LdapAuthenticationService authenticationService = mock(LdapAuthenticationService.class);
        UserRepository userRepository = mock(UserRepository.class);
        UserEntity localUser = new UserEntity();
        localUser.setUsername("local-user");
        when(userRepository.findForAuthenticationByIdentifier("local-user"))
                .thenReturn(Optional.of(localUser));
        LdapAuthenticationProvider provider =
                new LdapAuthenticationProvider(
                        authenticationService,
                        userRepository,
                        mock(LdapFederationIdentityRepository.class));

        assertThat(provider.authenticate(token("local-user"))).isNull();
        verify(authenticationService, never()).authenticate("local-user", "password");
    }

    @Test
    void returnsNullWhenLdapDoesNotFindTheUser() {
        LdapAuthenticationService authenticationService = mock(LdapAuthenticationService.class);
        when(authenticationService.authenticate("ldap-user", "password")).thenReturn(null);
        LdapAuthenticationProvider provider = provider(authenticationService);

        assertThat(provider.authenticate(token("ldap-user"))).isNull();
    }

    @Test
    void recognizesFederatedUsersByTheirIdentity() {
        UserRepository userRepository = mock(UserRepository.class);
        LdapFederationIdentityRepository identityRepository =
                mock(LdapFederationIdentityRepository.class);
        UserEntity user = new UserEntity();
        user.setUsername("ldap-user");
        when(userRepository.findForAuthenticationByIdentifier("ldap-user"))
                .thenReturn(Optional.of(user));
        when(identityRepository.findByUserUsername("ldap-user"))
                .thenReturn(Optional.of(mock(LdapFederationIdentityEntity.class)));
        LdapAuthenticationProvider provider =
                new LdapAuthenticationProvider(
                        mock(LdapAuthenticationService.class), userRepository, identityRepository);

        assertThat(provider.isFederatedUser("ldap-user")).isTrue();
        when(identityRepository.findByUserUsername("ldap-user")).thenReturn(Optional.empty());
        assertThat(provider.isFederatedUser("ldap-user")).isFalse();
        when(userRepository.findForAuthenticationByIdentifier("missing-user"))
                .thenReturn(Optional.empty());
        assertThat(provider.isFederatedUser("missing-user")).isFalse();
    }

    @Test
    void delegatesAPreviouslyImportedFederatedUserToLdap() {
        UserRepository userRepository = mock(UserRepository.class);
        LdapFederationIdentityRepository identityRepository =
                mock(LdapFederationIdentityRepository.class);
        UserEntity localUser = new UserEntity();
        localUser.setUsername("ldap-user");
        when(userRepository.findForAuthenticationByIdentifier("ldap-user"))
                .thenReturn(Optional.of(localUser));
        when(identityRepository.findByUserUsername("ldap-user"))
                .thenReturn(Optional.of(mock(LdapFederationIdentityEntity.class)));
        LdapAuthenticationService authenticationService = mock(LdapAuthenticationService.class);
        when(authenticationService.authenticate("ldap-user", "password")).thenReturn(localUser);

        Authentication authentication =
                new LdapAuthenticationProvider(
                                authenticationService, userRepository, identityRepository)
                        .authenticate(token("ldap-user"));

        assertThat(authentication).isNotNull();
        verify(authenticationService).authenticate("ldap-user", "password");
    }

    @Test
    void marksLdapAuthenticationAsPasswordFactor() {
        UserEntity user = new UserEntity();
        user.setUsername("ldap-user");
        AuthorityEntity authority = new AuthorityEntity();
        authority.setName("ROLE_USER");
        user.setAuthorities(Set.of(authority));
        LdapAuthenticationService authenticationService = mock(LdapAuthenticationService.class);
        UserRepository userRepository = mock(UserRepository.class);
        when(userRepository.findForAuthenticationByIdentifier("ldap-user"))
                .thenReturn(Optional.empty());
        when(authenticationService.authenticate("ldap-user", "ldap-password")).thenReturn(user);
        LdapFederationIdentityRepository identityRepository =
                mock(LdapFederationIdentityRepository.class);
        var authentication =
                new LdapAuthenticationProvider(
                                authenticationService, userRepository, identityRepository)
                        .authenticate(
                                UsernamePasswordAuthenticationToken.unauthenticated(
                                        "ldap-user", "ldap-password"));

        assertThat(authentication).isNotNull();
        assertThat(authentication.getAuthorities())
                .anySatisfy(
                        grantedAuthority ->
                                assertThat(grantedAuthority)
                                        .isInstanceOf(FactorGrantedAuthority.class)
                                        .extracting(
                                                value ->
                                                        ((FactorGrantedAuthority) value)
                                                                .getAuthority())
                                        .isEqualTo(FactorGrantedAuthority.PASSWORD_AUTHORITY));
        assertThat(authentication.getAuthorities())
                .filteredOn(FactorGrantedAuthority.class::isInstance)
                .allSatisfy(
                        grantedAuthority ->
                                assertThat(
                                                ((FactorGrantedAuthority) grantedAuthority)
                                                        .getIssuedAt())
                                        .isNotNull());
    }

    private static LdapAuthenticationProvider provider(
            LdapAuthenticationService authenticationService) {
        return new LdapAuthenticationProvider(
                authenticationService,
                mock(UserRepository.class),
                mock(LdapFederationIdentityRepository.class));
    }

    private static UsernamePasswordAuthenticationToken token(String username) {
        return UsernamePasswordAuthenticationToken.unauthenticated(username, "password");
    }
}
