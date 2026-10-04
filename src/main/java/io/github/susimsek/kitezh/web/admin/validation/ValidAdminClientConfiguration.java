package io.github.susimsek.kitezh.web.admin.validation;

import static java.lang.annotation.ElementType.TYPE;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = AdminClientConfigurationValidator.class)
@Retention(RUNTIME)
@Target(TYPE)
public @interface ValidAdminClientConfiguration {

    String message() default "{app.api.problem.violation.client_configuration}";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
