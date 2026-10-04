package io.github.susimsek.kitezh.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.kitezh.mapper.RegisteredClientMapper;
import io.github.susimsek.kitezh.repository.ClientRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;

@ExtendWith(MockitoExtension.class)
class DomainRegisteredClientServiceTest {

    @Mock private ClientRepository clientRepository;
    @Mock private RegisteredClientMapper registeredClientMapper;
    @Mock private AuthorizationServerMapperSupport mapperSupport;

    @Test
    void savesMappedRegisteredClient() {
        RegisteredClient registeredClient = registeredClient();
        RegisteredClientEntity entity = new RegisteredClientEntity();
        when(registeredClientMapper.toEntity(registeredClient, mapperSupport)).thenReturn(entity);

        new DomainRegisteredClientService(clientRepository, registeredClientMapper, mapperSupport)
                .save(registeredClient);

        verify(clientRepository).save(entity);
    }

    @Test
    void findsByIdAndClientId() {
        RegisteredClientEntity entity = new RegisteredClientEntity();
        RegisteredClient registeredClient = registeredClient();
        when(clientRepository.findById("id-1")).thenReturn(Optional.of(entity));
        when(clientRepository.findByClientId("client")).thenReturn(Optional.of(entity));
        when(registeredClientMapper.toObject(entity, mapperSupport)).thenReturn(registeredClient);

        DomainRegisteredClientService service =
                new DomainRegisteredClientService(
                        clientRepository, registeredClientMapper, mapperSupport);

        assertThat(service.findById("id-1")).isSameAs(registeredClient);
        assertThat(service.findByClientId("client")).isSameAs(registeredClient);
        assertThat(service.findById("missing")).isNull();
        assertThat(service.findByClientId("missing")).isNull();
    }

    private static RegisteredClient registeredClient() {
        return RegisteredClient.withId("id-1")
                .clientId("client")
                .clientSecret("secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                .authorizationGrantType(AuthorizationGrantType.CLIENT_CREDENTIALS)
                .scope("openid")
                .build();
    }
}
