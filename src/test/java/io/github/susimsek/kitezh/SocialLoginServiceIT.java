package io.github.susimsek.springauthserversamples;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.github.susimsek.springauthserversamples.domain.SocialIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.SocialProviderEntity;
import io.github.susimsek.springauthserversamples.domain.SocialProviderMapperEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.SocialIdentityRepository;
import io.github.susimsek.springauthserversamples.repository.SocialProviderMapperRepository;
import io.github.susimsek.springauthserversamples.repository.SocialProviderRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.service.SocialAccountLinkRequiredException;
import io.github.susimsek.springauthserversamples.service.SocialLoginService;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.test.context.TestPropertySource;

@IntegrationTest
@TestPropertySource(properties = "app.social-login.enabled=true")
class SocialLoginServiceIT {

    @Autowired private SocialLoginService socialLoginService;
    @Autowired private SocialIdentityRepository socialIdentityRepository;
    @Autowired private SocialProviderRepository socialProviderRepository;
    @Autowired private SocialProviderMapperRepository socialProviderMapperRepository;
    @Autowired private UserRepository userRepository;

    @Test
    void socialLoginPersistsSecureLinksClaimsAndProfileSynchronization() {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String registrationId = "social-it-" + suffix;
        String alias = "social-it-alias-" + suffix;
        SocialProviderEntity provider =
                socialProviderRepository.save(provider(registrationId, alias));
        SocialProviderMapperEntity mapper = socialProviderMapperRepository.save(mapper(alias));
        String subject = "subject-" + UUID.randomUUID();
        String email = "social-" + UUID.randomUUID() + "@example.test";
        String linkedSubject = "linked-subject-" + UUID.randomUUID();
        String collisionSubject = "collision-subject-" + UUID.randomUUID();
        UserEntity linkedUser = null;
        UserEntity collisionUser = null;
        String createdUsername = null;
        try {
            assertThat(socialLoginService.providerRequiresMfa(alias)).isTrue();
            assertThat(socialLoginService.availableProviders())
                    .extracting(providerView -> providerView.provider())
                    .contains(alias);

            createdUsername =
                    socialLoginService.findOrCreate(
                            authentication(
                                    registrationId, claims(subject, email, "Ada", "Operations")));

            UserEntity created = userRepository.findByUsername(createdUsername).orElseThrow();
            SocialIdentityEntity identity =
                    socialIdentityRepository
                            .findByProviderAndSubject(registrationId, subject)
                            .orElseThrow();
            assertThat(created.isEnabled()).isTrue();
            assertThat(created.isEmailVerified()).isTrue();
            assertThat(created.getFirstName()).isEqualTo("Operations");
            assertThat(identity.getUser().getId()).isEqualTo(created.getId());
            assertThat(identity.getMappedClaims())
                    .contains("\"id_token\"")
                    .contains("\"access_token\"")
                    .contains("\"firstName\":\"Operations\"");

            String repeatedUsername =
                    socialLoginService.findOrCreate(
                            authentication(
                                    registrationId,
                                    claims(subject, "updated-" + email, "Updated", "Platform")));
            UserEntity synchronizedUser =
                    userRepository.findByUsername(repeatedUsername).orElseThrow();
            assertThat(repeatedUsername).isEqualTo(createdUsername);
            assertThat(synchronizedUser.getFirstName()).isEqualTo("Platform");
            assertThat(synchronizedUser.getEmail()).isEqualTo("updated-" + email);
            assertThat(socialIdentityRepository.findAllByUserUsername(createdUsername)).hasSize(1);

            collisionUser =
                    userRepository.save(
                            new UserEntity(
                                    null,
                                    "collision-" + UUID.randomUUID(),
                                    "{noop}Local-password12!",
                                    true,
                                    Set.of()));
            collisionUser.setEmail("collision-" + UUID.randomUUID() + "@example.test");
            collisionUser = userRepository.save(collisionUser);
            String collisionEmail = collisionUser.getEmail();
            OAuth2AuthenticationToken collisionAuthentication =
                    authentication(
                            registrationId,
                            claims(collisionSubject, collisionEmail, "Collision", "Security"));
            assertThatThrownBy(() -> socialLoginService.findOrCreate(collisionAuthentication))
                    .isInstanceOf(SocialAccountLinkRequiredException.class)
                    .hasMessageContaining("authenticate locally to link");
            assertThat(
                            socialIdentityRepository.findByProviderAndSubject(
                                    registrationId, collisionSubject))
                    .isEmpty();

            linkedUser =
                    userRepository.save(
                            new UserEntity(
                                    null,
                                    "linked-" + UUID.randomUUID(),
                                    "{noop}Local-password12!",
                                    true,
                                    Set.of()));
            assertThat(
                            socialLoginService.linkExisting(
                                    linkedUser.getUsername(),
                                    alias,
                                    authentication(
                                            registrationId,
                                            claims(
                                                    linkedSubject,
                                                    "linked-" + email,
                                                    "Linked",
                                                    "Engineering"))))
                    .isEqualTo(linkedUser.getUsername());
            assertThat(
                            socialIdentityRepository
                                    .findByProviderAndSubject(registrationId, linkedSubject)
                                    .orElseThrow()
                                    .getUser()
                                    .getId())
                    .isEqualTo(linkedUser.getId());

            socialLoginService.unlink(linkedUser.getUsername(), alias);
            assertThat(
                            socialIdentityRepository.findByProviderAndSubject(
                                    registrationId, linkedSubject))
                    .isEmpty();

            OAuth2AuthenticationToken missingClaimAuthentication =
                    authentication(
                            registrationId, Map.of("sub", "missing-claim-" + UUID.randomUUID()));
            assertThatThrownBy(() -> socialLoginService.findOrCreate(missingClaimAuthentication))
                    .isInstanceOf(OAuth2AuthenticationException.class)
                    .hasMessageContaining("required claim: email");
        } finally {
            if (createdUsername != null) {
                socialIdentityRepository.deleteAll(
                        socialIdentityRepository.findAllByUserUsername(createdUsername));
                userRepository.findByUsername(createdUsername).ifPresent(userRepository::delete);
            }
            if (linkedUser != null) {
                socialIdentityRepository.deleteAll(
                        socialIdentityRepository.findAllByUserUsername(linkedUser.getUsername()));
                userRepository.deleteById(linkedUser.getId());
            }
            if (collisionUser != null) {
                socialIdentityRepository.deleteAll(
                        socialIdentityRepository.findAllByUserUsername(
                                collisionUser.getUsername()));
                userRepository.deleteById(collisionUser.getId());
            }
            socialProviderMapperRepository.deleteById(mapper.getId());
            socialProviderRepository.deleteById(provider.getId());
        }
    }

