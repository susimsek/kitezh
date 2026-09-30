package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.SocialProviderMapperEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.repository.SocialProviderMapperRepository;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.StreamSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies the configured identity-provider mappers during broker login. */
@Service
@RequiredArgsConstructor
@SuppressWarnings("java:S107")
public class SocialIdentityMapperService {

    private final SocialProviderMapperRepository mapperRepository;
    private final UserProfileService userProfileService;

    @Transactional
    public Map<String, Map<String, Object>> apply(
            String providerAlias, Map<String, Object> claims, UserEntity user, boolean firstLogin) {
        return applyInternal(providerAlias, claims, user, firstLogin, false, "import");
    }

    @Transactional
    public Map<String, Map<String, Object>> apply(
            String providerAlias,
            Map<String, Object> claims,
            UserEntity user,
            boolean firstLogin,
            boolean caseSensitiveUsername) {
        return applyInternal(
                providerAlias, claims, user, firstLogin, caseSensitiveUsername, "import");
    }

    @Transactional
    public Map<String, Map<String, Object>> apply(
            String providerAlias,
            Map<String, Object> claims,
            UserEntity user,
            boolean firstLogin,
            boolean caseSensitiveUsername,
            String providerSyncMode) {
        return applyInternal(
                providerAlias, claims, user, firstLogin, caseSensitiveUsername, providerSyncMode);
    }

    private Map<String, Map<String, Object>> applyInternal(
            String providerAlias,
            Map<String, Object> claims,
            UserEntity user,
            boolean firstLogin,
            boolean caseSensitiveUsername,
            String providerSyncMode) {
        String effectiveProviderSyncMode =
                providerSyncMode == null || providerSyncMode.isBlank()
                        ? SocialProviderSyncMode.IMPORT.value()
                        : providerSyncMode;
        if (providerAlias == null || providerAlias.isBlank()) {
            return Map.of();
        }
        List<SocialProviderMapperEntity> mappers =
                mapperRepository.findAllByProviderAliasIgnoreCase(providerAlias);
        if (mappers.isEmpty()) {
            return Map.of();
        }
        Map<String, List<String>> profileValues = new LinkedHashMap<>();
        Map<String, Map<String, Object>> mappedClaims = new LinkedHashMap<>();
        boolean userChanged = false;
        for (SocialProviderMapperEntity mapper : mappers) {
            userChanged |=
                    applyMapper(
                            mapper,
                            claims,
                            user,
                            firstLogin,
                            caseSensitiveUsername,
                            effectiveProviderSyncMode,
                            profileValues,
                            mappedClaims);
        }
        if (userChanged) {
            userProfileService.saveMappedUser(user, firstLogin);
        }
        if (!profileValues.isEmpty()) {
            userProfileService.mergeMappedAttributes(user, profileValues, "social-login");
        }
        return mappedClaims;
    }

    private static boolean applyMapper(
            SocialProviderMapperEntity mapper,
            Map<String, Object> claims,
            UserEntity user,
            boolean firstLogin,
            boolean caseSensitiveUsername,
            String providerSyncMode,
            Map<String, List<String>> profileValues,
            Map<String, Map<String, Object>> mappedClaims) {
        if (!isApplicable(mapper, firstLogin, providerSyncMode)) {
            return false;
        }
        List<String> values = values(claims, mapper.getSourceClaim());
        if (values.isEmpty()) {
            return false;
        }
        String target = mapper.getTarget() == null ? "" : mapper.getTarget().trim();
        if (target.isEmpty()) {
            return false;
        }
        boolean userChanged =
                applyUserAttribute(
                        mapper, user, target, values, caseSensitiveUsername, profileValues);
        addTokenClaims(mapper, target, values, mappedClaims);
        return userChanged;
    }

    private static boolean applyUserAttribute(
            SocialProviderMapperEntity mapper,
            UserEntity user,
            String target,
            List<String> values,
            boolean caseSensitiveUsername,
            Map<String, List<String>> profileValues) {
        if (!"user-attribute".equalsIgnoreCase(mapper.getMapperType())) {
            return false;
        }
        if (applyBuiltIn(user, target, values.getFirst(), caseSensitiveUsername)) {
            return true;
        }
        if (!isBuiltInTarget(target)) {
            profileValues.put(target, values);
        }
        return false;
    }

