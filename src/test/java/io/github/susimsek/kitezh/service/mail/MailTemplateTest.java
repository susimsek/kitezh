package io.github.susimsek.kitezh.service.mail;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.thymeleaf.context.Context;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

class MailTemplateTest {

    private SpringTemplateEngine templateEngine;

    @BeforeEach
    void setUp() {
        ClassLoaderTemplateResolver templateResolver = new ClassLoaderTemplateResolver();
        templateResolver.setPrefix("templates/");
        templateResolver.setSuffix(".html");
        templateResolver.setTemplateMode(TemplateMode.HTML);
        templateResolver.setCharacterEncoding(StandardCharsets.UTF_8.name());

        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasename("i18n/messages");
        messageSource.setDefaultEncoding(StandardCharsets.UTF_8.name());
        messageSource.setFallbackToSystemLocale(false);

        templateEngine = new SpringTemplateEngine();
        templateEngine.setTemplateResolver(templateResolver);
        templateEngine.setTemplateEngineMessageSource(messageSource);
    }

    @Test
    void rendersEnglishVerificationTemplate() {
        String content = render("mail/emailVerification", Locale.ENGLISH);

        assertThat(content)
                .contains("Hello user,")
                .contains("Verify email address")
                .contains("https://example.com/action?token=secret");
    }

    @Test
    void rendersTurkishPasswordResetTemplate() {
        String content = render("mail/passwordReset", Locale.forLanguageTag("tr"));

        assertThat(content)
                .contains("Merhaba user,")
                .contains("Parolayı sıfırla")
                .contains("https://example.com/action?token=secret");
    }

    private String render(String template, Locale locale) {
        Context context = new Context(locale);
        context.setVariable("username", "user");
        context.setVariable("actionUrl", "https://example.com/action?token=secret");
        context.setVariable("baseUrl", "https://example.com");
        return templateEngine.process(template, context);
    }
}
