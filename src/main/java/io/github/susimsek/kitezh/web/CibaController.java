package io.github.susimsek.kitezh.web;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.config.security.MfaAuthorizationFilter;
import io.github.susimsek.kitezh.domain.CibaAuthenticationRequestEntity;
import io.github.susimsek.kitezh.dto.oauth.CibaBackchannelAuthenticationResponseDTO;
import io.github.susimsek.kitezh.dto.oauth.CibaErrorResponseDTO;
import io.github.susimsek.kitezh.dto.oauth.CibaPendingRequestDTO;
import io.github.susimsek.kitezh.service.ciba.CibaAuthenticationService;
import io.github.susimsek.kitezh.service.ciba.CibaClientAuthenticationService;
import io.github.susimsek.kitezh.service.ciba.CibaProtocolException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Duration;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.authorization.authentication.OAuth2ClientAuthenticationToken;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** CIBA backchannel initiation and local user approval endpoints. */
@RestController
@ApiController
@Tag(name = "OAuth2 / CIBA", description = "Client-Initiated Backchannel Authentication endpoints.")
public class CibaController {

    private final CibaAuthenticationService cibaAuthenticationService;
    private final CibaClientAuthenticationService clientAuthenticationService;

    public CibaController(
            CibaAuthenticationService cibaAuthenticationService,
            CibaClientAuthenticationService clientAuthenticationService) {
        this.cibaAuthenticationService = cibaAuthenticationService;
        this.clientAuthenticationService = clientAuthenticationService;
    }

    @PostMapping("/oauth2/bc-authorize")
    @Operation(
            summary = "Start CIBA authentication",
            description =
                    "Creates a CIBA request for an enabled local user. Poll and ping clients"
                            + " receive the token from the token endpoint; push clients receive it"
                            + " at their registered notification endpoint after approval. Provide"
                            + " exactly one of login_hint, login_hint_token, or id_token_hint,"
                            + " either directly or inside a signed request JWT. A user_code may be"
                            + " supplied by the client; otherwise the response contains a generated"
                            + " code for the user approval screen.")
    @ApiResponse(responseCode = "200", description = "CIBA request created.")
    @ApiResponse(responseCode = "400", description = "The CIBA request is invalid.")
    @ApiResponse(responseCode = "401", description = "Client authentication failed.")
    CibaBackchannelAuthenticationResponseDTO authorize(
            HttpServletRequest request,
            @Parameter(
                            description = "Space-delimited scopes.",
                            example = "openid profile",
                            required = true)
                    @RequestParam(required = false)
                    String scope,
            @Parameter(description = "Local username used as the login hint.", example = "admin")
                    @RequestParam(name = "login_hint", required = false)
                    String loginHint,
            @Parameter(
                            description = "Signed token containing the user's login hint.",
                            example = "eyJhbGciOiJSUzI1NiJ9...")
                    @RequestParam(name = "login_hint_token", required = false)
                    String loginHintToken,
            @Parameter(
                            description = "Signed OIDC ID token identifying the user.",
                            example = "eyJhbGciOiJSUzI1NiJ9...")
                    @RequestParam(name = "id_token_hint", required = false)
                    String idTokenHint,
            @Parameter(
                            description = "Optional user-facing binding message.",
                            example = "Approve sign in")
                    @RequestParam(name = "binding_message", required = false)
                    String bindingMessage,
            @Parameter(description = "Optional request lifetime in seconds.", example = "300")
                    @RequestParam(name = "requested_expiry", required = false)
                    Integer requestedExpiry,
            @Parameter(
                            description = "Optional user-facing code used to identify the request.",
                            example = "K7P4M2Q9")
                    @RequestParam(name = "user_code", required = false)
                    String userCode,
            @Parameter(
                            description = "Registered CIBA delivery mode: poll, ping, or push.",
                            example = "poll")
                    @RequestParam(name = "backchannel_token_delivery_mode", required = false)
                    String deliveryMode,
            @Parameter(
                            description =
                                    "Bearer token used to authenticate ping or push callbacks.",
                            example = "8d67dc78-7faa-4d41-aabd-67707b374255")
                    @RequestParam(name = "client_notification_token", required = false)
                    String clientNotificationToken,
            @Parameter(
                            description = "Optional requested authentication context class values.",
                            example = "urn:mace:incommon:iap:silver")
                    @RequestParam(name = "acr_values", required = false)
                    String acrValues,
            @Parameter(
                            description = "Signed request JWT containing CIBA request parameters.",
                            example = "eyJhbGciOiJSUzI1NiJ9...")
                    @RequestParam(name = "request", required = false)
                    String requestObject) {
        OAuth2ClientAuthenticationToken client = clientAuthenticationService.authenticate(request);
        CibaAuthenticationRequestEntity cibaRequest =
                cibaAuthenticationService.create(
                        client.getRegisteredClient(),
                        scope,
                        loginHint,
                        loginHintToken,
                        idTokenHint,
                        bindingMessage,
                        requestedExpiry,
                        deliveryMode,
                        clientNotificationToken,
                        userCode,
                        acrValues,
                        requestObject);
        return response(cibaRequest);
    }

