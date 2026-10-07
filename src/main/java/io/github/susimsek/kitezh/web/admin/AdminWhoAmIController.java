package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminWhoAmIDTO;
import io.github.susimsek.kitezh.security.AuthoritiesConstants;
import io.github.susimsek.kitezh.service.admin.AdminUserService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@ApiController
@RequiredArgsConstructor
@RequestMapping("/api/admin")
@Tag(name = "Admin - Identity", description = "Current administrator identity and access flags.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminWhoAmIController {

    private final AdminUserService adminUserService;

    @GetMapping("/whoami")
    @Operation(
            summary = "Get current administrator",
            description =
                    "Returns the authenticated administrator and access flags calculated from"
                            + " assigned authorities.")
    @ApiResponse(responseCode = "200", description = "Current administrator identity returned.")
    AdminWhoAmIDTO whoAmI(Authentication authentication) {
        Set<String> authorities =
                authentication.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .collect(Collectors.toUnmodifiableSet());

        return new AdminWhoAmIDTO(
                authentication.getName(),
                adminUserService.currentAvatarUrl(authentication.getName()),
                authorities.stream().sorted().toList(),
                Map.ofEntries(
                        Map.entry("isAdmin", hasAny(authorities, AuthoritiesConstants.ADMIN)),
                        Map.entry(
                                "queryClients",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.CLIENT_QUERY,
                                        AuthoritiesConstants.CLIENT_MANAGER)),
                        Map.entry(
                                "viewClients",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.CLIENT_VIEWER,
                                        AuthoritiesConstants.CLIENT_MANAGER)),
                        Map.entry(
                                "manageClients",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.CLIENT_MANAGER)),
                        Map.entry(
                                "queryUsers",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.USER_QUERY,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry(
                                "viewUsers",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.USER_VIEWER,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry(
                                "queryGroups",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.GROUP_QUERY,
                                        AuthoritiesConstants.GROUP_MANAGER,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry(
                                "viewGroups",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.GROUP_VIEWER,
                                        AuthoritiesConstants.GROUP_MANAGER,
                                        AuthoritiesConstants.USER_VIEWER,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry(
                                "manageGroups",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.GROUP_MANAGER,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry(
                                "manageUsers",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry(
                                "impersonateUsers",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.USER_IMPERSONATOR)),
                        Map.entry(
                                "viewRoles",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry("manageRoles", hasAny(authorities, AuthoritiesConstants.ADMIN)),
                        Map.entry(
                                "viewSessions",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.USER_VIEWER,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry(
                                "manageSessions",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry(
                                "viewConsents",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.USER_VIEWER,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry(
                                "manageConsents",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.USER_MANAGER)),
                        Map.entry(
                                "viewEvents",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.EVENT_VIEWER,
                                        AuthoritiesConstants.EVENT_MANAGER)),
                        Map.entry(
                                "manageEvents",
                                hasAny(
                                        authorities,
                                        AuthoritiesConstants.ADMIN,
                                        AuthoritiesConstants.EVENT_MANAGER)),
                        Map.entry("viewKeys", hasAny(authorities, AuthoritiesConstants.ADMIN)),
                        Map.entry("manageKeys", hasAny(authorities, AuthoritiesConstants.ADMIN))));
    }

    private static boolean hasAny(Set<String> authorities, String... candidates) {
        for (String candidate : candidates) {
            if (authorities.contains(candidate)) {
                return true;
            }
        }
        return false;
    }
}
