package io.github.susimsek.springauthserversamples.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationMapperEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationMapperType;
import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.domain.UserProfileAttributeDefinitionEntity;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.GroupRepository;
import io.github.susimsek.springauthserversamples.repository.LdapFederationMapperRepository;
import io.github.susimsek.springauthserversamples.repository.UserProfileAttributeDefinitionRepository;
import io.github.susimsek.springauthserversamples.repository.UserProfileAttributeRepository;
import io.github.susimsek.springauthserversamples.security.AuthoritiesConstants;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LdapFederationMapperServiceTest {

    private final LdapFederationMapperRepository mapperRepository =
            mock(LdapFederationMapperRepository.class);
    private final LdapDirectoryClient directoryClient = mock(LdapDirectoryClient.class);
    private final GroupRepository groupRepository = mock(GroupRepository.class);
    private final AuthorityRepository authorityRepository = mock(AuthorityRepository.class);
    private final UserProfileAttributeDefinitionRepository profileDefinitionRepository =
            mock(UserProfileAttributeDefinitionRepository.class);
    private final UserProfileAttributeRepository profileAttributeRepository =
            mock(UserProfileAttributeRepository.class);
    private final LdapFederationMapperService service =
            new LdapFederationMapperService(
                    mapperRepository,
                    directoryClient,
                    groupRepository,
                    authorityRepository,
                    profileDefinitionRepository,
                    profileAttributeRepository);
    private final LdapFederationProviderEntity provider = new LdapFederationProviderEntity();
    private final LdapDirectoryClient.Configuration configuration =
            new LdapDirectoryClient.Configuration(
                    "ldap://directory.example.com:389",
                    "cn=bind,dc=example,dc=com",
                    "password",
                    "ou=users,dc=example,dc=com",
                    "uid",
                    "entryUUID",
                    "mail",
                    "givenName",
                    "sn",
                    "uid",
                    "inetOrgPerson",
                    "SUBTREE");

    @BeforeEach
    void setUp() {
        provider.setId("provider-id");
    }

    @Test
    void appliesFullNameHardcodedRoleAndMsadAccountMappers() {
        UserEntity user = user();
        AuthorityEntity userRole = authority("ROLE_USER");
        AuthorityEntity adminRole = authority("ROLE_ADMIN");
        when(authorityRepository.findByName("ROLE_ADMIN")).thenReturn(Optional.of(adminRole));
        when(authorityRepository.findByName("ROLE_USER")).thenReturn(Optional.of(userRole));
        when(mapperRepository.findAllByProviderIdAndEnabledTrueOrderByNameAsc(provider.getId()))
                .thenReturn(
                        List.of(
                                mapper("name", LdapFederationMapperType.FULL_NAME),
                                mapperWithTarget(
                                        "admin",
                                        LdapFederationMapperType.HARDCODED_ROLE,
                                        "ROLE_ADMIN"),
                                mapper("account", LdapFederationMapperType.MSAD_USER_ACCOUNT)));
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("external-id", "uid=alice", provider, user);
        LdapDirectoryClient.LdapUser external =
                new LdapDirectoryClient.LdapUser(
                        "uid=alice",
                        "external-id",
                        "alice",
                        "alice@example.com",
                        "Alice",
                        "Example",
                        Map.of(
                                "cn", List.of("Alice Example"),
                                "userAccountControl", List.of("514"),
                                "pwdLastSet", List.of("0")));

        service.apply(provider, configuration, external, user, identity);

        assertThat(user.getFirstName()).isEqualTo("Alice");
        assertThat(user.getLastName()).isEqualTo("Example");
        assertThat(user.isEnabled()).isFalse();
        assertThat(user.isMustChangePassword()).isTrue();
        assertThat(user.getAuthorities())
                .extracting(AuthorityEntity::getName)
                .containsExactlyInAnyOrder("ROLE_USER", "ROLE_ADMIN");
        assertThat(identity.getSyncedRoleNames()).containsExactly("ROLE_ADMIN");
    }

    @Test
    void synchronizesLdapGroupsAndRemovesPreviousMemberships() {
        UserEntity user = user();
        GroupEntity previous = group("old");
        GroupEntity current = group("engineering");
        user.getGroups().add(previous);
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("external-id", "uid=alice", provider, user);
        identity.getSyncedGroupNames().add("old");
        when(mapperRepository.findAllByProviderIdAndEnabledTrueOrderByNameAsc(provider.getId()))
                .thenReturn(List.of(mapper("groups", LdapFederationMapperType.GROUP)));
        when(directoryClient.findGroups(
                        any(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(List.of("engineering"));
        when(groupRepository.findByNameIgnoreCase("engineering")).thenReturn(Optional.of(current));

        service.apply(provider, configuration, external(), user, identity);

        assertThat(user.getGroups()).containsExactly(current);
        assertThat(identity.getSyncedGroupNames()).containsExactly("engineering");
    }

    @Test
    void mapsBuiltInAndCustomUserAttributesAndCreatesMissingRole() {
        UserEntity user = user();
        user.setId(42L);
        UserProfileAttributeDefinitionEntity definition =
                new UserProfileAttributeDefinitionEntity();
        definition.setId(7L);
        definition.setName("department");
        when(profileDefinitionRepository.findByNameIgnoreCase("department"))
                .thenReturn(Optional.of(definition));
        LdapFederationMapperEntity roleMapper =
                mapperWithTarget("admin", LdapFederationMapperType.ROLE, "ROLE_ADMIN");
        roleMapper.setLdapAttribute("memberOf");
        when(mapperRepository.findAllByProviderIdAndEnabledTrueOrderByNameAsc(provider.getId()))
                .thenReturn(
                        List.of(
                                mapperWithUserAttribute(
                                        "mail", "email", LdapFederationMapperType.USER_ATTRIBUTE),
                                mapperWithUserAttribute(
                                        "department",
                                        "department",
                                        LdapFederationMapperType.CERTIFICATE),
                                mapperWithUserAttribute(
                                        "active",
                                        "enabled",
                                        LdapFederationMapperType.USER_ATTRIBUTE),
                                roleMapper));
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("external-id", "uid=alice", provider, user);
        LdapDirectoryClient.LdapUser external =
                new LdapDirectoryClient.LdapUser(
                        "uid=alice",
                        "external-id",
                        "alice",
                        "alice@example.com",
                        "Alice",
                        "Example",
                        Map.of(
                                "mail", List.of("alice@example.com"),
                                "department", List.of("Engineering", "Platform"),
                                "active", List.of("true"),
                                "memberOf", List.of("ROLE_ADMIN")));
        AuthorityEntity createdRole = authority("ROLE_ADMIN");
        when(authorityRepository.findByName("ROLE_ADMIN")).thenReturn(Optional.empty());
        when(authorityRepository.save(any(AuthorityEntity.class))).thenReturn(createdRole);
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(authority(AuthoritiesConstants.USER)));

        service.apply(provider, configuration, external, user, identity);

        assertThat(user.getEmail()).isEqualTo("alice@example.com");
        assertThat(user.isEnabled()).isTrue();
        assertThat(identity.getSyncedRoleNames()).containsExactly("ROLE_ADMIN");
        verify(profileAttributeRepository).deleteAllByUserIdAndDefinitionId(42L, 7L);
        verify(profileAttributeRepository, org.mockito.Mockito.times(2)).save(any());
    }

    @Test
    void mapsRoleFromGroupAndCreatesGroupWhenItDoesNotExist() {
        UserEntity user = user();
        LdapFederationIdentityEntity identity =
                new LdapFederationIdentityEntity("external-id", "uid=alice", provider, user);
        LdapFederationMapperEntity roleMapper =
                mapperWithTarget(
                        "engineering-role", LdapFederationMapperType.ROLE, "ROLE_ENGINEER");
        roleMapper.setLdapAttribute("memberOf");
        LdapFederationMapperEntity groupMapper = mapper("groups", LdapFederationMapperType.GROUP);
        when(mapperRepository.findAllByProviderIdAndEnabledTrueOrderByNameAsc(provider.getId()))
                .thenReturn(List.of(roleMapper, groupMapper));
        when(directoryClient.findGroups(
                        any(), anyString(), anyString(), anyString(), anyString(), anyString()))
                .thenReturn(List.of("ROLE_ENGINEER"), List.of("engineering"));
        when(groupRepository.findByNameIgnoreCase("engineering")).thenReturn(Optional.empty());
        GroupEntity created = group("engineering");
        when(groupRepository.save(any(GroupEntity.class))).thenReturn(created);
        AuthorityEntity role = authority("ROLE_ENGINEER");
        when(authorityRepository.findByName("ROLE_ENGINEER")).thenReturn(Optional.of(role));
        when(authorityRepository.findByName(AuthoritiesConstants.USER))
                .thenReturn(Optional.of(authority(AuthoritiesConstants.USER)));

        service.apply(provider, configuration, external(), user, identity);

        assertThat(user.getGroups()).containsExactly(created);
        assertThat(user.getAuthorities()).contains(role);
        assertThat(identity.getSyncedRoleNames()).containsExactly("ROLE_ENGINEER");
        verify(groupRepository).save(any(GroupEntity.class));
    }

    @Test
    void handlesBlankAndInvalidMsadAttributesAndPreservesLastNameRules() {
        UserEntity user = user();
        when(mapperRepository.findAllByProviderIdAndEnabledTrueOrderByNameAsc(provider.getId()))
                .thenReturn(
                        List.of(
                                mapper("name", LdapFederationMapperType.FULL_NAME),
                                mapper("account", LdapFederationMapperType.MSAD_USER_ACCOUNT)));

        service.apply(
                provider,
                configuration,
                new LdapDirectoryClient.LdapUser(
                        "uid=alice",
                        "external-id",
                        "alice",
                        "alice@example.com",
                        "Alice",
                        "Example",
                        Map.of(
                                "cn", List.of("  "),
                                "userAccountControl", List.of("invalid"),
                                "pwdLastSet", List.of("0"))),
                user);

        assertThat(user.getFirstName()).isNull();
        assertThat(user.getLastName()).isNull();
        assertThat(user.isEnabled()).isFalse();
        assertThat(user.isMustChangePassword()).isTrue();
    }

    private static UserEntity user() {
        UserEntity user = new UserEntity();
        user.setAuthorities(new java.util.HashSet<>());
        user.setGroups(new java.util.HashSet<>());
        return user;
    }

    private static AuthorityEntity authority(String name) {
        AuthorityEntity authority = new AuthorityEntity();
        authority.setName(name);
        return authority;
    }

    private static GroupEntity group(String name) {
        GroupEntity group = new GroupEntity();
        group.setName(name);
        return group;
    }

    private static LdapFederationMapperEntity mapper(String name, LdapFederationMapperType type) {
        return mapperWithTarget(name, type, null);
    }

    private static LdapFederationMapperEntity mapperWithUserAttribute(
            String ldapAttribute, String userAttribute, LdapFederationMapperType type) {
        LdapFederationMapperEntity mapper = mapper(ldapAttribute, type);
        mapper.setLdapAttribute(ldapAttribute);
        mapper.setUserAttribute(userAttribute);
        return mapper;
    }

    private static LdapFederationMapperEntity mapperWithTarget(
            String name, LdapFederationMapperType type, String target) {
        LdapFederationMapperEntity mapper = new LdapFederationMapperEntity();
        mapper.setName(name);
        mapper.setType(type);
        mapper.setTargetName(target);
        mapper.setLdapAttribute("cn");
        mapper.setGroupSearchBase("ou=groups,dc=example,dc=com");
        mapper.setGroupObjectClass("groupOfNames");
        mapper.setGroupNameAttribute("cn");
        mapper.setGroupMemberAttribute("member");
        return mapper;
    }

    private static LdapDirectoryClient.LdapUser external() {
        return new LdapDirectoryClient.LdapUser(
                "uid=alice", "external-id", "alice", "alice@example.com", "Alice", "Example");
    }
}
