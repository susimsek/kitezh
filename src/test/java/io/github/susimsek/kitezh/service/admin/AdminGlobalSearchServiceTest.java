package io.github.susimsek.kitezh.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.AuthorityEntity;
import io.github.susimsek.kitezh.domain.GroupEntity;
import io.github.susimsek.kitezh.domain.RegisteredClientEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.repository.AuthorityRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.GroupRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.security.authentication.TestingAuthenticationToken;

@ExtendWith(MockitoExtension.class)
class AdminGlobalSearchServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private AuthorityRepository authorityRepository;
    @Mock private GroupRepository groupRepository;

    @Test
    void returnsPermissionFilteredResultsForAllResourceTypes() {
        UserEntity user = new UserEntity();
        user.setId(2L);
        user.setUsername("admin");
        user.setEmail("admin@example.test");

        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-1");
        client.setClientId("demo-client");
        client.setClientName("Demo Client");

        final AuthorityEntity role = new AuthorityEntity(3L, "ROLE_ADMIN", "Administrator");
        GroupEntity group = new GroupEntity();
        group.setId(4L);
        group.setName("administrators");

        when(userRepository.searchUsers(any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(user)));
        when(clientRepository.findByClientIdContainingIgnoreCaseOrClientNameContainingIgnoreCase(
                        any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(client)));
        when(authorityRepository.findByNameContainingIgnoreCase(any(), any()))
                .thenReturn(new PageImpl<>(List.of(role)));
        when(groupRepository.findByNameContainingIgnoreCase(any(), any()))
                .thenReturn(new PageImpl<>(List.of(group)));

        var response =
                service()
                        .search(
                                " admin ",
                                new TestingAuthenticationToken(
                                        "admin", null, AuthoritiesConstants.ADMIN));

        assertThat(response.results())
                .extracting("type")
                .containsExactly("user", "client", "role", "group");
        assertThat(response.results())
                .extracting("title")
                .containsExactly("admin", "demo-client", "ROLE_ADMIN", "administrators");
        assertThat(response.results().getFirst().href()).isEqualTo("/admin/users/2");
    }

    @Test
    void onlySearchesResourcesAllowedByAuthorities() {
        RegisteredClientEntity client = new RegisteredClientEntity();
        client.setId("client-1");
        client.setClientId("demo-client");
        client.setClientName("Demo Client");
        when(clientRepository.findByClientIdContainingIgnoreCaseOrClientNameContainingIgnoreCase(
                        any(), any(), any()))
                .thenReturn(new PageImpl<>(List.of(client)));

        var response =
                service()
                        .search(
                                "demo",
                                new TestingAuthenticationToken(
                                        "client-manager", null, AuthoritiesConstants.CLIENT_QUERY));

        assertThat(response.results())
                .singleElement()
                .satisfies(
                        result -> {
                            assertThat(result.type()).isEqualTo("client");
                            assertThat(result.title()).isEqualTo("demo-client");
                        });
        verifyNoInteractions(userRepository, authorityRepository, groupRepository);
    }

    @Test
    void doesNotQueryForBlankSearchText() {
        var response =
                service()
                        .search(
                                "  ",
                                new TestingAuthenticationToken(
                                        "admin", null, AuthoritiesConstants.ADMIN));

        assertThat(response.results()).isEmpty();
        verifyNoInteractions(
                userRepository, clientRepository, authorityRepository, groupRepository);
    }

    private AdminGlobalSearchService service() {
        return new AdminGlobalSearchService(
                userRepository, clientRepository, authorityRepository, groupRepository);
    }
}
