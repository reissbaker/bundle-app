var fs = require('fs');
var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var del = require('del');
var toml = require('toml');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var wate = require('wate');
var _ = require('lodash');
var shell = require('shelljs');
var uglify = require('gulp-uglify');
var gzip = require('gulp-gzip');
var mustache = require('mustache');
var readline = require('readline');
var yargs = require('yargs');


var CONF_FILE = 'app.toml';

var TARGET_DIR = yargs.argv.input;
var BUILD_DIR = yargs.argv.output;

if(!BUILD_DIR) throw new Error('Must provide an output dir with --output');
if(!TARGET_DIR) throw new Error('Must provide an input dir with --input');

if(TARGET_DIR === BUILD_DIR) {
  throw new Error('Can\'t have the same input and output dirs');
}

if(BUILD_DIR[BUILD_DIR.length - 1] !== '/') {
  BUILD_DIR = BUILD_DIR + '/';
}
if(TARGET_DIR[TARGET_DIR.length - 1] !== '/') {
  TARGET_DIR = TARGET_DIR + '/';
}

// Attempt to read the conf file; this will explode if the input dir is invalid.
readConf();

function readConf() {
  var config = fs.readFileSync(TARGET_DIR + CONF_FILE, 'utf-8');
  if(!config) return null;

  var parsed = toml.parse(config);
  return parsed;
}

gulp.task('document', [ 'clean' ], function(cb) {
  var conf = readConf();

  var layout = wate.make(function(cb) {
    fs.readFile('layout.mustache', 'utf-8', cb);
  });
  var body = wate.make(function(cb) {
    fs.readFile(TARGET_DIR + conf.document.body, 'utf-8', cb);
  });

  var all = [ body, layout ];
  wate.firstError(all, cb);
  wate.spreadAll(all, function(body, layout) {
    _.each(conf.scripts.files, function(filename) {
      shell.cp(TARGET_DIR + filename, BUILD_DIR + filename);
    });
    var scripts = _.map(conf.scripts.files, function(filename) {
      return { src: filename };
    });
    scripts.push({
      src: 'asset-manifest.js'
    });
    scripts.push({
      src: 'build.js'
    });

    var rendered = mustache.render(layout, {
      title: conf.app.name,
      styles: _.map(conf.styles.files, function(filename) {
        return { href: filename };
      }),
      body: body,
      scripts: scripts,
    });

    fs.writeFile(BUILD_DIR + 'index.html', rendered, cb);
  });
});

gulp.task('asset-manifest', [ 'clean' ], function(cb) {
  var conf = readConf();

  _.each(conf.images, function(val, key) {
    conf.images[key] = val;
  });

  conf = "window.assetManifest = " + JSON.stringify(conf) + ";";

  fs.writeFile(BUILD_DIR + 'asset-manifest.js', conf, cb);
});

gulp.task('scripts', [ 'clean' ], function() {
  var conf = readConf();

  var bundler = browserify({
    entries: [ TARGET_DIR + conf.scripts.entryPoint ],
    debug: true
  });

  return bundler.bundle()
    .pipe(source('build.js'))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(uglify())
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('compress-scripts', [ 'scripts' ], function() {
  return gulp.src('./build/build.js')
    .pipe(gzip({
      gzipOptions: {
        level: 9
      }
    }))
    .pipe(gulp.dest(BUILD_DIR));
});

gulp.task('images', [ 'clean' ], function(cb) {
  var conf = readConf();
  var processedImages = _.map(conf.images, pngcrush);
  wate.all(processedImages).done(cb);
});

gulp.task('styles', [ 'clean' ], function(cb) {
  var conf = readConf();
  _.each(conf.styles.files, function(filename) {
    shell.cp(TARGET_DIR + filename, BUILD_DIR + filename);
  });
  cb();
});

function pngcrush(image) {
  return wate.make(function(cb) {
    exec(
      [
        'pngcrush -rem gAMA -rem cHRM -rem iCCP -rem sRGB ',
        TARGET_DIR,
        image,
        ' ',
        BUILD_DIR,
        image
      ].join(''),
      cb
    );
  });
}

gulp.task('clean', function(cb) {
  del([ BUILD_DIR ], { force: true }, function() {
    shell.mkdir('-p', BUILD_DIR);
    shell.mkdir('-p', BUILD_DIR + 'assets');
    shell.mkdir('-p', BUILD_DIR + 'styles');
    shell.mkdir('-p', BUILD_DIR + 'vendor');
    cb();
  });
});

gulp.task('default', [
  'clean',
  'scripts',
  'compress-scripts',
  'images',
  'document',
  'asset-manifest',
  'styles'
]);

gulp.task('server', [ 'default' ], function(cb) {
  var watchers = [
    gulp.watch('app.toml', [ 'default' ]),
    gulp.watch('body.html', [ 'default' ]),
    gulp.watch('layout.mustache', [ 'default' ]),
    gulp.watch('demo/*.js', [ 'default' ]),
    gulp.watch('demo/**/*.js', [ 'default' ]),
  ];

  var server = spawn('python', [ '-m', 'SimpleHTTPServer', '8000' ], {
    stdio: [ 'pipe', 1, 2 ],
    cwd: BUILD_DIR
  });

  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Hit enter or Ctrl-C to exit.\n', function() {
    console.log('Closing server. Goodbye!');
    server.kill('SIGTERM');
  });

  server.on('close', function() {
    _.each(watchers, function(watcher) {
      watcher.end();
    });
    server.unref();
    rl.close();
    cb();
  });

  exec('open http://localhost:8000');
});
