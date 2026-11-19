package com.deskhive.office;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

public interface OfficeRepository extends JpaRepository<Office, Long> {

    List<Office> findAllByOrderByNameAsc();

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);

    /** Locked while deleting, so a floor can't be added to an office that is being deleted. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from Office o where o.id = :id")
    java.util.Optional<Office> lockById(Long id);
}
