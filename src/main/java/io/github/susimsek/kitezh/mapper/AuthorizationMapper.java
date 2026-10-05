package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.AuthorizationEntity;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2DeviceCode;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.security.oauth2.core.OAuth2Token;
import org.springframework.security.oauth2.core.OAuth2UserCode;
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization;
import org.springframework.security.oauth2.server.authorization.OAuth2Authorization.Token;
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationCode;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.stereotype.Component;

@Component
public class AuthorizationMapper {

    public AuthorizationEntity toEntity(
            OAuth2Authorization authorization, AuthorizationServerMapperSupport support) {
        AuthorizationEntity entity = new AuthorizationEntity();
        mapBaseFields(entity, authorization, support);
        mapStandardToken(
                authorization.getToken(OAuth2AuthorizationCode.class),
                entity::setAuthorizationCodeValue,
                entity::setAuthorizationCodeIssuedAt,
                entity::setAuthorizationCodeExpiresAt,
                entity::setAuthorizationCodeMetadata,
                support);
        mapAccessToken(entity, authorization.getAccessToken(), support);
        mapOidcIdToken(entity, authorization.getToken(OidcIdToken.class), support);
        entity.setOidcIdTokenClaims(
                writeClaims(authorization.getToken(OidcIdToken.class), support));
        mapStandardToken(
                authorization.getRefreshToken(),
                entity::setRefreshTokenValue,
                entity::setRefreshTokenIssuedAt,
                entity::setRefreshTokenExpiresAt,
                entity::setRefreshTokenMetadata,
                support);
        mapStandardToken(
                authorization.getToken(OAuth2UserCode.class),
                entity::setUserCodeValue,
                entity::setUserCodeIssuedAt,
                entity::setUserCodeExpiresAt,
                entity::setUserCodeMetadata,
                support);
        mapStandardToken(
                authorization.getToken(OAuth2DeviceCode.class),
                entity::setDeviceCodeValue,
                entity::setDeviceCodeIssuedAt,
                entity::setDeviceCodeExpiresAt,
                entity::setDeviceCodeMetadata,
                support);
        return entity;
    }

    public OAuth2Authorization toObject(
            AuthorizationEntity entity,
            RegisteredClient registeredClient,
            AuthorizationServerMapperSupport support) {
        OAuth2Authorization.Builder builder =
                OAuth2Authorization.withRegisteredClient(registeredClient)
                        .id(entity.getId())
                        .principalName(entity.getPrincipalName())
                        .authorizationGrantType(
                                new AuthorizationGrantType(entity.getAuthorizationGrantType()))
                        .authorizedScopes(support.readCollection(entity.getAuthorizedScopes()));
        builder.attributes(
                attributes -> attributes.putAll(support.readMap(entity.getAttributes())));
        if (entity.getState() != null) {
            builder.attribute(OAuth2ParameterNames.STATE, entity.getState());
        }
        addStandardToken(
                builder,
                entity.getAuthorizationCodeValue(),
                entity.getAuthorizationCodeIssuedAt(),
                entity.getAuthorizationCodeExpiresAt(),
                entity.getAuthorizationCodeMetadata(),
                support,
                tokenData ->
                        new OAuth2AuthorizationCode(
                                tokenData.value(), tokenData.issuedAt(), tokenData.expiresAt()));
        addAccessToken(builder, entity, support);
        addOidcIdToken(builder, entity, support);
        addStandardToken(
                builder,
                entity.getRefreshTokenValue(),
                entity.getRefreshTokenIssuedAt(),
                entity.getRefreshTokenExpiresAt(),
                entity.getRefreshTokenMetadata(),
                support,
                tokenData ->
                        new OAuth2RefreshToken(
                                tokenData.value(), tokenData.issuedAt(), tokenData.expiresAt()));
        addStandardToken(
                builder,
                entity.getUserCodeValue(),
                entity.getUserCodeIssuedAt(),
                entity.getUserCodeExpiresAt(),
                entity.getUserCodeMetadata(),
                support,
                tokenData ->
                        new OAuth2UserCode(
                                tokenData.value(), tokenData.issuedAt(), tokenData.expiresAt()));
        addStandardToken(
                builder,
                entity.getDeviceCodeValue(),
                entity.getDeviceCodeIssuedAt(),
                entity.getDeviceCodeExpiresAt(),
                entity.getDeviceCodeMetadata(),
                support,
                tokenData ->
                        new OAuth2DeviceCode(
                                tokenData.value(), tokenData.issuedAt(), tokenData.expiresAt()));
        return builder.build();
    }

