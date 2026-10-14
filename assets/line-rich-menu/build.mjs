import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const fontDir = process.env.WINDIR ? join(process.env.WINDIR, 'Fonts') : '';
const T = {
  tagline: '&#20844;&#38283;&#25136;&#32318; &#183; &#30436;&#21475;&#25512;&#34214;',
  todayPicks: '&#20170;&#26085;&#25512;&#34214;',
  todaySub: '&#30070;&#26085;&#26377;&#20998;&#26512;&#30340;&#36093;&#20107;',
  weekPicks: '&#26412;&#36913;&#25512;&#34214;',
  weekSub: '&#36817; 7 &#26085;&#24453;&#38283;&#36093;&#20998;&#26512;',
  charts: '&#25136;&#32318;&#36208;&#21218;',
  chartsSub: '&#21629;&#20013;&#29575; &#183; &#32047;&#31309;&#32318;&#25928;',
  perf: '&#21508;&#32879;&#36093;&#32318;&#25928;',
  home: '&#32178;&#31449;&#39318;&#38913;',
  bb: '&#31811;&#29699;',
  bbSub: '&#20170;&#26085; / &#26412;&#36913; &#183; &#20381;&#32879;&#36093;',
  bbGo: '&#36914;&#20837;&#31811;&#29699;&#36984;&#21934; &#8594;',
  fb: '&#36275;&#29699;',
  fbSub: '&#20170;&#26085; / &#26412;&#36913; &#183; &#20381;&#32879;&#36093;',
  fbGo: '&#36914;&#20837;&#36275;&#29699;&#36984;&#21934; &#8594;',
  back: '&#8592; &#36820;&#22238;',
  bbTitle: '&#31811;&#29699;&#25512;&#34214;',
  bbToday: '&#20170;&#26085;&#31811;&#29699;',
  bbTodaySub: '&#20170;&#22825;&#26377;&#25512;&#34214;&#30340;&#31811;&#29699;&#36093;&#20107;',
  bbWeek: '&#26412;&#36913;&#31811;&#29699;',
  bbWeekSub: '&#36817; 7 &#26085;&#24453;&#38283;&#36093;&#31811;&#29699;&#25512;&#34214;',
  byLeague: '&#20381;&#32879;&#36093;&#28687;&#35261;',
  easl: '&#26481;&#36229;',
  allBb: '&#20840;&#37096;&#31811;&#29699;',
  allBbSub: '&#26412;&#36913;&#25152;&#26377;&#31811;&#29699;&#25512;&#34214;',
  fbTitle: '&#36275;&#29699;&#25512;&#34214;',
  fbToday: '&#20170;&#26085;&#36275;&#29699;',
  fbTodaySub: '&#20170;&#22825;&#26377;&#25512;&#34214;&#30340;&#36275;&#29699;&#36093;&#20107;',
  fbWeek: '&#26412;&#36913;&#36275;&#29699;',
  fbWeekSub: '&#36817; 7 &#26085;&#24453;&#38283;&#36093;&#36275;&#29699;&#25512;&#34214;',
  epl: '&#33521;&#36229;',
  laliga: '&#35199;&#30002;',
  bundes: '&#24503;&#30002;',
  ligue1: '&#27861;&#30002;',
  bundes2: '&#24503;&#20057;',
  mls: '&#32654;&#36275;',
  ligamx: '&#22696;&#36229;',
  ered: '&#33655;&#34349;&#30002;',
  allFb: '&#20840;&#37096;&#36275;&#29699;',
  allFbSub: '&#26412;&#36913;&#25152;&#26377;&#36275;&#29699;&#25512;&#34214;',
  goWeb: '&#21069;&#24448;&#32178;&#31449;',
  weekHint: 'SBL &#183; TPBL &#183; PLG &#183; &#33521;&#36229; &#183; &#35199;&#30002; &#183; &#24503;&#30002;'
};

