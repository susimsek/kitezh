package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.dto.account.SocialProviderDTO;
import io.github.susimsek.kitezh.repository.OrganizationIdentityProviderRepository;
import io.github.susimsek.kitezh.service.SocialLoginService;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Locale;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Public authentication", description = "Public login and social provider discovery.")
public class SocialLoginController {

    private final SocialLoginService socialLoginService;
    private final io.github.susimsek.kitezh.repository.OrganizationRepository
            organizationRepository;
    private final OrganizationIdentityProviderRepository organizationIdentityProviderRepository;

    public SocialLoginController(SocialLoginService socialLoginService) {
        this(socialLoginService, null, null);
    }

    @Autowired
    public SocialLoginController(
            SocialLoginService socialLoginService,
            io.github.susimsek.kitezh.repository.OrganizationRepository organizationRepository,
            OrganizationIdentityProviderRepository organizationIdentityProviderRepository) {
        this.socialLoginService = socialLoginService;
        this.organizationRepository = organizationRepository;
        this.organizationIdentityProviderRepository = organizationIdentityProviderRepository;
    }

    @GetMapping("/social-providers")
    @Operation(
            summary = "List enabled social login providers",
            description =
                    "Returns enabled providers. An unconfigured provider remains visible but is"
                            + " not usable until its Client ID and Client Secret are saved.")
    @ApiResponse(responseCode = "200", description = "Social provider availability returned.")
    java.util.List<SocialProviderDTO> providers() {
        return providers(null);
    }

    java.util.List<SocialProviderDTO> providers(
            @RequestParam(required = false) String organization) {
        java.util.List<SocialProviderDTO> providers = socialLoginService.availableProviders();
        if (organization == null || organization.isBlank()) {
            return providers;
        }
        if (organizationRepository == null || organizationIdentityProviderRepository == null) {
            return providers;
        }
        String normalizedOrganization = organization.strip().toLowerCase(Locale.ROOT);
        organizationRepository
                .findByAliasIgnoreCase(normalizedOrganization)
                .orElseThrow(() -> ApiException.notFound("Organization not found"));
        Set<String> boundProviders =
                Set.copyOf(
                        organizationIdentityProviderRepository
                                .findEnabledProviderAliasesByOrganizationAlias(
                                        normalizedOrganization));
        return providers.stream()
                .filter(provider -> boundProviders.contains(provider.provider()))
                .toList();
    }
}
