package io.github.susimsek.kitezh.web.admin;

import io.github.susimsek.kitezh.config.openapi.OpenApiConfig;
import io.github.susimsek.kitezh.dto.admin.EventListenerDeliveryDTO;
import io.github.susimsek.kitezh.dto.admin.EventListenerProviderDTO;
import io.github.susimsek.kitezh.dto.admin.EventListenerProviderRequestDTO;
import io.github.susimsek.kitezh.service.admin.EventListenerDeliveryService;
import io.github.susimsek.kitezh.service.admin.EventListenerProviderService;
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
@RequestMapping("/api/admin/event-listeners")
@RequiredArgsConstructor
@Tag(name = "Admin - Event listeners", description = "Webhook listener administration.")
@SecurityRequirement(name = OpenApiConfig.ADMIN_BEARER)
class AdminEventListenerController {
    private final EventListenerProviderService providerService;
    private final EventListenerDeliveryService deliveryService;

    @GetMapping
    @Operation(
            summary = "List event listener providers",
            description = "Returns configured event listener providers with bounded pagination.")
    @ApiResponse(responseCode = "200", description = "Provider page returned.")
    @ApiResponse(responseCode = "403", description = "The administrator cannot view listeners.")
    Page<EventListenerProviderDTO> list(
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return providerService.list(pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get event listener provider")
    @ApiResponse(
            responseCode = "200",
            description = "Provider returned.",
            content = @Content(schema = @Schema(implementation = EventListenerProviderDTO.class)))
    @ApiResponse(responseCode = "404", description = "Provider not found.")
    EventListenerProviderDTO get(@PathVariable String id) {
        return providerService.get(id);
    }

    @PostMapping
    @Operation(
            summary = "Create event listener provider",
            description = "Creates an HTTPS webhook provider after endpoint and retry validation.")
    @ApiResponse(
            responseCode = "200",
            description = "Provider created.",
            content = @Content(schema = @Schema(implementation = EventListenerProviderDTO.class)))
    @ApiResponse(responseCode = "400", description = "Provider request is invalid.")
    @ApiResponse(responseCode = "409", description = "Provider name already exists.")
    EventListenerProviderDTO create(@Valid @RequestBody EventListenerProviderRequestDTO request) {
        return providerService.create(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update event listener provider")
    @ApiResponse(
            responseCode = "200",
            description = "Provider updated.",
            content = @Content(schema = @Schema(implementation = EventListenerProviderDTO.class)))
    @ApiResponse(responseCode = "400", description = "Provider request is invalid.")
    @ApiResponse(responseCode = "404", description = "Provider not found.")
    EventListenerProviderDTO update(
            @PathVariable String id, @Valid @RequestBody EventListenerProviderRequestDTO request) {
        return providerService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete event listener provider")
    @ApiResponse(responseCode = "204", description = "Provider deleted.")
    @ApiResponse(responseCode = "404", description = "Provider not found.")
    ResponseEntity<Void> delete(@PathVariable String id) {
        providerService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/deliveries")
    @Operation(
            summary = "List delivery history",
            description = "Returns bounded delivery history, optionally filtered by provider.")
    @ApiResponse(responseCode = "200", description = "Delivery history returned.")
    @ApiResponse(responseCode = "404", description = "Provider not found.")
    Page<EventListenerDeliveryDTO> deliveries(
            @Parameter(description = "Optional provider identifier.", example = "provider-1")
                    @RequestParam(required = false)
                    String providerId,
            @PageableDefault(
                            size = 20,
                            sort = "createdAt",
                            direction = org.springframework.data.domain.Sort.Direction.DESC)
                    Pageable pageable) {
        return providerService.deliveries(providerId, pageable);
    }

    @PostMapping("/deliveries/{id}/retry")
    @Operation(
            summary = "Queue a delivery retry",
            description = "Queues a non-successful delivery for immediate retry.")
    @ApiResponse(responseCode = "204", description = "Retry queued.")
    @ApiResponse(responseCode = "403", description = "The administrator cannot retry deliveries.")
    ResponseEntity<Void> retry(@PathVariable String id) {
        deliveryService.retry(id);
        return ResponseEntity.noContent().build();
    }
}
