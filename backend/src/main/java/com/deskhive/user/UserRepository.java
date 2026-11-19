package com.deskhive.user;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRoleAndStatus(Role role, UserStatus status);

    long countByOfficeId(Long officeId);

    /** SELECT ... FOR UPDATE: the first lock a booking transaction takes (see BookingService). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> lockById(Long id);

    /** Locks every active Admin row (in id order), so two Admins can't both delete themselves as "not the last one". */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.role = com.deskhive.user.Role.ADMIN and u.status = com.deskhive.user.UserStatus.ACTIVE order by u.id")
    java.util.List<User> lockActiveAdmins();

    /** People screen: everyone except people who deleted their account, optionally filtered by name or email. */
    @Query("""
            select u from User u
            where u.status <> com.deskhive.user.UserStatus.DELETED
              and (:officeId is null or u.officeId = :officeId)
              and (:q is null or lower(u.name) like :q or lower(u.email) like :q)
            """)
    Page<User> searchPeople(Long officeId, String q, Pageable pageable);
}
