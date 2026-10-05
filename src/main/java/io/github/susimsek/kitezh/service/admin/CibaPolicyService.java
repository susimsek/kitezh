package io.github.susimsek.kitezh.service.admin;

import io.github.susimsek.kitezh.domain.CibaPolicyEntity;
import io.github.susimsek.kitezh.dto.admin.AdminCibaPolicyDTO;
import io.github.susimsek.kitezh.dto.admin.AdminCibaPolicyRequestDTO;
import io.github.susimsek.kitezh.repository.CibaPolicyRepository;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class CibaPolicyService {

    private static final long POLICY_ID = 1L;

    private final CibaPolicyRepository repository;
    private final AdminAuditEventService auditEventService;

    @Transactional(readOnly = true)
    public AdminCibaPolicyDTO get() {
        return toDto(entity());
    }

    @Transactional
    @CacheEvict(cacheNames = CibaPolicyRepository.CIBA_POLICY_BY_ID_CACHE, allEntries = true)
    public AdminCibaPolicyDTO update(AdminCibaPolicyRequestDTO request) {
        CibaPolicyEntity policy = entity();
        policy.setRequestLifespanSeconds(request.requestLifespanSeconds());
        policy.setPollingIntervalSeconds(request.pollingIntervalSeconds());
        policy.setDeliveryMode(normalize(request.deliveryMode()));
        policy.setUserVerification(normalize(request.userVerification()));
        policy.setMfaRequired(request.mfaRequired());
        policy.setStepUpRequired(request.stepUpRequired());
        policy.setStepUpAcr(
                StringUtils.hasText(request.stepUpAcr()) ? request.stepUpAcr().trim() : null);
        repository.save(policy);
        auditEventService.record("ciba.policy.updated", "ciba-policy", "default");
        return toDto(policy);
    }

    private CibaPolicyEntity entity() {
        return repository
                .findById(POLICY_ID)
                .orElseThrow(() -> new IllegalStateException("CIBA policy is not initialized"));
    }

    private static String normalize(String value) {
        return value.trim().toLowerCase(Locale.ROOT);
    }

    private static AdminCibaPolicyDTO toDto(CibaPolicyEntity policy) {
        return new AdminCibaPolicyDTO(
                policy.getRequestLifespanSeconds(),
                policy.getPollingIntervalSeconds(),
                policy.getDeliveryMode(),
                policy.getUserVerification(),
                policy.isMfaRequired(),
                policy.isStepUpRequired(),
                policy.getStepUpAcr());
    }
}
