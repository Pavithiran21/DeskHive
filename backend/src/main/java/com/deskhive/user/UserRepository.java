package com.deskhive.user;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    long countByRoleAndStatus(Role role, UserStatus status);

    long countByOfficeId(Long officeId);

    /**
     * SELECT ... FOR UPDATE: the first lock a booking transaction takes (see BookingService). Plain
     * SQL: Hibernate's lock mode would add "OF <alias>", which TiDB refuses.
     */
    @Query(value = "select * from users where id = :id for update", nativeQuery = true)
    Optional<User> lockById(Long id);

    /** Locks every active Admin row (in id order), so two Admins can't both delete themselves as "not the last one". */
    @Query(value = "select * from users where role = 'ADMIN' and status = 'ACTIVE' order by id for update", nativeQuery = true)
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