const svgs = {
  main: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">
  <rect width="2500" height="1686" fill="#fafafa"/>
  <rect x="48" y="48" width="1176" height="1590" fill="#0b5fad"/>
  <text x="108" y="140" fill="#ffffff" font-family="Inter, sans-serif" font-size="36" font-weight="800" letter-spacing="6" opacity="0.9">RS</text>
  <text x="108" y="720" fill="#ffffff" font-family="Microsoft JhengHei, sans-serif" font-size="96" font-weight="800">${T.todayPicks}</text>
  <text x="108" y="810" fill="#dbeafe" font-family="Microsoft JhengHei, sans-serif" font-size="32">${T.todaySub}</text>
  <line x1="108" y1="880" x2="380" y2="880" stroke="#ffffff" stroke-width="2" opacity="0.45"/>
  <rect x="1248" y="48" width="1204" height="775" fill="#ffffff"/>
  <rect x="1248" y="48" width="1204" height="8" fill="#0b5fad"/>
  <text x="1308" y="420" fill="#111827" font-family="Microsoft JhengHei, sans-serif" font-size="88" font-weight="800">${T.weekPicks}</text>
  <text x="1308" y="500" fill="#6b7280" font-family="Microsoft JhengHei, sans-serif" font-size="30">${T.weekSub}</text>
  <text x="1308" y="580" fill="#9ca3af" font-family="Microsoft JhengHei, sans-serif" font-size="26">${T.weekHint}</text>
  <rect x="1248" y="843" width="1204" height="795" fill="#ffffff"/>
  <rect x="1248" y="843" width="8" height="795" fill="#374151"/>
  <text x="1308" y="1180" fill="#111827" font-family="Microsoft JhengHei, sans-serif" font-size="80" font-weight="800">${T.goWeb}</text>
  <text x="1308" y="1260" fill="#6b7280" font-family="Inter, sans-serif" font-size="36">sportsrs.com</text>
  <text x="1308" y="1330" fill="#9ca3af" font-family="Microsoft JhengHei, sans-serif" font-size="26">${T.tagline}</text>
</svg>`,
  basketball: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">
  <rect width="2500" height="1686" fill="#ffffff"/>
  <line x1="0" y1="132" x2="2500" y2="132" stroke="#e5e7eb" stroke-width="2"/>
  <rect x="64" y="36" width="200" height="72" rx="4" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2"/>
  <text x="164" y="86" text-anchor="middle" fill="#374151" font-family="Microsoft JhengHei, sans-serif" font-size="28" font-weight="600">${T.back}</text>
  <text x="320" y="88" fill="#0b5fad" font-family="Microsoft JhengHei, sans-serif" font-size="52" font-weight="800">${T.bbTitle}</text>
  <rect x="64" y="168" width="1176" height="420" rx="4" fill="#0b5fad"/>
  <text x="120" y="300" fill="#ffffff" font-family="Microsoft JhengHei, sans-serif" font-size="56" font-weight="700">${T.bbToday}</text>
  <text x="120" y="370" fill="#dbeafe" font-family="Microsoft JhengHei, sans-serif" font-size="28">${T.bbTodaySub}</text>
  <rect x="1260" y="168" width="1176" height="420" rx="4" fill="#ffffff" stroke="#0b5fad" stroke-width="3"/>
  <text x="1316" y="300" fill="#0b5fad" font-family="Microsoft JhengHei, sans-serif" font-size="56" font-weight="700">${T.bbWeek}</text>
  <text x="1316" y="370" fill="#6b7280" font-family="Microsoft JhengHei, sans-serif" font-size="28">${T.bbWeekSub}</text>
  <text x="80" y="660" fill="#6b7280" font-family="Microsoft JhengHei, sans-serif" font-size="26" font-weight="600">${T.byLeague}</text>
  <rect x="64" y="720" width="776" height="420" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="452" y="920" text-anchor="middle" fill="#111827" font-family="Inter, sans-serif" font-size="56" font-weight="800">SBL</text>
  <rect x="862" y="720" width="776" height="420" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="1250" y="920" text-anchor="middle" fill="#0b5fad" font-family="Inter, sans-serif" font-size="56" font-weight="800">TPBL</text>
  <rect x="1660" y="720" width="776" height="420" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="2048" y="920" text-anchor="middle" fill="#111827" font-family="Inter, sans-serif" font-size="56" font-weight="800">PLG</text>
  <rect x="64" y="1164" width="776" height="458" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="452" y="1370" text-anchor="middle" fill="#111827" font-family="Inter, sans-serif" font-size="56" font-weight="800">BCL</text>
  <rect x="862" y="1164" width="776" height="458" rx="4" fill="#fffbeb" stroke="#78350f" stroke-width="2"/>
  <text x="1250" y="1370" text-anchor="middle" fill="#78350f" font-family="Microsoft JhengHei, sans-serif" font-size="56" font-weight="800">${T.easl}</text>
  <rect x="1660" y="1164" width="776" height="458" rx="4" fill="#eef4fb" stroke="#0b5fad" stroke-width="2"/>
  <text x="2048" y="1350" text-anchor="middle" fill="#0b5fad" font-family="Microsoft JhengHei, sans-serif" font-size="44" font-weight="700">${T.allBb}</text>
  <text x="2048" y="1410" text-anchor="middle" fill="#6b7280" font-family="Microsoft JhengHei, sans-serif" font-size="24">${T.allBbSub}</text>
</svg>`,
  football: `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="1686" viewBox="0 0 2500 1686">
  <rect width="2500" height="1686" fill="#ffffff"/>
  <line x1="0" y1="132" x2="2500" y2="132" stroke="#e5e7eb" stroke-width="2"/>
  <rect x="64" y="36" width="200" height="72" rx="4" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2"/>
  <text x="164" y="86" text-anchor="middle" fill="#374151" font-family="Microsoft JhengHei, sans-serif" font-size="28" font-weight="600">${T.back}</text>
  <text x="320" y="88" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="52" font-weight="800">${T.fbTitle}</text>
  <rect x="64" y="168" width="1176" height="420" rx="4" fill="#059669"/>
  <text x="120" y="300" fill="#ffffff" font-family="Microsoft JhengHei, sans-serif" font-size="56" font-weight="700">${T.fbToday}</text>
  <text x="120" y="370" fill="#d1fae5" font-family="Microsoft JhengHei, sans-serif" font-size="28">${T.fbTodaySub}</text>
  <rect x="1260" y="168" width="1176" height="420" rx="4" fill="#ffffff" stroke="#059669" stroke-width="3"/>
  <text x="1316" y="300" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="56" font-weight="700">${T.fbWeek}</text>
  <text x="1316" y="370" fill="#6b7280" font-family="Microsoft JhengHei, sans-serif" font-size="28">${T.fbWeekSub}</text>
  <text x="80" y="660" fill="#6b7280" font-family="Microsoft JhengHei, sans-serif" font-size="26" font-weight="600">${T.byLeague}</text>
  <rect x="64" y="720" width="776" height="300" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="452" y="880" text-anchor="middle" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="48" font-weight="800">${T.epl}</text>
  <rect x="862" y="720" width="776" height="300" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="1250" y="880" text-anchor="middle" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="48" font-weight="800">${T.laliga}</text>
  <rect x="1660" y="720" width="776" height="300" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="2048" y="880" text-anchor="middle" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="48" font-weight="800">${T.bundes}</text>
  <rect x="64" y="1044" width="776" height="300" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="452" y="1204" text-anchor="middle" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="48" font-weight="800">${T.ligue1}</text>
  <rect x="862" y="1044" width="776" height="300" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="1250" y="1204" text-anchor="middle" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="48" font-weight="800">${T.bundes2}</text>
  <rect x="1660" y="1044" width="776" height="300" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="2048" y="1204" text-anchor="middle" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="48" font-weight="800">${T.mls}</text>
  <rect x="64" y="1368" width="776" height="254" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="452" y="1510" text-anchor="middle" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="48" font-weight="800">${T.ligamx}</text>
  <rect x="862" y="1368" width="776" height="254" rx="4" fill="#f8f9fa" stroke="#e5e7eb" stroke-width="2"/>
  <text x="1250" y="1510" text-anchor="middle" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="48" font-weight="800">${T.ered}</text>
  <rect x="1660" y="1368" width="776" height="254" rx="4" fill="#ecfdf5" stroke="#059669" stroke-width="2"/>
  <text x="2048" y="1490" text-anchor="middle" fill="#059669" font-family="Microsoft JhengHei, sans-serif" font-size="44" font-weight="700">${T.allFb}</text>
  <text x="2048" y="1545" text-anchor="middle" fill="#6b7280" font-family="Microsoft JhengHei, sans-serif" font-size="24">${T.allFbSub}</text>
</svg>`
};

for (const [name, svg] of Object.entries(svgs)) {
  const svgPath = join(dir, `${name}.svg`);
  const pngPath = join(dir, `${name}.png`);
  writeFileSync(svgPath, svg, 'utf8');
  const args = ['--yes', '@resvg/resvg-js-cli'];
  if (fontDir) {
    args.push('--font-dir', fontDir);
    args.push('--font-file', join(fontDir, 'msjh.ttc'));
    args.push('--font-default-family', 'Microsoft JhengHei');
  }
  args.push(svgPath, pngPath);
  const quoted = args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
  execFileSync(`npx ${quoted}`, { stdio: 'inherit', shell: true });
  console.log('built', name);
}
