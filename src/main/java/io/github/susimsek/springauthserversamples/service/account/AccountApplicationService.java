package io.github.susimsek.springauthserversamples.service.account;

import io.github.susimsek.springauthserversamples.domain.AuthorizationConsentEntity;
import io.github.susimsek.springauthserversamples.domain.AuthorizationConsentId;
import io.github.susimsek.springauthserversamples.domain.AuthorizationEntity;
import io.github.susimsek.springauthserversamples.dto.account.AccountApplicationDTO;
import io.github.susimsek.springauthserversamples.dto.account.AccountOfflineSessionDTO;
import io.github.susimsek.springauthserversamples.mapper.AccountApplicationMapper;
import io.github.susimsek.springauthserversamples.mapper.AuthorizationServerMapperSupport;
import io.github.susimsek.springauthserversamples.repository.AuthorizationConsentRepository;
import io.github.susimsek.springauthserversamples.repository.AuthorizationRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.service.admin.AdminAuditEventService;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.mapstruct.factory.Mappers;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
public class AccountApplicationService {

    private final AuthorizationConsentRepository authorizationConsentRepository;
    private final AuthorizationRepository authorizationRepository;
    private final ClientRepository clientRepository;
    private final AuthorizationServerMapperSupport mapperSupport;
    private final AdminAuditEventService auditEventService;
    private final AccountApplicationMapper accountApplicationMapper;

    public AccountApplicationService(
            AuthorizationConsentRepository authorizationConsentRepository,
            AuthorizationRepository authorizationRepository,
            ClientRepository clientRepository,
            AuthorizationServerMapperSupport mapperSupport,
            AdminAuditEventService auditEventService) {
        this(
                authorizationConsentRepository,
                authorizationRepository,
                clientRepository,
                mapperSupport,
                auditEventService,
                Mappers.getMapper(AccountApplicationMapper.class));
    }

    @Transactional(readOnly = true)
    public Page<AccountApplicationDTO> applications(String username, Pageable pageable) {
        Page<AuthorizationConsentEntity> consents =
                authorizationConsentRepository.findByIdPrincipalName(username, pageable);
        Map<String, String> clientNames =
                clientRepository
                        .findAllById(
                                consents.stream()
                                        .map(consent -> consent.getId().getRegisteredClientId())
                                        .distinct()
                                        .toList())
                        .stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        client -> client.getId(),
                                        client -> client.getClientName()));
        return consents.map(
                consent -> accountApplicationMapper.toDTO(consent, clientNames, mapperSupport));
    }

    @Transactional
    public void revokeApplication(String username, String clientId) {
        AuthorizationConsentId id = new AuthorizationConsentId(clientId, username);
        if (!authorizationConsentRepository.existsById(id)) {
            throw ApiException.notFound("Application consent not found");
        }
        authorizationConsentRepository.deleteById(id);
        authorizationRepository.deleteByPrincipalNameAndRegisteredClientId(username, clientId);
        auditEventService.record(
                "account.application.revoked", "consent", clientId + ":" + username);
    }

    @Transactional(readOnly = true)
    public Page<AccountOfflineSessionDTO> offlineSessions(String username, Pageable pageable) {
        var sessions =
                authorizationRepository
                        .findAllByPrincipalNameAndSessionIdIsNullAndRefreshTokenValueIsNotNull(
                                username, pageable);
        Map<String, String> clientNames =
                clientRepository
                        .findAllById(
                                sessions.getContent().stream()
                                        .map(AuthorizationEntity::getRegisteredClientId)
                                        .distinct()
                                        .toList())
                        .stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        client -> client.getId(),
                                        client -> client.getClientName()));
        return sessions.map(
                session ->
                        new AccountOfflineSessionDTO(
                                session.getId(),
                                session.getRegisteredClientId(),
                                clientNames.getOrDefault(
                                        session.getRegisteredClientId(),
                                        session.getRegisteredClientId()),
                                session.getRefreshTokenIssuedAt(),
                                session.getRefreshTokenExpiresAt()));
    }

    @Transactional
    public void revokeOfflineSession(String username, String id) {
        AuthorizationEntity authorization =
                authorizationRepository
                        .findById(id)
                        .filter(entity -> username.equals(entity.getPrincipalName()))
                        .filter(entity -> entity.getSessionId() == null)
                        .orElseThrow(() -> ApiException.notFound("Offline session not found"));
        authorizationRepository.delete(authorization);
        auditEventService.record("account.offline-session.revoked", "offline-session", id);
    }
}
