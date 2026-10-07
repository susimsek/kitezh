package io.github.susimsek.kitezh.config.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.WebApplicationContextRunner;
import org.springframework.context.support.StaticApplicationContext;
import org.springframework.security.config.ObjectPostProcessor;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.servlet.util.matcher.PathPatternRequestMatcher;

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

    @Test
    void buildsSecurityChainForEnabledConsoleInDevelopment() {
        SecurityFilterChain chain =
                new H2ConsoleSecurityConfig().h2ConsoleSecurityFilterChain(httpSecurity());

        assertThat(chain).isNotNull();
    }

    private static HttpSecurity httpSecurity() {
        ObjectPostProcessor<Object> postProcessor =
                new ObjectPostProcessor<>() {
                    @Override
                    public <O> O postProcess(O object) {
                        return object;
                    }
                };
        HttpSecurity httpSecurity =
                new HttpSecurity(
                        postProcessor,
                        new AuthenticationManagerBuilder(postProcessor),
                        new HashMap<>());
        StaticApplicationContext applicationContext = new StaticApplicationContext();
        applicationContext
                .getBeanFactory()
                .registerSingleton("pathPatternBuilder", PathPatternRequestMatcher.withDefaults());
        httpSecurity.setSharedObject(
                org.springframework.context.ApplicationContext.class, applicationContext);
        return httpSecurity;
    }
}
