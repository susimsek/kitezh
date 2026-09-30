package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.AuthorityEntity;
import io.github.susimsek.springauthserversamples.domain.GroupEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationIdentityEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationMapperEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationMapperType;
import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.domain.UserEntity;
import io.github.susimsek.springauthserversamples.domain.UserProfileAttributeDefinitionEntity;
import io.github.susimsek.springauthserversamples.domain.UserProfileAttributeEntity;
import io.github.susimsek.springauthserversamples.repository.AuthorityRepository;
import io.github.susimsek.springauthserversamples.repository.GroupRepository;
import io.github.susimsek.springauthserversamples.repository.LdapFederationMapperRepository;
import io.github.susimsek.springauthserversamples.repository.UserProfileAttributeDefinitionRepository;
import io.github.susimsek.springauthserversamples.repository.UserProfileAttributeRepository;
import io.github.susimsek.springauthserversamples.security.AuthoritiesConstants;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;

/** Applies provider-scoped LDAP mappers to a local or transient application user. */
@Service
@RequiredArgsConstructor
public class LdapFederationMapperService {

    private final LdapFederationMapperRepository mapperRepository;
    private final LdapDirectoryClient directoryClient;
    private final GroupRepository groupRepository;
    private final AuthorityRepository authorityRepository;
    private final UserProfileAttributeDefinitionRepository profileDefinitionRepository;
    private final UserProfileAttributeRepository profileAttributeRepository;

    public void apply(
            LdapFederationProviderEntity provider,
            LdapDirectoryClient.Configuration configuration,
            LdapDirectoryClient.LdapUser external,
            UserEntity user) {
        apply(provider, configuration, external, user, null);
    }

    @CacheEvict(cacheNames = AuthorityRepository.AUTHORITY_BY_NAME_CACHE, allEntries = true)
    public void apply(
            LdapFederationProviderEntity provider,
            LdapDirectoryClient.Configuration configuration,
            LdapDirectoryClient.LdapUser external,
            UserEntity user,
            LdapFederationIdentityEntity identity) {
        resetPreviousSynchronization(user, identity);
        for (LdapFederationMapperEntity mapper :
                mapperRepository.findAllByProviderIdAndEnabledTrueOrderByNameAsc(
                        provider.getId())) {
            applyMapper(configuration, external, user, mapper, identity);
        }
    }

    private void applyMapper(
            LdapDirectoryClient.Configuration configuration,
            LdapDirectoryClient.LdapUser external,
            UserEntity user,
            LdapFederationMapperEntity mapper,
            LdapFederationIdentityEntity identity) {
        LdapFederationMapperType type = mapper.getType();
        switch (type) {
            case USER_ATTRIBUTE, CERTIFICATE ->
                    setAttribute(
                            user,
                            mapper.getUserAttribute(),
                            external.values(mapper.getLdapAttribute()));
            case FULL_NAME -> applyFullName(user, external.values(mapper.getLdapAttribute()));
            case HARDCODED_ATTRIBUTE ->
                    setAttribute(
                            user,
                            mapper.getUserAttribute(),
                            List.of(value(mapper.getHardcodedValue())));
            case HARDCODED_ROLE -> addRole(user, mapper.getTargetName(), identity);
            case ROLE -> applyRoleMapper(configuration, external, user, mapper, identity);
            case GROUP -> applyGroupMapper(configuration, external, user, mapper, identity);
            case MSAD_USER_ACCOUNT -> applyMsadAccount(user, external);
            default -> throw new IllegalArgumentException("Unsupported LDAP mapper type: " + type);
        }
    }

    private void applyRoleMapper(
            LdapDirectoryClient.Configuration configuration,
            LdapDirectoryClient.LdapUser external,
            UserEntity user,
            LdapFederationMapperEntity mapper,
            LdapFederationIdentityEntity identity) {
        List<String> values = external.values(mapper.getLdapAttribute());
        if (values.stream().anyMatch(value -> matchesTarget(value, mapper.getTargetName()))) {
            addRole(user, mapper.getTargetName(), identity);
            return;
        }
        if (mapper.getGroupSearchBase() != null) {
            List<String> groups = findGroups(configuration, external, mapper);
            if (groups.stream().anyMatch(value -> matchesTarget(value, mapper.getTargetName()))) {
                addRole(user, mapper.getTargetName(), identity);
            }
        }
    }

    private void applyGroupMapper(
            LdapDirectoryClient.Configuration configuration,
            LdapDirectoryClient.LdapUser external,
            UserEntity user,
            LdapFederationMapperEntity mapper,
            LdapFederationIdentityEntity identity) {
        for (String groupName : findGroups(configuration, external, mapper)) {
            GroupEntity group =
                    groupRepository
                            .findByNameIgnoreCase(groupName)
                            .orElseGet(
                                    () -> {
                                        GroupEntity created = new GroupEntity();
                                        created.setName(groupName);
                                        return groupRepository.save(created);
                                    });
            user.getGroups().add(group);
            if (identity != null) {
                identity.getSyncedGroupNames().add(groupName);
            }
        }
    }

