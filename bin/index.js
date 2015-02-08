/*
 * Spawns off a gulp process with the right arguments.
 */

var path = require('path');
var spawn = require('child_process').spawn;
var yargs = require('yargs');

var GULP_DIR = path.resolve(__dirname, '..');
var BIN_PATH = path.resolve(__dirname, '..', 'node_modules', '.bin');

var argv = yargs
  .usage('Usage: $0 --output OUTPUT_DIR [--server] PATH_TO_BUNDLE_TOML')
  .demand('output')
  .boolean('server')
  .describe('output', 'The output directory')
  .describe('server', 'Runs a local development server')
  .alias('output', 'o')
  .alias('server', 's')
  .demand(1)
  .argv;

var input = path.dirname(path.resolve(argv._[0]));
var output = path.resolve(argv.output);

var args = [ '--input', input, '--output', output ];
args.push('--gulpfile', path.resolve(GULP_DIR, 'gulpfile.js'));

if(argv.server) args.push('server');

var gulp = spawn(path.resolve(BIN_PATH, 'gulp'), args, {
  stdio: 'inherit',
});
