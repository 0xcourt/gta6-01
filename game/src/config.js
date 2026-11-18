// Every tuning number, name and colour of Leonida Nights in one place.
// The game draws on a fixed 1280x720 logical area; the renderer scales it
// to the window, so no rule below depends on the screen size.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The whole city, in world pixels. The camera never leaves these bounds. */
export const WORLD = { width: 3600, height: 2600 };

/** The street grid: vertical avenues and horizontal streets, road width 120. */
export const ROADS_V = [300, 800, 1300, 1800, 2300, 2800, 3300];
export const ROADS_H = [250, 700, 1150, 1600, 2050];
export const ROAD_W = 120;

/** The beach strip along the south edge: sand, then open water. */
export const BEACH_Y = 2320;
export const WATER_Y = 2480;

/** The player on foot: how fast he walks and runs, how much he can take. */
export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  runSpeed: 330,
  health: 100,
  punchRange: 46,
  punchDamage: 34,
  punchCooldown: 0.45,
};

/** The pistol: damage, range, fire rate and the ammo a fresh run starts with. */
export const GUN = {
  damage: 34,
  bulletSpeed: 900,
  range: 520,
  cooldown: 0.22,
  startAmmo: 24,
  maxAmmo: 99,
};

/** Any drivable car: acceleration, top speed, reverse and how it turns. */
export const CAR = {
  length: 56,
  width: 28,
  accel: 520,
  maxSpeed: 640,
  reverseSpeed: 220,
  brake: 900,
  drag: 0.55,
  steer: 2.6,
  health: 100,
};

/** Traffic cars: how fast they cruise and how many may be out at once. */
export const TRAFFIC = {
  minSpeed: 150,
  maxSpeed: 300,
  maxCars: 14,
  spawnEvery: 1.6,
  colours: ['#c0392b', '#2980b9', '#f39c12', '#7f8c8d', '#16a085', '#d35400', '#8e44ad', '#bdc3c7'],
};

/** Pedestrians: walking speed, how many wander the sidewalks, how fast they flee. */
export const PED = {
  walkSpeed: 55,
  fleeSpeed: 190,
  maxPeds: 22,
  spawnEvery: 1.1,
  colours: ['#e67e22', '#1abc9c', '#9b59b6', '#f1c40f', '#ecf0f1', '#e74c3c', '#3498db'],
};

/** The wanted level: 0 to 5 stars, what raises it and how fast it cools off. */
export const WANTED = {
  max: 5,
  stealCar: 1,
  hitPed: 1,
  shoot: 1,
  killPed: 1,
  killCop: 2,
  ramCop: 1,
  /** Seconds with no crime and no police in sight before a star fades. */
  decaySeconds: 22,
  /** Police cars on the street for each wanted level. */
  copsForLevel: [0, 1, 2, 3, 4, 5],
};

/** The police: pursuit speed, how hard they ram, and the bust timer on foot. */
export const POLICE = {
  maxSpeed: 700,
  accel: 620,
  ramDamage: 12,
  bustSeconds: 1.4,
  despawnDistance: 1700,
};

/** Health: slow regen while the heat is off, and what pickups restore. */
export const HEALTH = {
  regenPerSecond: 3,
  pickup: 40,
  ammoPickup: 12,
};

