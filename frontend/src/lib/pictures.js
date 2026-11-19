/**
 * Which illustration a space gets (components/SpacePicture.jsx draws them). Rooms for up to 2 people
 * are focus rooms. A desk area uses the features its desks have and falls back to the area name.
 */
export function pictureFor({ type, features = [], capacity, name = '' }) {
  const lower = name.toLowerCase();
  if (type === 'ROOM') {
    return (capacity != null && capacity <= 2) || lower.includes('focus') ? 'focus' : 'room';
  }
  if (features.includes('STANDING') || lower.includes('standing')) {
    return 'standing';
  }
  if (features.includes('WINDOW') || lower.includes('window')) {
    return 'window';
  }
  return 'quiet';
}

/** The picture for a booking's space. */
export function pictureForSpace(space) {
  return pictureFor({ type: space.type, features: space.features ?? [], name: space.area ?? space.label });
}
