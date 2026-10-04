package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.LocalizationMessageOverrideDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationMessageOverrideRequestDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationSettingsDTO;
import io.github.susimsek.kitezh.dto.admin.LocalizationSettingsRequestDTO;
import io.github.susimsek.kitezh.service.admin.LocalizationSettingsService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
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

@RestController
@ApiController
@RequestMapping("/api/admin/settings/localization")
@RequiredArgsConstructor
@Tag(
        name = "Admin - Localization",
        description = "Application language and message override settings.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminLocalizationController {

    private final LocalizationSettingsService service;

    @GetMapping
    @Operation(summary = "Get localization settings")
    @ApiResponse(
            responseCode = "200",
            description = "Localization settings returned.",
            content = @Content(schema = @Schema(implementation = LocalizationSettingsDTO.class)))
    LocalizationSettingsDTO get() {
        return service.get();
    }

    @PutMapping
    @Operation(summary = "Update localization settings")
    @ApiResponse(
            responseCode = "200",
            description = "Localization settings updated.",
            content = @Content(schema = @Schema(implementation = LocalizationSettingsDTO.class)))
    LocalizationSettingsDTO update(@Valid @RequestBody LocalizationSettingsRequestDTO request) {
        return service.update(request);
    }

    @GetMapping("/messages")
    @Operation(summary = "Search message overrides")
    @ApiResponse(responseCode = "200", description = "Paged message overrides returned.")
    Page<LocalizationMessageOverrideDTO> messages(
            @Parameter(description = "Message key or value search.", example = "login")
                    @RequestParam(defaultValue = "")
                    String q,
            @Parameter(description = "Locale filter.", example = "tr")
                    @RequestParam(defaultValue = "")
                    String locale,
            @Parameter(description = "Message bundle filter.", example = "admin")
                    @RequestParam(defaultValue = "")
                    String bundle,
            @PageableDefault(
                            size = 20,
                            sort = {"locale", "messageKey"})
                    Pageable pageable) {
        return service.overrides(q, locale, bundle, pageable);
    }

    @GetMapping("/bundled")
    @Operation(summary = "Get bundled backend messages")
    @ApiResponse(responseCode = "200", description = "Bundled backend messages returned.")
    java.util.Map<String, String> bundled(
            @RequestParam String locale, @RequestParam(defaultValue = "backend") String bundle) {
        return service.bundledMessages(locale, bundle);
    }

    @PostMapping("/messages")
    @Operation(summary = "Create a message override")
    @ApiResponse(
            responseCode = "201",
            description = "Message override created.",
            content =
                    @Content(
                            schema =
                                    @Schema(implementation = LocalizationMessageOverrideDTO.class)))
    ResponseEntity<LocalizationMessageOverrideDTO> create(
            @Valid @RequestBody LocalizationMessageOverrideRequestDTO request) {
        return ResponseEntity.status(201).body(service.create(request));
    }

    @PutMapping("/messages/{id}")
    @Operation(summary = "Update a message override")
    LocalizationMessageOverrideDTO updateMessage(
            @PathVariable Long id,
            @Valid @RequestBody LocalizationMessageOverrideRequestDTO request) {
        return service.updateMessageOverride(id, request);
    }

    @DeleteMapping("/messages/{id}")
    @Operation(summary = "Delete a message override")
    ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
