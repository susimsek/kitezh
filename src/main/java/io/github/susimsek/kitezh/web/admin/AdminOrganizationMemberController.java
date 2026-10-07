package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationMemberRequestDTO;
import io.github.susimsek.kitezh.service.admin.AdminOrganizationMemberService;
import io.github.susimsek.kitezh.web.ApiController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
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
@RequestMapping("/api/admin/organizations/{organizationId}/members")
@RequiredArgsConstructor
@Tag(name = "Admin - Organization members", description = "Organization membership management.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
public class AdminOrganizationMemberController {

    private final AdminOrganizationMemberService memberService;

    @GetMapping
    @Operation(summary = "List organization members", description = "Returns a paged member list.")
    @ApiResponse(responseCode = "200", description = "Paged members returned.")
    Page<AdminOrganizationMemberDTO> findAll(
            @PathVariable Long organizationId,
            @RequestParam(defaultValue = "") String q,
            @PageableDefault(size = 20, sort = "user.username") Pageable pageable) {
        return memberService.findAll(organizationId, q, pageable);
    }

    @PostMapping
    @Operation(
            summary = "Add organization member",
            description = "Adds an existing user to the organization.")
    @ApiResponse(responseCode = "201", description = "Member added.")
    ResponseEntity<AdminOrganizationMemberDTO> add(
            @PathVariable Long organizationId,
            @Valid @RequestBody AdminOrganizationMemberRequestDTO request) {
        AdminOrganizationMemberDTO member = memberService.add(organizationId, request);
        return ResponseEntity.created(
                        URI.create(
                                "/api/admin/organizations/"
                                        + organizationId
                                        + "/members/"
                                        + member.userId()))
                .body(member);
    }

    @PutMapping("/{userId}")
    @Operation(
            summary = "Update organization membership",
            description = "Changes the membership type.")
    @ApiResponse(responseCode = "200", description = "Membership updated.")
    AdminOrganizationMemberDTO update(
            @PathVariable Long organizationId,
            @PathVariable Long userId,
            @Valid @RequestBody AdminOrganizationMemberRequestDTO request) {
        return memberService.update(organizationId, userId, request);
    }

    @DeleteMapping("/{userId}")
    @Operation(
            summary = "Remove organization member",
            description = "Removes membership without deleting the user.")
    @ApiResponse(responseCode = "204", description = "Membership removed.")
    ResponseEntity<Void> remove(@PathVariable Long organizationId, @PathVariable Long userId) {
        memberService.remove(organizationId, userId);
        return ResponseEntity.noContent().build();
    }
}
