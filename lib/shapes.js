// constants
const DEFAULT_STYLES = {};

DEFAULT_STYLES.overlay = {
  position: 'fixed',
  boxSizing: 'border-box',
  pointerEvents: 'none',
  backgroundColor: 'rgba(0, 0, 0, 0.1)',
  transition: 'top 0.1s ease, left 0.1s ease'
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