package io.github.susimsek.kitezh.service.security;

import io.github.susimsek.kitezh.domain.AuthenticationFlowBindingType;
import io.github.susimsek.kitezh.domain.AuthenticationFlowEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowRequirement;
import io.github.susimsek.kitezh.repository.AuthenticationExecutionRepository;
import io.github.susimsek.kitezh.repository.AuthenticationFlowBindingRepository;
import io.github.susimsek.kitezh.repository.AuthenticationFlowRepository;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/** Resolves the configured single-issuer flow graph for runtime security decisions. */
@Service
@RequiredArgsConstructor
public class AuthenticationFlowRuntimeService {

    private final AuthenticationFlowBindingRepository bindingRepository;
    private final AuthenticationFlowRepository flowRepository;
    private final AuthenticationExecutionRepository executionRepository;

    /**
     * Returns whether a binding contains an enabled execution for the requested provider.
     *
     * <p>A missing or incomplete binding keeps the pre-flow behavior. This is important for
     * existing installations that have not enabled the authentication-flow changelog yet.
     */
    public boolean containsEnabledExecution(
            AuthenticationFlowBindingType bindingType, String providerId) {
        try {
            AuthenticationFlowEntity flow =
                    bindingRepository
                            .findById(bindingType)
                            .map(binding -> binding.getFlow())
                            .orElse(null);
            if (flow == null) {
                return true;
            }
            return containsEnabledExecution(flow, providerId.trim().toLowerCase(Locale.ROOT));
        } catch (RuntimeException _) {
            return true;
        }
    }

    private boolean containsEnabledExecution(AuthenticationFlowEntity flow, String providerId) {
        boolean executionFound =
                executionRepository.findAllByFlowIdOrderByPriorityAscIdAsc(flow.getId()).stream()
                        .anyMatch(
                                execution ->
                                        providerId.equals(execution.getProviderId())
                                                && execution.getRequirement()
                                                        != AuthenticationFlowRequirement.DISABLED);
        if (executionFound) {
            return true;
        }
        return flowRepository.findAllByParentFlowIdOrderByPriorityAscIdAsc(flow.getId()).stream()
                .anyMatch(child -> containsEnabledExecution(child, providerId));
    }
}
