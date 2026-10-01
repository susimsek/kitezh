package io.github.susimsek.springauthserversamples.service.admin;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.util.StringUtils;

public final class ClientScopeSettings {

    public static final String DEFAULT_SCOPES = "settings.client.default-client-scopes";
    public static final String OPTIONAL_SCOPES = "settings.client.optional-client-scopes";
    public static final String OFFLINE_ACCESS = "offline_access";

    private ClientScopeSettings() {}

    public static Set<String> defaultScopes(RegisteredClient client) {
        Set<String> configured = read(client.getClientSettings(), DEFAULT_SCOPES);
        if (!configured.isEmpty()
                || client.getClientSettings().getSetting(DEFAULT_SCOPES) != null) {
            return withoutImplicitOfflineAccess(configured);
        }
        return withoutImplicitOfflineAccess(client.getScopes());
    }

    public static Set<String> optionalScopes(RegisteredClient client) {
        return read(client.getClientSettings(), OPTIONAL_SCOPES);
    }

    public static ClientSettings withAssignments(
            ClientSettings settings, Set<String> defaultScopes, Set<String> optionalScopes) {
        var values = new java.util.HashMap<>(settings.getSettings());
        values.put(DEFAULT_SCOPES, write(defaultScopes));
        values.put(OPTIONAL_SCOPES, write(optionalScopes));
        return ClientSettings.withSettings(values).build();
    }

    static String write(Set<String> scopes) {
        return scopes.stream().sorted().collect(Collectors.joining(","));
    }

    private static Set<String> read(ClientSettings settings, String key) {
        Object value = settings.getSetting(key);
        if (!(value instanceof String text) || !StringUtils.hasText(text)) {
            return new LinkedHashSet<>();
        }
        return Arrays.stream(StringUtils.commaDelimitedListToStringArray(text))
                .filter(StringUtils::hasText)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static Set<String> withoutImplicitOfflineAccess(Set<String> scopes) {
        return scopes.stream()
                .filter(scope -> !OFFLINE_ACCESS.equals(scope))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