    private static void addTokenClaims(
            SocialProviderMapperEntity mapper,
            String target,
            List<String> values,
            Map<String, Map<String, Object>> mappedClaims) {
        if (!mapper.isAddToIdToken() && !mapper.isAddToAccessToken()) {
            return;
        }
        if (isReservedClaim(target)) {
            return;
        }
        Object claimValue = values.size() == 1 ? values.getFirst() : values;
        if (mapper.isAddToIdToken()) {
            mappedClaims
                    .computeIfAbsent("id_token", ignored -> new LinkedHashMap<>())
                    .put(target, claimValue);
        }
        if (mapper.isAddToAccessToken()) {
            mappedClaims
                    .computeIfAbsent("access_token", ignored -> new LinkedHashMap<>())
                    .put(target, claimValue);
        }
    }

    private static boolean isApplicable(
            SocialProviderMapperEntity mapper, boolean firstLogin, String providerSyncMode) {
        String mode = mapper.getSyncMode() == null ? "inherit" : mapper.getSyncMode().trim();
        if ("inherit".equalsIgnoreCase(mode)) {
            mode = providerSyncMode;
        }
        if ("read-only".equalsIgnoreCase(mode)) {
            mode = "read_only";
        }
        try {
            return SocialProviderSyncMode.from(mode).applies(firstLogin);
        } catch (IllegalArgumentException _) {
            return firstLogin;
        }
    }

    private static boolean isBuiltInTarget(String target) {
        return switch (target) {
            case "username", "email", "firstName", "lastName", "pictureUrl", "emailVerified" ->
                    true;
            default -> false;
        };
    }

    private static boolean isReservedClaim(String target) {
        return switch (target) {
            case "iss", "sub", "aud", "exp", "iat", "nbf", "jti", "nonce", "sid", "scope" -> true;
            default -> false;
        };
    }

    private static boolean applyBuiltIn(
            UserEntity user, String target, String value, boolean caseSensitiveUsername) {
        if ("username".equals(target)) {
            String username = value.trim();
            if (!caseSensitiveUsername) {
                username = username.toLowerCase(Locale.ROOT);
            }
            return set(user.getUsername(), username, user::setUsername);
        }
        return switch (target) {
            case "email" -> set(user.getEmail(), normalizeEmail(value), user::setEmail);
            case "firstName" -> set(user.getFirstName(), value, user::setFirstName);
            case "lastName" -> set(user.getLastName(), value, user::setLastName);
            case "pictureUrl" -> {
                String picture = httpsUrl(value);
                yield picture != null && set(user.getPictureUrl(), picture, user::setPictureUrl);
            }
            case "emailVerified" -> {
                if (!value.equalsIgnoreCase("true") && !value.equalsIgnoreCase("false")) {
                    yield false;
                }
                yield set(
                        user.isEmailVerified(),
                        Boolean.parseBoolean(value),
                        user::setEmailVerified);
            }
            default -> false;
        };
    }

    private static <T> boolean set(T current, T next, java.util.function.Consumer<T> setter) {
        if (next == null || Objects.equals(current, next)) {
            return false;
        }
        setter.accept(next);
        return true;
    }

    private static List<String> values(Map<String, Object> claims, String path) {
        if (path == null || path.isBlank()) {
            return List.of();
        }
        Object value = claims;
        for (String part : path.split("\\.")) {
            if (!(value instanceof Map<?, ?> map)) {
                return List.of();
            }
            value = map.get(part);
        }
        if (value instanceof Iterable<?> iterable) {
            return StreamSupport.stream(iterable.spliterator(), false)
                    .filter(Objects::nonNull)
                    .map(String::valueOf)
                    .map(String::trim)
                    .filter(item -> !item.isBlank())
                    .toList();
        }
        String scalar = value == null ? "" : String.valueOf(value).trim();
        return scalar.isBlank() ? List.of() : List.of(scalar);
    }

    private static String normalizeEmail(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private static String httpsUrl(String value) {
        if (value == null || value.length() > 1000) {
            return null;
        }
        try {
            URI uri = URI.create(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                            && uri.getHost() != null
                            && uri.getUserInfo() == null
                            && uri.getFragment() == null
                    ? uri.toString()
                    : null;
        } catch (IllegalArgumentException _) {
            return null;
        }
    }
}
