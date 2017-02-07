// third-party dependencies
const gulp = require('gulp');
const gulpSize = require('gulp-size');

// browserify
const browserify = require('browserify');
const source     = require('vinyl-source-stream');
const buffer     = require('vinyl-buffer');

gulp.task('javascript', function () {
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: 'lib/index.js',
    debug: false,

    // standalone global object for main module
    standalone: 'DOMHighlighter',
  });

  return b.bundle()
    .pipe(source('dom-highlighter.js'))
    .pipe(buffer())
    .pipe(gulp.dest('dist'))
    .pipe(gulpSize());
});

gulp.task('distribute', ['javascript']);

gulp.task('develop', ['javascript'], function () {

  gulp.watch('lib/**/*.js', ['javascript']);

});
