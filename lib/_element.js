// third-party
var $     = require('jquery');
var clone = require('clone');
var debounce = require('debounce');

const RECT_BASE_STYLES = {
  position: 'fixed',
  boxSizing: 'border-box',
  pointerEvents: 'none',
};

const RECT_LABEL_STYLES = {
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
}

const RECT_LABEL_SELECTOR = '.h-rectangle-label';

/**
 * Creates a jquery $element that represents a general rectangle
 * @param  {[type]} styles [description]
 * @return {[type]}        [description]
 */
function _rect(styles, labelStyles) {

  styles = styles || {};
  labelStyles = labelStyles || {};

  var _styles = clone(styles);
  var _labelStyles = clone(labelStyles);

  for (var prop in RECT_BASE_STYLES) {
    if (!_styles[prop]) {
      _styles[prop] = RECT_BASE_STYLES[prop];
    }
  }

  for (var prop in RECT_LABEL_STYLES) {
    if (!_labelStyles[prop]) {
      _labelStyles[prop] = RECT_LABEL_STYLES[prop];
    }
  }

  var $label = $('<div class="h-rectangle-label"></div>').css(_labelStyles);

  var $rect = $('<div class="h-rectangle"></div>').css(_styles);

  $rect.append($label);

  return $rect;
}

function _calcPaddingRect(rect, padding) {
  return {
    top: rect.top + padding.top,
    bottom: rect.bottom - padding.bottom,
    left: rect.left + padding.left,
    right: rect.right - padding.right,

    height: rect.height - padding.top - padding.bottom,
    width: rect.width - padding.left - padding.right
  };
}

function _calcMarginRect(rect, margin) {
  return {
    top: rect.top - margin.top,
    bottom: rect.bottom + margin.bottom,
    left: rect.left - margin.left,
    right: rect.right + margin.right,

    height: rect.height + margin.top + margin.bottom,
    width: rect.width + margin.left + margin.right
  };
}

function ElementHighlighter(options) {

  var $body = $('body');

  // update on scroll
  $(window).on('scroll', debounce(this.update.bind(this), 100));

  options = options || {};

  var elementRectStyles = options.elementRect;
  var paddingRectStyles = options.paddingRect;
  var marginRectStyles  = options.marginRect;

  // only build rectangles that are required
  if (elementRectStyles) {
    elementRectStyles.zIndex = 100002;
    this.$elementRect = _rect(elementRectStyles);
    $body.append(this.$elementRect);
  }

  if (paddingRectStyles) {
    paddingRectStyles.zIndex = 100000;
    this.$paddingRect = _rect(paddingRectStyles);
    $body.append(this.$paddingRect);
  }

  if (marginRectStyles) {
    marginRectStyles.zIndex  = 100001
    this.$marginRect  = _rect(marginRectStyles);
    $body.append(this.$marginRect);
  }

  // initial state is hidden
  this.hide();
}

ElementHighlighter.prototype.attach = function (target) {

  target = $(target)[0];

  if (!target) {
    this.remove();

    return;
  }

  this.target = target;

  this.update();
  this.show();
}

ElementHighlighter.prototype.isAttachedTo = function (target) {
  if (!this.target) {
    return false;
  } else {
    return $(this.target).is(target);
  }
};

ElementHighlighter.prototype.update = function () {

  var target = this.target;

  if (!target) {
    return;
  }

  var boundingRect = target.getBoundingClientRect();

  // update css
  this.$elementRect.css({
    top: boundingRect.top,
    left: boundingRect.left,
    width: boundingRect.width,
    height: boundingRect.height
  });

  var tagName = target.tagName.toLowerCase();
  var id      = target.id ? '#' + target.id : '';
  var classes = Array.prototype.join.call(target.classList, '.');

  classes = classes ? '.' + classes : '';

  // update label
  var labelText = tagName + id + classes;

  if (labelText) {
    this.$elementRect
      .find(RECT_LABEL_SELECTOR)
      .html(labelText)
      .show();
  } else {
    this.$elementRect
      .find(RECT_LABEL_SELECTOR)
      .hide()
      .html('');
  }

  if (this.$paddingRect || this.$marginRect) {
    // these computations are extremely expensive
    // thus we need to run them carefully

    var computedStyle = window.getComputedStyle(target);

    if (this.$paddingRect) {
      this.$paddingRect.css(_calcPaddingRect(boundingRect, {
        top: parseInt(computedStyle.getPropertyValue('padding-top'), 10),
        bottom: parseInt(computedStyle.getPropertyValue('padding-bottom'), 10),
        left: parseInt(computedStyle.getPropertyValue('padding-left'), 10),
        right: parseInt(computedStyle.getPropertyValue('padding-right'), 10)
      }));
    }

    if (this.$marginRect) {
      this.$marginRect.css(_calcMarginRect(boundingRect, {
        top: parseInt(computedStyle.getPropertyValue('margin-top'), 10),
        bottom: parseInt(computedStyle.getPropertyValue('margin-bottom'), 10),
        left: parseInt(computedStyle.getPropertyValue('margin-left'), 10),
        right: parseInt(computedStyle.getPropertyValue('margin-right'), 10)
      }));
    }
  }
};

ElementHighlighter.prototype.remove = function () {
  this.$elementRect.remove();
  // this.$paddingRect.remove();
  // this.$marginRect.remove();
};

ElementHighlighter.prototype.hide = function () {
  this.$elementRect.hide();
};

ElementHighlighter.prototype.show = function () {
  this.$elementRect.show();
};

module.exports = ElementHighlighter;