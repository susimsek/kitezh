package io.github.susimsek.springauthserversamples.domain;

import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;

import org.hibernate.proxy.HibernateProxy;
import org.hibernate.proxy.LazyInitializer;

final class HibernateProxySupport {

    private HibernateProxySupport() {}

    static LazyInitializer lazyInitializer(Class<?> persistentClass) {
        LazyInitializer lazyInitializer = mock(LazyInitializer.class);
        doReturn(persistentClass).when(lazyInitializer).getPersistentClass();
        return lazyInitializer;
    }

    static final class ProxyUserEntity extends UserEntity implements HibernateProxy {

        private final LazyInitializer lazyInitializer;

        ProxyUserEntity(Class<?> persistentClass) {
            this.lazyInitializer = lazyInitializer(persistentClass);
        }

        @Override
        public Object writeReplace() {
            return this;
        }

        @Override
        public LazyInitializer getHibernateLazyInitializer() {
            return lazyInitializer;
        }
    }

    static final class ProxyAuthorityEntity extends AuthorityEntity implements HibernateProxy {

        private final LazyInitializer lazyInitializer;

        ProxyAuthorityEntity(Class<?> persistentClass) {
            this.lazyInitializer = lazyInitializer(persistentClass);
        }

        @Override
        public Object writeReplace() {
            return this;
        }

        @Override
        public LazyInitializer getHibernateLazyInitializer() {
            return lazyInitializer;
        }
    }

    static final class ProxyRegisteredClientEntity extends RegisteredClientEntity
            implements HibernateProxy {

        private final LazyInitializer lazyInitializer;

        ProxyRegisteredClientEntity(Class<?> persistentClass) {
            this.lazyInitializer = lazyInitializer(persistentClass);
        }

        @Override
        public Object writeReplace() {
            return this;
        }

        @Override
        public LazyInitializer getHibernateLazyInitializer() {
            return lazyInitializer;
        }
    }

    static final class ProxyClientRoleEntity extends ClientRoleEntity implements HibernateProxy {

        private final LazyInitializer lazyInitializer;

        ProxyClientRoleEntity(Class<?> persistentClass) {
            this.lazyInitializer = lazyInitializer(persistentClass);
        }

        @Override
        public Object writeReplace() {
            return this;
        }

        @Override
        public LazyInitializer getHibernateLazyInitializer() {
            return lazyInitializer;
        }
    }

    static final class ProxyAuthorizationConsentEntity extends AuthorizationConsentEntity
            implements HibernateProxy {

        private final LazyInitializer lazyInitializer;

        ProxyAuthorizationConsentEntity(Class<?> persistentClass) {
            this.lazyInitializer = lazyInitializer(persistentClass);
        }

        @Override
        public Object writeReplace() {
            return this;
        }

        @Override
        public LazyInitializer getHibernateLazyInitializer() {
            return lazyInitializer;
        }
    }

    static final class ProxyAuthorizationEntity extends AuthorizationEntity
            implements HibernateProxy {

        private final LazyInitializer lazyInitializer;

        ProxyAuthorizationEntity(Class<?> persistentClass) {
            this.lazyInitializer = lazyInitializer(persistentClass);
        }

        @Override
        public Object writeReplace() {
            return this;
        }

        @Override
        public LazyInitializer getHibernateLazyInitializer() {
            return lazyInitializer;
        }
    }

    static final class ProxyOAuth2KeyEntity extends OAuth2KeyEntity implements HibernateProxy {

        private final LazyInitializer lazyInitializer;

        ProxyOAuth2KeyEntity(Class<?> persistentClass) {
            this.lazyInitializer = lazyInitializer(persistentClass);
        }

        @Override
        public Object writeReplace() {
            return this;
        }

        @Override
        public LazyInitializer getHibernateLazyInitializer() {
            return lazyInitializer;
        }
    }
}
