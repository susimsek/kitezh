package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.ClientMapperEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeMapperEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.repository.ClientMapperRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeMapperRepository;
import io.github.susimsek.springauthserversamples.repository.ClientScopeRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AdminClientScopeEvaluationServiceTest {

    private final ClientRepository clientRepository = mock(ClientRepository.class);
    private final ClientMapperRepository mapperRepository = mock(ClientMapperRepository.class);
    private final ClientScopeRepository scopeRepository = mock(ClientScopeRepository.class);
    private final ClientScopeMapperRepository scopeMapperRepository =
            mock(ClientScopeMapperRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);

    @Test
    void includesReusableScopeMappersInEvaluation() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-1");
        client.setClientId("demo-client");
        client.setScopes("openid account-api");
        ClientScopeEntity scope = new ClientScopeEntity();
        scope.setId("scope-1");
        scope.setName("account-api");
        ClientMapperEntity clientMapper =
                mapper("client-claim", "hardcoded-claim", "client_claim", "client");
        ClientScopeMapperEntity scopeMapper =
                scopeMapper("scope-claim", "hardcoded-claim", "scope_claim", "scope");
        when(clientRepository.findById("client-1")).thenReturn(Optional.of(client));
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-1"))
                .thenReturn(List.of(clientMapper));
        when(scopeRepository.findByNameIn(java.util.Set.of("account-api")))
                .thenReturn(List.of(scope));
        when(scopeMapperRepository.findAllByClientScopeIdInOrderByPriorityAscNameAsc(
                        List.of("scope-1")))
                .thenReturn(List.of(scopeMapper));

        var result = service().evaluate("client-1", "account-api", null);

        assertThat(result.effectiveScopes()).containsExactly("account-api");
        assertThat(result.mappedClaims()).containsExactly("client_claim", "scope_claim");
        assertThat(result.claims())
                .containsEntry("client_claim", "client")
                .containsEntry("scope_claim", "scope");
    }

    private AdminClientScopeEvaluationService service() {
        return new AdminClientScopeEvaluationService(
                clientRepository,
                mapperRepository,
                scopeRepository,
                scopeMapperRepository,
                userRepository);
    }

    private static ClientMapperEntity mapper(
            String name, String type, String claimName, String value) {
        ClientMapperEntity mapper = new ClientMapperEntity();
        mapper.setName(name);
        mapper.setMapperType(type);
        mapper.setClaimName(claimName);
        mapper.setValue(value);
        return mapper;
    }

    private static ClientScopeMapperEntity scopeMapper(
            String name, String type, String claimName, String value) {
        ClientScopeMapperEntity mapper = new ClientScopeMapperEntity();
        mapper.setName(name);
        mapper.setMapperType(type);
        mapper.setClaimName(claimName);
        mapper.setValue(value);
        return mapper;
    }
}
