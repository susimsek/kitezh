package io.github.susimsek.kitezh.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Application-wide binding from an authentication entry point to a top-level flow. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(name = "authentication_flow_binding")
public class AuthenticationFlowBindingEntity {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "binding_type", nullable = false, length = 30)
    private AuthenticationFlowBindingType bindingType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "flow_id")
    private AuthenticationFlowEntity flow;
}
