const util = require('util');
const EventEmitter = require('events');

const throttle = require('lodash.throttle');

const shapes = require('../shapes');

const OVERLAY_SELECTOR = '.highlight-overlay';
const LABEL_SELECTOR = '.highlight-overlay-label';

/**
 * Checks whether the given bounding rect is within viewport
 *
 * Taken from
 * http://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport#125106
 * 
 * @param  {ClientBoundingRect} rect
 * @return {Boolean}
 */
function isBoundingRectWithinViewPort(rect) {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

function ElementHighlighter(options) {

  var body = document.querySelector('body');

  /**
   * Hash to store shape elements
   * @type {Object}
   */
  this.shapes = {};

  // bind and throttle the update method to this instance
  this.update = throttle(this.update.bind(this), 50);

  // update on scroll
  window.addEventListener('scroll', this.update, false);

  /**
   * Shape of the element itself
   * @type {DOMElement}
   */
  this.shapes.element = shapes.overlay();
  body.appendChild(this.shapes.element);
}

ElementHighlighter.prototype.highlight = function (target) {
  if (!(target instanceof Element)) {
    throw new TypeError('target MUST be instance of Element');
  }

  this.target = target;

  this.update();
  this.show();
};

ElementHighlighter.prototype.isTarget = function (element) {
  return this.target === element;
};

ElementHighlighter.prototype.update = function () {
  var target = this.target;

  if (!target) {
    return;
  }

  var elementShape = this.shapes.element;
  var elementLabel = elementShape.querySelector(LABEL_SELECTOR);

  // position the element shape
  var boundingRect = target.getBoundingClientRect();

  // TODO:
  // if (!isBoundingRectWithinViewPort(boundingRect)) {
  //   this.hide();
  //   return;
  // }
  
  this.shapes.element.style.top = boundingRect.top + 'px';
  this.shapes.element.style.left = boundingRect.left + 'px';
  this.shapes.element.style.height = boundingRect.height + 'px';
  this.shapes.element.style.width = boundingRect.width + 'px';

  // update label text
  var tagName = target.tagName.toLowerCase();
  var id      = target.id ? '#' + target.id : '';
  var classes = Array.prototype.join.call(target.classList, '.');
  classes = classes ? '.' + classes : '';

  var labelText = tagName + id + classes;

  if (labelText) {
    elementLabel.removeAttribute('hidden');
    elementLabel.innerHTML = labelText;
  } else {
    elementLabel.setAttribute('hidden', true);
    elementLabel.innerHTML = '';
  }
};

ElementHighlighter.prototype.destroy = function () {

  // update on scroll
  window.removeEventListener('scroll', this.update, false);

  Object.keys(this.shapes).forEach(function (shapeName) {
    this.shapes[shapeName].remove();
  }.bind(this));
};

ElementHighlighter.prototype.hide = function () {
  this.shapes.element.setAttribute('hidden', true);
};

ElementHighlighter.prototype.show = function () {
  this.shapes.element.removeAttribute('hidden');
};

module.exports = ElementHighlighter;
