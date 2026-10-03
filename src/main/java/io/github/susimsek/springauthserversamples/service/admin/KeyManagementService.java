package io.github.susimsek.springauthserversamples.service.admin;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.KeyUse;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import io.github.susimsek.springauthserversamples.domain.OAuth2KeyEntity;
import io.github.susimsek.springauthserversamples.dto.admin.AdminKeyDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminKeyMapper;
import io.github.susimsek.springauthserversamples.repository.OAuth2KeyRepository;
import io.github.susimsek.springauthserversamples.service.error.ApiErrorCode;
import io.github.susimsek.springauthserversamples.service.error.ApiException;
import java.util.Base64;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor(onConstructor_ = @org.springframework.beans.factory.annotation.Autowired)
public class KeyManagementService {

    private final OAuth2KeyRepository oauth2KeyRepository;
    private final AdminAuditEventService adminAuditEventService;
    private final AdminKeyMapper adminKeyMapper;

    public KeyManagementService(
            OAuth2KeyRepository oauth2KeyRepository,
            AdminAuditEventService adminAuditEventService) {
        this(oauth2KeyRepository, adminAuditEventService, null);
    }

    @Transactional(readOnly = true)
    public Page<AdminKeyDTO> keys(String query, Boolean active, Pageable pageable) {
        String searchQuery = AdminSearch.normalize(query);
        Page<OAuth2KeyEntity> keys =
                active == null
                        ? oauth2KeyRepository.findByKidContainingIgnoreCase(searchQuery, pageable)
                        : oauth2KeyRepository.findByKidContainingIgnoreCaseAndActive(
                                searchQuery, active, pageable);
        return keys.map(adminKeyMapper::toDTO);
    }

    @Transactional
    @CacheEvict(cacheNames = OAuth2KeyRepository.OAUTH2_KEYS_CACHE, allEntries = true)
    public AdminKeyDTO rotateKey() {
        try {
            oauth2KeyRepository.findAllForRotation().forEach(key -> key.setActive(false));
            String kid = UUID.randomUUID().toString();
            RSAKey key =
                    new RSAKeyGenerator(2048)
                            .keyUse(KeyUse.SIGNATURE)
                            .algorithm(JWSAlgorithm.RS256)
                            .keyID(kid)
                            .generate();
            OAuth2KeyEntity entity =
                    adminKeyMapper.toEntity(
                            UUID.randomUUID().toString(),
                            kid,
                            "RSA",
                            "RS256",
                            "sig",
                            true,
                            Base64.getEncoder().encodeToString(key.toRSAPublicKey().getEncoded()),
                            Base64.getEncoder().encodeToString(key.toRSAPrivateKey().getEncoded()));
            OAuth2KeyEntity saved = oauth2KeyRepository.save(entity);
            adminAuditEventService.record("key.rotated", "key", saved.getId());
            return adminKeyMapper.toDTO(saved);
        } catch (Exception ex) {
            throw ApiException.serverError(
                    ApiErrorCode.KEY_ROTATION_FAILED, "Could not rotate the signing key", ex);
        }
    }
}
