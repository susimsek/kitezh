package io.github.susimsek.springauthserversamples.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.dto.admin.AdminDashboardDTO;
import io.github.susimsek.springauthserversamples.mapper.AdminDashboardMapper;
import io.github.susimsek.springauthserversamples.repository.AuthorizationConsentRepository;
import io.github.susimsek.springauthserversamples.repository.ClientRepository;
import io.github.susimsek.springauthserversamples.repository.UserRepository;
import io.github.susimsek.springauthserversamples.repository.UserSessionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminDashboardServiceTest {

    @Mock private ClientRepository clientRepository;
    @Mock private UserRepository userRepository;
    @Mock private UserSessionRepository userSessionRepository;
    @Mock private AuthorizationConsentRepository authorizationConsentRepository;

    @Test
    void returnsAdministrationCounters() {
        when(clientRepository.count()).thenReturn(2L);
        when(userRepository.count()).thenReturn(3L);
        when(userSessionRepository.countByExpiryTimeAfter(org.mockito.ArgumentMatchers.anyLong()))
                .thenReturn(4L);
        when(authorizationConsentRepository.count()).thenReturn(5L);

        assertThat(service().dashboard()).isEqualTo(new AdminDashboardDTO(2L, 3L, 4L, 5L));
    }

    private AdminDashboardService service() {
        return new AdminDashboardService(
                clientRepository,
                userRepository,
                userSessionRepository,
                authorizationConsentRepository,
                Mappers.getMapper(AdminDashboardMapper.class));
    }
}
