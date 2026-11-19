package com.deskhive.office;

import java.util.EnumSet;
import java.util.Set;

/** Attributes of a space. Desks and rooms each have their own set. */
public enum Feature {
    DUAL_MONITOR,
    STANDING,
    WINDOW,
    ACCESSIBLE,
    SCREEN,
    VIDEO_CALLS,
    WHITEBOARD,
    STEP_FREE;

    public static final Set<Feature> DESK_FEATURES = EnumSet.of(DUAL_MONITOR, STANDING, WINDOW, ACCESSIBLE);
    public static final Set<Feature> ROOM_FEATURES = EnumSet.of(SCREEN, VIDEO_CALLS, WHITEBOARD, STEP_FREE);

    public static Set<Feature> allowedFor(SpaceType type) {
        return type == SpaceType.DESK ? DESK_FEATURES : ROOM_FEATURES;
    }
}
