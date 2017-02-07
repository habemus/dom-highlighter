(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.DOMHighlighter = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const PX_RE = /(-?[0-9.]+)px$/;

function toPixels(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {

    var match = value.match(PX_RE);

    if (!match) {
      throw new Error('invalid value: could not parse pixel count from ' + value);
    }

    return parseInt(match[1]);
  }

  throw new Error('invalid value: could not parse pixel count from ' + value);
}
exports.toPixels = toPixels;

exports.fmtPixels = function (value) {
  if (Math.round(value) !== value) {
    // is decimal
    return parseFloat(value).toFixed(2);
  } else {
    return value;
  }
}

exports.normalizeRect = function (rect) {

  rect = Object.assign({}, rect);

  if (typeof rect.top === 'undefined' || typeof rect.left === 'undefined') {
    console.warn(rect);
    throw new Error('rect.top and rect.left MUST NOT be undefined');
  }

  if (typeof rect.width === 'number' && typeof rect.right === 'undefined') {
    rect.right = rect.left + rect.width;
  } else if (typeof rect.right === 'number' && typeof rect.width === 'undefined') {
    rect.width = rect.right - rect.left;
  }

  if (typeof rect.height === 'number' && typeof rect.bottom === 'undefined') {
    rect.bottom = rect.top + rect.height;
  } else if (typeof rect.bottom === 'number' && typeof rect.height === 'undefined') {
    rect.height = rect.bottom - rect.top;
  }

  return rect;
};

exports.calcElementRectangles = function (element) {
  var boundingRect = element.getBoundingClientRect();
  var cStyles      = window.getComputedStyle(element);

  var padding = {
    top: toPixels(cStyles['padding-top']),
    bottom: toPixels(cStyles['padding-bottom']),
    left: toPixels(cStyles['padding-left']),
    right: toPixels(cStyles['padding-right']),
  };

  var border = {
    top: toPixels(cStyles['border-top-width']),
    bottom: toPixels(cStyles['border-bottom-width']),
    left: toPixels(cStyles['border-left-width']),
    right: toPixels(cStyles['border-right-width']),
  };

  var margin = {
    top: toPixels(cStyles['margin-top']),
    bottom: toPixels(cStyles['margin-bottom']),
    left: toPixels(cStyles['margin-left']),
    right: toPixels(cStyles['margin-right']),
  };

  // hash containing specs for rectangles
  var rectangles = {};
  rectangles.element = exports.normalizeRect({
    top: boundingRect.top + padding.top + border.top,
    left: boundingRect.left + padding.left + border.left,
    height: boundingRect.height - (padding.top + padding.bottom + border.top + border.bottom),
    width: boundingRect.width - (padding.left + padding.right + border.left + border.bottom),
  });
  rectangles.padding = exports.normalizeRect({
    top: boundingRect.top + border.top,
    bottom: boundingRect.bottom - border.bottom,
    left: boundingRect.left + border.left,
    right: boundingRect.right - border.right,
  });
  rectangles.border = exports.normalizeRect({
    top: boundingRect.top,
    bottom: boundingRect.bottom,
    left: boundingRect.left,
    right: boundingRect.right,
  });
  rectangles.margin = exports.normalizeRect({
    top: boundingRect.top - margin.top,
    bottom: boundingRect.bottom + margin.bottom,
    left: boundingRect.left - margin.left,
    right: boundingRect.right + margin.right,
  });

  return rectangles;
};

exports.applyStyles = function (element) {
  
  // accepts either infinite arguments as style objects
  // or a second argument that is an array of style objects
  var styleObjects = Array.isArray(arguments[1]) ?
    arguments[1] : Array.prototype.slice.call(arguments, 1);
  var styles = Object.assign.apply(null, [{}].concat(styleObjects));
  
  for (var st in styles) {
    element.style[st] = styles[st];
  }
};

},{}],2:[function(require,module,exports){
const util = require('util');
const EventEmitter = require('events');

const throttle = require('lodash.throttle');

const shapes = require('../shapes');
const aux    = require('../auxiliary');

const SHARED_STYLES = {
  transition: 'all .05s linear',
  
  // TODO: study better place for this style
  pointerEvents: 'none',
};
const HIGH_VALUE = 9999999999;
const LABEL_THRESHOLD = 60;

const BLUE = 'rgb(118, 154, 198)';
const BLUE_A = 'rgba(118, 154, 198, 0.5)';
const GREEN = 'rgb(152, 184, 140)';
const GREEN_A = 'rgba(152, 184, 140, 0.5)';
const LIGHT_ORANGE = 'rgb(233, 161, 116)';
const LIGHT_ORANGE_A = 'rgba(233, 161, 116, 0.3)';
const ORANGE = 'rgb(233, 161, 116)';
const ORANGE_A = 'rgba(233, 161, 116, 0.5)';

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
  
  options = options || {};

  var body = document.querySelector('body');

  /**
   * Hash to store shape elements
   * @type {Object}
   */
  this.shapes = {};

  // bind and throttle the update method to this instance
  this.update = throttle(this.update.bind(this), 50);

  // update on scroll and on resize
  window.addEventListener('scroll', this.update, false);
  window.addEventListener('resize', this.update, false);

  /**
   * Shape of the element itself
   * @type {DOMElement}
   */
  // this.shapes.elementRect = shapes.overlay();
  
  /**
   * Container element for all shapes used by this highlighter
   * @type {DOMElement}
   */
  this.element = document.createElement('div');
  this.element.className = 'dom-highlighter-container';
  body.appendChild(this.element);

  var _invisible = {
    top: 0,
    left: 0,
    height: 0,
    width: 0,
  };
  this.shapes.elementRect = new shapes.Rectangle(_invisible, {
    color: BLUE_A,
    attachTo: this.element,
    styles: [SHARED_STYLES, {
      zIndex: 10 * HIGH_VALUE,
    }],
  });
  
  this.shapes.paddingRect = new shapes.HollowRectangle({
    outer: _invisible,
    inner: _invisible,
  }, {
    color: GREEN_A,
    attachTo: this.element,
    styles: [SHARED_STYLES, {
      zIndex: 9 * HIGH_VALUE,
    }],
  });
  
  this.shapes.borderRect = new shapes.HollowRectangle({
    outer: _invisible,
    inner: _invisible,
  }, {
    color: LIGHT_ORANGE_A,
    attachTo: this.element,
    styles: [SHARED_STYLES, {
      zIndex: 8 * HIGH_VALUE,
    }],
  });
  
  this.shapes.marginRect =  new shapes.HollowRectangle({
    outer: _invisible,
    inner: _invisible,
  }, {
    color: ORANGE_A,
    attachTo: this.element,
    styles: [SHARED_STYLES, {
      zIndex: 7 * HIGH_VALUE,
    }],
  });
  
  if (!options.noLabel) {
    this.shapes.label = new shapes.Label({
      attachTo: this.element,
      styles: [SHARED_STYLES, {
        zIndex: 10 * HIGH_VALUE,
      }],
    });
  }
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
  
  var rects = aux.calcElementRectangles(target);
  
  this.shapes.elementRect.update(rects.element);
  this.shapes.paddingRect.update({
    outer: rects.padding,
    inner: rects.element
  });
  this.shapes.borderRect.update({
    outer: rects.border,
    inner: rects.padding
  });
  this.shapes.marginRect.update({
    outer: rects.margin,
    inner: rects.border
  });

  // // TODO:
  // // if (!isBoundingRectWithinViewPort(boundingRect)) {
  // //   this.hide();
  // //   return;
  // // }

  // update label text
  if (this.shapes.label) {
    var tagName = target.tagName.toLowerCase();
    var id      = target.id ? '#' + target.id : '';
    var classes = Array.prototype.join.call(target.classList, '.');
    classes = classes ? '.' + classes : '';
  
    var html = '';
    html += '<div style="display: flex; align-items: center;">'
    html +=   '<div>' + tagName + id + classes + '</div>';
    
    html +=   '<div style="margin: 0 5px;">|</div>';
    
    html +=   '<div style="display: flex; flex-direction: column; font-size: 10px;">';
    
    // element data
    html +=     '<div style="color: ' + BLUE + '; margin: 1px 0;">';
    html +=     aux.fmtPixels(rects.element.width) + ' x ';
    html +=     aux.fmtPixels(rects.element.height);
    html +=     '</div>'
    
    if (rects.padding.width !== rects.element.width ||
        rects.padding.height !== rects.element.height) {
      // padding data
      html +=   '<div style="color: ' + GREEN + '; margin: 1px 0;">';
      html +=   aux.fmtPixels(rects.padding.width) + ' x ';
      html +=   aux.fmtPixels(rects.padding.height);
      html +=   '</div>'
    }
    
    if (rects.margin.width !== rects.padding.width ||
        rects.margin.height !== rects.padding.height) {
      // margin data
      html +=   '<div style="color: ' + ORANGE + '; margin: 1px 0;">';
      html +=   aux.fmtPixels(rects.margin.width) + ' x ';
      html +=   aux.fmtPixels(rects.margin.height);
      html +=   '</div>';
    }
    
    html +=   '</div>';
    html += '</div>';
  
    if (html) {
      this.shapes.label.show(html);
      
      // use margin box
      if (rects.margin.top > LABEL_THRESHOLD) {
        // use bottom anchor
        if (rects.margin.left < window.innerWidth * 2 / 3) {
          // use start
          this.shapes.label.update('bottom-start', {
            x: rects.margin.left + 10 + 8,
            y: window.innerHeight - rects.margin.top,
          });
        } else {
          this.shapes.label.update('bottom-end', {
            // use end
            x: window.innerWidth - (rects.margin.right - 10 - 8),
            y: window.innerHeight - rects.margin.top,
          });
        }
        
      } else {
        if (rects.margin.left < window.innerWidth * 2 / 3) {
          this.shapes.label.update('top-start', {
            x: rects.margin.left + 10 + 8,
            y: Math.min(rects.margin.top + rects.margin.height, window.innerHeight - LABEL_THRESHOLD),
          });
        } else {
          this.shapes.label.update('top-end', {
            x: window.innerWidth - (rects.margin.right - 10 - 8),
            y: Math.min(rects.margin.top + rects.margin.height, window.innerHeight - LABEL_THRESHOLD),
          });
        }
      }
      
      
    } else {
      this.shapes.label.hide();
    }
  }
};

ElementHighlighter.prototype.destroy = function () {

  // update on scroll
  window.removeEventListener('scroll', this.update, false);

  // remove shapes
  Object.keys(this.shapes).forEach(function (shapeName) {
    this.shapes[shapeName].remove();
  }.bind(this));

  // remove element itself
  this.element.remove();
};

ElementHighlighter.prototype.hide = function () {
  this.element.setAttribute('hidden', 'true');
};

ElementHighlighter.prototype.show = function () {
  this.element.removeAttribute('hidden');
};

module.exports = ElementHighlighter;

},{"../auxiliary":1,"../shapes":6,"events":9,"lodash.throttle":12,"util":15}],3:[function(require,module,exports){
// own dependencies
const ElementHighlighter = require('./element');

function _toArray(obj) {
  return Array.prototype.slice.call(obj, 0);
}

// Element.matches(selector) polyfill
// https://developer.mozilla.org/en-US/docs/Web/API/Element/matches
// https://davidwalsh.name/element-matches-selector
function _selectorMatches(el, selector) {
  var p = Element.prototype;
  var f = p.matches || p.webkitMatchesSelector || p.mozMatchesSelector || p.msMatchesSelector || function(s) {
    return [].indexOf.call(document.querySelectorAll(s), this) !== -1;
  };
  return f.call(el, selector);
}

function SelectorHighlighter() {

  /**
   * The css selector to be used for highlighting
   * @type {String}
   */
  this.target;

  /**
   * Array holding all element highlighters
   * @type {Array}
   */
  this.elHighlighters = [];

  /**
   * Maximum number of element highlighters to be used for the selector highlighter.
   * @type {Number}
   */
  this.maxElHighlighters = 20;
}

SelectorHighlighter.prototype.highlight = function (cssSelector) {
  if (typeof cssSelector !== 'string') {
    throw new TypeError('cssSelector MUST be a String');
  }

  this.target = cssSelector;

  // get all elements that should be highlighted
  var selectedElements = _toArray(document.querySelectorAll(cssSelector));

  // highlighters that should be kept
  var keep = [];

  // clone the selectedElements array into an array of elements
  // to be added to the highlight
  var add  = selectedElements.slice(0, this.maxElHighlighters);

  // highlighters that are not in use anymore.
  // they will be either reused or destroyed at the end of
  // the highlight process
  var idle = [];

  // loop through existing highlighters
  this.elHighlighters.forEach(function (hlt, index) {
    if (_selectorMatches(hlt.target, cssSelector)) {
      // add to the array of highlighters to be kept
      // and remove the element from the add array
      keep.push(hlt);
      var index = add.indexOf(hlt.target);
      add.splice(index, 1);
    } else {
      idle.push(hlt);
    }
  });

  // reset elHighlighters to those to be kept
  this.elHighlighters = keep;

  // create new highlighters
  add.forEach(function (element) {
    var highlighter = (idle.length > 0) ?
      idle.pop() : new ElementHighlighter({ noLabel: true });

    highlighter.highlight(element);

    this.elHighlighters.push(highlighter);
  }.bind(this));

  // destroy remaining idle highlighters
  idle.forEach(function (hlt) {
    hlt.destroy();
  });

  this.update();
  this.show();
};

SelectorHighlighter.prototype.isTarget = function (cssSelector) {
  return this.target = cssSelector;
};

SelectorHighlighter.prototype.isHighlighted = function (element) {
  return this.elHighlighters.some(function (elHlt) {
    return elHlt.isTarget(element);
  });
};

/**
 * Creates a highlighter for the given element.
 * 
 * @private
 * @param {DOMElement} element
 */
SelectorHighlighter.prototype._createHighlighter = function (element) {
  var highlighter = new ElementHighlighter();

  highlighter.highlight(element);

  this.elHighlighters.push(highlighter);
};

/**
 * Remvoes the highlighter that corresponds to
 * the given element
 *
 * @private
 * @param  {DOMElement} element
 */
SelectorHighlighter.prototype._destroyHighlighter = function (element) {
  var highlighterIndex = this.elHighlighters.findIndex(function (hlt) {
    return hlt.isTarget(element);
  });

  if (highlighterIndex === -1) {
    return;
  }

  // remove it from the elHighlighters array and destroy it
  var highlighter = this.elHighlighters.splice(highlighterIndex, 1);
  highlighter.destroy();
}

/**
 * Updates the highlighter according to selectors
 * @return {[type]} [description]
 */
SelectorHighlighter.prototype.update = function () {
  this.elHighlighters.forEach(function (hlt) {
    hlt.update();
  });
};

SelectorHighlighter.prototype.show = function () {
  this.elHighlighters.forEach(function (hlt) {
    hlt.show();
  });
};

SelectorHighlighter.prototype.hide = function () {
  this.elHighlighters.forEach(function (hlt) {
    hlt.hide();
  });
};

module.exports = SelectorHighlighter;

},{"./element":2}],4:[function(require,module,exports){
const ElementHighlighter = require('./highlighter/element');
const SelectorHighlighter = require('./highlighter/selector');

exports.ElementHighlighter = ElementHighlighter;
exports.SelectorHighlighter = SelectorHighlighter;
exports.shapes = require('./shapes');
exports.aux = require('./auxiliary');

},{"./auxiliary":1,"./highlighter/element":2,"./highlighter/selector":3,"./shapes":6}],5:[function(require,module,exports){
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

},{"../auxiliary":1}],6:[function(require,module,exports){
exports.HollowRectangle = require('./hollow-rectangle');
exports.Rectangle = require('./rectangle');
exports.Label = require('./label');

// constants
const DEFAULT_STYLES = {};

DEFAULT_STYLES.overlay = {
  position: 'fixed',
  boxSizing: 'border-box',
  pointerEvents: 'none',
  backgroundColor: 'rgba(0, 0, 0, 0.1)',
  // transition: 'top 0.3s ease, left 0.3s ease'
};

DEFAULT_STYLES.label = {
  position: 'absolute',
  boxSizing: 'border-box',
  top: '0',
  left: '0',
  transform: 'translateY(-100%)',
  fontSize: '12px',
  fontFamily: 'sans-serif',
  padding: '3px 3px',
  color: 'white',
  backgroundColor: 'rgba(0, 0, 0, 0.4)',
};

exports.OVERLAY_CLASS = 'highlight-overlay';
exports.LABEL_CLASS   = 'highlight-overlay-label';

exports.applyStyle = function (element, style) {
  for (var prop in style) {
    element.style[prop] = style[prop];
  }
};

exports.createStyle = function (baseStyleName, style) {
  var baseStyle = DEFAULT_STYLES[baseStyleName];

  if (!baseStyle) {
    throw new Error('baseStyle `' + baseStyleName + '` undefined');
  }

  style = style || {};

  return Object.assign({}, baseStyle, style);
};

exports.overlay = function (options) {

  options = options || {};

  var overlayStyle = options.overlayStyle || {};
  var labelStyle   = options.labelStyle   || {};

  overlayStyle = exports.createStyle('overlay', overlayStyle);
  labelStyle   = exports.createStyle('label', labelStyle);

  var labelElement = document.createElement('div');
  labelElement.classList.add(exports.LABEL_CLASS);
  exports.applyStyle(labelElement, labelStyle);

  var overlayElement = document.createElement('div');
  overlayElement.classList.add(exports.OVERLAY_CLASS);
  exports.applyStyle(overlayElement, overlayStyle);

  overlayElement.appendChild(labelElement);

  return overlayElement;
};

},{"./hollow-rectangle":5,"./label":7,"./rectangle":8}],7:[function(require,module,exports){
// own
const aux = require('../auxiliary');

// constants
const ARROW_HEIGHT = 8;
const ARROW_WIDTH  = 16;
const ARROW_OFFSET = 10;

var contentStyles = {
  padding: '4px 6px',
  backgroundColor: 'black',
  color: 'white',
  borderRadius: '2px',
  fontSize: '12px',
  fontFamily: 'monaco, consolas, monospace',
};

var resetPositionStyles = {
  top: '',
  left: '',
  right: '',
  bottom: '',
}

var arrowStyles = {
  position: 'absolute',
  
  width: 0, 
  height: 0, 
  borderLeft: (ARROW_WIDTH / 2) + 'px solid transparent',
  borderRight: (ARROW_WIDTH / 2) + 'px solid transparent',
  
  borderBottom: (ARROW_HEIGHT) + 'px solid black',
};


function Label(options) {
  
  options = options || {};
  
  var element = document.createElement('div');
  element.style.position = 'fixed';
  element.style.zIndex = 100000;
  element.className = 'dom-highlighter-label';
  this.element = element;
  
  var contentsEl = document.createElement('div');
  this.element.appendChild(contentsEl);
  aux.applyStyles(contentsEl, contentStyles);
  this.contentsEl = contentsEl;
  
  var arrow = document.createElement('div');
  this.element.appendChild(arrow);
  aux.applyStyles(arrow, arrowStyles);
  this.arrow = arrow;
  
  if (options.attachTo) {
    this.attach(options.attachTo);
  }
  
  if (options.styles) {
    aux.applyStyles(this.element, options.styles);
  }
}

Label.prototype.update = function (anchor, position) {
  
  var anchorChanged = this.anchor !== anchor;
  
  var anchorSplit = anchor.split('-');
  
  var anchorSide     = anchorSplit[0];
  var anchorPosition = anchorSplit[1];
  
  var elementStyles = {};
  var arrowStyles   = {};
  
  // first deal with anchor side
  switch (anchorSide) {
    case 'top':
      elementStyles.top = (position.y + ARROW_HEIGHT) + 'px';
      
      arrowStyles.transform = 'rotate(0)';
      arrowStyles.bottom    = '100%';
      
      break;
    case 'bottom':
      elementStyles.bottom = (position.y + ARROW_HEIGHT) + 'px';
      
      arrowStyles.transform = 'rotate(180deg)';
      arrowStyles.top    = '100%';
      
      break;
  }
  
  // then deal with anchor position
  switch (anchorPosition) {
    case 'start':
      elementStyles.left =
        Math.max(position.x - ARROW_OFFSET - ARROW_WIDTH / 2, 0) + 'px';
      
      arrowStyles.left = ARROW_OFFSET + 'px';
      
      break;
    case 'end':
      elementStyles.right =
        Math.max(position.x - ARROW_OFFSET - ARROW_WIDTH / 2, 0) + 'px';
      
      arrowStyles.right = ARROW_OFFSET + 'px';
      
      break;
  }
  
  aux.applyStyles(this.element, resetPositionStyles, elementStyles);
  
  if (anchorChanged) {
    aux.applyStyles(this.arrow, resetPositionStyles, arrowStyles);
  }
  
  this.anchor = anchor;
};

Label.prototype.show = function (innerHTML) {
  this.contentsEl.innerHTML = innerHTML;
};

Label.prototype.attach = function (element) {
  element.appendChild(this.element);
};

Label.prototype.remove = function () {
  this.element.remove();
};

module.exports = Label;

},{"../auxiliary":1}],8:[function(require,module,exports){
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

},{"../auxiliary":1}],9:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],10:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],11:[function(require,module,exports){
/**
 * lodash 4.0.6 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var NAN = 0 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    symbolTag = '[object Symbol]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
    nativeMin = Math.min;

/**
 * Gets the timestamp of the number of milliseconds that have elapsed since
 * the Unix epoch (1 January 1970 00:00:00 UTC).
 *
 * @static
 * @memberOf _
 * @since 2.4.0
 * @type {Function}
 * @category Date
 * @returns {number} Returns the timestamp.
 * @example
 *
 * _.defer(function(stamp) {
 *   console.log(_.now() - stamp);
 * }, _.now());
 * // => Logs the number of milliseconds it took for the deferred function to be invoked.
 */
var now = Date.now;

/**
 * Creates a debounced function that delays invoking `func` until after `wait`
 * milliseconds have elapsed since the last time the debounced function was
 * invoked. The debounced function comes with a `cancel` method to cancel
 * delayed `func` invocations and a `flush` method to immediately invoke them.
 * Provide an options object to indicate whether `func` should be invoked on
 * the leading and/or trailing edge of the `wait` timeout. The `func` is invoked
 * with the last arguments provided to the debounced function. Subsequent calls
 * to the debounced function return the result of the last `func` invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is invoked
 * on the trailing edge of the timeout only if the debounced function is
 * invoked more than once during the `wait` timeout.
 *
 * See [David Corbacho's article](https://css-tricks.com/debouncing-throttling-explained-examples/)
 * for details over the differences between `_.debounce` and `_.throttle`.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Function
 * @param {Function} func The function to debounce.
 * @param {number} [wait=0] The number of milliseconds to delay.
 * @param {Object} [options={}] The options object.
 * @param {boolean} [options.leading=false]
 *  Specify invoking on the leading edge of the timeout.
 * @param {number} [options.maxWait]
 *  The maximum time `func` is allowed to be delayed before it's invoked.
 * @param {boolean} [options.trailing=true]
 *  Specify invoking on the trailing edge of the timeout.
 * @returns {Function} Returns the new debounced function.
 * @example
 *
 * // Avoid costly calculations while the window size is in flux.
 * jQuery(window).on('resize', _.debounce(calculateLayout, 150));
 *
 * // Invoke `sendMail` when clicked, debouncing subsequent calls.
 * jQuery(element).on('click', _.debounce(sendMail, 300, {
 *   'leading': true,
 *   'trailing': false
 * }));
 *
 * // Ensure `batchLog` is invoked once after 1 second of debounced calls.
 * var debounced = _.debounce(batchLog, 250, { 'maxWait': 1000 });
 * var source = new EventSource('/stream');
 * jQuery(source).on('message', debounced);
 *
 * // Cancel the trailing debounced invocation.
 * jQuery(window).on('popstate', debounced.cancel);
 */
function debounce(func, wait, options) {
  var lastArgs,
      lastThis,
      maxWait,
      result,
      timerId,
      lastCallTime = 0,
      lastInvokeTime = 0,
      leading = false,
      maxing = false,
      trailing = true;

  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  wait = toNumber(wait) || 0;
  if (isObject(options)) {
    leading = !!options.leading;
    maxing = 'maxWait' in options;
    maxWait = maxing ? nativeMax(toNumber(options.maxWait) || 0, wait) : maxWait;
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }

  function invokeFunc(time) {
    var args = lastArgs,
        thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    return result;
  }

  function leadingEdge(time) {
    // Reset any `maxWait` timer.
    lastInvokeTime = time;
    // Start the timer for the trailing edge.
    timerId = setTimeout(timerExpired, wait);
    // Invoke the leading edge.
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time) {
    var timeSinceLastCall = time - lastCallTime,
        timeSinceLastInvoke = time - lastInvokeTime,
        result = wait - timeSinceLastCall;

    return maxing ? nativeMin(result, maxWait - timeSinceLastInvoke) : result;
  }

  function shouldInvoke(time) {
    var timeSinceLastCall = time - lastCallTime,
        timeSinceLastInvoke = time - lastInvokeTime;

    // Either this is the first call, activity has stopped and we're at the
    // trailing edge, the system time has gone backwards and we're treating
    // it as the trailing edge, or we've hit the `maxWait` limit.
    return (!lastCallTime || (timeSinceLastCall >= wait) ||
      (timeSinceLastCall < 0) || (maxing && timeSinceLastInvoke >= maxWait));
  }

  function timerExpired() {
    var time = now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Restart the timer.
    timerId = setTimeout(timerExpired, remainingWait(time));
  }

  function trailingEdge(time) {
    clearTimeout(timerId);
    timerId = undefined;

    // Only invoke if we have `lastArgs` which means `func` has been
    // debounced at least once.
    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel() {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    lastCallTime = lastInvokeTime = 0;
    lastArgs = lastThis = timerId = undefined;
  }

  function flush() {
    return timerId === undefined ? result : trailingEdge(now());
  }

  function debounced() {
    var time = now(),
        isInvoking = shouldInvoke(time);

    lastArgs = arguments;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxing) {
        // Handle invocations in a tight loop.
        clearTimeout(timerId);
        timerId = setTimeout(timerExpired, wait);
        return invokeFunc(lastCallTime);
      }
    }
    if (timerId === undefined) {
      timerId = setTimeout(timerExpired, wait);
    }
    return result;
  }
  debounced.cancel = cancel;
  debounced.flush = flush;
  return debounced;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified,
 *  else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array and weak map constructors,
  // and PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/6.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified,
 *  else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = debounce;

},{}],12:[function(require,module,exports){
/**
 * lodash 4.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var debounce = require('lodash.debounce');

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/**
 * Creates a throttled function that only invokes `func` at most once per
 * every `wait` milliseconds. The throttled function comes with a `cancel`
 * method to cancel delayed `func` invocations and a `flush` method to
 * immediately invoke them. Provide an options object to indicate whether
 * `func` should be invoked on the leading and/or trailing edge of the `wait`
 * timeout. The `func` is invoked with the last arguments provided to the
 * throttled function. Subsequent calls to the throttled function return the
 * result of the last `func` invocation.
 *
 * **Note:** If `leading` and `trailing` options are `true`, `func` is invoked
 * on the trailing edge of the timeout only if the throttled function is
 * invoked more than once during the `wait` timeout.
 *
 * See [David Corbacho's article](http://drupalmotion.com/article/debounce-and-throttle-visual-explanation)
 * for details over the differences between `_.throttle` and `_.debounce`.
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to throttle.
 * @param {number} [wait=0] The number of milliseconds to throttle invocations to.
 * @param {Object} [options] The options object.
 * @param {boolean} [options.leading=true] Specify invoking on the leading
 *  edge of the timeout.
 * @param {boolean} [options.trailing=true] Specify invoking on the trailing
 *  edge of the timeout.
 * @returns {Function} Returns the new throttled function.
 * @example
 *
 * // Avoid excessively updating the position while scrolling.
 * jQuery(window).on('scroll', _.throttle(updatePosition, 100));
 *
 * // Invoke `renewToken` when the click event is fired, but not more than once every 5 minutes.
 * var throttled = _.throttle(renewToken, 300000, { 'trailing': false });
 * jQuery(element).on('click', throttled);
 *
 * // Cancel the trailing throttled invocation.
 * jQuery(window).on('popstate', throttled.cancel);
 */
function throttle(func, wait, options) {
  var leading = true,
      trailing = true;

  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  if (isObject(options)) {
    leading = 'leading' in options ? !!options.leading : leading;
    trailing = 'trailing' in options ? !!options.trailing : trailing;
  }
  return debounce(func, wait, {
    'leading': leading,
    'maxWait': wait,
    'trailing': trailing
  });
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = throttle;

},{"lodash.debounce":11}],13:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
  try {
    cachedSetTimeout = setTimeout;
  } catch (e) {
    cachedSetTimeout = function () {
      throw new Error('setTimeout is not defined');
    }
  }
  try {
    cachedClearTimeout = clearTimeout;
  } catch (e) {
    cachedClearTimeout = function () {
      throw new Error('clearTimeout is not defined');
    }
  }
} ())
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = cachedSetTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    cachedClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        cachedSetTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],14:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],15:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":14,"_process":13,"inherits":10}]},{},[4])(4)
});