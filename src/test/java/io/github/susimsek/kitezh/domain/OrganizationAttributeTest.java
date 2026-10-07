package io.github.susimsek.kitezh.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class OrganizationAttributeTest {

    @Test
    void comparesAttributesByNameAndValue() {
        var attribute = new OrganizationAttribute("department", "engineering");
        var same = new OrganizationAttribute("department", "engineering");

        assertThat(attribute).isEqualTo(attribute).isEqualTo(same);
        assertThat(attribute).hasSameHashCodeAs(same);
        assertThat(attribute).isNotEqualTo(new OrganizationAttribute("department", "sales"));
        assertThat(attribute).isNotEqualTo(null).isNotEqualTo("department");
    }
}
