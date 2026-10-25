package io.github.susimsek.kitezh.service.account;

import io.github.susimsek.kitezh.domain.PersonalAccessTokenEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenCreatedDTO;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenDTO;
import io.github.susimsek.kitezh.dto.account.PersonalAccessTokenRequestDTO;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.repository.PersonalAccessTokenRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import java.security.Principal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContext;
import org.springframework.security.oauth2.server.authorization.context.AuthorizationServerContextHolder;
import org.springframework.security.oauth2.server.authorization.settings.AuthorizationServerSettings;
import org.springframework.security.oauth2.server.authorization.token.DefaultOAuth2TokenContext;
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenGenerator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PersonalAccessTokenService {

    public static final String CLIENT_ID = "kitezh-mcp-personal-access-token";
    public static final String SCOPE = "mcp.read";
    public static final String GRANT_TYPE_VALUE = "urn:kitezh:grant-type:personal_access_token";
    private static final int MAX_TOKENS_PER_USER = 50;
    private static final AuthorizationGrantType GRANT_TYPE =
            new AuthorizationGrantType(GRANT_TYPE_VALUE);

    private final PersonalAccessTokenRepository personalAccessTokenRepository;
    private final UserRepository userRepository;
    private final AuthorizationRepository authorizationRepository;
    private final RegisteredClientRepository registeredClientRepository;
    private final OAuth2AuthorizationService authorizationService;
    private final OAuth2TokenGenerator<? extends OAuth2Token> tokenGenerator;
    private final UserDetailsService userDetailsService;
    private final AuthorizationServerSettings authorizationServerSettings;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public List<PersonalAccessTokenDTO> list(String username) {
        return personalAccessTokenRepository
                .findAllByUserUsernameOrderByCreatedAtDesc(username)
                .stream()
                .map(this::toDTO)
                .toList();
    }

    @Transactional
    public PersonalAccessTokenCreatedDTO create(
            String username, PersonalAccessTokenRequestDTO request) {
        Instant createdAt = Instant.now();
        Instant expiresAt = expirationAt(request, createdAt);
        return createToken(username, request.name(), request.description(), expiresAt, createdAt);
    }

    private PersonalAccessTokenCreatedDTO createToken(
            String username,
            String name,
            String description,
            Instant expiresAt,
            Instant createdAt) {
        if (personalAccessTokenRepository.countActiveByUsername(username, Instant.now())
                >= MAX_TOKENS_PER_USER) {
            throw ApiException.badRequest(
                    ApiErrorCode.INVALID_REQUEST, "The account has reached its token limit");
        }

        RegisteredClient client = registeredClientRepository.findByClientId(CLIENT_ID);
        if (client == null) {
            throw new IllegalStateException("Personal access token client is not configured");
        }

        String tokenId = UUID.randomUUID().toString();
        String authorizationId = UUID.randomUUID().toString();
        UserDetails userDetails = userDetailsService.loadUserByUsername(username);
        Authentication principal =
                UsernamePasswordAuthenticationToken.authenticated(
                        userDetails.getUsername(), null, userDetails.getAuthorities());
        PersonalAccessTokenGrant grant = new PersonalAccessTokenGrant(expiresAt);
        OAuth2Token generatedToken =
                tokenGenerator.generate(
                        DefaultOAuth2TokenContext.builder()
                                .registeredClient(client)
                                .principal(principal)
                                .authorizationServerContext(currentContext())
                                .authorizedScopes(Set.of(SCOPE))
                                .tokenType(OAuth2TokenType.ACCESS_TOKEN)
                                .authorizationGrantType(GRANT_TYPE)
                                .authorizationGrant(grant)
                                .build());
        if (generatedToken == null) {
            throw new IllegalStateException("Personal access token generation failed");
        }
        OAuth2AccessToken accessToken =
                generatedToken instanceof OAuth2AccessToken generatedAccessToken
                        ? generatedAccessToken
                        : new OAuth2AccessToken(
                                OAuth2AccessToken.TokenType.BEARER,
                                generatedToken.getTokenValue(),
                                generatedToken.getIssuedAt(),
                                generatedToken.getExpiresAt(),
                                Set.of(SCOPE));

        OAuth2Authorization authorization =
                OAuth2Authorization.withRegisteredClient(client)
                        .id(authorizationId)
                        .principalName(username)
                        .attribute(Principal.class.getName(), principal)
                        .authorizationGrantType(GRANT_TYPE)
                        .authorizedScopes(Set.of(SCOPE))
                        .attribute("personal_access_token_id", tokenId)
                        .token(
                                accessToken,
                                metadata -> addClaimsIfAvailable(metadata, generatedToken))
                        .build();
        authorizationService.save(authorization);

        UserEntity user = findUser(username);
        PersonalAccessTokenEntity entity = new PersonalAccessTokenEntity();
        entity.setId(tokenId);
        entity.setUser(user);
        entity.setAuthorizationId(authorizationId);
        entity.setName(name.trim());
        entity.setDescription(
                description == null || description.isBlank() ? null : description.trim());
        entity.setCreatedAt(createdAt);
        entity.setExpiresAt(expiresAt);
        personalAccessTokenRepository.save(entity);
        auditEventService.record(
                "account.personal-access-token.created", "personal_access_token", tokenId);
        return new PersonalAccessTokenCreatedDTO(
                tokenId,
                entity.getName(),
                entity.getDescription(),
                accessToken.getTokenValue(),
                SCOPE,
                createdAt,
                expiresAt);
    }

    @Transactional
    public void revoke(String username, String tokenId) {
        PersonalAccessTokenEntity token =
                personalAccessTokenRepository
                        .findByIdAndUserUsername(tokenId, username)
                        .orElseThrow(
                                () -> ApiException.notFound("Personal access token not found"));
        personalAccessTokenRepository.delete(token);
        authorizationRepository.deleteById(token.getAuthorizationId());
        auditEventService.record(
                "account.personal-access-token.revoked", "personal_access_token", tokenId);
    }

    private UserEntity findUser(String username) {
        return userRepository
                .findByUsername(username)
                .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private static Instant expirationAt(PersonalAccessTokenRequestDTO request, Instant createdAt) {
        if (request.customExpirationDate() != null && !"custom".equals(request.expiration())) {
            throw invalidExpiration();
        }
        return switch (request.expiration()) {
            case "7" -> createdAt.plus(Duration.ofDays(7));
            case "30" -> createdAt.plus(Duration.ofDays(30));
            case "60" -> createdAt.plus(Duration.ofDays(60));
            case "90" -> createdAt.plus(Duration.ofDays(90));
            case "never" -> null;
            case "custom" -> customExpiration(request.customExpirationDate(), createdAt);
            default -> throw invalidExpiration();
        };
    }

    private static Instant customExpiration(LocalDate expirationDate, Instant createdAt) {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        if (expirationDate == null
                || !expirationDate.isAfter(today)
                || expirationDate.isAfter(today.plusYears(1))) {
            throw invalidExpiration();
        }
        return expirationDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
    }

    private static ApiException invalidExpiration() {
        return ApiException.badRequest(
                "expiration",
                ApiErrorCode.INVALID_REQUEST,
                "Choose 7, 30, 60, 90 days, a date within one year, or no expiration");
    }

    private PersonalAccessTokenDTO toDTO(PersonalAccessTokenEntity token) {
        return new PersonalAccessTokenDTO(
                token.getId(),
                token.getName(),
                token.getDescription(),
                SCOPE,
                token.getCreatedAt(),
                token.getExpiresAt());
    }

    private AuthorizationServerContext currentContext() {
        AuthorizationServerContext context = AuthorizationServerContextHolder.getContext();
        if (context != null) {
            return context;
        }
        return new AuthorizationServerContext() {
            @Override
            public String getIssuer() {
                return authorizationServerSettings.getIssuer();
            }

            @Override
            public AuthorizationServerSettings getAuthorizationServerSettings() {
                return authorizationServerSettings;
            }
        };
    }

    private static void addClaimsIfAvailable(
            java.util.Map<String, Object> metadata, OAuth2Token token) {
        if (token instanceof org.springframework.security.oauth2.core.ClaimAccessor claimAccessor) {
            metadata.put(OAuth2Authorization.Token.CLAIMS_METADATA_NAME, claimAccessor.getClaims());
        }
    }
}
