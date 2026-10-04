package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminLdapConnectionTestRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLdapMapperDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLdapMapperRequestDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLdapProviderDTO;
import io.github.susimsek.kitezh.dto.admin.AdminLdapProvidersRequestDTO;
import io.github.susimsek.kitezh.service.LdapFederationMapperAdminService;
import io.github.susimsek.kitezh.service.LdapFederationSettingsService;
import io.github.susimsek.kitezh.service.LdapFederationSyncService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@ApiController
@RestController
@RequestMapping("/api/admin/settings/ldap")
@Tag(name = "Admin - LDAP federation", description = "LDAP and Active Directory user federation.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminLdapFederationController {

    private final LdapFederationSettingsService settingsService;
    private final LdapFederationMapperAdminService mapperAdminService;
    private final LdapFederationSyncService syncService;

    @Autowired
    AdminLdapFederationController(
            LdapFederationSettingsService settingsService,
            LdapFederationMapperAdminService mapperAdminService,
            LdapFederationSyncService syncService) {
        this.settingsService = settingsService;
        this.mapperAdminService = mapperAdminService;
        this.syncService = syncService;
    }

    AdminLdapFederationController(LdapFederationSettingsService settingsService) {
        this(settingsService, null, null);
    }

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

    @PostMapping("/{id}/sync")
    @Operation(summary = "Synchronize LDAP users")
    @ApiResponse(responseCode = "200", description = "LDAP synchronization completed.")
    LdapFederationSyncService.SyncResult sync(
            @PathVariable String id,
            @RequestParam(defaultValue = "FULL") LdapFederationSyncService.SyncMode mode) {
        return syncService.synchronize(id, mode);
    }

    @GetMapping("/{providerId}/mappers")
    @Operation(summary = "List LDAP provider mappers")
    @ApiResponse(responseCode = "200", description = "LDAP mappers returned.")
    List<AdminLdapMapperDTO> mappers(@PathVariable String providerId) {
        return mapperAdminService.list(providerId);
    }

    @PostMapping("/{providerId}/mappers")
    @Operation(summary = "Create an LDAP provider mapper")
    @ApiResponse(responseCode = "200", description = "LDAP mapper created.")
    AdminLdapMapperDTO createMapper(
            @PathVariable String providerId,
            @Valid @RequestBody AdminLdapMapperRequestDTO request) {
        return mapperAdminService.save(providerId, request);
    }

    @PutMapping("/{providerId}/mappers/{mapperId}")
    @Operation(summary = "Update an LDAP provider mapper")
    @ApiResponse(responseCode = "200", description = "LDAP mapper updated.")
    AdminLdapMapperDTO updateMapper(
            @PathVariable String providerId,
            @PathVariable Long mapperId,
            @Valid @RequestBody AdminLdapMapperRequestDTO request) {
        AdminLdapMapperRequestDTO normalized =
                new AdminLdapMapperRequestDTO(
                        mapperId,
                        request.name(),
                        request.type(),
                        request.enabled(),
                        request.ldapAttribute(),
                        request.userAttribute(),
                        request.hardcodedValue(),
                        request.targetName(),
                        request.groupSearchBase(),
                        request.groupObjectClass(),
                        request.groupNameAttribute(),
                        request.groupMemberAttribute());
        return mapperAdminService.save(providerId, normalized);
    }

    @DeleteMapping("/{providerId}/mappers/{mapperId}")
    @Operation(summary = "Delete an LDAP provider mapper")
    @ApiResponse(responseCode = "204", description = "LDAP mapper deleted.")
    ResponseEntity<Void> deleteMapper(
            @PathVariable String providerId, @PathVariable Long mapperId) {
        mapperAdminService.delete(providerId, mapperId);
        return ResponseEntity.noContent().build();
    }
}
