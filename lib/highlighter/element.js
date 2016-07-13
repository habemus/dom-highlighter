const util = require('util');
const EventEmitter = require('events');

const shapes = require('../shapes');

const OVERLAY_SELECTOR = '.highlight-overlay';
const LABEL_SELECTOR = '.highlight-overlay-label';

function ElementHighlighter(options) {

  var body = document.querySelector('body');

  /**
   * Hash to store shape elements
   * @type {Object}
   */
  this.shapes = {};

  /**
   * Shape of the element itself
   * @type {DOMElement}
   */
  this.shapes.element = shapes.overlay();
  body.appendChild(this.shapes.element);
}

ElementHighlighter.prototype.attach = function (target) {
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
