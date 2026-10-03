package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.RegisteredClientEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminSearchResponseDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminSearchResultDTO;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.GroupRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.security.AuthoritiesConstants;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminGlobalSearchService {

    private static final int RESULTS_PER_RESOURCE = 5;
    private static final Set<String> USER_AUTHORITIES =
            Set.of(
                    AuthoritiesConstants.ADMIN,
                    AuthoritiesConstants.USER_QUERY,
                    AuthoritiesConstants.USER_VIEWER,
                    AuthoritiesConstants.USER_MANAGER);
    private static final Set<String> CLIENT_AUTHORITIES =
            Set.of(
                    AuthoritiesConstants.ADMIN,
                    AuthoritiesConstants.CLIENT_QUERY,
                    AuthoritiesConstants.CLIENT_VIEWER,
                    AuthoritiesConstants.CLIENT_MANAGER);
    private static final Set<String> ROLE_AUTHORITIES =
            Set.of(
                    AuthoritiesConstants.ADMIN,
                    AuthoritiesConstants.USER_VIEWER,
                    AuthoritiesConstants.USER_MANAGER);
    private static final Set<String> GROUP_AUTHORITIES =
            Set.of(
                    AuthoritiesConstants.ADMIN,
                    AuthoritiesConstants.GROUP_QUERY,
                    AuthoritiesConstants.GROUP_VIEWER,
                    AuthoritiesConstants.GROUP_MANAGER,
                    AuthoritiesConstants.USER_VIEWER,
                    AuthoritiesConstants.USER_MANAGER);

    private final UserRepository userRepository;
    private final ClientRepository clientRepository;
    private final AuthorityRepository authorityRepository;
    private final GroupRepository groupRepository;

    public AdminGlobalSearchService(
            UserRepository userRepository,
            ClientRepository clientRepository,
            AuthorityRepository authorityRepository,
            GroupRepository groupRepository) {
        this.userRepository = userRepository;
        this.clientRepository = clientRepository;
        this.authorityRepository = authorityRepository;
        this.groupRepository = groupRepository;
    }

    @Transactional(readOnly = true)
    public AdminSearchResponseDTO search(String query, Authentication authentication) {
        String normalizedQuery = AdminSearch.normalize(query);
        if (normalizedQuery.isEmpty()) {
            return new AdminSearchResponseDTO(List.of());
        }

        PageRequest pageRequest =
                PageRequest.of(0, RESULTS_PER_RESOURCE, Sort.by(Sort.Direction.ASC, "username"));
        List<AdminSearchResultDTO> results = new ArrayList<>();
        if (hasAny(authentication, USER_AUTHORITIES)) {
            results.addAll(userResults(normalizedQuery, pageRequest));
        }
        if (hasAny(authentication, CLIENT_AUTHORITIES)) {
            results.addAll(clientResults(normalizedQuery, pageRequest));
        }
        if (hasAny(authentication, ROLE_AUTHORITIES)) {
            results.addAll(roleResults(normalizedQuery));
        }
        if (hasAny(authentication, GROUP_AUTHORITIES)) {
            results.addAll(groupResults(normalizedQuery));
        }
        return new AdminSearchResponseDTO(results);
    }

    private List<AdminSearchResultDTO> userResults(String query, PageRequest pageRequest) {
        return userRepository.searchUsers(query, null, pageRequest).stream()
                .map(AdminGlobalSearchService::userResult)
                .toList();
    }

    private List<AdminSearchResultDTO> clientResults(String query, PageRequest pageRequest) {
        PageRequest clientPageRequest =
                PageRequest.of(0, RESULTS_PER_RESOURCE, Sort.by(Sort.Direction.ASC, "clientId"));
        return clientRepository
                .findByClientIdContainingIgnoreCaseOrClientNameContainingIgnoreCase(
                        query, query, clientPageRequest)
                .stream()
                .map(AdminGlobalSearchService::clientResult)
                .toList();
    }

    private List<AdminSearchResultDTO> roleResults(String query) {
        PageRequest rolePageRequest =
                PageRequest.of(0, RESULTS_PER_RESOURCE, Sort.by(Sort.Direction.ASC, "name"));
        return authorityRepository.findByNameContainingIgnoreCase(query, rolePageRequest).stream()
                .map(AdminGlobalSearchService::roleResult)
                .toList();
    }

    private List<AdminSearchResultDTO> groupResults(String query) {
        PageRequest groupPageRequest =
                PageRequest.of(0, RESULTS_PER_RESOURCE, Sort.by(Sort.Direction.ASC, "name"));
        return groupRepository.findByNameContainingIgnoreCase(query, groupPageRequest).stream()
                .map(AdminGlobalSearchService::groupResult)
                .toList();
    }

    private static AdminSearchResultDTO userResult(UserEntity user) {
        String subtitle =
                Stream.of(user.getFirstName(), user.getLastName(), user.getEmail())
                        .filter(value -> value != null && !value.isBlank())
                        .reduce((left, right) -> left + " · " + right)
                        .orElse(null);
        return new AdminSearchResultDTO(
                "user",
                user.getId().toString(),
                user.getUsername(),
                subtitle,
                "/admin/users/" + user.getId());
    }

    private static AdminSearchResultDTO clientResult(RegisteredClientEntity client) {
        return new AdminSearchResultDTO(
                "client",
                client.getId(),
                client.getClientId(),
                client.getClientName(),
                "/admin/clients/" + client.getId() + "/settings");
    }

    private static AdminSearchResultDTO roleResult(AuthorityEntity role) {
        return new AdminSearchResultDTO(
                "role",
                role.getName(),
                role.getName(),
                role.getDescription(),
                "/admin/roles/" + role.getName() + "/details");
    }

    private static AdminSearchResultDTO groupResult(GroupEntity group) {
        return new AdminSearchResultDTO(
                "group",
                group.getId().toString(),
                group.getName(),
                null,
                "/admin/groups/" + group.getId() + "/details");
    }

    private static boolean hasAny(Authentication authentication, Collection<String> expected) {
        return authentication != null
                && authentication.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .anyMatch(expected::contains);
    }
}
