// Hand-drawn SVG icons for the research tree (no emoji: they don't render on every device).
// Icons.svg(name) -> an <svg> string, 64x64, stroked in currentColor with a few fills.
'use strict';
(function (root) {
  const S = 'stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"';
  const steel = '#c9d2da', wood = '#c48d55', orange = '#f08a24', soil = '#7a4a26', skin = '#f1c7a3', ore = '#3a404b', blue = '#4d9fe8';
  const P = {
    spoon: `<ellipse cx="22" cy="20" rx="10" ry="13" transform="rotate(-40 22 20)" fill="${steel}" ${S}/><path d="M29 28 L52 52" ${S}/>`,
    scoop: `<path d="M10 22 L34 10 L44 30 L20 42 Z" fill="${steel}" ${S}/><path d="M38 34 L54 52" stroke="${wood}" stroke-width="7" stroke-linecap="round"/><path d="M38 34 L54 52" ${S} stroke-width="2"/>`,
    trowel: `<path d="M14 12 C26 8 36 16 36 26 L28 34 C18 34 10 24 14 12 Z" fill="${steel}" ${S}/><path d="M32 30 L40 38" ${S}/><path d="M40 38 L54 52" stroke="${wood}" stroke-width="7" stroke-linecap="round"/>`,
    shovel: `<path d="M12 10 L28 10 L30 28 C30 34 24 38 20 38 C16 38 10 34 10 28 Z" fill="${steel}" ${S}/><path d="M20 38 L46 54" stroke="${wood}" stroke-width="6" stroke-linecap="round"/><path d="M42 58 L52 48" ${S}/>`,
    pick: `<path d="M8 22 C22 8 42 8 56 22" fill="none" stroke="${steel}" stroke-width="7" stroke-linecap="round"/><path d="M8 22 C22 8 42 8 56 22" ${S} stroke-width="2"/><path d="M32 13 L32 58" stroke="${wood}" stroke-width="6" stroke-linecap="round"/>`,
    b5: `<path d="M18 24 L46 24 L42 54 L22 54 Z" fill="${orange}" ${S}/><path d="M16 24 C16 8 48 8 48 24" ${S}/><text x="32" y="46" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="sans-serif">5</text>`,
    b10: `<path d="M16 22 L48 22 L44 54 L20 54 Z" fill="${orange}" ${S}/><path d="M14 22 C14 6 50 6 50 22" ${S}/><text x="32" y="45" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="sans-serif">10</text>`,
    b20: `<path d="M12 20 L52 20 L47 56 L17 56 Z" fill="${orange}" ${S}/><path d="M10 20 C10 2 54 2 54 20" ${S}/><path d="M14 22 C22 18 42 18 50 22" fill="${soil}"/><text x="32" y="46" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="sans-serif">20</text>`,
    sack: `<path d="M20 16 C10 30 10 54 32 56 C54 54 54 30 44 16 Z" fill="#c9a26d" ${S}/><path d="M22 16 L42 16" ${S}/><path d="M26 10 L32 16 L38 10" ${S}/><text x="32" y="44" text-anchor="middle" font-size="13" font-weight="900" fill="#5a3a1a" font-family="sans-serif">50</text>`,
    barrow: `<path d="M8 22 L44 22 L38 40 L14 40 Z" fill="${orange}" ${S}/><circle cx="42" cy="48" r="7" fill="#3b4048" ${S}/><path d="M44 22 L58 14 M14 40 L10 54" ${S}/>`,
    arm: `<path d="M12 50 C12 36 18 26 28 22 C34 20 38 14 40 10 L48 14 C46 22 42 28 36 32 C42 32 50 36 52 44 C50 52 40 54 30 54 Z" fill="${skin}" ${S}/>`,
    arm2: `<path d="M12 50 C12 36 18 26 28 22 C34 20 38 14 40 10 L48 14 C46 22 42 28 36 32 C42 32 50 36 52 44 C50 52 40 54 30 54 Z" fill="${skin}" ${S}/><path d="M50 8 L56 4 M54 14 L60 12" ${S}/>`,
    arm3: `<path d="M12 50 C12 36 18 26 28 22 C34 20 38 14 40 10 L48 14 C46 22 42 28 36 32 C42 32 50 36 52 44 C50 52 40 54 30 54 Z" fill="${orange}" ${S}/><path d="M50 8 L56 4 M54 14 L60 12 M52 22 L58 22" ${S}/>`,
    scale: `<path d="M32 10 L32 50 M14 54 L50 54 M12 18 L52 18" ${S}/><path d="M12 18 L6 34 L18 34 Z M52 18 L46 34 L58 34 Z" fill="${steel}" ${S}/>`,
    scale2: `<rect x="10" y="30" width="44" height="22" rx="4" fill="${steel}" ${S}/><rect x="18" y="36" width="20" height="9" rx="2" fill="#2f8a3a"/><path d="M16 30 L16 20 L48 20 L48 30" ${S}/>`,
    worker: `<circle cx="32" cy="16" r="8" fill="${skin}" ${S}/><path d="M24 12 C24 4 40 4 40 12 Z" fill="#2b3442"/><path d="M18 56 L20 32 C22 26 42 26 44 32 L46 56 Z" fill="${orange}" ${S}/>`,
    workers2: `<circle cx="22" cy="18" r="7" fill="${skin}" ${S}/><path d="M10 54 L12 34 C14 28 30 28 32 34 L34 54 Z" fill="${orange}" ${S}/><circle cx="44" cy="20" r="7" fill="${skin}" ${S}/><path d="M32 56 L34 36 C36 30 52 30 54 36 L56 56 Z" fill="${blue}" ${S}/>`,
    workers3: `<circle cx="16" cy="22" r="6" fill="${skin}" ${S}/><path d="M6 54 L8 38 C10 32 22 32 24 38 L26 54 Z" fill="${orange}" ${S}/><circle cx="32" cy="16" r="6" fill="${skin}" ${S}/><path d="M22 50 L24 32 C26 26 38 26 40 32 L42 50 Z" fill="${blue}" ${S}/><circle cx="48" cy="22" r="6" fill="${skin}" ${S}/><path d="M38 54 L40 38 C42 32 54 32 56 38 L58 54 Z" fill="#7a9b5b" ${S}/>`,
    cabin: `<rect x="8" y="24" width="48" height="26" rx="5" fill="#e9e8e4" ${S}/><path d="M8 32 L56 32" stroke="${orange}" stroke-width="4"/><rect x="14" y="36" width="10" height="8" fill="${blue}"/><circle cx="18" cy="54" r="5" fill="#3b4048"/><circle cx="46" cy="54" r="5" fill="#3b4048"/>`,
    probe: `<path d="M32 6 L32 50" ${S}/><path d="M32 50 L28 58 L36 58 Z" fill="${steel}" ${S}/><path d="M20 10 L44 10" stroke="${wood}" stroke-width="6" stroke-linecap="round"/><path d="M18 40 L46 40" stroke="${soil}" stroke-width="4" stroke-dasharray="3 4"/>`,
    detector: `<ellipse cx="22" cy="48" rx="14" ry="6" fill="${steel}" ${S}/><path d="M28 44 L50 12" ${S}/><rect x="42" y="14" width="12" height="10" rx="2" fill="${orange}" ${S}/><path d="M8 30 C4 24 6 18 10 16 M14 28 C12 24 13 21 16 19" ${S}/>`,
    detector2: `<ellipse cx="22" cy="48" rx="16" ry="7" fill="${orange}" ${S}/><path d="M28 44 L50 12" ${S}/><rect x="42" y="12" width="14" height="12" rx="2" fill="${steel}" ${S}/><path d="M4 32 C0 24 3 16 8 13 M11 30 C9 25 10 21 14 18 M18 28 C17 26 18 24 20 22" ${S}/>`,
    radar: `<rect x="10" y="38" width="44" height="12" rx="3" fill="${orange}" ${S}/><circle cx="18" cy="54" r="4" fill="#3b4048"/><circle cx="46" cy="54" r="4" fill="#3b4048"/><path d="M20 30 C26 22 38 22 44 30 M14 24 C24 12 40 12 50 24" ${S}/>`,
    ore: `<path d="M10 40 L20 18 L40 12 L54 28 L48 50 L24 54 Z" fill="${ore}" ${S}/><path d="M20 30 L44 24 M18 40 L46 36" stroke="#8c96a5" stroke-width="3"/>`,
    rig: `<path d="M32 10 L12 56 M32 10 L52 56 M32 10 L32 56" stroke="${wood}" stroke-width="4" stroke-linecap="round"/><path d="M32 22 L32 60" ${S}/><path d="M26 34 L38 38 M26 42 L38 46 M26 50 L38 54" ${S}/><circle cx="32" cy="12" r="6" fill="none" ${S}/>`,
    rig2: `<path d="M32 14 L12 56 M32 14 L52 56" stroke="${steel}" stroke-width="4" stroke-linecap="round"/><rect x="22" y="6" width="20" height="14" rx="3" fill="${orange}" ${S}/><path d="M32 20 L32 60" ${S}/><path d="M26 34 L38 38 M26 42 L38 46 M26 50 L38 54" ${S}/>`,
    rig3: `<path d="M20 18 L8 54 M20 18 L32 54 M44 18 L32 54 M44 18 L56 54" stroke="${steel}" stroke-width="3.5" stroke-linecap="round"/><rect x="13" y="10" width="14" height="10" rx="2" fill="${orange}" ${S}/><rect x="37" y="10" width="14" height="10" rx="2" fill="${orange}" ${S}/><path d="M20 20 L20 58 M44 20 L44 58" ${S}/>`,
    globe: `<circle cx="32" cy="32" r="22" fill="${blue}" ${S}/><path d="M18 22 C26 20 28 28 22 32 C18 36 24 44 20 50 M36 12 C40 18 48 18 50 24 C46 28 40 26 38 32 C36 38 44 42 48 46" fill="none" stroke="#6fb848" stroke-width="5" stroke-linecap="round"/>`,
    jump: `<path d="M32 50 L32 16 M18 30 L32 16 L46 30" ${S} stroke-width="5"/><path d="M14 54 L50 54" ${S} stroke-width="5"/>`,
    lock: `<rect x="16" y="28" width="32" height="24" rx="5" fill="currentColor"/><path d="M22 28 L22 20 C22 8 42 8 42 20 L42 28" ${S}/>`,
  };
  root.Icons = { svg: name => `<svg viewBox="0 0 64 64" aria-hidden="true">${P[name] || P.ore}</svg>` };
})(window);
