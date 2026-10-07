package io.github.susimsek.kitezh.mapper;

import io.github.susimsek.kitezh.domain.OrganizationEntity;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationDTO;
import io.github.susimsek.kitezh.dto.admin.AdminOrganizationRequestDTO;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface AdminOrganizationMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "alias", source = "alias", qualifiedByName = "trim")
    @Mapping(target = "name", source = "name", qualifiedByName = "trim")
    @Mapping(target = "attributes", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "lastModifiedBy", ignore = true)
    OrganizationEntity toEntity(AdminOrganizationRequestDTO request);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "alias", ignore = true)
    @Mapping(target = "name", source = "name", qualifiedByName = "trim")
    @Mapping(target = "attributes", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "createdBy", ignore = true)
    @Mapping(target = "lastModifiedBy", ignore = true)
    void update(AdminOrganizationRequestDTO request, @MappingTarget OrganizationEntity target);

    default AdminOrganizationDTO toDTO(OrganizationEntity organization) {
        Map<String, List<String>> attributes = new LinkedHashMap<>();
        organization.getAttributes().stream()
                .sorted(
                        java.util.Comparator.comparing(
                                        io.github.susimsek.kitezh.domain.OrganizationAttribute
                                                ::getName)
                                .thenComparing(
                                        io.github.susimsek.kitezh.domain.OrganizationAttribute
                                                ::getValue))
                .forEach(
                        attribute ->
                                attributes
                                        .computeIfAbsent(
                                                attribute.getName(), ignored -> new ArrayList<>())
                                        .add(attribute.getValue()));
        return new AdminOrganizationDTO(
                organization.getId(),
                organization.getAlias(),
                organization.getName(),
                organization.getRedirectUrl(),
                organization.getDescription(),
                organization.isEnabled(),
                attributes);
    }

    default void updateAttributes(Map<String, List<String>> values, OrganizationEntity target) {
        target.getAttributes().clear();
        if (values == null) {
            return;
        }
        values.forEach(
                (name, entries) -> {
                    if (entries != null) {
                        entries.stream()
                                .filter(value -> value != null && !value.isBlank())
                                .map(
                                        value ->
                                                new io.github.susimsek.kitezh.domain
                                                        .OrganizationAttribute(
                                                        name.strip(), value.strip()))
                                .forEach(target.getAttributes()::add);
                    }
                });
    }

    @org.mapstruct.Named("trim")
    default String trim(String value) {
        return value == null ? null : value.strip();
    }
}
