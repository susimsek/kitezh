package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.config.ApplicationProperties;
import io.github.susimsek.kitezh.domain.OAuth2KeyEntity;
import io.github.susimsek.kitezh.dto.admin.AdminServerInfoDTO;
import io.github.susimsek.kitezh.mapper.AdminKeyMapper;
import io.github.susimsek.kitezh.mapper.AdminServerInfoMapper;
import io.github.susimsek.kitezh.repository.OAuth2KeyRepository;
import java.time.Duration;
import java.util.Comparator;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.session.autoconfigure.SessionProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminServerInfoService {

    private final ApplicationProperties applicationProperties;
    private final SessionProperties sessionProperties;
    private final OAuth2KeyRepository oauth2KeyRepository;
    private final AdminKeyMapper adminKeyMapper;
    private final AdminServerInfoMapper adminServerInfoMapper;

    @Transactional(readOnly = true)
    public AdminServerInfoDTO serverInfo() {
        String issuer = applicationProperties.authorizationServer().issuer();
        Duration sessionTimeout = sessionProperties.getTimeout();

        Optional<OAuth2KeyEntity> activeKey =
                oauth2KeyRepository.findAllKeys().stream()
                        .filter(OAuth2KeyEntity::isActive)
                        .max(Comparator.comparing(OAuth2KeyEntity::getCreatedAt));

        return adminServerInfoMapper.toDTO(
                issuer,
                sessionTimeout == null ? null : sessionTimeout.toString(),
                activeKey.map(adminKeyMapper::toSummaryDTO).orElse(null));
    }
}
