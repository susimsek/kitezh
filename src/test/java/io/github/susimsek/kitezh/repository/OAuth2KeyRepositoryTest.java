package io.github.susimsek.kitezh.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.jpa.repository.Query;

class OAuth2KeyRepositoryTest {

    @Test
    void keysQueryIsExplicitAndCached() throws Exception {
        Method method = OAuth2KeyRepository.class.getMethod("findAllKeys");
        Cacheable cacheable = method.getAnnotation(Cacheable.class);
        Query query = method.getAnnotation(Query.class);

        assertThat(cacheable).isNotNull();
        assertThat(cacheable.cacheNames()).containsExactly(OAuth2KeyRepository.OAUTH2_KEYS_CACHE);
        assertThat(cacheable.unless()).isEmpty();
        assertThat(query).isNotNull();
        assertThat(query.value())
                .isEqualTo("select k from OAuth2KeyEntity k order by k.createdAt desc");
    }
}
