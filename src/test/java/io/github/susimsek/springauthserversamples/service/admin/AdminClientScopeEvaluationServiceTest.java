package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.ClientMapperEntity;
import io.github.susimsek.springauthserversamples.domain.ClientRoleEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeEntity;
import io.github.susimsek.springauthserversamples.domain.ClientScopeMapperEntity;
import io.github.susimsek.springauthserversamples.domain.GroupAttribute;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
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

    @Test
    void mergesAudienceMappersIntoTheStandardAudienceClaim() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-1");
        client.setClientId("demo-client");
        client.setScopes("openid");
        when(clientRepository.findById("client-1")).thenReturn(Optional.of(client));
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-1"))
                .thenReturn(
                        List.of(
                                mapper("first", "audience", null, "reports-api"),
                                mapper("second", "audience", null, "billing-api")));

        var result = service().evaluate("client-1", "unknown", null);

        assertThat(result.claims()).containsEntry("aud", List.of("reports-api", "billing-api"));
    }

    @Test
    void evaluatesUserPropertyMappersForTheSelectedSubject() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-1");
        client.setClientId("demo-client");
        client.setScopes("openid");
        ClientMapperEntity mapper =
                mapper("username", "user-property", "preferred_username", "username");
        mapper.setSource("username");
        UserEntity user = new UserEntity();
        user.setUsername("admin");
        user.setEmail("admin@example.com");
        when(clientRepository.findById("client-1")).thenReturn(Optional.of(client));
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-1"))
                .thenReturn(List.of(mapper));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));

        var result = service().evaluate("client-1", "openid", "admin");

        assertThat(result.claims()).containsEntry("preferred_username", "admin");
    }

    @Test
    void evaluatesUserAndGroupMapperTypes() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-1");
        client.setClientId("demo-client");
        client.setScopes("openid");
        UserEntity user = new UserEntity();
        user.setId(7L);
        user.setUsername("admin");
        user.setFirstName("Ada");
        user.setLastName("Lovelace");
        user.setEmail("ada@example.com");
        user.setPreferredLocale("tr");
        user.getAuthorities().add(new AuthorityEntity(1L, "ROLE_USER"));
        RegisteredClientEntity otherClient = new RegisteredClientEntity();
        otherClient.setId("other");
        otherClient.setClientId("other-client");
        ClientRoleEntity otherRole = new ClientRoleEntity(otherClient, "reports.read", null);
        otherRole.setId(2L);
        user.getClientRoles().add(otherRole);
        GroupEntity group = new GroupEntity();
        group.setName("Operations");
        group.getAttributes().add(new GroupAttribute("department", "engineering"));
        user.getGroups().add(group);
        List<ClientMapperEntity> mappers =
                List.of(
                        mapper("hardcoded", "hardcoded-claim", "hardcoded", "value"),
                        mapper("audience", "audience", "audience", "reports-api"),
                        mapper("audience-resolve", "audience-resolve", "audience", null),
                        mapperWithSource("first", "user-property", "first", "firstName"),
                        mapperWithSource("last", "user-property", "last", "lastName"),
                        mapper("email", "email", "mail", null),
                        mapper("full", "full-name", "full", null),
                        mapper("locale", "locale", "locale", null),
                        mapper("username", "username", "user", null),
                        mapper("groups", "group-membership", "groups", null),
                        mapperWithSource(
                                "group-attribute", "group-attribute", "department", "department"),
                        mapper("roles", "application-role", "roles", null),
                        mapper("client-roles", "client-role", "client-roles", null));
        when(clientRepository.findById("client-1")).thenReturn(Optional.of(client));
        when(mapperRepository.findAllByClientIdOrderByPriorityAscNameAsc("client-1"))
                .thenReturn(mappers);
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(user));

        var result = service().evaluate("client-1", "openid", "admin");

        assertThat(result.claims())
                .containsEntry("hardcoded", "value")
                .containsEntry("first", "Ada")
                .containsEntry("last", "Lovelace")
                .containsEntry("mail", "ada@example.com")
                .containsEntry("full", "Ada Lovelace")
                .containsEntry("locale", "tr")
                .containsEntry("user", "admin")
                .containsEntry("groups", List.of("/Operations"))
                .containsEntry("department", "engineering")
                .containsKey("roles")
                .containsKey("client-roles")
                .containsEntry("aud", List.of("reports-api", "other-client"));
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

    private static ClientMapperEntity mapperWithSource(
            String name, String type, String claimName, String source) {
        ClientMapperEntity mapper = mapper(name, type, claimName, null);
        mapper.setSource(source);
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
