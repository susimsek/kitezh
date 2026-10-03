package io.github.susimsek.springauthserversamples.service.admin;

import io.github.susimsek.springauthserversamples.config.ApplicationProperties;
import io.github.susimsek.springauthserversamples.domain.OAuth2KeyEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminServerInfoDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminKeyMapper;
import io.github.susimsek.springauthserversamples.mapper.AdminServerInfoMapper;
import io.github.susimsek.springauthserversamples.repository.OAuth2KeyRepository;
import java.time.Duration;
import java.util.Comparator;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.session.autoconfigure.SessionProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
public class AdminServerInfoService {

    private final ApplicationProperties applicationProperties;
    private final SessionProperties sessionProperties;
    private final OAuth2KeyRepository oauth2KeyRepository;
    private final AdminKeyMapper adminKeyMapper;
    private final AdminServerInfoMapper adminServerInfoMapper;

    public AdminServerInfoService(
            ApplicationProperties applicationProperties,
            SessionProperties sessionProperties,
            OAuth2KeyRepository oauth2KeyRepository) {
        this(applicationProperties, sessionProperties, oauth2KeyRepository, null, null);
    }

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
