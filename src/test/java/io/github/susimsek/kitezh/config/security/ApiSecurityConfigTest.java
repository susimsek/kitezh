package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.service.AuthorizationRevocationPolicyService;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.mock.web.MockServletContext;
import org.springframework.security.config.ObjectPostProcessor;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

class ApiSecurityConfigTest {

    private static final ObjectPostProcessor<Object> NO_OP_POST_PROCESSOR =
            new ObjectPostProcessor<>() {
                @Override
                public <O> O postProcess(O object) {
                    return object;
                }
            };

    @Test
    void buildsAdminApiSecurityChainAndMapsScopesAndRoles() {
        AdminApiSecurityConfig config = new AdminApiSecurityConfig();
        JwtDecoder decoder =
                config.adminApiJwtDecoder(
                        mock(),
                        new ApplicationProperties(),
                        mock(AuthorizationRepository.class),
                        mock(AuthorizationRevocationPolicyService.class));

        SecurityFilterChain chain = config.adminApiSecurityFilterChain(httpSecurity(), decoder);

        assertThat(chain).isNotNull();
        JwtAuthenticationConverter converter =
                org.springframework.test.util.ReflectionTestUtils.invokeMethod(
                        AdminApiSecurityConfig.class, "jwtAuthenticationConverter");
        Jwt jwt =
                Jwt.withTokenValue("token")
                        .header("alg", "none")
                        .claim("scope", "admin-api profile")
                        .claim("roles", List.of("ROLE_ADMIN", "ROLE_USER"))
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(60))
                        .build();

        assertThat(converter.convert(jwt).getAuthorities())
                .extracting(Object::toString)
                .contains("SCOPE_admin-api", "SCOPE_profile", "ROLE_ADMIN", "ROLE_USER");
    }

    @Test
    void buildsAccountApiSecurityChainAndCreatesDecoder() {
        AccountApiSecurityConfig config = new AccountApiSecurityConfig();
        JwtDecoder decoder =
                config.accountApiJwtDecoder(
                        mock(),
                        new ApplicationProperties(),
                        mock(AuthorizationRepository.class),
                        mock(AuthorizationRevocationPolicyService.class));

        assertThat(decoder).isNotNull();
        assertThat(config.accountApiSecurityFilterChain(httpSecurity(), decoder)).isNotNull();
    }

    private static HttpSecurity httpSecurity() {
        HttpSecurity httpSecurity =
                new HttpSecurity(
                        NO_OP_POST_PROCESSOR,
                        new AuthenticationManagerBuilder(NO_OP_POST_PROCESSOR),
                        new HashMap<>());
        StaticApplicationContext applicationContext = new StaticApplicationContext();
        applicationContext
                .getBeanFactory()
                .registerSingleton("pathPatternBuilder", PathPatternRequestMatcher.withDefaults());
        httpSecurity.setSharedObject(ApplicationContext.class, applicationContext);
        httpSecurity.setSharedObject(
                jakarta.servlet.ServletContext.class, new MockServletContext());
        return httpSecurity;
    }
}
