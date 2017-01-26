// own
const aux = require('../auxiliary');

function Rectangle(rect, options) {
  if (!rect) {
    throw new Error('rect is required');
  }

  options = options || {};

  var element = options.element || document.createElement('div');
  element.style.position = 'fixed';
  this.element = element;

  this.rect = {};
  this.update(rect);

  if (options.color) {
    this.setColor(options.color);
  }

  if (options.id) {
    this.element.setAttribute('id', options.id);
  }

  if (options.className) {
    this.element.className = options.className;
  }

  if (options.attachTo) {
    this.attach(options.attachTo);
  }
  
  if (options.styles) {
    aux.applyStyles(this.element, options.styles);
  }
}

Rectangle.prototype.update = function (rect) {
  rect = aux.normalizeRect(rect);

  // update only changed values
  ['top', 'left', 'height', 'width'].forEach(function (prop) {

    if (this.rect[prop] !== rect[prop]) {
      this.rect[prop] = rect[prop];
      this.element.style[prop] = rect[prop] + 'px';
    }

  }.bind(this));
  
  // update label position
  
};

Rectangle.prototype.setColor = function (color) {
  this.element.style.backgroundColor = color;
};

Rectangle.prototype.attach = function (element) {
  element.appendChild(this.element);
};

Rectangle.prototype.remove = function () {
  this.element.remove();
};

module.exports = Rectangle;
