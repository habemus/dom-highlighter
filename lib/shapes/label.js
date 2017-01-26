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
