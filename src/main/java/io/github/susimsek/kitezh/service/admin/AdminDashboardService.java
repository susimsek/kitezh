package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.dto.admin.AdminDashboardDTO;
import io.github.susimsek.kitezh.mapper.AdminDashboardMapper;
import io.github.susimsek.kitezh.repository.AuthorizationConsentRepository;
import io.github.susimsek.kitezh.repository.ClientRepository;
import io.github.susimsek.kitezh.repository.UserRepository;
import io.github.susimsek.kitezh.repository.UserSessionRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final ClientRepository clientRepository;
    private final UserRepository userRepository;
    private final UserSessionRepository userSessionRepository;
    private final AuthorizationConsentRepository authorizationConsentRepository;
    private final AdminDashboardMapper adminDashboardMapper;

    @Transactional(readOnly = true)
    public AdminDashboardDTO dashboard() {
        return adminDashboardMapper.toDTO(
                clientRepository.count(),
                userRepository.count(),
                userSessionRepository.countByExpiryTimeAfter(Instant.now().toEpochMilli()),
                authorizationConsentRepository.count());
    }
}
