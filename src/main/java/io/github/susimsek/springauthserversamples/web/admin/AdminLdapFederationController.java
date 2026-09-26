package io.github.susimsek.springauthserversamples.web.admin;

import io.github.susimsek.springauthserversamples.config.openapi.OpenApiConfig;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapConnectionTestRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapProviderDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminLdapProvidersRequestDTO;
import io.github.susimsek.springauthserversamples.service.LdapFederationSettingsService;
import io.github.susimsek.springauthserversamples.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/admin/settings/ldap")
@RequiredArgsConstructor
@Tag(name = "Admin - LDAP federation", description = "LDAP and Active Directory user federation.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminLdapFederationController {

    private final LdapFederationSettingsService settingsService;

    @GetMapping
    @Operation(summary = "Get LDAP federation providers")
    @ApiResponse(responseCode = "200", description = "LDAP federation providers returned.")
    List<AdminLdapProviderDTO> get() {
        return settingsService.adminSettings();
    }

    @PutMapping
    @Operation(summary = "Update LDAP federation providers")
    @ApiResponse(responseCode = "200", description = "LDAP federation providers updated.")
    List<AdminLdapProviderDTO> update(@Valid @RequestBody AdminLdapProvidersRequestDTO request) {
        return settingsService.update(request);
    }

    @PostMapping("/test")
    @Operation(summary = "Test an LDAP federation connection")
    @ApiResponse(responseCode = "204", description = "The LDAP connection succeeded.")
    ResponseEntity<Void> test(@Valid @RequestBody AdminLdapConnectionTestRequestDTO request) {
        settingsService.test(request);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete an LDAP federation provider")
    @ApiResponse(responseCode = "204", description = "LDAP federation provider deleted.")
    ResponseEntity<Void> delete(@PathVariable String id) {
        settingsService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
