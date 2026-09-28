package io.github.susimsek.springauthserversamples.mapper;

import io.github.susimsek.springauthserversamples.config.security.SecurityJsonMapper;
import io.github.susimsek.springauthserversamples.domain.AuthorizationConsentId;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.security.oauth2.server.authorization.settings.ConfigurationSettingNames;
import org.springframework.security.oauth2.server.authorization.settings.TokenSettings;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;

@Component
public class AuthorizationServerMapperSupport {

    private static final TypeReference<Map<String, Object>> MAP_TYPE_REFERENCE =
            new TypeReference<>() {};

    private final SecurityJsonMapper securityJsonMapper;

    public AuthorizationServerMapperSupport(SecurityJsonMapper securityJsonMapper) {
        this.securityJsonMapper = securityJsonMapper;
    }

    public AuthorizationConsentId newAuthorizationConsentId(
            String registeredClientId, String principalName) {
        return new AuthorizationConsentId(registeredClientId, principalName);
    }

    public String writeClientAuthenticationMethods(
            Set<ClientAuthenticationMethod> clientAuthenticationMethods) {
        return writeCollection(
                clientAuthenticationMethods.stream()
                        .map(ClientAuthenticationMethod::getValue)
                        .collect(Collectors.toCollection(LinkedHashSet::new)));
    }

    public Set<ClientAuthenticationMethod> readClientAuthenticationMethods(String value) {
        return readCollection(value).stream()
                .map(ClientAuthenticationMethod::new)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public String writeAuthorizationGrantTypes(
            Set<AuthorizationGrantType> authorizationGrantTypes) {
        return writeCollection(
                authorizationGrantTypes.stream()
                        .map(AuthorizationGrantType::getValue)
                        .collect(Collectors.toCollection(LinkedHashSet::new)));
    }

    public Set<AuthorizationGrantType> readAuthorizationGrantTypes(String value) {
        return readCollection(value).stream()
                .map(AuthorizationGrantType::new)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public String writeCollection(Set<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        return StringUtils.collectionToCommaDelimitedString(values);
    }

    public Set<String> readCollection(String value) {
        if (!StringUtils.hasText(value)) {
            return Collections.emptySet();
        }
        return Arrays.stream(StringUtils.commaDelimitedListToStringArray(value))
                .filter(StringUtils::hasText)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public String writeMap(Map<String, Object> value) {
        if (value == null || value.isEmpty()) {
            return null;
        }
        try {
            return securityJsonMapper.delegate().writeValueAsString(value);
        } catch (JacksonException ex) {
            throw new IllegalStateException("Failed to serialize authorization server value", ex);
        }
    }

    public Map<String, Object> readMap(String value) {
        if (!StringUtils.hasText(value)) {
            return Collections.emptyMap();
        }
        try {
            return securityJsonMapper.delegate().readValue(value, MAP_TYPE_REFERENCE);
        } catch (JacksonException ex) {
            throw new IllegalStateException("Failed to deserialize authorization server value", ex);
        }
    }

    public String writeClientSettings(ClientSettings clientSettings) {
        return writeMap(clientSettings.getSettings());
    }

    public ClientSettings readClientSettings(String value) {
        Map<String, Object> settings = new java.util.HashMap<>(readMap(value));
        Object algorithm =
                settings.get(
                        ConfigurationSettingNames.Client
                                .TOKEN_ENDPOINT_AUTHENTICATION_SIGNING_ALGORITHM);
        if (algorithm instanceof String name) {
            SignatureAlgorithm signatureAlgorithm = SignatureAlgorithm.from(name);
            if (signatureAlgorithm != null) {
                settings.put(
                        ConfigurationSettingNames.Client
                                .TOKEN_ENDPOINT_AUTHENTICATION_SIGNING_ALGORITHM,
                        signatureAlgorithm);
            }
        }
        return settings.isEmpty()
                ? ClientSettings.builder().build()
                : ClientSettings.withSettings(settings).build();
    }

    public String writeTokenSettings(TokenSettings tokenSettings) {
        return writeMap(tokenSettings.getSettings());
    }

    public TokenSettings readTokenSettings(String value) {
        return TokenSettings.withSettings(readMap(value)).build();
    }

    public String writeAuthorities(Set<GrantedAuthority> authorities) {
        return writeCollection(
                authorities.stream()
                        .map(GrantedAuthority::getAuthority)
                        .collect(Collectors.toCollection(LinkedHashSet::new)));
    }

    public Set<GrantedAuthority> readAuthorities(String value) {
        return readCollection(value).stream()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
