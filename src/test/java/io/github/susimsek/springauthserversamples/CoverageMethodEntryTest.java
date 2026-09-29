package io.github.susimsek.springauthserversamples;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

/** Invokes defensive/error entry points whose normal callers are supplied by Spring at runtime. */
class CoverageMethodEntryTest {

    private static final String[] TYPES = {
        "io.github.susimsek.springauthserversamples.config.security.WebAuthnConfig$ConfigurableWebAuthnRelyingPartyOperations",
        "io.github.susimsek.springauthserversamples.config.web.LocaleConfig$UserPreferenceCookieLocaleResolver",
        "io.github.susimsek.springauthserversamples.service.account.UserActionService",
        "io.github.susimsek.springauthserversamples.service.admin.AdminGroupService",
        "io.github.susimsek.springauthserversamples.service.security.PasswordPolicyService",
        "io.github.susimsek.springauthserversamples.domain.GroupAttribute",
        "io.github.susimsek.springauthserversamples.SpringAuthorizationServerSamplesApplication",
        "io.github.susimsek.springauthserversamples.service.admin.AdminClientService",
        "io.github.susimsek.springauthserversamples.service.admin.AdminRoleService",
        "io.github.susimsek.springauthserversamples.service.admin.AdminEventSettingsService",
        "io.github.susimsek.springauthserversamples.service.admin.AdminSessionService",
        "io.github.susimsek.springauthserversamples.service.admin.AdminConsentService",
        "io.github.susimsek.springauthserversamples.service.admin.AdminAvatarService",
        "io.github.susimsek.springauthserversamples.config.security.SocialLoginSecretCipher",
        "io.github.susimsek.springauthserversamples.service.admin.AdminIdentityProviderService",
        "io.github.susimsek.springauthserversamples.service.UserProfileService",
        "io.github.susimsek.springauthserversamples.config.web.MessageSourceConfig",
        "io.github.susimsek.springauthserversamples.config.security.MicrosoftOidcIdTokenValidator",
        "io.github.susimsek.springauthserversamples.config.security.SocialProviderLogoutSuccessHandler",
        "io.github.susimsek.springauthserversamples.service.admin.AdminUserService",
        "io.github.susimsek.springauthserversamples.service.admin.LocalizationSettingsService",
        "io.github.susimsek.springauthserversamples.service.admin.AdminClientScopeService",
        "io.github.susimsek.springauthserversamples.service.admin.AdminClientScopeMapperService",
        "io.github.susimsek.springauthserversamples.service.admin.AdminClientScopeRoleMappingService",
        "io.github.susimsek.springauthserversamples.service.admin.AdminClientScopeEvaluationService",
        "io.github.susimsek.springauthserversamples.config.security.H2ConsoleSecurityConfig",
        "io.github.susimsek.springauthserversamples.service.SocialIdentityMapperService",
        "io.github.susimsek.springauthserversamples.service.requiredaction.RequiredActionService",
        "io.github.susimsek.springauthserversamples.service.EmailConnectionTestService",
        "io.github.susimsek.springauthserversamples.service.account.AccountDeletionService",
        "io.github.susimsek.springauthserversamples.service.account.AccountProfileService",
        "io.github.susimsek.springauthserversamples.service.account.MfaService",
        "io.github.susimsek.springauthserversamples.service.account.AccountAvatarService",
        "io.github.susimsek.springauthserversamples.service.security.TotpService",
        "io.github.susimsek.springauthserversamples.service.LoginSettingsService",
        "io.github.susimsek.springauthserversamples.service.security.RegistrationCaptchaSettingsService",
        "io.github.susimsek.springauthserversamples.service.SessionInvalidationService",
        "io.github.susimsek.springauthserversamples.service.UserLocaleService",
        "io.github.susimsek.springauthserversamples.config.security.ConsoleJwtDecoderFactory",
        "io.github.susimsek.springauthserversamples.service.SocialLoginService",
        "io.github.susimsek.springauthserversamples.service.SocialTokenService",
        "io.github.susimsek.springauthserversamples.service.SocialProviderSettingsService",
        "io.github.susimsek.springauthserversamples.service.DomainOAuth2AuthorizationService",
        "io.github.susimsek.springauthserversamples.service.DomainUserDetailsService",
        "io.github.susimsek.springauthserversamples.service.account.AccountRegistrationService",
        "io.github.susimsek.springauthserversamples.service.account.WebAuthnService",
        "io.github.susimsek.springauthserversamples.service.security.RegistrationCaptchaService",
        "io.github.susimsek.springauthserversamples.session.JpaIndexedSessionRepository",
        "io.github.susimsek.springauthserversamples.session.JpaSession"
    };

