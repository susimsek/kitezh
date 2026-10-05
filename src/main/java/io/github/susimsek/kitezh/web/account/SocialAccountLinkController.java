package io.github.susimsek.kitezh.web.account;

import io.github.susimsek.kitezh.service.SocialLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

/** Starts an explicit, already-authenticated account-to-social-identity link. */
@Controller
@RequestMapping("/account/social-links")
@RequiredArgsConstructor
@ConditionalOnBean(ClientRegistrationRepository.class)
public class SocialAccountLinkController {

    private final ClientRegistrationRepository clientRegistrationRepository;
    private final SocialLoginService socialLoginService;

    @GetMapping("/{registrationId}/start")
    void start(
            @PathVariable String registrationId,
            Authentication authentication,
            HttpServletRequest request,
            HttpServletResponse response)
            throws IOException {
        if (clientRegistrationRepository.findByRegistrationId(registrationId) == null
                || !socialLoginService.isProviderEnabled(registrationId)) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return;
        }
        Map<String, String> pendingLinkTarget = new LinkedHashMap<>();
        pendingLinkTarget.put("username", authentication.getName());
        pendingLinkTarget.put("provider", registrationId);
        request.getSession(true)
                .setAttribute(SocialLoginService.PENDING_SOCIAL_LINK_TARGET, pendingLinkTarget);
        response.sendRedirect("/oauth2/authorization/" + registrationId);
    }
}
