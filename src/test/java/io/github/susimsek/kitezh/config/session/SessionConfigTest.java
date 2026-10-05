package io.github.susimsek.kitezh.config.session;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.config.security.SecurityJsonMapper;
import io.github.susimsek.kitezh.domain.UserSessionEntity;
import io.github.susimsek.kitezh.repository.UserSessionRepository;
import io.github.susimsek.kitezh.session.JpaIndexedSessionRepository;
import io.github.susimsek.kitezh.session.JpaSession;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.boot.session.autoconfigure.SessionProperties;
import org.springframework.core.convert.ConversionService;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.FactorGrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextImpl;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2UserAuthority;
import org.springframework.security.web.savedrequest.DefaultSavedRequest;
import org.springframework.security.web.webauthn.api.AuthenticatorSelectionCriteria;
import org.springframework.security.web.webauthn.api.Bytes;
import org.springframework.security.web.webauthn.api.ImmutablePublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialCreationOptions;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialRpEntity;
import org.springframework.security.web.webauthn.api.PublicKeyCredentialUserEntity;
import org.springframework.security.web.webauthn.api.ResidentKeyRequirement;
import org.springframework.security.web.webauthn.api.UserVerificationRequirement;
import org.springframework.session.MapSession;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;

class SessionConfigTest {

    private final SessionConfig config = new SessionConfig();

    @Test
    void springSessionConversionServiceRoundTripsJsonCompatiblePayloads() {
        ConversionService conversionService =
                config.springSessionConversionService(
                        new SecurityJsonMapper(getClass().getClassLoader()));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("username", "admin");
        payload.put("enabled", true);

        byte[] serialized = conversionService.convert(payload, byte[].class);
        Object deserialized = conversionService.convert(serialized, Object.class);

        assertThat(serialized).isNotEmpty();
        assertThat(deserialized)
                .isInstanceOf(Map.class)
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("username", "admin")
                .containsEntry("enabled", true);
    }

