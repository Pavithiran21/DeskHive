package com.deskhive.office;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.EnumSet;
import java.util.Set;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * A desk (area, row letter, number) or a meeting room (name, capacity). One table for both: the
 * columns of the other type stay NULL, and the migration's CHECKs keep that consistent.
 */
@Entity
@Table(name = "spaces")
public class Space {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "floor_id", nullable = false)
    private Long floorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 4, updatable = false)
    private SpaceType type;

    @Column(length = 60)
    private String area;

    @Column(name = "row_label", length = 1)
    private String rowLabel;

    @Column(name = "seat_number")
    private Integer seatNumber;

    @Column(length = 80)
    private String name;

    private Integer capacity;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "space_features", joinColumns = @JoinColumn(name = "space_id"))
    @Enumerated(EnumType.STRING)
    @Column(name = "feature", nullable = false, length = 20)
    private Set<Feature> features = EnumSet.noneOf(Feature.class);

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Space() {
    }

    public static Space desk(Long floorId, String area, String rowLabel, int seatNumber, Set<Feature> features) {
        Space space = new Space();
        space.type = SpaceType.DESK;
        space.floorId = floorId;
        space.area = area;
        space.rowLabel = rowLabel;
        space.seatNumber = seatNumber;
        space.features = copyOf(features);
        return space;
    }

    public static Space room(Long floorId, String name, int capacity, Set<Feature> features) {
        Space space = new Space();
        space.type = SpaceType.ROOM;
        space.floorId = floorId;
        space.name = name;
        space.capacity = capacity;
        space.features = copyOf(features);
        return space;
    }

    private static Set<Feature> copyOf(Set<Feature> features) {
        Set<Feature> copy = EnumSet.noneOf(Feature.class);
        copy.addAll(features);
        return copy;
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
    }

    public boolean isDesk() {
        return type == SpaceType.DESK;
    }

    /** "B7" for a desk, the room's name for a room. */
    public String label() {
        return isDesk() ? rowLabel + seatNumber : name;
    }

    public Long getId() {
        return id;
    }

    public Long getFloorId() {
        return floorId;
    }

    public void setFloorId(Long floorId) {
        this.floorId = floorId;
    }

    public SpaceType getType() {
        return type;
    }

    public String getArea() {
        return area;
    }

    public void setArea(String area) {
        this.area = area;
    }

    public String getRowLabel() {
        return rowLabel;
    }

    public void setRowLabel(String rowLabel) {
        this.rowLabel = rowLabel;
    }

    public Integer getSeatNumber() {
        return seatNumber;
    }

    public void setSeatNumber(Integer seatNumber) {
        this.seatNumber = seatNumber;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getCapacity() {
        return capacity;
    }

    public void setCapacity(Integer capacity) {
        this.capacity = capacity;
    }

    public Set<Feature> getFeatures() {
        return features;
    }

    public void setFeatures(Set<Feature> features) {
        this.features.clear();
        this.features.addAll(features);
    }
}
