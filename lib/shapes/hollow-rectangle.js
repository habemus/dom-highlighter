// own
const aux = require('../auxiliary');

function HollowRectangle(rects, options) {
  if (!rects || !rects.outer || !rects.inner) {
    throw new Error('rects.inner and rects.outer are required');
  }
  
  options = options || {};

  var div = document.createElement('div');
  div.style.position    = 'fixed';
  div.style.boxSizing   = 'border-box';
  div.style.borderStyle = 'solid';
  this.element = div;

  this.outer = {};
  this.inner = {};
  this.border = {};
  this.update(rects);

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

HollowRectangle.prototype.update = function (rects) {

  var outer = rects.outer ? aux.normalizeRect(rects.outer) : this.outer;
  var inner = rects.inner ? aux.normalizeRect(rects.inner) : this.inner;

  // update rectangle positioning
  ['top', 'left', 'height', 'width'].forEach(function (prop) {

    if (this.outer[prop] !== outer[prop]) {
      this.outer[prop] = outer[prop];
      this.element.style[prop] = outer[prop] + 'px';
    }

  }.bind(this));

  // update rectangle border widths
  var border = {};
  border.top    = Math.max((inner.top - outer.top), 0);
  border.bottom = Math.max((outer.bottom - inner.bottom), 0);
  border.left   = Math.max((inner.left - outer.left), 0);
  border.right  = Math.max((outer.right - inner.right), 0);
  
  ['top', 'bottom', 'left', 'right'].forEach(function (side) {

    var prop = 'border-' + side + '-width';

    if (this.border[prop] !== border[side]) {
      this.border[prop] = border[side];
      this.element.style[prop] = border[side] + 'px';
    }

  }.bind(this));

  this.outer = outer;
  this.inner = inner;
  this.border = border;
};

HollowRectangle.prototype.setColor = function (color) {
  this.element.style.borderColor = color;
};

HollowRectangle.prototype.attach = function (element) {
  element.appendChild(this.element);
};

HollowRectangle.prototype.remove = function () {
  this.element.remove();
};

module.exports = HollowRectangle;
