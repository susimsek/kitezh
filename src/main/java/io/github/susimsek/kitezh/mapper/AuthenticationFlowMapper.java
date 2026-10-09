package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.AuthenticationExecutionEntity;
import io.github.susimsek.kitezh.domain.AuthenticationFlowEntity;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationExecutionDTO;
import io.github.susimsek.kitezh.dto.admin.AdminAuthenticationFlowDTO;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AuthenticationFlowMapper {

    @Mapping(target = "topLevel", expression = "java(flow.isTopLevel())")
    AdminAuthenticationFlowDTO toFlowDTO(AuthenticationFlowEntity flow);

    @Mapping(target = "flowId", source = "flow.id")
    AdminAuthenticationExecutionDTO toExecutionDTO(AuthenticationExecutionEntity execution);
}
