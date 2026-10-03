package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.dto.admin.AdminDashboardDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminDashboardMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorizationConsentRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.repository.UserSessionRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
public class AdminDashboardService {

    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final UserSessionRepository userSessionRepository;
    private final AuthorizationConsentRepository authorizationConsentRepository;
    private final AdminDashboardMapper adminDashboardMapper;

    public AdminDashboardService(
            ClientRepository clientRepository,
            UserRepository userRepository,
            UserSessionRepository userSessionRepository,
            AuthorizationConsentRepository authorizationConsentRepository) {
        this(
                clientRepository,
                userRepository,
                userSessionRepository,
                authorizationConsentRepository,
                null);
    }

    @Transactional(readOnly = true)
    public AdminDashboardDTO dashboard() {
        return adminDashboardMapper.toDTO(
                clientRepository.count(),
                userRepository.count(),
                userSessionRepository.countByExpiryTimeAfter(Instant.now().toEpochMilli()),
                authorizationConsentRepository.count());
    }
}
