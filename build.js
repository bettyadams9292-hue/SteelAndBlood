/* Build: bundles the modular source into a single self-contained dist/index.html
 * (scripts + CSS inlined, splash/logo art embedded as data URIs).
 * Usage: node build.js            -> dist/index.html
 *        node build.js --dev      -> dev.html that loads modules individually (for debugging) */
const fs = require('fs'), path = require('path');
const MODULES = [
  'core/base.js', 'data/items.js', 'data/world.js', 'core/input.js', 'core/audio.js', 'core/save.js',
  'systems/loot.js', 'systems/progression.js', 'render/art.js', 'render/fx.js', 'render/gore.js',
  'render3d/engine.js', 'render3d/materials.js', 'render3d/sky.js', 'render3d/kits.js', 'render3d/terrain.js', 'render3d/weapons3d.js', 'render3d/knight3d.js', 'render3d/crowd3d.js', 'render3d/fx3d.js',
  'game/player.js', 'game/combat.js', 'game/enemies.js', 'game/world.js', 'game/game.js',
  'ui/ui.js', 'ui/touch.js', 'main.js',
];
const src = (p) => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const VENDOR = ['vendor/three.classic.js', 'vendor/bgu.classic.js'];
const vend = () => VENDOR.map((v) => fs.readFileSync(path.join(__dirname, v), 'utf8')).join('\n');
const b64 = (p, mime) => 'data:' + mime + ';base64,' + fs.readFileSync(path.join(__dirname, p)).toString('base64');
const dev = process.argv.includes('--dev');
let html = src('index.html');
const assets = dev
  ? "IF.ASSETS = { splash: '../assets/splash.jpg', logo: '../assets/logo.jpg', menu: '../assets/menu_bg.jpg' };"
  : 'IF.ASSETS = { splash: ' + JSON.stringify(b64('assets/splash.jpg', 'image/jpeg')) + ', logo: ' + JSON.stringify(b64('assets/logo.jpg', 'image/jpeg')) + ', menu: ' + JSON.stringify(b64('assets/menu_bg.jpg', 'image/jpeg')) + ' };';
if (dev) {
  html = html.replace('<!--STYLE-->', '<link rel="stylesheet" href="../src/style.css">')
    .replace('<!--SCRIPTS-->', VENDOR.map((v) => '<script src="../' + v + '"></script>').join('\n') + '\n' + MODULES.map((m, i) => '<script src="../src/' + m + '"></script>' + (i === 0 ? '\n<script>' + assets + '</script>' : '')).join('\n'));
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'dist', 'dev.html'), html);
  console.log('dev build -> dist/dev.html');
} else {
  const js = MODULES.map((m, i) => '/* ==== ' + m + ' ==== */\n' + src(m) + (i === 0 ? '\n' + assets : '')).join('\n');
  html = html.replace('<!--STYLE-->', () => '<style>\n' + src('style.css') + '\n</style>').replace('<!--SCRIPTS-->', () => '<script>\n' + vend() + '\n</script>\n<script>\n' + js + '\n</script>');
  fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
  console.log('build -> dist/index.html', (html.length / 1024).toFixed(0) + ' KB,', js.split('\n').length, 'lines of JS');
}