/** The three story missions, in order, with their pay and their dialogue. */
export const MISSIONS = [
  {
    id: 'paket',
    title: 'Misi 1 — Paket Tengah Malam',
    pay: 400,
    intro: [
      'RICO: Raka, ada paket di Gudang Pelabuhan. Ambil, antar ke Kafe Neon.',
      'RAKA: Berapa bayarannya?',
      'RICO: $400. Jangan buka paketnya. Jangan tanya isinya.',
    ],
    steps: [
      { type: 'goto', x: 3300, y: 2050, label: 'Ambil paket di Gudang Pelabuhan', radius: 90 },
      { type: 'goto', x: 800, y: 1150, label: 'Antar paket ke Kafe Neon', radius: 90 },
    ],
    outro: [
      'MAYA: Paket diterima. Kamu cepat juga.',
      'RAKA: Kerjaan gampang kalau jalannya sepi.',
      'MAYA: Jangan senang dulu. Polisi lagi razia besar-besaran malam ini.',
    ],
  },
  {
    id: 'razia',
    title: 'Misi 2 — Kabur dari Razia',
    pay: 600,
    intro: [
      'RICO: Razia di mana-mana! Bintang tiga nempel di kepalamu.',
      'RAKA: Aku bahkan belum ngapa-ngapain!',
      'RICO: Kabur ke Gubuk Dermaga sampai panasnya reda. Jangan ketangkap!',
    ],
    steps: [
      { type: 'escape', x: 300, y: 2150, label: 'Lolos dari polisi — sembunyi di Gubuk Dermaga', radius: 110 },
    ],
    outro: [
      'RICO: Bagus. Mereka kehilangan jejakmu.',
      'RAKA: Jadi kapan kerjaan besarnya?',
      'RICO: Malam ini. Bank Leonida. Satu kali, bersih, kita kaya.',
    ],
  },
  {
    id: 'bank',
    title: 'Misi 3 — Bank Leonida',
    pay: 1500,
    intro: [
      'RICO: Ini dia. Masuk Bank Leonida, ambil uangnya, kabur ke dermaga.',
      'RAKA: Kalau alarm bunyi?',
      'RICO: Alarm PASTI bunyi. Lari yang cepat.',
    ],
    steps: [
      { type: 'goto', x: 1800, y: 700, label: 'Masuk ke Bank Leonida', radius: 90 },
      { type: 'hold', x: 1800, y: 700, label: 'Tahan E — bobol brankas (3 detik)', radius: 90, holdSeconds: 3 },
      { type: 'escape', x: 300, y: 2150, label: 'Kabur ke Gubuk Dermaga!', radius: 110 },
    ],
    outro: [
      'MAYA: $1.500. Bersih. Tidak ada yang terluka... terlalu parah.',
      'RAKA: Leonida Nights baru saja dimulai.',
      'RICO: Kota ini milik kita sekarang, Raka.',
    ],
  },
];

/** Named places on the map, drawn with signs and used by missions. */
export const LANDMARKS = [
  { name: 'GUDANG PELABUHAN', short: 'GUDANG', x: 3300, y: 2050, color: '#e67e22' },
  { name: 'KAFE NEON', short: 'KAFE', x: 800, y: 1150, color: '#ff2d78' },
  { name: 'GUBUK DERMAGA', short: 'DERMAGA', x: 300, y: 2150, color: '#2ecc71' },
  { name: 'BANK LEONIDA', short: 'BANK', x: 1800, y: 700, color: '#f1c40f' },
  { name: 'BENGKEL RICO', short: 'BENGKEL', x: 1300, y: 1600, color: '#3498db' },
  { name: 'RS LEONIDA', short: 'RS', x: 2300, y: 250, color: '#ecf0f1' },
  { name: 'TAMAN PALEM', short: 'TAMAN', x: 2300, y: 1150, color: '#27ae60' },
  { name: 'KANTOR POLISI', short: 'POLISI', x: 2800, y: 700, color: '#5dade2' },
];

export const PALETTE = {
  ground: '#1b2138',
  groundDark: '#161b2e',
  sidewalk: '#3d4358',
  road: '#232838',
  roadEdge: '#f5d76e',
  laneDash: '#8a8fa3',
  water: '#0d2f52',
  waterLight: '#155a8a',
  sand: '#b39b6d',
  sandDark: '#a08a5c',
  park: '#1e4d2b',
  parkLight: '#2a6b3c',
  buildingRoof: '#2c3350',
  panel: 'rgba(10, 13, 26, 0.85)',
  panelEdge: '#ff2d78',
  text: '#f4f1e6',
  muted: '#b9b3a4',
  good: '#2ecc71',
  warn: '#f39c12',
  bad: '#e74c3c',
  neonPink: '#ff2d78',
  neonCyan: '#00e5ff',
  neonYellow: '#f5d76e',
  player: '#00e5ff',
  police: '#dfe6f2',
  policeLight: '#ff2d55',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where progress is kept between visits (this browser only). */
export const SAVE_KEY = 'leonida-nights.save.v1';
export const BEST_KEY = 'leonida-nights.best';
