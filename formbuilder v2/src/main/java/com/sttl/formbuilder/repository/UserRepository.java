package com.sttl.formbuilder.repository;

import com.sttl.formbuilder.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"appRole", "createdByAdmin"})
    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"appRole", "createdByAdmin"})
    @org.springframework.lang.NonNull
    java.util.Optional<User> findById(@org.springframework.lang.NonNull java.util.UUID id);

    /** All sub-users created by a specific admin. */
    List<User> findByCreatedByAdmin_Id(UUID adminId);
}
