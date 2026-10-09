package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.domain.AuthorizationEntity;
import io.github.susimsek.kitezh.mapper.AuthorizationMapper;
import io.github.susimsek.kitezh.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.kitezh.repository.AuthorizationRepository;
import io.github.susimsek.kitezh.security.AuthorizationGrantTypes;
import io.github.susimsek.kitezh.security.ClientSecuritySettings;
import io.github.susimsek.kitezh.security.OfflineAccessSettings;
import io.github.susimsek.kitezh.service.admin.OfflineAccessPolicyService;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataRetrievalFailureException;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.core.oidc.endpoint.OidcParameterNames;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService;
import org.springframework.security.oauth2.server.authorization.OAuth2TokenType;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.Assert;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor
public class DomainOAuth2AuthorizationService implements OAuth2AuthorizationService {

    private static final String OFFLINE_ACCESS_SCOPE = "offline_access";

    private final AuthorizationRepository authorizationRepository;
    private final RegisteredClientRepository registeredClientRepository;
    private final AuthorizationMapper authorizationMapper;
    private final AuthorizationServerMapperSupport mapperSupport;
    private final OfflineAccessPolicyService offlineAccessPolicyService;
    private final AuthorizationRevocationPolicyService revocationPolicyService;

    @Override
    @Transactional
    public void save(OAuth2Authorization authorization) {
        AuthorizationEntity entity = authorizationMapper.toEntity(authorization, mapperSupport);
        if (isOfflineAuthorization(authorization)) {
            // Offline authorizations survive browser logout, just like Keycloak offline
            // sessions. User/client revocation still removes the persisted authorization.
            entity.setSessionId(null);
            Map<String, Object> attributes = new HashMap<>();
            Map<String, Object> existingAttributes = mapperSupport.readMap(entity.getAttributes());
            if (existingAttributes != null) {
                attributes.putAll(existingAttributes);
            }
            attributes.putIfAbsent(
                    OfflineAccessSettings.SESSION_STARTED_AT, Instant.now().toString());
            entity.setAttributes(mapperSupport.writeMap(attributes));
        } else if (isTokenExchangeAuthorization(authorization)) {
            Map<String, Object> attributes = mapperSupport.readMap(entity.getAttributes());
            String sourceAuthorizationId = null;
            if (attributes != null) {
                Object sourceAuthorization =
                        attributes.get(
                                ClientSecuritySettings.TOKEN_EXCHANGE_SOURCE_AUTHORIZATION_ID);
                if (sourceAuthorization instanceof String value) {
                    sourceAuthorizationId = value;
                }
            }
            if (sourceAuthorizationId != null) {
                authorizationRepository
                        .findById(sourceAuthorizationId)
                        .ifPresent(source -> entity.setSessionId(source.getSessionId()));
            } else {
                copyCurrentSession(entity, authorization);
            }
        } else {
            copyCurrentSession(entity, authorization);
        }
        authorizationRepository.save(entity);
    }

    private void copyCurrentSession(AuthorizationEntity entity, OAuth2Authorization authorization) {
        String sessionId = currentSessionId();
        if (sessionId != null) {
            entity.setSessionId(sessionId);
        } else {
            authorizationRepository
                    .findById(authorization.getId())
                    .map(AuthorizationEntity::getSessionId)
                    .ifPresent(entity::setSessionId);
        }
    }

    private static boolean isTokenExchangeAuthorization(OAuth2Authorization authorization) {
        return AuthorizationGrantTypes.TOKEN_EXCHANGE.equals(
                authorization.getAuthorizationGrantType().getValue());
    }

    @Override
    @Transactional
    public void remove(OAuth2Authorization authorization) {
        authorizationRepository.deleteById(authorization.getId());
    }