    private List<String> findGroups(
            LdapDirectoryClient.Configuration configuration,
            LdapDirectoryClient.LdapUser external,
            LdapFederationMapperEntity mapper) {
        return directoryClient.findGroups(
                configuration,
                external.distinguishedName(),
                mapper.getGroupSearchBase(),
                mapper.getGroupObjectClass(),
                mapper.getGroupNameAttribute(),
                mapper.getGroupMemberAttribute());
    }

    private void applyFullName(UserEntity user, List<String> values) {
        if (values.isEmpty() || values.getFirst().isBlank()) {
            return;
        }
        String[] parts = values.getFirst().trim().split("\\s+", 2);
        user.setFirstName(parts[0]);
        user.setLastName(parts.length == 1 ? null : parts[1]);
    }

    private void applyMsadAccount(UserEntity user, LdapDirectoryClient.LdapUser external) {
        String accountControl = first(external.values("userAccountControl"));
        if (accountControl != null) {
            try {
                user.setEnabled((Integer.parseInt(accountControl) & 0x2) == 0);
            } catch (NumberFormatException _) {
                user.setEnabled(false);
            }
        }
        if ("0".equals(first(external.values("pwdLastSet")))) {
            user.setMustChangePassword(true);
        }
    }

    private void setAttribute(UserEntity user, String attribute, List<String> values) {
        String value = first(values);
        if (attribute == null || value == null) {
            return;
        }
        switch (attribute.trim().toLowerCase(Locale.ROOT)) {
            case "username" -> user.setUsername(value);
            case "email" -> user.setEmail(value);
            case "firstname", "first_name" -> user.setFirstName(value);
            case "lastname", "last_name" -> user.setLastName(value);
            case "enabled" -> user.setEnabled(Boolean.parseBoolean(value));
            case "emailverified", "email_verified" ->
                    user.setEmailVerified(Boolean.parseBoolean(value));
            case "mustchangepassword", "must_change_password" ->
                    user.setMustChangePassword(Boolean.parseBoolean(value));
            default -> setCustomAttribute(user, attribute, values);
        }
    }

    private void setCustomAttribute(UserEntity user, String name, List<String> values) {
        if (user.getId() == null || name == null) {
            return;
        }
        UserProfileAttributeDefinitionEntity definition =
                profileDefinitionRepository.findByNameIgnoreCase(name).orElse(null);
        if (definition == null) {
            return;
        }
        profileAttributeRepository.deleteAllByUserIdAndDefinitionId(
                user.getId(), definition.getId());
        int position = 0;
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                profileAttributeRepository.save(
                        new UserProfileAttributeEntity(user, definition, position++, value.trim()));
            }
        }
    }

    private void addRole(UserEntity user, String roleName, LdapFederationIdentityEntity identity) {
        if (roleName == null || roleName.isBlank()) {
            return;
        }
        String normalized = roleName.trim();
        AuthorityEntity authority =
                authorityRepository
                        .findByName(normalized)
                        .orElseGet(
                                () -> {
                                    AuthorityEntity created = new AuthorityEntity();
                                    created.setName(normalized);
                                    return authorityRepository.save(created);
                                });
        user.getAuthorities().add(authority);
        if (identity != null) {
            identity.getSyncedRoleNames().add(normalized);
        }
        if (user.getAuthorities().stream()
                .noneMatch(value -> AuthoritiesConstants.USER.equals(value.getName()))) {
            authorityRepository
                    .findByName(AuthoritiesConstants.USER)
                    .ifPresent(user.getAuthorities()::add);
        }
    }

    private static void resetPreviousSynchronization(
            UserEntity user, LdapFederationIdentityEntity identity) {
        if (identity == null) {
            return;
        }
        user.getAuthorities()
                .removeIf(
                        authority ->
                                identity.getSyncedRoleNames().stream()
                                        .anyMatch(
                                                role ->
                                                        role.equalsIgnoreCase(
                                                                authority.getName())));
        user.getGroups()
                .removeIf(
                        group ->
                                identity.getSyncedGroupNames().stream()
                                        .anyMatch(name -> name.equalsIgnoreCase(group.getName())));
        identity.getSyncedRoleNames().clear();
        identity.getSyncedGroupNames().clear();
    }

    private static boolean matchesTarget(String value, String target) {
        return value != null && target != null && value.equalsIgnoreCase(target);
    }

    private static String first(List<String> values) {
        return values.isEmpty() || values.getFirst().isBlank() ? null : values.getFirst().trim();
    }

    private static String value(String value) {
        return value == null ? "" : value.trim();
    }
}
