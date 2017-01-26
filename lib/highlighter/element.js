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
    html +=     '<div style="color: ' + BLUE + ';">';
    html +=     aux.fmtPixels(rects.element.width) + ' x ';
    html +=     aux.fmtPixels(rects.element.height);
    html +=     '</div>'
    
    if (rects.padding.width !== rects.element.width ||
        rects.padding.height !== rects.element.height) {
      // padding data
      html +=   '<div style="color: ' + GREEN + ';">';
      html +=   aux.fmtPixels(rects.padding.width) + ' x ';
      html +=   aux.fmtPixels(rects.padding.height);
      html +=   '</div>'
    }
    
    if (rects.margin.width !== rects.padding.width ||
        rects.margin.height !== rects.padding.height) {
      // margin data
      html +=   '<div style="color: ' + ORANGE + ';">';
      html +=   aux.fmtPixels(rects.margin.width) + ' x ';
      html +=   aux.fmtPixels(rects.margin.height);
      html +=   '</div>';
    }
    
    html +=   '</div>';
    html += '</div>';
  
    if (html) {
      this.shapes.label.show(html);
      
      // use margin box
      if (rects.margin.top > 30) {
        this.shapes.label.update('bottom-start', {
          x: rects.margin.left + 10 + 8,
          y: window.innerHeight - rects.margin.top,
        });
      } else {
        this.shapes.label.update('top-start', {
          x: rects.margin.left + 10 + 8,
          y: rects.margin.top + rects.margin.height,
        });
      }
      
      
    } else {
      this.shapes.label.hide();
    }
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
  this.element.setAttribute('hidden', 'true');
};

ElementHighlighter.prototype.show = function () {
  this.element.removeAttribute('hidden');
};

module.exports = ElementHighlighter;
