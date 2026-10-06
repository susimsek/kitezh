package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.config.security.SamlRelyingPartyRegistrationRepository;
import io.github.susimsek.kitezh.service.SocialLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

/** Starts an explicit, already-authenticated account-to-social-identity link. */
@Controller
@RequestMapping("/account/social-links")
public class SocialAccountLinkController {

    private final ClientRegistrationRepository clientRegistrationRepository;
    private final SamlRelyingPartyRegistrationRepository samlRegistrationRepository;
    private final SocialLoginService socialLoginService;

    @Autowired
    public SocialAccountLinkController(
            ObjectProvider<ClientRegistrationRepository> clientRegistrationRepository,
            SamlRelyingPartyRegistrationRepository samlRegistrationRepository,
            SocialLoginService socialLoginService) {
        this.clientRegistrationRepository = clientRegistrationRepository.getIfAvailable();
        this.samlRegistrationRepository = samlRegistrationRepository;
        this.socialLoginService = socialLoginService;
    }

    public SocialAccountLinkController(
            ClientRegistrationRepository clientRegistrationRepository,
            SocialLoginService socialLoginService) {
        this.clientRegistrationRepository = clientRegistrationRepository;
        this.samlRegistrationRepository = null;
        this.socialLoginService = socialLoginService;
    }

    @GetMapping("/{registrationId}/start")
    void start(
            @PathVariable String registrationId,
            Authentication authentication,
            HttpServletRequest request,
            HttpServletResponse response)
            throws IOException {
        boolean oauthProvider =
                clientRegistrationRepository != null
                        && clientRegistrationRepository.findByRegistrationId(registrationId)
                                != null;
        boolean samlProvider =
                samlRegistrationRepository != null
                        && samlRegistrationRepository.findByRegistrationId(registrationId) != null;
        if ((!oauthProvider && !samlProvider)
                || !socialLoginService.isProviderEnabled(registrationId)) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        Map<String, String> pendingLinkTarget = new LinkedHashMap<>();
        pendingLinkTarget.put("username", authentication.getName());
        pendingLinkTarget.put("provider", registrationId);
        request.getSession(true)
                .setAttribute(SocialLoginService.PENDING_SOCIAL_LINK_TARGET, pendingLinkTarget);
        response.sendRedirect(
                samlProvider
                        ? "/saml2/authenticate/" + registrationId
                        : "/oauth2/authorization/" + registrationId);
    }
}
