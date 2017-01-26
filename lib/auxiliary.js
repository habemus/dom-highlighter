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
