package com.deskhive.office;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

public interface SpaceRepository extends JpaRepository<Space, Long> {

    /**
     * SELECT ... FOR UPDATE on one space row. Every booking of this space waits here, one at a time:
     * this lock is what makes "no overlapping bookings" safe (see BookingService).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Space s where s.id = :id")
    Optional<Space> lockById(Long id);

    List<Space> findByFloorId(Long floorId);

    List<Space> findByFloorIdAndType(Long floorId, SpaceType type);

    long countByFloorId(Long floorId);

    long countByFloorIdAndType(Long floorId, SpaceType type);

    /** Desks and rooms per floor for many floors in one query: rows of {floorId, type, count}. */
    @Query("select s.floorId, s.type, count(s) from Space s where s.floorId in :floorIds group by s.floorId, s.type")
    List<Object[]> countByFloorAndType(Collection<Long> floorIds);

    boolean existsByFloorIdAndRowLabelAndSeatNumber(Long floorId, String rowLabel, Integer seatNumber);

    boolean existsByFloorIdAndRowLabelAndSeatNumberAndIdNot(Long floorId, String rowLabel, Integer seatNumber, Long id);

    boolean existsByFloorIdAndName(Long floorId, String name);

    boolean existsByFloorIdAndNameAndIdNot(Long floorId, String name, Long id);

    /** Every desk and room of an office, for availability. */
    @Query("select s from Space s where s.floorId in (select f.id from Floor f where f.officeId = :officeId)")
    List<Space> findByOfficeId(Long officeId);

    List<Space> findByIdIn(Collection<Long> ids);

    /** The Spaces and seats table for one floor: optional text search on the label or area, paginated. */
    @Query("""
            select s from Space s
            where s.floorId = :floorId
              and (:type is null or s.type = :type)
              and (:q is null or lower(s.name) like :q or lower(s.area) like :q
                   or lower(concat(coalesce(s.rowLabel, ''), coalesce(str(s.seatNumber), ''))) like :q)
            order by s.type, s.rowLabel, s.seatNumber, s.name, s.id
            """)
    Page<Space> search(Long floorId, SpaceType type, String q, Pageable pageable);
}
