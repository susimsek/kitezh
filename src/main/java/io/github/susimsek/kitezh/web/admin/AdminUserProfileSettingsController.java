package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.userprofile.UserProfileAttributeDefinitionDTO;
import io.github.susimsek.kitezh.dto.userprofile.UserProfileAttributeDefinitionRequestDTO;
import io.github.susimsek.kitezh.dto.userprofile.UserProfileAttributeOrderRequestDTO;
import io.github.susimsek.kitezh.service.UserProfileService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
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
@RequestMapping("/api/admin/settings/user-profile")
@RequiredArgsConstructor
@Tag(name = "Admin - User profile", description = "Configurable user profile attributes.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminUserProfileSettingsController {

    private final UserProfileService userProfileService;

    @GetMapping
    @Operation(summary = "List profile attribute definitions")
    @ApiResponse(
            responseCode = "200",
            description = "Profile definitions returned.",
            content =
                    @Content(
                            schema =
                                    @Schema(
                                            implementation =
                                                    UserProfileAttributeDefinitionDTO.class)))
    List<UserProfileAttributeDefinitionDTO> definitions() {
        return userProfileService.definitions(false);
    }

    @GetMapping("/page")
    @Operation(summary = "Search profile attribute definitions")
    @ApiResponse(responseCode = "200", description = "Paged profile definitions returned.")
    Page<UserProfileAttributeDefinitionDTO> page(
            @Parameter(
                            description = "Optional name or display-label search text.",
                            example = "department")
                    @RequestParam(defaultValue = "")
                    String q,
            @PageableDefault(size = 20, sort = "displayOrder") Pageable pageable) {
        return userProfileService.definitions(q, pageable);
    }

    @PostMapping
    @Operation(summary = "Create a profile attribute definition")
    @ApiResponse(
            responseCode = "201",
            description = "Profile definition created.",
            content =
                    @Content(
                            schema =
                                    @Schema(
                                            implementation =
                                                    UserProfileAttributeDefinitionDTO.class)))
    ResponseEntity<UserProfileAttributeDefinitionDTO> create(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Profile attribute definition to create.",
                            required = true,
                            content =
                                    @Content(
                                            schema =
                                                    @Schema(
                                                            implementation =
                                                                    UserProfileAttributeDefinitionRequestDTO
                                                                            .class)))
                    @Valid
                    @RequestBody
                    UserProfileAttributeDefinitionRequestDTO request) {
        return ResponseEntity.status(201).body(userProfileService.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a profile attribute definition")
    @ApiResponse(
            responseCode = "200",
            description = "Profile definition updated.",
            content =
                    @Content(
                            schema =
                                    @Schema(
                                            implementation =
                                                    UserProfileAttributeDefinitionDTO.class)))
    UserProfileAttributeDefinitionDTO update(
            @Parameter(
                            description = "Profile definition identifier.",
                            example = "1",
                            required = true)
                    @PathVariable
                    Long id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Profile attribute definition to apply.",
                            required = true,
                            content =
                                    @Content(
                                            schema =
                                                    @Schema(
                                                            implementation =
                                                                    UserProfileAttributeDefinitionRequestDTO
                                                                            .class)))
                    @Valid
                    @RequestBody
                    UserProfileAttributeDefinitionRequestDTO request) {
        return userProfileService.update(id, request);
    }

    @PutMapping("/order")
    @Operation(
            summary = "Reorder profile attribute definitions",
            description =
                    "Persists the display order supplied by the profile attribute list."
                            + " All identifiers must be unique and refer to existing definitions.")
    @ApiResponse(responseCode = "200", description = "Profile definition order updated.")
    List<UserProfileAttributeDefinitionDTO> reorder(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(
                            description = "Profile attribute identifiers in display order.",
                            required = true,
                            content =
                                    @Content(
                                            schema =
                                                    @Schema(
                                                            implementation =
                                                                    UserProfileAttributeOrderRequestDTO
                                                                            .class)))
                    @Valid
                    @RequestBody
                    UserProfileAttributeOrderRequestDTO request) {
        return userProfileService.reorder(request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete a profile attribute definition")
    @ApiResponse(responseCode = "204", description = "Profile definition deleted.")
    ResponseEntity<Void> delete(
            @Parameter(
                            description = "Profile definition identifier.",
                            example = "1",
                            required = true)
                    @PathVariable
                    Long id) {
        userProfileService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
