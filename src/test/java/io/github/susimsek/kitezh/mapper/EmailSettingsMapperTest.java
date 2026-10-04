package io.github.susimsek.kitezh.mapper;

import static org.assertj.core.api.Assertions.assertThat;

import io.github.susimsek.kitezh.domain.EmailSettingsEntity;
import io.github.susimsek.kitezh.dto.admin.AdminEmailSettingsRequestDTO;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;

class EmailSettingsMapperTest {

    private final EmailSettingsMapper mapper = Mappers.getMapper(EmailSettingsMapper.class);

    @Test
    void exposesOnlyWhetherPasswordIsConfigured() {
        EmailSettingsEntity entity = new EmailSettingsEntity();
        entity.setFromAddress("noreply@example.com");
        entity.setPassword("secret");

        var dto = mapper.toDTO(entity);

        assertThat(dto.fromAddress()).isEqualTo("noreply@example.com");
        assertThat(dto.passwordConfigured()).isTrue();
    }

    @Test
    void treatsBlankPasswordAsNotConfigured() {
        EmailSettingsEntity entity = new EmailSettingsEntity();
        entity.setPassword(" ");

        assertThat(mapper.toDTO(entity).passwordConfigured()).isFalse();
    }

    @Test
    void updatesSettingsAndNormalizesAddressFields() {
        EmailSettingsEntity target = new EmailSettingsEntity();
        AdminEmailSettingsRequestDTO source =
                new AdminEmailSettingsRequestDTO(
                        true,
                        " noreply@example.com ",
                        " https://example.com ",
                        " smtp.example.com ",
                        587,
                        "mailer",
                        "",
                        true,
                        true,
                        false);

        mapper.update(source, target);

        assertThat(target.isEnabled()).isTrue();
        assertThat(target.getFromAddress()).isEqualTo("noreply@example.com");
        assertThat(target.getBaseUrl()).isEqualTo("https://example.com");
        assertThat(target.getHost()).isEqualTo("smtp.example.com");
        assertThat(target.getPort()).isEqualTo(587);
        assertThat(target.getUsername()).isEqualTo("mailer");
        assertThat(target.isSmtpAuth()).isTrue();
        assertThat(target.isStarttls()).isTrue();
        assertThat(target.isSsl()).isFalse();
    }
}
