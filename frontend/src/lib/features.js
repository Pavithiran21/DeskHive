import {
  IconArrowAutofitHeight,
  IconChalkboard,
  IconDeviceDesktop,
  IconDeviceTv,
  IconVideo,
  IconWheelchair,
  IconWindow,
} from '@tabler/icons-react';

// The feature codes the API uses, with the words and icon the screens show.
export const DESK_FEATURES = [
  { code: 'DUAL_MONITOR', label: 'Dual monitor', form: 'Dual monitor', Icon: IconDeviceDesktop },
  { code: 'STANDING', label: 'Standing', form: 'Standing (height adjustable)', Icon: IconArrowAutofitHeight },
  { code: 'WINDOW', label: 'By the window', form: 'By the window', Icon: IconWindow },
  { code: 'ACCESSIBLE', label: 'Accessible', form: 'Accessible', Icon: IconWheelchair },
];

export const ROOM_FEATURES = [
  { code: 'SCREEN', label: 'Screen', form: 'Screen', Icon: IconDeviceTv },
  { code: 'VIDEO_CALLS', label: 'Video calls', form: 'Video calls', Icon: IconVideo },
  { code: 'WHITEBOARD', label: 'Whiteboard', form: 'Whiteboard', Icon: IconChalkboard },
  { code: 'STEP_FREE', label: 'Step-free', form: 'Step-free access', Icon: IconWheelchair },
];

const ALL = [...DESK_FEATURES, ...ROOM_FEATURES];

export function featureInfo(code) {
  return ALL.find((entry) => entry.code === code) ?? { code, label: code, form: code, Icon: null };
}

/** "Screen, video calls, whiteboard" in the order of the lists above. */
export function featureText(codes) {
  if (!codes?.length) {
    return '—';
  }
  const text = ALL.filter((entry) => codes.includes(entry.code)).map((entry) => entry.label.toLowerCase()).join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
