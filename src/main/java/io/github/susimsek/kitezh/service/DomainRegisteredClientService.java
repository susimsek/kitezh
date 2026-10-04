package io.github.susimsek.kitezh.service;

import io.github.susimsek.kitezh.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.kitezh.mapper.RegisteredClientMapper;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.security.ClientSecuritySettings;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DomainRegisteredClientService implements RegisteredClientRepository {

    private final ClientRepository clientRepository;
    private final RegisteredClientMapper registeredClientMapper;
    private final AuthorizationServerMapperSupport mapperSupport;

    @Override
    @Transactional
    @CacheEvict(
            cacheNames = ClientRepository.REGISTERED_CLIENT_BY_CLIENT_ID_CACHE,
            allEntries = true)
    public void save(RegisteredClient registeredClient) {
        clientRepository.save(registeredClientMapper.toEntity(registeredClient, mapperSupport));
    }

    @Override
    @Transactional(readOnly = true)
    public RegisteredClient findById(String id) {
        return clientRepository
                .findById(id)
                .map(entity -> registeredClientMapper.toObject(entity, mapperSupport))
                .filter(ClientSecuritySettings::isEnabled)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public RegisteredClient findByClientId(String clientId) {
        return clientRepository
                .findByClientId(clientId)
                .map(entity -> registeredClientMapper.toObject(entity, mapperSupport))
                .filter(ClientSecuritySettings::isEnabled)
                .orElse(null);
    }
}
