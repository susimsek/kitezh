package io.github.susimsek.kitezh.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.security.Principal;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "OAuth2 / OIDC", description = "Authorization server browser session endpoints.")
public class OidcSessionStatusController {

    @GetMapping("/oidc/session-status")
    @Operation(
            summary = "Get browser SSO session status",
            description = "Returns whether a browser SSO session exists for the current request.")
    @ApiResponse(
            responseCode = "200",
            description = "Session status returned.",
            content =
                    @Content(
                            schema =
                                    @Schema(
                                            type = "object",
                                            example =
                                                    "{\"authenticated\":true,\"sessionId\":\"6f9b4dd0-2ed2-4af8-9e89-6ef3d4dd8c12\"}")))
    ResponseEntity<Map<String, Object>> sessionStatus(
            HttpServletRequest request, Principal principal) {
        HttpSession session = request.getSession(false);
        boolean authenticated = principal != null && session != null;
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(
                        Map.of(
                                "authenticated",
                                authenticated,
                                "sessionId",
                                authenticated ? session.getId() : ""));
    }
}
