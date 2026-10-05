package io.github.susimsek.kitezh.web;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.domain.UserEntity;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.SessionInvalidationService;
import io.github.susimsek.kitezh.service.admin.AdminAuditEventService;
import io.github.susimsek.kitezh.service.admin.ImpersonationService;
import io.github.susimsek.kitezh.service.error.ApiErrorCode;
import io.github.susimsek.kitezh.service.error.ApiException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.FactorGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.switchuser.SwitchUserGrantedAuthority;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/impersonation")
@Tag(name = "Impersonation", description = "Browser session impersonation handoff endpoints.")
@SecurityRequirement(name = OpenApiConfig.BROWSER_SESSION)
public class ImpersonationController {

    private static final String TICKET_COOKIE = "IMPERSONATION_TICKET";
    private final ImpersonationService impersonationService;
    private final UserDetailsService userDetailsService;
    private final SessionInvalidationService sessionInvalidationService;
    private final AdminAuditEventService auditEventService;

    @Qualifier("browserSecurityContextRepository")
    private final SecurityContextRepository securityContextRepository;

    public ImpersonationController(
            ImpersonationService impersonationService,
            UserDetailsService userDetailsService,
            SessionInvalidationService sessionInvalidationService,
            AdminAuditEventService auditEventService,
            @Qualifier("browserSecurityContextRepository")
                    SecurityContextRepository securityContextRepository) {
        this.impersonationService = impersonationService;
        this.userDetailsService = userDetailsService;
        this.sessionInvalidationService = sessionInvalidationService;
        this.auditEventService = auditEventService;
        this.securityContextRepository = securityContextRepository;
    }

    @GetMapping("/accept")
    @Operation(
            summary = "Accept an impersonation handoff",
            description =
                    "Consumes the handoff cookie and redirects to the impersonated account"
                            + " console.")
    @ApiResponse(responseCode = "302", description = "Browser redirected to the account console.")
    void accept(
            Authentication authentication, HttpServletRequest request, HttpServletResponse response)
            throws java.io.IOException {
        UserEntity target = impersonationService.consume(ticket(request), authentication);
        var targetDetails = userDetailsService.loadUserByUsername(target.getUsername());
        var authorities = new java.util.ArrayList<GrantedAuthority>(targetDetails.getAuthorities());
        authentication.getAuthorities().stream()
                .filter(FactorGrantedAuthority.class::isInstance)
                .forEach(authorities::add);
        authorities.add(
                new SwitchUserGrantedAuthority(
                        AuthoritiesConstants.PREVIOUS_ADMINISTRATOR, authentication));
        Authentication switched =
                UsernamePasswordAuthenticationToken.authenticated(targetDetails, null, authorities);
        auditEventService.record(
                "user.impersonation.accepted",
                "user",
                target.getId().toString(),
                "actor="
                        + authentication.getName()
                        + ";targetUsername="
                        + target.getUsername()
                        + ";result=success");
        saveContext(switched, request, response);
        clearTicket(response);
        response.sendRedirect("/account/?impersonated=1");
    }

    @GetMapping("/exit")
    @Operation(
            summary = "Exit impersonation",
            description =
                    "Restores the original operator session and redirects to the admin console.")
    @ApiResponse(responseCode = "302", description = "Browser redirected to the admin console.")
    void exit(
            Authentication authentication, HttpServletRequest request, HttpServletResponse response)
            throws java.io.IOException {
        SwitchUserGrantedAuthority previous =
                authentication.getAuthorities().stream()
                        .filter(SwitchUserGrantedAuthority.class::isInstance)
                        .map(SwitchUserGrantedAuthority.class::cast)
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        ApiException.forbidden(
                                                ApiErrorCode.FORBIDDEN,
                                                "Not impersonating a user"));
        String sessionId =
                Optional.ofNullable(request.getSession(false)).map(s -> s.getId()).orElse(null);
        if (sessionId != null) {
            sessionInvalidationService.invalidateAuthorizations(sessionId);
        }
        Authentication restored = previous.getSource();
        saveContext(restored, request, response);
        auditEventService.recordAs(
                restored.getName(),
                "user.impersonation.ended",
                "user",
                authentication.getName(),
                "actor="
                        + restored.getName()
                        + ";targetUsername="
                        + authentication.getName()
                        + ";result=success");
        response.sendRedirect("/admin/?impersonation_ended=1");
    }

    private void saveContext(
            Authentication authentication,
            HttpServletRequest request,
            HttpServletResponse response) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        if (request.getSession(false) != null) {
            request.changeSessionId();
        }
        securityContextRepository.saveContext(context, request, response);
    }

    private static String ticket(HttpServletRequest request) {
        return Optional.ofNullable(request.getCookies()).stream()
                .flatMap(Arrays::stream)
                .filter(cookie -> TICKET_COOKIE.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElseThrow(
                        () ->
                                ApiException.badRequest(
                                        ApiErrorCode.INVALID_REQUEST,
                                        "Impersonation ticket is required"));
    }

    private static void clearTicket(HttpServletResponse response) {
        Cookie cookie = new Cookie(TICKET_COOKIE, "");
        cookie.setMaxAge(0);
        cookie.setPath("/impersonation");
        cookie.setHttpOnly(true);
        response.addCookie(cookie);
    }
}
