package io.github.susimsek.kitezh.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSenderImpl;

class MailSenderConfigTest {

    @Test
    void createsDefaultJavaMailSender() {
        assertThat(new MailSenderConfig().mailSender()).isInstanceOf(JavaMailSenderImpl.class);
    }
}
