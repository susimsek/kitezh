package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;

class H2ConsoleSecurityConfigTest {

    private final WebApplicationContextRunner contextRunner =
            new WebApplicationContextRunner().withUserConfiguration(H2ConsoleSecurityConfig.class);

    @ParameterizedTest
    @ValueSource(strings = {"default", "prod", "dev,prod"})
    void doesNotRelaxSecurityOutsideDevelopment(String profiles) {
        contextRunner
                .withInitializer(
                        context -> context.getEnvironment().setActiveProfiles(profiles.split(",")))
                .withPropertyValues("spring.h2.console.enabled=true")
                .run(
                        context ->
                                assertThat(context)
                                        .doesNotHaveBean("h2ConsoleSecurityFilterChain"));
    }

    @Test
    void doesNotRegisterSecurityChainWhenConsoleIsDisabled() {
        contextRunner
                .withInitializer(context -> context.getEnvironment().setActiveProfiles("dev"))
                .withPropertyValues("spring.h2.console.enabled=false")
                .run(
                        context ->
                                assertThat(context)
                                        .doesNotHaveBean("h2ConsoleSecurityFilterChain"));
    }
}
