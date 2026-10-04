package io.github.susimsek.kitezh.web.admin.validation;

import static java.lang.annotation.ElementType.FIELD;
import static java.lang.annotation.ElementType.PARAMETER;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

@Documented
@Constraint(validatedBy = OptionalPasswordValidator.class)
@Retention(RUNTIME)
@Target({FIELD, PARAMETER})
public @interface OptionalPassword {

    String message() default "{app.api.problem.violation.password}";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