    CibaBackchannelAuthenticationResponseDTO authorize(
            HttpServletRequest request,
            String scope,
            String loginHint,
            String bindingMessage,
            Integer requestedExpiry) {
        OAuth2ClientAuthenticationToken client = clientAuthenticationService.authenticate(request);
        return response(
                cibaAuthenticationService.create(
                        client.getRegisteredClient(),
                        scope,
                        loginHint,
                        bindingMessage,
                        requestedExpiry));
    }

    private static CibaBackchannelAuthenticationResponseDTO response(
            CibaAuthenticationRequestEntity cibaRequest) {
        return new CibaBackchannelAuthenticationResponseDTO(
                cibaRequest.getAuthReqId(),
                (int)
                        Duration.between(cibaRequest.getCreatedAt(), cibaRequest.getExpiresAt())
                                .toSeconds(),
                "poll".equals(cibaRequest.getDeliveryMode())
                        ? cibaRequest.getIntervalSeconds()
                        : null,
                cibaRequest.getUserCode());
    }

    @GetMapping("/api/ciba/requests")
    @Operation(
            summary = "List pending CIBA requests",
            description =
                    "Returns pending CIBA requests owned by the authenticated account so the"
                            + " user can approve or deny them.")
    @ApiResponse(responseCode = "200", description = "Pending CIBA requests returned.")
    @SecurityRequirement(name = OpenApiConfig.ACCOUNT_BEARER)
    Page<CibaPendingRequestDTO> pendingRequests(
            Authentication authentication,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC)
                    Pageable pageable) {
        return cibaAuthenticationService.pendingRequests(authentication.getName(), pageable);
    }

    @PostMapping("/api/ciba/requests/{authReqId}/approve")
    @Operation(
            summary = "Approve a CIBA request",
            description = "Approves a pending CIBA request owned by the authenticated user.")
    @ApiResponse(responseCode = "204", description = "CIBA request approved.")
    @SecurityRequirement(name = OpenApiConfig.ACCOUNT_BEARER)
    ResponseEntity<Void> approve(
            Authentication authentication,
            HttpServletRequest servletRequest,
            @Parameter(description = "Opaque CIBA request identifier.", required = true)
                    @PathVariable
                    String authReqId,
            @RequestParam(name = "user_code", required = false) String userCode) {
        jakarta.servlet.http.HttpSession session = servletRequest.getSession(false);
        boolean mfaVerified =
                session != null
                        && Boolean.TRUE.equals(
                                session.getAttribute(MfaAuthorizationFilter.MFA_VERIFIED));
        boolean credentialVerified =
                session != null
                        && Boolean.TRUE.equals(
                                session.getAttribute(
                                        MfaAuthorizationFilter.MFA_CREDENTIAL_VERIFIED));
        if (userCode == null) {
            cibaAuthenticationService.approve(
                    authReqId,
                    authentication.getName(),
                    mfaVerified,
                    mfaVerified || credentialVerified);
        } else {
            cibaAuthenticationService.approve(
                    authReqId,
                    authentication.getName(),
                    userCode,
                    mfaVerified,
                    mfaVerified || credentialVerified);
        }
        return ResponseEntity.noContent().build();
    }

    ResponseEntity<Void> approve(
            Authentication authentication, HttpServletRequest servletRequest, String authReqId) {
        return approve(authentication, servletRequest, authReqId, null);
    }

    ResponseEntity<Void> approve(Authentication authentication, String authReqId) {
        cibaAuthenticationService.approve(authReqId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/ciba/requests/{authReqId}/deny")
    @Operation(
            summary = "Deny a CIBA request",
            description = "Denies a pending CIBA request owned by the authenticated user.")
    @ApiResponse(responseCode = "204", description = "CIBA request denied.")
    @SecurityRequirement(name = OpenApiConfig.ACCOUNT_BEARER)
    ResponseEntity<Void> deny(
            Authentication authentication,
            @Parameter(description = "Opaque CIBA request identifier.", required = true)
                    @PathVariable
                    String authReqId,
            @RequestParam(name = "user_code", required = false) String userCode) {
        cibaAuthenticationService.deny(authReqId, authentication.getName(), userCode);
        return ResponseEntity.noContent().build();
    }

    ResponseEntity<Void> deny(Authentication authentication, String authReqId) {
        cibaAuthenticationService.deny(authReqId, authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(CibaProtocolException.class)
    ResponseEntity<CibaErrorResponseDTO> protocolError(CibaProtocolException exception) {
        return ResponseEntity.status(exception.status())
                .body(new CibaErrorResponseDTO(exception.error(), exception.getMessage()));
    }
}