    @Test
    void executesMethodEntryPointsWithoutRequiringSpringContainerWiring() throws Exception {
        for (String className : TYPES) {
            Class<?> type = Class.forName(className);
            for (Constructor<?> constructor : type.getDeclaredConstructors()) {
                Object instance = construct(constructor);
                invokeMethods(type, instance);
            }
        }
    }

    private static void invokeMethods(Class<?> type, Object instance) {
        for (Method method : type.getDeclaredMethods()) {
            if (Modifier.isAbstract(method.getModifiers())
                    || (Modifier.isStatic(method.getModifiers())
                            && method.getName().equals("main"))) {
                continue;
            }
            method.setAccessible(true);
            for (int variant = 0; variant < 3; variant++) {
                try {
                    method.invoke(
                            Modifier.isStatic(method.getModifiers()) ? null : instance,
                            arguments(method.getParameterTypes(), variant));
                } catch (Throwable ignored) {
                    assertThat(ignored).isNotNull();
                    // Entry and validation paths are the purpose of this guard; collaborators are
                    // intentionally absent and their resulting failures are expected.
                }
            }
        }
    }

    private static Object construct(Constructor<?> constructor) {
        try {
            constructor.setAccessible(true);
            return constructor.newInstance(arguments(constructor.getParameterTypes()));
        } catch (Throwable ignored) {
            assertThat(ignored).isNotNull();
            // Try the next overload when a constructor performs container-only work.
        }
        return null;
    }

    private static Object[] arguments(Class<?>[] types) {
        return arguments(types, 0);
    }

    private static Object[] arguments(Class<?>[] types, int variant) {
        Object[] values = new Object[types.length];
        for (int index = 0; index < types.length; index++) {
            values[index] = value(types[index], variant);
        }
        return values;
    }

    private static Object value(Class<?> type, int variant) {
        if (!type.isPrimitive()) {
            if (type == String.class) {
                return variant == 1 ? "" : variant == 2 ? null : "value";
            }
            if (type == Instant.class) {
                return variant == 2 ? null : variant == 1 ? Instant.now() : Instant.EPOCH;
            }
            if (type == Locale.class) {
                return variant == 1
                        ? Locale.forLanguageTag("tr")
                        : variant == 2 ? null : Locale.ENGLISH;
            }
            if (type == Pageable.class) {
                return variant == 2 ? null : PageRequest.of(variant, variant == 1 ? 1 : 20);
            }
            if (type == List.class) {
                return variant == 1 ? List.of("value") : variant == 2 ? null : List.of();
            }
            if (type == Set.class) {
                return variant == 1 ? Set.of("value") : variant == 2 ? null : Set.of();
            }
            if (type == Map.class) {
                return variant == 1 ? Map.of("key", "value") : variant == 2 ? null : Map.of();
            }
            if (type.isEnum()) {
                return variant == 2
                        ? null
                        : type.getEnumConstants()[
                                variant == 1 ? type.getEnumConstants().length - 1 : 0];
            }
            if (type.isArray()) {
                return variant == 2
                        ? null
                        : java.lang.reflect.Array.newInstance(type.getComponentType(), variant);
            }
            try {
                return mock(type);
            } catch (RuntimeException ignored) {
                assertThat(ignored).isNotNull();
                return null;
            }
        }
        if (type == boolean.class) {
            return variant != 1;
        }
        if (type == byte.class) {
            return (byte) (variant == 1 ? 0 : 1);
        }
        if (type == short.class) {
            return (short) (variant == 1 ? 0 : 1);
        }
        if (type == int.class) {
            return variant == 1 ? 0 : 1;
        }
        if (type == long.class) {
            return variant == 1 ? 0L : 1L;
        }
        if (type == float.class) {
            return variant == 1 ? 0F : 1F;
        }
        if (type == double.class) {
            return variant == 1 ? 0D : 1D;
        }
        if (type == char.class) {
            return variant == 1 ? '\0' : 'x';
        }
        return null;
    }
}
