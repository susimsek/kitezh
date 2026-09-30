package io.github.susimsek.springauthserversamples.web.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.github.susimsek.springauthserversamples.dto.admin.AdminIdentityProviderDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminIdentityProviderRequestDTO;
import io.github.susimsek.springauthserversamples.dto.admin.AdminProviderMapperDTO;
import io.github.susimsek.springauthserversamples.service.admin.AdminIdentityProviderService;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;

class AdminIdentityProviderControllerTest {

    private final AdminIdentityProviderService service = mock(AdminIdentityProviderService.class);
    private final AdminIdentityProviderController controller =
            new AdminIdentityProviderController(service);

    @Test
    void delegatesProviderAndMapperOperations() {
        PageRequest pageable = PageRequest.of(0, 20);
        AdminIdentityProviderDTO provider = mock(AdminIdentityProviderDTO.class);
        when(provider.id()).thenReturn("google");
        Page<AdminIdentityProviderDTO> providers = Page.empty(pageable);
        Page<AdminProviderMapperDTO> mappers = Page.empty(pageable);
        AdminProviderMapperDTO mapper = mock(AdminProviderMapperDTO.class);
        when(service.findAll("goo", pageable)).thenReturn(providers);
        when(service.findById("google")).thenReturn(provider);
        when(service.findMappers("google", "email", pageable)).thenReturn(mappers);
        when(service.create(org.mockito.ArgumentMatchers.any())).thenReturn(provider);
        when(service.update("google", null)).thenReturn(provider);
        when(service.createMapper("google", null)).thenReturn(mapper);
        when(service.updateMapper("google", "email", null)).thenReturn(mapper);

        assertThat(controller.findAll("goo", pageable)).isSameAs(providers);
        assertThat(controller.findById("google").getBody()).isSameAs(provider);
        assertThat(controller.create(mock(AdminIdentityProviderRequestDTO.class)).getStatusCode())
                .isEqualTo(HttpStatus.CREATED);
        assertThat(controller.update("google", null)).isSameAs(provider);
        assertThat(controller.delete("google").getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(controller.findMappers("google", "email", pageable)).isSameAs(mappers);
        assertThat(controller.createMapper("google", null)).isSameAs(mapper);
        assertThat(controller.updateMapper("google", "email", null)).isSameAs(mapper);
        assertThat(controller.deleteMapper("google", "email").getStatusCode())
                .isEqualTo(HttpStatus.NO_CONTENT);
        verify(service).delete("google");
        verify(service).deleteMapper("google", "email");
    }

    @Test
    void returnsNotFoundWhenProviderIsMissing() {
        when(service.findById("missing")).thenReturn(null);

        assertThat(controller.findById("missing").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
