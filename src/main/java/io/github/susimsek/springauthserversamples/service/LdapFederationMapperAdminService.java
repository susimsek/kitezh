package io.github.susimsek.springauthserversamples.service;

import io.github.susimsek.springauthserversamples.domain.LdapFederationMapperEntity;
import io.github.susimsek.springauthserversamples.domain.LdapFederationProviderEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapMapperDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapMapperRequestDTO;
import io.github.susimsek.springauthserversamples.repository.LdapFederationMapperRepository;
import io.github.susimsek.springauthserversamples.repository.LdapFederationProviderRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LdapFederationMapperAdminService {

    private final LdapFederationMapperRepository mapperRepository;
    private final LdapFederationProviderRepository providerRepository;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public List<AdminLdapMapperDTO> list(String providerId) {
        requireProvider(providerId);
        return mapperRepository.findAllByProviderIdOrderByNameAsc(providerId).stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public AdminLdapMapperDTO save(String providerId, AdminLdapMapperRequestDTO request) {
        LdapFederationProviderEntity provider = requireProvider(providerId);
        String name = request.name().trim();
        boolean duplicate =
                request.id() == null
                        ? mapperRepository.existsByProviderIdAndNameIgnoreCase(providerId, name)
                        : mapperRepository.existsByProviderIdAndNameIgnoreCaseAndIdNot(
                                providerId, name, request.id());
        if (duplicate) {
            throw new IllegalArgumentException("LDAP mapper names must be unique per provider");
        }
        LdapFederationMapperEntity mapper =
                request.id() == null
                        ? new LdapFederationMapperEntity()
                        : mapperRepository
                                .findByIdAndProviderId(request.id(), providerId)
                                .orElseThrow(
                                        () ->
                                                new IllegalArgumentException(
                                                        "LDAP mapper not found"));
        mapper.setProvider(provider);
        mapper.setName(name);
        mapper.setType(request.type());
        mapper.setEnabled(request.enabled());
        mapper.setLdapAttribute(normalize(request.ldapAttribute()));
        mapper.setUserAttribute(normalize(request.userAttribute()));
        mapper.setHardcodedValue(normalize(request.hardcodedValue()));
        mapper.setTargetName(normalize(request.targetName()));
        mapper.setGroupSearchBase(normalize(request.groupSearchBase()));
        mapper.setGroupObjectClass(defaultValue(request.groupObjectClass(), "groupOfNames"));
        mapper.setGroupNameAttribute(defaultValue(request.groupNameAttribute(), "cn"));
        mapper.setGroupMemberAttribute(defaultValue(request.groupMemberAttribute(), "member"));
        LdapFederationMapperEntity saved = mapperRepository.save(mapper);
        auditEventService.record(
                request.id() == null ? "ldap.mapper.created" : "ldap.mapper.updated",
                "ldap-mapper",
                saved.getId().toString());
        return toDto(saved);
    }

    @Transactional
    public void delete(String providerId, Long mapperId) {
        LdapFederationMapperEntity mapper =
                mapperRepository
                        .findByIdAndProviderId(mapperId, providerId)
                        .orElseThrow(() -> new IllegalArgumentException("LDAP mapper not found"));
        mapperRepository.delete(mapper);
        auditEventService.record("ldap.mapper.deleted", "ldap-mapper", mapperId.toString());
    }

    private LdapFederationProviderEntity requireProvider(String providerId) {
        return providerRepository
                .findById(providerId)
                .orElseThrow(() -> new IllegalArgumentException("LDAP provider not found"));
    }

    private AdminLdapMapperDTO toDto(LdapFederationMapperEntity mapper) {
        return new AdminLdapMapperDTO(
                mapper.getId(),
                mapper.getName(),
                mapper.getType(),
                mapper.isEnabled(),
                mapper.getLdapAttribute(),
                mapper.getUserAttribute(),
                mapper.getHardcodedValue(),
                mapper.getTargetName(),
                mapper.getGroupSearchBase(),
                mapper.getGroupObjectClass(),
                mapper.getGroupNameAttribute(),
                mapper.getGroupMemberAttribute());
    }

    private static String defaultValue(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
