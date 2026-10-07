package io.github.susimsek.kitezh.web.account;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.dto.account.SocialProviderDTO;
import io.github.susimsek.kitezh.repository.OrganizationIdentityProviderRepository;
import io.github.susimsek.kitezh.repository.OrganizationRepository;
import io.github.susimsek.kitezh.service.SocialLoginService;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SocialLoginControllerTest {

    @Test
    void filtersPublicProvidersByEnabledOrganizationBindings() {
        SocialLoginService socialLoginService = mock(SocialLoginService.class);
        OrganizationRepository organizationRepository = mock(OrganizationRepository.class);
        OrganizationIdentityProviderRepository bindingRepository =
                mock(OrganizationIdentityProviderRepository.class);
        List<SocialProviderDTO> providers =
                List.of(
                        new SocialProviderDTO("google", "google", "google", true),
                        new SocialProviderDTO("github", "github", "github", true));
        OrganizationEntity organization = new OrganizationEntity();
        organization.setAlias("acme");
        when(socialLoginService.availableProviders()).thenReturn(providers);
        when(organizationRepository.findByAliasIgnoreCase("acme"))
                .thenReturn(Optional.of(organization));
        when(bindingRepository.findEnabledProviderAliasesByOrganizationAlias("acme"))
                .thenReturn(List.of("github"));

        var result =
                new SocialLoginController(
                                socialLoginService, organizationRepository, bindingRepository)
                        .providers(" ACME ");

        assertThat(result).extracting(SocialProviderDTO::provider).containsExactly("github");
    }
}
