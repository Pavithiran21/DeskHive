// Flat illustrated "photos" of each kind of space. No photos are uploaded in the MVP, so the picture
// is chosen from the space's type and features (pictureFor).

function Quiet() {
  return (
    <>
      <rect width="200" height="190" fill="#e9eef7" />
      <rect width="200" height="90" fill="#cfdcf0" />
      <rect x="18" y="16" width="70" height="60" rx="4" fill="#f4f8ff" />
      <rect x="112" y="16" width="70" height="60" rx="4" fill="#f4f8ff" />
      <rect x="30" y="104" width="140" height="10" rx="3" fill="#8a6a4f" />
      <rect x="40" y="114" width="6" height="46" fill="#6f5640" />
      <rect x="154" y="114" width="6" height="46" fill="#6f5640" />
      <rect x="60" y="78" width="36" height="24" rx="3" fill="#2b2b31" />
      <rect x="104" y="78" width="36" height="24" rx="3" fill="#2b2b31" />
      <rect x="86" y="132" width="30" height="34" rx="8" fill="#e11d48" opacity=".85" />
      <circle cx="170" cy="150" r="14" fill="#7fb07a" />
      <rect x="166" y="160" width="8" height="18" fill="#a0784f" />
    </>
  );
}

function Window() {
  return (
    <>
      <rect width="200" height="190" fill="#fff4e6" />
      <rect x="20" y="10" width="160" height="90" rx="6" fill="#bfe0ff" />
      <path d="M100 10v90M20 55h160" stroke="#fff" strokeWidth="4" />
      <circle cx="150" cy="35" r="12" fill="#ffd36b" />
      <rect x="24" y="110" width="152" height="10" rx="3" fill="#d6b48a" />
      <rect x="34" y="120" width="6" height="44" fill="#b8956b" />
      <rect x="160" y="120" width="6" height="44" fill="#b8956b" />
      <rect x="82" y="86" width="40" height="24" rx="3" fill="#2b2b31" />
      <rect x="88" y="136" width="28" height="32" rx="8" fill="#4b5563" />
    </>
  );
}

function Standing() {
  return (
    <>
      <rect width="200" height="190" fill="#eef7ef" />
      <rect y="120" width="200" height="70" fill="#dfeedf" />
      <rect x="40" y="70" width="120" height="10" rx="3" fill="#2b2b31" />
      <rect x="96" y="80" width="8" height="70" fill="#4b5563" />
      <rect x="70" y="150" width="60" height="8" rx="3" fill="#4b5563" />
      <rect x="78" y="40" width="44" height="28" rx="3" fill="#2b2b31" />
      <rect x="82" y="44" width="36" height="20" fill="#60a5fa" />
      <circle cx="30" cy="100" r="16" fill="#7fb07a" />
    </>
  );
}

function Room() {
  return (
    <>
      <rect width="200" height="190" fill="#f4f0ff" />
      <rect x="40" y="18" width="120" height="56" rx="4" fill="#2b2b31" />
      <rect x="46" y="24" width="108" height="44" fill="#b4bdf5" />
      <ellipse cx="100" cy="128" rx="74" ry="28" fill="#d6b48a" />
      <g fill="#e11d48" opacity=".8">
        <circle cx="40" cy="128" r="9" />
        <circle cx="160" cy="128" r="9" />
        <circle cx="72" cy="100" r="9" />
        <circle cx="128" cy="100" r="9" />
        <circle cx="72" cy="158" r="9" />
        <circle cx="128" cy="158" r="9" />
      </g>
    </>
  );
}

function Focus() {
  return (
    <>
      <rect width="200" height="190" fill="#fdf2f8" />
      <rect x="24" y="20" width="152" height="70" rx="6" fill="#fbcfe8" />
      <rect x="40" y="34" width="56" height="42" rx="3" fill="#2b2b31" />
      <rect x="45" y="39" width="46" height="32" fill="#f9a8d4" />
      <rect x="34" y="112" width="132" height="10" rx="3" fill="#8a6a4f" />
      <rect x="44" y="122" width="6" height="42" fill="#6f5640" />
      <rect x="150" y="122" width="6" height="42" fill="#6f5640" />
      <circle cx="76" cy="146" r="10" fill="#e11d48" opacity=".85" />
      <circle cx="124" cy="146" r="10" fill="#e11d48" opacity=".85" />
    </>
  );
}

const PICTURES = { quiet: Quiet, window: Window, standing: Standing, room: Room, focus: Focus };

/** The picture (kind from lib/pictures.js pictureFor), filling its box (the box sets the size and the rounded corners). */
export function SpacePicture({ kind, height = '100%' }) {
  const Picture = PICTURES[kind] ?? Quiet;
  return (
    <svg width="100%" height={height} viewBox="0 0 200 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <Picture />
    </svg>
  );
}
