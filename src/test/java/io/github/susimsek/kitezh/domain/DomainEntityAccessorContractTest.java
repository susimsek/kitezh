package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.beans.IntrospectionException;
import java.beans.Introspector;
import java.beans.PropertyDescriptor;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Verifies the JavaBean accessors used by Hibernate and DTO mapping for persisted domain models.
 */
class DomainEntityAccessorContractTest {

    private static final List<Class<?>> ENTITY_TYPES =
            List.of(
                    LoginSettingsEntity.class,
                    ClientRoleEntity.class,
                    UserEntity.class,
                    LdapFederationProviderEntity.class,
                    SocialProviderEntity.class,
                    GroupEntity.class,
                    AuthorizationEntity.class,
                    ClientScopeEntity.class,
                    AuthorityEntity.class,
                    SocialIdentityEntity.class,
                    SamlProviderConfigEntity.class,
                    CibaAuthenticationRequestEntity.class);

    @Test
    void persistedEntityPropertiesCanBeReadAndWrittenThroughBeanAccessors()
            throws IntrospectionException, ReflectiveOperationException {
        for (Class<?> entityType : ENTITY_TYPES) {
            Object entity = instantiate(entityType);

            for (PropertyDescriptor property :
                    Introspector.getBeanInfo(entityType, Object.class).getPropertyDescriptors()) {
                if (property.getReadMethod() == null || property.getWriteMethod() == null) {
                    continue;
                }

                Object originalValue = property.getReadMethod().invoke(entity);
                property.getWriteMethod().invoke(entity, originalValue);

                assertThat(property.getReadMethod().invoke(entity))
                        .as(
                                "%s.%s accessor round trip",
                                entityType.getSimpleName(), property.getName())
                        .isEqualTo(originalValue);
            }
        }
    }

    private static Object instantiate(Class<?> entityType)
            throws NoSuchMethodException,
                    InvocationTargetException,
                    InstantiationException,
                    IllegalAccessException {
        Constructor<?> constructor = entityType.getDeclaredConstructor();
        return constructor.newInstance();
    }
}