    @Test
    void springSessionConversionServiceRoundTripsImmutableMapPayloads() {
        ConversionService conversionService =
                config.springSessionConversionService(
                        new SecurityJsonMapper(getClass().getClassLoader()));

        byte[] serialized =
                conversionService.convert(
                        Map.of("username", "user", "provider", "github"), byte[].class);
        Object deserialized = conversionService.convert(serialized, Object.class);

        assertThat(deserialized)
                .isInstanceOf(Map.class)
                .asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.MAP)
                .containsEntry("username", "user")
                .containsEntry("provider", "github");
    }

    @Test
    void springSessionConversionServiceRoundTripsSavedRequest() {
        ConversionService conversionService =
                config.springSessionConversionService(
                        new SecurityJsonMapper(getClass().getClassLoader()));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/account/");
        request.setCookies(new Cookie("locale", "tr"));
        request.setServerName("localhost");
        request.setServerPort(9090);
        DefaultSavedRequest savedRequest = new DefaultSavedRequest(request);

        byte[] serialized = conversionService.convert(savedRequest, byte[].class);
        Object deserialized = conversionService.convert(serialized, Object.class);

        assertThat(deserialized)
                .isInstanceOf(DefaultSavedRequest.class)
                .extracting(value -> ((DefaultSavedRequest) value).getRedirectUrl())
                .isEqualTo("http://localhost:9090/account/");
    }

    @Test
    void springSessionConversionServiceRoundTripsOAuth2AuthorizationRequest() {
        ConversionService conversionService =
                config.springSessionConversionService(
                        new SecurityJsonMapper(getClass().getClassLoader()));
        OAuth2AuthorizationRequest authorizationRequest =
                OAuth2AuthorizationRequest.authorizationCode()
                        .authorizationUri("https://github.com/login/oauth/authorize")
                        .clientId("github-client")
                        .redirectUri("http://localhost:9090/login/oauth2/code/github")
                        .scopes(java.util.Set.of("read:user", "user:email"))
                        .state("state-value")
                        .attributes(
                                Map.of(
                                        org.springframework.security.oauth2.core.endpoint
                                                .OAuth2ParameterNames.REGISTRATION_ID,
                                        "github"))
                        .build();

        byte[] serialized = conversionService.convert(authorizationRequest, byte[].class);
        Object deserialized = conversionService.convert(serialized, Object.class);

        assertThat(deserialized).isEqualTo(authorizationRequest);
    }

    @Test
    void springSessionConversionServiceRoundTripsOAuth2Authentication() {
        ConversionService conversionService =
                config.springSessionConversionService(
                        new SecurityJsonMapper(getClass().getClassLoader()));
        DefaultOAuth2User user =
                new DefaultOAuth2User(
                        List.of(new OAuth2UserAuthority(Map.of("id", 123L, "login", "octocat"))),
                        Map.of("id", 123L, "login", "octocat"),
                        "id");
        OAuth2AuthenticationToken authentication =
                new OAuth2AuthenticationToken(user, user.getAuthorities(), "github");

        byte[] serialized = conversionService.convert(authentication, byte[].class);
        Object deserialized = conversionService.convert(serialized, Object.class);

        assertThat(deserialized).isEqualTo(authentication);
    }

    @Test
    void springSessionConversionServiceRoundTripsAuthenticatedSecurityContext() {
        ConversionService conversionService =
                config.springSessionConversionService(
                        new SecurityJsonMapper(getClass().getClassLoader()));
        UserDetails principal =
                org.springframework.security.core.userdetails.User.withUsername("admin")
                        .password("password")
                        .roles("ADMIN")
                        .build();
        UsernamePasswordAuthenticationToken authentication =
                UsernamePasswordAuthenticationToken.authenticated(
                        principal,
                        "password",
                        List.of(
                                new SimpleGrantedAuthority("ROLE_ADMIN"),
                                FactorGrantedAuthority.fromFactor("PASSWORD")));
        SecurityContextImpl securityContext = new SecurityContextImpl(authentication);

        byte[] serialized = conversionService.convert(securityContext, byte[].class);
        SecurityContextImpl deserialized =
                (SecurityContextImpl) conversionService.convert(serialized, Object.class);

        assertThat(deserialized.getAuthentication().getName()).isEqualTo("admin");
        assertThat(deserialized.getAuthentication().getAuthorities())
                .extracting(GrantedAuthority::getAuthority)
                .contains("ROLE_ADMIN", "FACTOR_PASSWORD");
    }

    @Test
    void springSessionConversionServiceRoundTripsWebauthnCreationOptions() {
        ConversionService conversionService =
                config.springSessionConversionService(
                        new SecurityJsonMapper(getClass().getClassLoader()));
        PublicKeyCredentialUserEntity user =
                ImmutablePublicKeyCredentialUserEntity.builder()
                        .name("admin")
                        .id(new Bytes(new byte[] {1, 2, 3}))
                        .displayName("Admin")
                        .build();
        PublicKeyCredentialCreationOptions options =
                PublicKeyCredentialCreationOptions.builder()
                        .rp(
                                PublicKeyCredentialRpEntity.builder()
                                        .id("localhost")
                                        .name("Sample")
                                        .build())
                        .user(user)
                        .challenge(new Bytes(new byte[] {4, 5, 6}))
                        .pubKeyCredParams(
                                List.of(
                                        org.springframework.security.web.webauthn.api
                                                .PublicKeyCredentialParameters.RS256))
                        .authenticatorSelection(
                                AuthenticatorSelectionCriteria.builder()
                                        .residentKey(ResidentKeyRequirement.REQUIRED)
                                        .userVerification(UserVerificationRequirement.REQUIRED)
                                        .build())
                        .build();

        byte[] serialized = conversionService.convert(options, byte[].class);
        Object deserialized = conversionService.convert(serialized, Object.class);

        assertThat(deserialized).isInstanceOf(PublicKeyCredentialCreationOptions.class);
        assertThat(((PublicKeyCredentialCreationOptions) deserialized).getRp().getId())
                .isEqualTo("localhost");
        assertThat(((PublicKeyCredentialCreationOptions) deserialized).getChallenge())
                .isEqualTo(options.getChallenge());
    }

    @Test
    void springSessionConversionServiceRoundTripsWebauthnRequestOptions() {
        ConversionService conversionService =
                config.springSessionConversionService(
                        new SecurityJsonMapper(getClass().getClassLoader()));
        var options =
                org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions
                        .builder()
                        .challenge(new Bytes(new byte[] {7, 8, 9}))
                        .timeout(Duration.ofMinutes(5))
                        .rpId("localhost")
                        .allowCredentials(List.of())
                        .userVerification(UserVerificationRequirement.REQUIRED)
                        .build();

        byte[] serialized = conversionService.convert(options, byte[].class);
        Object deserialized = conversionService.convert(serialized, Object.class);

        assertThat(deserialized)
                .isInstanceOf(
                        org.springframework.security.web.webauthn.api
                                .PublicKeyCredentialRequestOptions.class);
        var restored =
                (org.springframework.security.web.webauthn.api.PublicKeyCredentialRequestOptions)
                        deserialized;
        assertThat(restored.getRpId()).isEqualTo("localhost");
        assertThat(restored.getChallenge()).isEqualTo(options.getChallenge());
    }

    @Test
    void sessionRepositoryUsesProvidedConversionService() {
        ConversionService conversionService =
                config.springSessionConversionService(
                        new SecurityJsonMapper(getClass().getClassLoader()));
        UserSessionRepository userSessionRepository = mock(UserSessionRepository.class);
        InMemorySessionStore store = new InMemorySessionStore();
        when(userSessionRepository.findBySessionId(anyString()))
                .thenAnswer(invocation -> store.findBySessionId(invocation.getArgument(0)));
        when(userSessionRepository.findAllByPrincipalNameAndExpiryTimeAfter(anyString(), anyLong()))
                .thenAnswer(
                        invocation ->
                                store.findAllByPrincipalNameAndExpiryTimeAfter(
                                        invocation.getArgument(0), invocation.getArgument(1)));
        when(userSessionRepository.save(any(UserSessionEntity.class)))
                .thenAnswer(invocation -> store.save(invocation.getArgument(0)));
        when(userSessionRepository.deleteBySessionId(anyString()))
                .thenAnswer(invocation -> store.deleteBySessionId(invocation.getArgument(0)));
        when(userSessionRepository.deleteExpiredSessions(anyLong()))
                .thenAnswer(invocation -> store.deleteExpiredSessions(invocation.getArgument(0)));

        JpaIndexedSessionRepository repository =
                config.sessionRepository(
                        userSessionRepository,
                        new NoOpTransactionManager(),
                        config.jpaSessionMapper(conversionService));
        JpaSession session = repository.createSession();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tenant", "internal");
        payload.put("count", 2);
        session.setAttribute("payload", payload);

        repository.save(session);

        assertThat(
                        repository
                                .findById(session.getId())
                                .<Map<String, Object>>getAttribute("payload"))
                .containsEntry("tenant", "internal")
                .containsEntry("count", 2);
    }

    @Test
    void sessionCleanupSchedulerAppliesConfiguredTimeout() {
        JpaIndexedSessionRepository repository =
                new JpaIndexedSessionRepository(
                        mock(UserSessionRepository.class),
                        new NoOpTransactionManager(),
                        config.jpaSessionMapper(
                                config.springSessionConversionService(
                                        new SecurityJsonMapper(getClass().getClassLoader()))));
        SessionProperties sessionProperties = new SessionProperties();
        sessionProperties.setTimeout(Duration.ofMinutes(5));

        SessionCleanupScheduler scheduler =
                config.sessionCleanupScheduler(
                        repository,
                        mock(TaskScheduler.class),
                        sessionProperties,
                        new ApplicationProperties(
                                new ApplicationProperties.Cache(
                                        new ApplicationProperties.Caffeine(
                                                Duration.ofHours(1), 500, 1000, Map.of())),
                                new ApplicationProperties.Session("-"),
                                new ApplicationProperties.AuthorizationServer(
                                        "http://127.0.0.1:9090"),
                                new ApplicationProperties.Mail(
                                        false, "no-reply@localhost", "http://127.0.0.1:9090")));

        assertThat(repository.createSession().getMaxInactiveInterval())
                .isEqualTo(Duration.ofMinutes(5));
        assertThat(scheduler).isNotNull();
    }

    @Test
    void sessionCleanupSchedulerFallsBackToDefaultTimeoutWhenUnset() {
        JpaIndexedSessionRepository repository =
                new JpaIndexedSessionRepository(
                        mock(UserSessionRepository.class),
                        new NoOpTransactionManager(),
                        config.jpaSessionMapper(
                                config.springSessionConversionService(
                                        new SecurityJsonMapper(getClass().getClassLoader()))));

        config.sessionCleanupScheduler(
                repository,
                mock(TaskScheduler.class),
                new SessionProperties(),
                new ApplicationProperties(
                        new ApplicationProperties.Cache(
                                new ApplicationProperties.Caffeine(
                                        Duration.ofHours(1), 500, 1000, Map.of())),
                        new ApplicationProperties.Session("-"),
                        new ApplicationProperties.AuthorizationServer("http://127.0.0.1:9090"),
                        new ApplicationProperties.Mail(
                                false, "no-reply@localhost", "http://127.0.0.1:9090")));

        assertThat(repository.createSession().getMaxInactiveInterval())
                .isEqualTo(MapSession.DEFAULT_MAX_INACTIVE_INTERVAL);
    }

    private static final class NoOpTransactionManager implements PlatformTransactionManager {

        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {
            // The test transaction manager does not persist anything.
        }

        @Override
        public void rollback(TransactionStatus status) {
            // The test transaction manager does not persist anything.
        }
    }

    private static final class InMemorySessionStore {

        private final Map<String, UserSessionEntity> bySessionId = new LinkedHashMap<>();

        private Optional<UserSessionEntity> findBySessionId(String sessionId) {
            return Optional.ofNullable(bySessionId.get(sessionId)).map(this::copyOf);
        }

        private List<UserSessionEntity> findAllByPrincipalNameAndExpiryTimeAfter(
                String principalName, long expiryTime) {
            return bySessionId.values().stream()
                    .filter(entity -> principalName.equals(entity.getPrincipalName()))
                    .filter(entity -> entity.getExpiryTime() > expiryTime)
                    .map(this::copyOf)
                    .toList();
        }

        private UserSessionEntity save(UserSessionEntity entity) {
            UserSessionEntity copy = copyOf(entity);
            bySessionId.put(copy.getSessionId(), copy);
            return copyOf(copy);
        }

        private int deleteBySessionId(String sessionId) {
            return bySessionId.remove(sessionId) == null ? 0 : 1;
        }

        private int deleteExpiredSessions(long expiryTime) {
            List<String> expiredIds =
                    bySessionId.values().stream()
                            .filter(entity -> entity.getExpiryTime() < expiryTime)
                            .map(UserSessionEntity::getSessionId)
                            .toList();
            expiredIds.forEach(bySessionId::remove);
            return expiredIds.size();
        }

        private UserSessionEntity copyOf(UserSessionEntity entity) {
            UserSessionEntity copy = new UserSessionEntity();
            copy.setPrimaryId(entity.getPrimaryId());
            copy.setSessionId(entity.getSessionId());
            copy.setCreationTime(entity.getCreationTime());
            copy.setLastAccessTime(entity.getLastAccessTime());
            copy.setMaxInactiveInterval(entity.getMaxInactiveInterval());
            copy.setExpiryTime(entity.getExpiryTime());
            copy.setPrincipalName(entity.getPrincipalName());
            Map<String, byte[]> attributes = new LinkedHashMap<>();
            entity.getAttributes().forEach((key, value) -> attributes.put(key, value.clone()));
            copy.setAttributes(attributes);
            return copy;
        }
    }
}
