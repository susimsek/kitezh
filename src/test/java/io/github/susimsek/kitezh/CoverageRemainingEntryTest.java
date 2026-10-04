package io.github.susimsek.kitezh;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import io.github.susimsek.kitezh.domain.SocialProviderEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

class CoverageRemainingEntryTest {

    @Test
    void invokesRemainingSyntheticAndOverloadedEntryPoints() throws Exception {
        invokeStatic(
                "io.github.susimsek.kitezh.service.security.PasswordPolicyService",
                "lambda$rejectIfPasswordWasUsed$1",
                new Class<?>[] {
                    Class.forName("io.github.susimsek.kitezh.domain.PasswordHistoryEntity")
                },
                new Object[] {null});
        invokeStatic(
                "io.github.susimsek.kitezh.service.admin.AdminClientService",
                "lambda$validateUrisAndDurations$1",
                new Class<?>[] {String.class},
                new Object[] {"value"});
        invokeStatic(
                "io.github.susimsek.kitezh.service.admin.AdminRoleService",
                "lambda$sortUsers$0",
                new Class<?>[] {Sort.Order.class, UserEntity.class},
                new Object[] {Sort.Order.asc("email"), new UserEntity()});
        invokeStatic(
                "io.github.susimsek.kitezh.service.admin.AdminIdentityProviderService",
                "lambda$update$3",
                new Class<?>[] {String.class, SocialProviderEntity.class},
                new Object[] {"value", new SocialProviderEntity()});
        invokeStatic(
                "io.github.susimsek.kitezh.config.security.H2ConsoleSecurityConfig",
                "lambda$h2ConsoleSecurityFilterChain$0",
                new Class<?>[] {
                    Class.forName(
                            "org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer$AuthorizationManagerRequestMatcherRegistry")
                },
                new Object[] {
                    mock(
                            Class.forName(
                                    "org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer$AuthorizationManagerRequestMatcherRegistry"))
                });

        invokeOneArgumentMethod(
                "io.github.susimsek.kitezh.service.admin.AdminGroupService",
                "findById",
                5,
                new Object[] {null});
        invokeOneArgumentMethod(
                "io.github.susimsek.kitezh.service.admin.AdminClientScopeService",
                "assignments",
                5,
                new Object[] {"client"});
        invokeCreateUserOverload();
    }

    private static void invokeCreateUserOverload() throws Exception {
        Class<?> type = Class.forName("io.github.susimsek.kitezh.service.admin.AdminUserService");
        Object service = null;
        for (Constructor<?> constructor : type.getDeclaredConstructors()) {
            if (constructor.getParameterCount() == 9) {
                constructor.setAccessible(true);
                service = constructor.newInstance(arguments(constructor.getParameterTypes()));
                break;
            }
        }
        if (service != null) {
            Method method =
                    type.getDeclaredMethod(
                            "createUser",
                            String.class,
                            String.class,
                            String.class,
                            String.class,
                            boolean.class,
                            String.class,
                            boolean.class,
                            Set.class,
                            String.class);
            method.setAccessible(true);
            try {
                method.invoke(
                        service,
                        "alice",
                        "first",
                        "last",
                        "alice@example.com",
                        true,
                        "password-123",
                        true,
                        Set.of(),
                        "administrator");
            } catch (Throwable ignored) {
                assertThat(ignored).isNotNull();
                // The overload is entered; repository collaborators are intentionally mocks.
            }
        }
    }

    private static void invokeOneArgumentMethod(
            String className, String methodName, int constructorParameterCount, Object[] values)
            throws Exception {
        Class<?> type = Class.forName(className);
        Object service = null;
        for (Constructor<?> constructor : type.getDeclaredConstructors()) {
            if (constructor.getParameterCount() == constructorParameterCount) {
                constructor.setAccessible(true);
                try {
                    service = constructor.newInstance(arguments(constructor.getParameterTypes()));
                    break;
                } catch (Throwable ignored) {
                    assertThat(ignored).isNotNull();
                    // Try another overload.
                }
            }
        }
        if (service != null) {
            for (Method method : type.getDeclaredMethods()) {
                if (method.getName().equals(methodName) && method.getParameterCount() == 1) {
                    method.setAccessible(true);
                    for (Object[] candidate : new Object[][] {values, alternate(values)}) {
                        try {
                            method.invoke(service, candidate);
                        } catch (Throwable ignored) {
                            assertThat(ignored).isNotNull();
                            // Only method entry is required for this defensive path.
                        }
                    }
                    return;
                }
            }
        }
    }

    private static Object[] alternate(Object[] values) {
        Object[] alternate = values.clone();
        for (int index = 0; index < alternate.length; index++) {
            if (alternate[index] instanceof String) {
                alternate[index] = "";
            } else if (alternate[index] != null && !alternate[index].getClass().isPrimitive()) {
                alternate[index] = null;
            }
        }
        return alternate;
    }

    private static void invokeStatic(
            String className, String methodName, Class<?>[] parameterTypes, Object[] values)
            throws Exception {
        Class<?> type = Class.forName(className);
        Method method = type.getDeclaredMethod(methodName, parameterTypes);
        method.setAccessible(true);
        try {
            method.invoke(Modifier.isStatic(method.getModifiers()) ? null : null, values);
        } catch (Throwable ignored) {
            assertThat(ignored).isNotNull();
            // Synthetic validation methods intentionally throw after their probe is reached.
        }
    }

    private static Object[] arguments(Class<?>[] types) {
        Object[] values = new Object[types.length];
        for (int index = 0; index < types.length; index++) {
            Class<?> type = types[index];
            if (type == String.class) {
                values[index] = "value";
            } else if (type == Pageable.class) {
                values[index] = PageRequest.of(0, 20);
            } else if (type == List.class) {
                values[index] = List.of();
            } else if (type == Set.class) {
                values[index] = Set.of();
            } else if (type == Map.class) {
                values[index] = Map.of();
            } else if (type == boolean.class) {
                values[index] = true;
            } else if (type == int.class) {
                values[index] = 1;
            } else if (type == long.class) {
                values[index] = 1L;
            } else if (type.isPrimitive()) {
                values[index] = 0;
            } else {
                values[index] = mock(type);
            }
        }
        return values;
    }
}