    private static void mapBaseFields(
            AuthorizationEntity entity,
            OAuth2Authorization authorization,
            AuthorizationServerMapperSupport support) {
        entity.setId(authorization.getId());
        entity.setRegisteredClientId(authorization.getRegisteredClientId());
        entity.setPrincipalName(authorization.getPrincipalName());
        entity.setAuthorizationGrantType(authorization.getAuthorizationGrantType().getValue());
        entity.setAuthorizedScopes(support.writeCollection(authorization.getAuthorizedScopes()));
        entity.setAttributes(support.writeMap(authorization.getAttributes()));
        entity.setState(authorization.getAttribute(OAuth2ParameterNames.STATE));
    }

    private static void mapStandardToken(
            Token<? extends OAuth2Token> token,
            Consumer<String> valueSetter,
            Consumer<Instant> issuedAtSetter,
            Consumer<Instant> expiresAtSetter,
            Consumer<String> metadataSetter,
            AuthorizationServerMapperSupport support) {
        valueSetter.accept(tokenValue(token));
        issuedAtSetter.accept(tokenIssuedAt(token));
        expiresAtSetter.accept(tokenExpiresAt(token));
        metadataSetter.accept(writeTokenMetadata(token, support));
    }

    private static void mapAccessToken(
            AuthorizationEntity entity,
            Token<OAuth2AccessToken> accessToken,
            AuthorizationServerMapperSupport support) {
        mapStandardToken(
                accessToken,
                entity::setAccessTokenValue,
                entity::setAccessTokenIssuedAt,
                entity::setAccessTokenExpiresAt,
                entity::setAccessTokenMetadata,
                support);
        entity.setAccessTokenType(accessTokenType(accessToken));
        entity.setAccessTokenScopes(accessTokenScopes(accessToken, support));
    }

    private static void mapOidcIdToken(
            AuthorizationEntity entity,
            Token<OidcIdToken> oidcIdToken,
            AuthorizationServerMapperSupport support) {
        entity.setOidcIdTokenValue(tokenValue(oidcIdToken));
        entity.setOidcIdTokenIssuedAt(tokenIssuedAt(oidcIdToken));
        entity.setOidcIdTokenExpiresAt(tokenExpiresAt(oidcIdToken));
        entity.setOidcIdTokenMetadata(writeTokenMetadata(oidcIdToken, support, false));
    }

    private static <T extends OAuth2Token> void addStandardToken(
            OAuth2Authorization.Builder builder,
            String value,
            Instant issuedAt,
            Instant expiresAt,
            String metadataValue,
            AuthorizationServerMapperSupport support,
            Function<TokenData, T> tokenFactory) {
        if (value == null) {
            return;
        }
        T token = tokenFactory.apply(new TokenData(value, issuedAt, expiresAt));
        Map<String, Object> metadata = support.readMap(metadataValue);
        builder.token(token, tokenMetadata -> tokenMetadata.putAll(metadata));
    }

    private static void addAccessToken(
            OAuth2Authorization.Builder builder,
            AuthorizationEntity entity,
            AuthorizationServerMapperSupport support) {
        if (entity.getAccessTokenValue() == null) {
            return;
        }
        OAuth2AccessToken accessToken =
                new OAuth2AccessToken(
                        new OAuth2AccessToken.TokenType(entity.getAccessTokenType()),
                        entity.getAccessTokenValue(),
                        entity.getAccessTokenIssuedAt(),
                        entity.getAccessTokenExpiresAt(),
                        readScopes(entity.getAccessTokenScopes(), support));
        Map<String, Object> metadata = support.readMap(entity.getAccessTokenMetadata());
        builder.token(accessToken, tokenMetadata -> tokenMetadata.putAll(metadata));
    }

