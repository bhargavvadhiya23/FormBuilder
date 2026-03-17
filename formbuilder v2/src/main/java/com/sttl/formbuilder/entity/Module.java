package com.sttl.formbuilder.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "modules")
@Data
public class Module {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "route_prefix", length = 255)
    private String routePrefix;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "icon_class", length = 100)
    private String iconClass;

    @Column(name = "page_link", length = 500)
    private String pageLink;

    @Column(name = "active_status", nullable = false)
    private boolean activeStatus = true;

    @JsonProperty("isParent")
    @Column(name = "is_parent", nullable = false)
    private boolean isParent = false;

    @Column(name = "parent_id")
    private UUID parentId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