    @Override
    @Transactional(readOnly = true)
    public OAuth2Authorization findById(String id) {
        return authorizationRepository.findById(id).map(this::toObject).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public OAuth2Authorization findByToken(String token, OAuth2TokenType tokenType) {
        Assert.hasText(token, "token cannot be empty");

        Optional<AuthorizationEntity> authorization =
                tokenType == null
                        ? authorizationRepository.findByToken(token)
                        : findByTokenType(token, tokenType);

        return authorization
                .filter(entity -> isUsable(entity, tokenType))
                .map(this::toObject)
                .orElse(null);
    }

    private boolean isUsable(AuthorizationEntity entity, OAuth2TokenType tokenType) {
        if (offlineAccessPolicyService != null
                && isOfflineAuthorization(entity)
                && offlineAuthorizationRevoked(entity)) {
            return false;
        }
        Instant issuedAt = issuedAt(entity, tokenType);
        RegisteredClient client =
                registeredClientRepository.findById(entity.getRegisteredClientId());
        String clientId = client == null ? entity.getRegisteredClientId() : client.getClientId();
        return !revocationPolicyService.isRevoked(entity.getPrincipalName(), clientId, issuedAt);
    }

    private boolean offlineAuthorizationRevoked(AuthorizationEntity entity) {
        Map<String, Object> attributes = mapperSupport.readMap(entity.getAttributes());
        Object startedAt =
                attributes == null
                        ? null
                        : attributes.get(OfflineAccessSettings.SESSION_STARTED_AT);
        if (startedAt instanceof String value) {
            try {
                return offlineAccessPolicyService.revoked(Instant.parse(value));
            } catch (RuntimeException _) {
                return false;
            }
        }
        return false;
    }

    private static Instant issuedAt(AuthorizationEntity entity, OAuth2TokenType tokenType) {
        if (tokenType == null) {
            return entity.getAccessTokenIssuedAt();
        }
        return switch (tokenType.getValue()) {
            case OAuth2ParameterNames.CODE -> entity.getAuthorizationCodeIssuedAt();
            case OAuth2ParameterNames.ACCESS_TOKEN -> entity.getAccessTokenIssuedAt();
            case OAuth2ParameterNames.REFRESH_TOKEN -> entity.getRefreshTokenIssuedAt();
            case OidcParameterNames.ID_TOKEN -> entity.getOidcIdTokenIssuedAt();
            case OAuth2ParameterNames.USER_CODE -> entity.getUserCodeIssuedAt();
            case OAuth2ParameterNames.DEVICE_CODE -> entity.getDeviceCodeIssuedAt();
            default -> entity.getAccessTokenIssuedAt();
        };
    }

    private Optional<AuthorizationEntity> findByTokenType(String token, OAuth2TokenType tokenType) {
        return switch (tokenType.getValue()) {
            case OAuth2ParameterNames.STATE -> authorizationRepository.findByState(token);
            case OAuth2ParameterNames.CODE ->
                    authorizationRepository.findByAuthorizationCodeValue(token);
            case OAuth2ParameterNames.ACCESS_TOKEN ->
                    authorizationRepository.findByAccessTokenValue(token);
            case OAuth2ParameterNames.REFRESH_TOKEN ->
                    authorizationRepository.findByRefreshTokenValue(token);
            case OidcParameterNames.ID_TOKEN ->
                    authorizationRepository.findByOidcIdTokenValue(token);
            case OAuth2ParameterNames.USER_CODE ->
                    authorizationRepository.findByUserCodeValue(token);
            case OAuth2ParameterNames.DEVICE_CODE ->
                    authorizationRepository.findByDeviceCodeValue(token);
            default -> Optional.empty();
        };
    }

    private OAuth2Authorization toObject(AuthorizationEntity entity) {
        RegisteredClient registeredClient =
                registeredClientRepository.findById(entity.getRegisteredClientId());
        if (registeredClient == null) {
            throw new DataRetrievalFailureException(
                    "Registered client not found: " + entity.getRegisteredClientId());
        }
        return authorizationMapper.toObject(entity, registeredClient, mapperSupport);
    }

    private static boolean isOfflineAuthorization(OAuth2Authorization authorization) {
        return authorization.getAuthorizedScopes().contains(OFFLINE_ACCESS_SCOPE);
    }

    private static boolean isOfflineAuthorization(AuthorizationEntity authorization) {
        return authorization.getAuthorizedScopes() != null
                && java.util.Arrays.stream(authorization.getAuthorizedScopes().split(","))
                        .anyMatch(OFFLINE_ACCESS_SCOPE::equals);
    }

    private static String currentSessionId() {
        if (!(RequestContextHolder.getRequestAttributes()
                instanceof ServletRequestAttributes attributes)) {
            return null;
        }
        var session = attributes.getRequest().getSession(false);
        return session != null ? session.getId() : null;
    }
}
