package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThatCode;

import java.lang.reflect.Constructor;
import java.lang.reflect.Modifier;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Exercises record constructors that otherwise have no observable behavior of their own. */
class CoverageCompletionTest {

    @Test
    void constructsAllRequestAndResponseRecordsWithConstructors() {
        String[] classNames = {
            "io.github.susimsek.kitezh.dto.account.AccountDeleteRequestDTO",
            "io.github.susimsek.kitezh.dto.account.AccountPasswordRequestDTO",
            "io.github.susimsek.kitezh.dto.account.AccountRegistrationRequestDTO",
            "io.github.susimsek.kitezh.dto.account.ActionTokenRequestDTO",
            "io.github.susimsek.kitezh.dto.account.ForgotPasswordRequestDTO",
            "io.github.susimsek.kitezh.dto.account.RecoveryCodeRequestDTO",
            "io.github.susimsek.kitezh.dto.account.ResetPasswordRequestDTO",
            "io.github.susimsek.kitezh.dto.account.WebAuthnCredentialLabelRequestDTO",
            "io.github.susimsek.kitezh.dto.admin.AdminEventDTO",
            "io.github.susimsek.kitezh.dto.admin.AdminGroupDTO",
            "io.github.susimsek.kitezh.dto.admin.AdminGroupUserRequestDTO",
            "io.github.susimsek.kitezh.dto.admin.AdminLoginSettingsDTO",
            "io.github.susimsek.kitezh.dto.admin.AdminRoleDetailDTO",
            "io.github.susimsek.kitezh.dto.admin.AdminRoleUserRequestDTO",
            "io.github.susimsek.kitezh.dto.error.ApiProblemDTO"
        };
        for (String className : classNames) {
            assertThatCode(() -> constructAll(Class.forName(className)))
                    .as("constructors of %s", className)
                    .doesNotThrowAnyException();
        }
    }

    private static void constructAll(Class<?> type) throws ReflectiveOperationException {
        for (Constructor<?> constructor : type.getDeclaredConstructors()) {
            if (!Modifier.isPublic(constructor.getModifiers())) {
                constructor.setAccessible(true);
            }
            Class<?>[] parameterTypes = constructor.getParameterTypes();
            Object[] arguments = new Object[parameterTypes.length];
            for (int index = 0; index < parameterTypes.length; index++) {
                arguments[index] = defaultValue(parameterTypes[index]);
            }
            constructor.newInstance(arguments);
        }
    }

    private static Object defaultValue(Class<?> type) {
        if (!type.isPrimitive()) {
            if (type == String.class) {
                return "value";
            }
            if (type == URI.class) {
                return URI.create("https://example.test");
            }
            if (type == Instant.class) {
                return Instant.EPOCH;
            }
            if (type == UUID.class) {
                return UUID.randomUUID();
            }
            if (type == Optional.class) {
                return Optional.empty();
            }
            if (type == List.class) {
                return List.of();
            }
            if (type == Set.class) {
                return Set.of();
            }
            if (type == Map.class) {
                return Map.of();
            }
            if (type.isEnum()) {
                return type.getEnumConstants()[0];
            }
            return null;
        }
        if (type == boolean.class) {
            return true;
        }
        if (type == char.class) {
            return 'x';
        }
        if (type == byte.class) {
            return (byte) 1;
        }
        if (type == short.class) {
            return (short) 1;
        }
        if (type == int.class) {
            return 1;
        }
        if (type == long.class) {
            return 1L;
        }
        if (type == float.class) {
            return 1F;
        }
        if (type == double.class) {
            return 1D;
        }
        return null;
    }
}
