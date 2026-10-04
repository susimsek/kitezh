package io.github.susimsek.kitezh.service.requiredaction;

import io.github.susimsek.kitezh.domain.RequiredActionDefinitionEntity;
import io.github.susimsek.kitezh.domain.UserEntity;
import java.util.Map;

/** Extension point for application-specific required actions. */
public interface RequiredActionHandler {

    String key();

    boolean isPending(
            UserEntity user, RequiredActionDefinitionEntity definition, boolean completed);

    void complete(UserEntity user, Map<String, Object> values);
}
