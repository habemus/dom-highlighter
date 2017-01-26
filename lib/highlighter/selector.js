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
  var add  = selectedElements.slice(0);

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
  })

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
