/*
 * Spawns off a gulp process with the right arguments.
 */

var path = require('path');
var spawn = require('child_process').spawn;
var yargs = require('yargs');

var GULP_DIR = path.resolve(__dirname, '..');
var BIN_PATH = path.resolve(__dirname, '..', 'node_modules', '.bin');

var argv = yargs
  .usage('Usage: $0 --input INPUT_DIR --output OUTPUT_DIR [--server]')
  .demand(['input', 'output'])
  .boolean('server')
  .describe('input', 'The input directory')
  .describe('output', 'The output directory')
  .describe('server', 'Runs a local development server')
  .alias('input', 'i')
  .alias('output', 'o')
  .alias('server', 's')
  .argv;

var input = path.resolve(argv.input);
var output = path.resolve(argv.output);

var args = [ '--input', input, '--output', output ];
args.push('--gulpfile', path.resolve(GULP_DIR, 'gulpfile.js'));

if(argv.server) args.push('server');

var gulp = spawn(path.resolve(BIN_PATH, 'gulp'), args, {
  stdio: 'inherit',
});