    private static void addOidcIdToken(
            OAuth2Authorization.Builder builder,
            AuthorizationEntity entity,
            AuthorizationServerMapperSupport support) {
        if (entity.getOidcIdTokenValue() == null) {
            return;
        }
        Map<String, Object> metadata = support.readMap(entity.getOidcIdTokenMetadata());
        OidcIdToken idToken =
                new OidcIdToken(
                        entity.getOidcIdTokenValue(),
                        entity.getOidcIdTokenIssuedAt(),
                        entity.getOidcIdTokenExpiresAt(),
                        readOidcIdTokenClaims(entity, support, metadata));
        builder.token(idToken, tokenMetadata -> tokenMetadata.putAll(metadata));
    }

    private static Map<String, Object> readClaims(Map<String, Object> metadata, String claimKey) {
        Object claims = metadata.get(claimKey);
        if (claims instanceof Map<?, ?> claimMap) {
            Map<String, Object> result = new HashMap<>();
            claimMap.forEach((key, value) -> result.put(String.valueOf(key), value));
            return result;
        }
        return Map.of();
    }

    private static String tokenValue(Token<? extends OAuth2Token> token) {
        return token != null ? token.getToken().getTokenValue() : null;
    }

    private static Instant tokenIssuedAt(Token<? extends OAuth2Token> token) {
        return token != null ? token.getToken().getIssuedAt() : null;
    }

    private static Instant tokenExpiresAt(Token<? extends OAuth2Token> token) {
        return token != null ? token.getToken().getExpiresAt() : null;
    }

    private static String writeTokenMetadata(
            Token<? extends OAuth2Token> token, AuthorizationServerMapperSupport support) {
        return writeTokenMetadata(token, support, true);
    }

    private static String writeTokenMetadata(
            Token<? extends OAuth2Token> token,
            AuthorizationServerMapperSupport support,
            boolean includeClaims) {
        if (token == null) {
            return null;
        }
        Map<String, Object> metadata = new HashMap<>(token.getMetadata());
        if (includeClaims && token.getClaims() != null && !token.getClaims().isEmpty()) {
            metadata.put(OAuth2Authorization.Token.CLAIMS_METADATA_NAME, token.getClaims());
        }
        return support.writeMap(metadata);
    }

    private static String writeClaims(
            Token<? extends OAuth2Token> token, AuthorizationServerMapperSupport support) {
        if (token == null || token.getClaims() == null || token.getClaims().isEmpty()) {
            return null;
        }
        return support.writeMap(token.getClaims());
    }

    private static String accessTokenType(Token<OAuth2AccessToken> token) {
        return token != null ? token.getToken().getTokenType().getValue() : null;
    }

    private static String accessTokenScopes(
            Token<OAuth2AccessToken> token, AuthorizationServerMapperSupport support) {
        return token != null ? support.writeCollection(token.getToken().getScopes()) : null;
    }

    private static Set<String> readScopes(
            String accessTokenScopes, AuthorizationServerMapperSupport support) {
        return support.readCollection(accessTokenScopes);
    }

    private static Map<String, Object> readOidcIdTokenClaims(
            AuthorizationEntity entity,
            AuthorizationServerMapperSupport support,
            Map<String, Object> metadata) {
        if (entity.getOidcIdTokenClaims() != null) {
            return support.readMap(entity.getOidcIdTokenClaims());
        }
        return readClaims(metadata, OAuth2Authorization.Token.CLAIMS_METADATA_NAME);
    }

    private record TokenData(String value, Instant issuedAt, Instant expiresAt) {}
}
