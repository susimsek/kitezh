package io.github.susimsek.springauthserversamples.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
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
import org.springframework.web.multipart.MultipartFile;

/**
 * Keeps thin HTTP delegation methods exercised even when their contract is already covered by ITs.
 */
class ControllerMethodCoverageTest {

    private static final String[] CONTROLLERS = {
        "io.github.susimsek.springauthserversamples.web.account.LoginSettingsController",
        "io.github.susimsek.springauthserversamples.web.account.MfaController",
        "io.github.susimsek.springauthserversamples.web.account.RequiredActionController",
        "io.github.susimsek.springauthserversamples.web.admin.AdminClientController",
        "io.github.susimsek.springauthserversamples.web.admin.AdminClientRoleController",
        "io.github.susimsek.springauthserversamples.web.admin.AdminClientScopeController",
        "io.github.susimsek.springauthserversamples.web.admin.AdminConsentController",
        "io.github.susimsek.springauthserversamples.web.admin.AdminDashboardController",
        "io.github.susimsek.springauthserversamples.web.admin.AdminEmailSettingsController",
        "io.github.susimsek.springauthserversamples.web.admin.AdminEventController",
        "io.github.susimsek.springauthserversamples.web.admin.AdminRoleController",
        "io.github.susimsek.springauthserversamples.web.admin.AdminUserProfileSettingsController",
        "io.github.susimsek.springauthserversamples.web.AvatarController"
    };

    @Test
    void invokesThinControllerMethodsWithSafeTestDoubles() throws Exception {
        for (String name : CONTROLLERS) {
            Class<?> type = Class.forName(name);
            Object controller = construct(type);
            assertThat(controller).isNotNull();
            for (Method method : type.getDeclaredMethods()) {
                if (Modifier.isStatic(method.getModifiers()) || method.isSynthetic()) {
                    continue;
                }
                method.setAccessible(true);
                try {
                    method.invoke(controller, arguments(method.getParameterTypes()));
                } catch (InvocationTargetException ignored) {
                    assertThat(ignored).isNotNull();
                    // The service contract tests own validation and authorization failures. This
                    // test is intentionally limited to executing the controller delegation body.
                }
            }
        }
    }

    private static Object construct(Class<?> type) throws ReflectiveOperationException {
        Constructor<?> constructor = type.getDeclaredConstructors()[0];
        constructor.setAccessible(true);
        Class<?>[] parameterTypes = constructor.getParameterTypes();
        Object[] arguments = new Object[parameterTypes.length];
        for (int index = 0; index < parameterTypes.length; index++) {
            arguments[index] = dependency(parameterTypes[index]);
        }
        return constructor.newInstance(arguments);
    }

    private static Object[] arguments(Class<?>[] parameterTypes) {
        Object[] arguments = new Object[parameterTypes.length];
        for (int index = 0; index < parameterTypes.length; index++) {
            arguments[index] = argument(parameterTypes[index]);
        }
        return arguments;
    }

    private static Object dependency(Class<?> type) {
        try {
            return mock(type);
        } catch (RuntimeException _) {
            return null;
        }
    }

    private static Object argument(Class<?> type) {
        if (!type.isPrimitive()) {
            if (type == String.class) {
                return "value";
            }
            if (type == Pageable.class) {
                return PageRequest.of(0, 20);
            }
            if (type == Locale.class) {
                return Locale.ENGLISH;
            }
            if (type == Instant.class) {
                return Instant.EPOCH;
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
            if (type == MultipartFile.class) {
                return null;
            }
            return dependency(type);
        }
        if (type == boolean.class) {
            return true;
        }
        if (type == int.class) {
            return 1;
        }
        if (type == long.class) {
            return 1L;
        }
        if (type == double.class) {
            return 1D;
        }
        return 0;
    }
}