    private static SocialProviderEntity provider(String registrationId, String alias) {
        SocialProviderEntity provider = new SocialProviderEntity();
        provider.setRegistrationId(registrationId);
        provider.setProviderType("oidc");
        provider.setDisplayName("Integration provider");
        provider.setAlias(alias);
        provider.setEnabled(true);
        provider.setTrustEmail(true);
        provider.setMfaRequired(true);
        provider.setRequiredClaims("sub,email");
        provider.setSyncMode("force");
        return provider;
    }

    private static SocialProviderMapperEntity mapper(String alias) {
        SocialProviderMapperEntity mapper = new SocialProviderMapperEntity();
        mapper.setProviderAlias(alias);
        mapper.setName("department-to-first-name");
        mapper.setSourceClaim("department");
        mapper.setTarget("firstName");
        mapper.setMapperType("user-attribute");
        mapper.setSyncMode("inherit");
        mapper.setAddToIdToken(true);
        mapper.setAddToAccessToken(true);
        return mapper;
    }

    private static Map<String, Object> claims(
            String subject, String email, String givenName, String department) {
        return Map.of(
                "sub", subject,
                "email", email,
                "email_verified", true,
                "given_name", givenName,
                "department", department,
                "picture", "https://images.example.test/avatar.png");
    }

    private static OAuth2AuthenticationToken authentication(
            String registrationId, Map<String, Object> attributes) {
        OAuth2User principal =
                new DefaultOAuth2User(
                        Set.of(new SimpleGrantedAuthority("ROLE_OAUTH2_USER")), attributes, "sub");
        return new OAuth2AuthenticationToken(principal, principal.getAuthorities(), registrationId);
    }
}
