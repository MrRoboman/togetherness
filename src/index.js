
DEBUG = 1

function g(el, label) {
// getter - more natural "attributes" from SVG elements
  var get_fn = () => {
      if (el.dataset === undefined) {
        return el[label];
      }
      if (Object.keys(el.dataset).indexOf(label) != -1) {
        return el.dataset[label];
      }
      if (Object.keys(el.attributes).indexOf(label) != -1) {
        return el.getAttribute(label);
      }
      var value = el.getAttribute(label);
      if (value !== null) {
        return value;
      }
      if (label === 'width' || label === 'height') {
        return el.getBBox()[label];
      }
  };
  var retval = get_fn()
  if (retval === 'false' || retval === 'null' || retval === 'undefined') {
    throw Error(`Tried to set element attr to JS value? Something probably went wrong (${label})`);
  }
  return retval
}

function s(el, label, val) {
// setter - more natural "attributes" from SVG elements
  if (val === undefined || val === null) {
    return el.removeAttribute(label);
  }
  el.setAttribute(label, val);
}

function documentDblclick(triggerNode, detail) {
  console.log("document dbl", triggerNode.id, detail)
  triggerNode.dispatchEvent(new MouseEvent('dblclick', {
    view: window,
    bubbles: true,
    cancelable: true,
    detail: detail,
  }))
}

function lock_selection(evt) {
  selection = evt.target.closest('[data-nest-for=mark]')
  console.log("EVT", evt, 'selection', selection)
  if (selection.dataset.locked) {
    return
  }
  selection.dataset.locked = true
  selection = SVG.adopt(selection)
  selection.removeClass('draggable-group')
  innerSVG = selection.first()
  cGroup = innerSVG.node.querySelector('.contents_group')
  if (cGroup) {
    cGroup.classList.add('drag-open')
  }
  rect = selection.last()
  rect.attr('stroke-opacity', 0.99)
  rect.attr('stroke-width', (4 * rect.attr('stroke-width')))
  rect.attr('stroke-dasharray', '8')
  rect.attr('stroke-linecap', 'round')
  rect.attr('fill', 'none')
  //SVG.adopt(evt.target).off('svg_dragsafe_click')

  var resize_handle = resize_widget.create(
    selection,
    selection.node.querySelector('[data-enveloped]'),
  )
  cGroup.appendChild(resize_handle.node)
}

var resize_widget = {
  create: function(parentSVG, targetEl) {
    var resize_handle = parentSVG.element('svg', SVG.Container)
    resize_handle.addClass('resize_handle')
    resize_handle.addClass('draggable-group')
    resize_handle.attr({
      'data-app-class': 'resize_handle',
      'data-app-target-id': targetEl.id,
      x: parentSVG.width() - 20,
      y: parentSVG.height() - 20,
      width: 30,
      height: 30,
    })
    var resize_rect = resize_handle.rect()
    resize_rect.attr({
      'data-app-class': 'resize_rect',
      x: 0,
      y: 0,
      'fill-opacity': 0.9,
      'stroke-opacity': 1.0,
      'stroke-width': 1,
      width: 30,
      height: 30,
      fill: '#a0a0a0',
      stroke: '#fafafa',
    })
    var resize_dotted_rect = resize_handle.rect()
    resize_dotted_rect.addClass('resize_dotted_rect')
    resize_dotted_rect.attr({
      'data-app-class': 'resize_dotted_rect',
      x: selection.x(),
      y: selection.y(),
      'fill-opacity': 0,
      'stroke-opacity': 1.0,
      'stroke-width': 1,
      'stroke-dasharray': 4,
      width: selection.width(),
      height: selection.height(),
      fill: getUserColor(),
      stroke: "#000000",
    })
    resize_handle.on('svg_dragstart', (e) => {
      svg_table.node.insertBefore(resize_dotted_rect.node, svg_table.node.firstChild)
      console.log("dragstart RESIZE", e)
    })
    resize_handle.on('svg_drag', (e) => {
      console.log("drag RESIZE", e, e.detail.mouse)
      console.log('orig xy', selection.x(), selection.y())
      console.log('new xy', resize_handle.cx(), resize_handle.cy())
      resize_dotted_rect.attr({
        width: resize_handle.cx() - selection.x(),
        height: resize_handle.cy() - selection.y(),
      })
    })
    resize_handle.node.addEventListener('svg_dragend', function (e) {
      handle = this
      resize_dotted_rect.remove()
      console.log("dragend RESIZE", e)
      console.log('orig nest', selection.node)
      console.log('orig xy', selection.x(), selection.y())
      console.log('orig xy', selection.bbox())
      console.log('new xy', resize_handle.cx(), resize_handle.cy())
      console.log('new xy', resize_handle.bbox())

      ui.unmark_all_but()
      evt_fire(
        'resize',
        byId(handle.dataset.appTargetId),
        e,
        {
          width: resize_handle.cx() - selection.x(),
          height: resize_handle.cy() - selection.y(),
        },
      )
      handle.remove()
    })
    resize_handle.add(resize_rect)
    return resize_handle
  },
}

function distance(v1, v2) {
  if (v1.hasOwnProperty('x')) {
    return Math.abs(v1.x - v2.x) + Math.abs(v1.y - v2.y)
  }
  return Math.abs(v1[0] - v2[0]) + Math.abs(v1[1] - v2[1])
}

function randInt(min, max) {
  // get a random integer in the range, inclusive.
  // randInt(1,6) might return 1,2,3,4,5,6
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array
}

function byId(id) {
  var rv = document.getElementById(id);
  if (!rv) {
    throw Error('element not found '+ id)
  }
  return rv;
}

function getUserColor() {
  if (localStorage.getItem('profile_color')) {
    return localStorage.getItem('profile_color')
  }
  return '#ffffff';
}



function str_to_fn(fname) {
  // given a string, return a globally-scoped function
  return (
    (window[fname] && typeof window[fname] === 'function')
    ?  window[fname]
    : null
  );
}

function nodeMap(parent, fn) {
  // iterate through an SVG element's children like [].map()
  var retval = [];
  parent.childNodes.forEach((node) => {
    if (g(node, 'data-app-class')) {
      var result = fn(node);
      if (result) {
        retval.push(result);
      }
    }
  });
  return retval;
}


function debugBar(s) {
  if (!DEBUG) { return }
  log = byId('debug_bar_log')
  text = log.innerHTML
  log.innerHTML = s + '\n' + text
}

togetherFunctions.on_hello = (msg) => {
  debugBar('HELLO: ' + msg)
  worldData = nodeMap(svg_table.node, serialize);
  if (worldData.length) {
    net_fire({
      type: "sync",
      data: worldData,
      bg: byId('svg_viewport').style.backgroundImage || null,
    });
  }
};

togetherFunctions.on_sync = (msg) => {
  debugBar('SYNC: ' + msg)
  msg.data.map(payload => {
    return Promise.resolve()
    .then(() => {
      return deserialize(payload)
    })
    .then((elem) => {
      s(elem, 'uiInitialized', null)
      svg_table.node.appendChild(elem)
      ui.hookup_ui(elem)
      if (payload['data-app-url']) {
        hookup_foreign_scripts(elem, payload['data-app-url'])
      }
    })
  });
  ui.change_background(msg.bg)
}

togetherFunctions.on_change = (msg) => {
  debugBar('CHANGE: ' + msg)
  deserialize(msg.data)
}

togetherFunctions.on_create = (msg) => {
  debugBar('CREATE: ' + msg)
  return Promise.resolve()
  .then(() => {
    return deserialize(msg.data)
  })
  .then((elem) => {
    elem.dataset.uiInitialized=false
    svg_table.node.appendChild(elem)
    ui.hookup_ui(elem)
    if (msg.data['data-app-url']) {
      hookup_foreign_scripts(elem, msg.data['data-app-url'])
    }
  })
}

togetherFunctions.on_create_mark = (msg) => {
  debugBar('CREATEMARK: ' + msg)
  ui.make_mark(msg.data.target_id, msg.data.mark_rect)
}


togetherFunctions.on_drop_nest_mark= (msg) => {
  ui._unmark_nest(document.querySelector('#' + msg.nest.id))
}

togetherFunctions.on_delete = (msg) => { recursive_delete(msg.data) }

togetherFunctions.on_change_background = (msg) => { ui.change_background(msg.data) }

serializers = {}
deserializers = {}

function deserialize(payload) {
  console.log("deserialize: ", payload)
  var obj = null;
  if (document.getElementById(payload.id)) {
    console.log("i've seen this before", payload.id)
    obj = SVG.adopt(byId(payload.id))
    Object.keys(payload).map(key => {
      if (key === 'data-text') {
        obj.text(payload[key])
      }
      if (key !== 'kids') {
        console.log('setting', key, 'to', payload[key])
        obj.attr(key, payload[key])
      }
    });
    url = payload['data-app-url']
    if (url) {
      deserializers[url](obj.node, payload)
    }
  } else {
    // elem is something new - remote has it, but it's not yet in the local doc
    console.log("this is something new", payload.id)

//--------
    url = payload['data-app-url']
    if (url) {
      return add_object_from_payload(payload)
    }
//--------

    var fn = str_to_fn('make_' + payload['data-app-class'])
    if (fn) {
      console.log('calling ', 'make_'+ payload['data-app-class'])
      obj = fn(payload);
    } else {
      throw Error('how to make? '+ payload['data-app-class'])
    }
  }
  if (payload.kids && obj) {
    payload.kids.map(innerPayload => {
      var kid = deserialize(innerPayload)
      obj.put(kid)
    });
  }
  return obj.node;
}

function recursive_delete(payload) {
  console.log("in recursive delete", payload)
  if (document.getElementById(payload.id)) {
    // el is something that already exists in the local SVG doc
    byId(payload.id).remove()
  }
  if (payload.kids) {
    payload.kids.map(innerPayload => {
      recursive_delete(innerPayload);
    })
  }
}

function serialize_group(group) {
  var retval = { kids: [] }
  nodeMap(group, (el) => {
    retval.kids.push(serialize(el));
  })
  return retval;
}

function serialize_nest(nest) {
  var retval = { kids: [] }
  nodeMap(nest, (el) => {
    retval.kids.push(serialize(el));
  })
  console.log("retval starts as", retval)
  console.log('x', nest.dataset, nest.dataset.appUrl, serializers)
  url = nest.dataset.appUrl
  if (url && serializers[url]) {
    console.log('calling serializer fn')
    retval = Object.assign(retval, serializers[url](nest))
  }
  console.log("retval is now", retval)
  return retval;
}


function serialize(thing, extras) {
  if (!myClientId) {
    // no network connection - skip it
    return;
  }
  var el = (thing.attr) ? thing.node : thing;
  var retval = ui.justNonUiAttributes(el)
  var fn = str_to_fn('serialize_' + g(el, 'data-app-class'))
  if (fn) {
    retval = Object.assign( retval, fn(el) )
  }
  if (extras) {
    retval = Object.assign( retval, extras )
  }
  return retval
}


function is_marked(node) {
  return (
    g(node.parentNode, 'data-app-class') === 'nest'
    &&
    g(node.parentNode.lastChild, 'data-app-class') === 'mark'
  )
}


var mark_menu = {
  'Remove mark': {
    eventName: 'remove_mark',
    applicable: (target) => { return g(target, 'data-app-class') === 'nest' },
  },
  /* causes bugs with "text" types
  'Object properties': {
    eventName: 'object_properties',
    applicable: () => { return true },
    handler: (evt) => {
      nestNode = byId(evt.detail.elemId)
      ui_popup_properties(
        nestNode.firstChild,
        {'data-dialog-id': 'dialog_properties'}
      )
    }
  },
  */
}

function import_foreign_svg(url, attrs) {
  if (!DEBUG) {
    var answer = confirm('Do you trust the security of '+ url +'?')
    if (!answer) {
      return;
    }
  }

  return fetch(url)
  .then((res) => {
    if (res.headers.get('content-length') > 1000000) {
      console.error('That file is too big (> 1MB)')
      alert('That file is too big (> 1MB)')
      return
    }
    return res.text()
  })
  .then((body) => {
    return _import_foreign_svg(body, url)
  })
}

function _import_foreign_svg(body, url) {
  var frame = document.createElementNS(SVG.ns, 'svg')
  frame.innerHTML = (
    // not sure if this is necessary...
    body.replace(/\n/, '').replace(/<([\w:-]+)([^<]+?)\/>/g, '<$1$2></$1>')
  )
  var nest = frame.getElementsByTagName('svg')[0]
  if (
    ( g(nest, 'x') !== undefined && g(nest, 'x') !== '0' )
    ||
    ( g(nest, 'y') !== undefined && g(nest, 'y') !== '0' )
  ) {
    console.error('X/Y coords must be "0"', g(nest, 'x'), g(nest, 'y'))
    alert('X/Y coords must be "0"', g(nest, 'x'))
  }
  var id = 'isvg_' + base32.short_id()
  var origId = g(nest, 'id')
  s(nest, 'id', id)
  nest = SVG.adopt(nest)
  nest.attr({
    'data-app-class': 'nest',
    'data-nest-for': 'svg',
    'data-app-url': url,
    'data-orig-name': origId,
  })
  // Ensure the imported SVG is of a reasonable screen size
  if (nest.width() < 30 || nest.width() > 520) {
    console.warn('Reigned in the width to 100. Was', nest.width())
    nest.width(100)
  }
  if (nest.height() < 30 || nest.height() > 520) {
    console.warn('Reigned in the height to 100. Was', nest.height())
    nest.height(100)
  }
  nest.addClass('draggable-group')
  //TODO: should this be nest.node instead of frame?
  frame.querySelectorAll('script').forEach((script) => {
    console.log("FOUND A SCRIPT", script.id, "IN", nest.node.id)
    appendDocumentScript(script, nest.node)
  })
  return nest
}

function add_fresh_svg(svgElem) {
  // None of the UI is hooked up for the freshly-loaded document
  svgElem.querySelectorAll('[data-ui-initialized]').forEach((elem) => {
    elem.removeAttribute('data-ui-initialized')
  })

  svgElem.querySelectorAll('[data-app-class]').forEach((subSvg) => {
    ui.hookup_ui(subSvg)
    hookup_foreign_scripts(subSvg)
  })
  svgElem.querySelectorAll('[data-nest-for=mark]').forEach((subSvg) => {
    ui.hookup_mark_handlers(subSvg)
  })
  /*
  svg_table.add(nest)
  ui.hookup_ui(nest.node)
  hookup_foreign_scripts(nest.node, url, attrs && attrs.serializedState)
  ui.fire({type: "create", data: { createdEl: nest.node }});
  net_fire({type: "create", data: serialize(nest)});
  */
}


function setColor(elem, color) {
  filterElem = elem.querySelector('#app-filter-colorize')
  if (!filterElem) {
    return
  }
  p = filterElem.parentNode
  clone = filterElem.cloneNode(true)
  clone.id = 'filter-' + elem.id
  p.appendChild(clone)
  p.removeChild(filterElem)
  // Find all the <g> elements with filter="..." and point to the new filter
  elem.querySelectorAll('g[filter]').forEach((gElem) => {
    val =  'url(#' + clone.id +')'
    s(gElem, 'filter', val)
  })
  clone.querySelectorAll('#recolorize-filter-matrix').forEach((matrixNode) => {
    recolorize(matrixNode, color)
  })
  s(elem, 'data-app-color', color)
}

function recolorize(matrixNode, color) {
  function to01(a) { return parseFloat(a,10)/255; }
  function getRGBColor(colorStr) {
    var a = document.createElement('div')
    a.style.color = colorStr
    var colors = window.getComputedStyle(document.body.appendChild(a)).color
    document.body.removeChild(a)
    return colors.match(/\d+/g).map(to01)
  }
  var c = getRGBColor(color)
  if (c[0] + c[1] + c[2] < 0.9) {
    // dice will be too dark to read, so boost them
    hsl = rgbToHsl(c[0], c[1], c[2])
    c = hslToRgb(hsl[0], 0.5, 0.5).map(to01)
    console.log("c", c)
  }
  matrixNode.setAttribute(
    'values',
    c[0] + ' 0 0 0 0 ' +
    c[1] + ' 0 0 0 0 ' +
    c[2] + ' 0 0 0 0 ' +
    '0 0 0 1 0'
  )
}

function rgbToHsl(r, g, b){
  /**
   * Converts an RGB color value to HSL. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes r, g, and b are contained in the set [0, 255] and
   * returns h, s, and l in the set [0, 1].
   *
   * @param   {number}  r       The red color value
   * @param   {number}  g       The green color value
   * @param   {number}  b       The blue color value
   * @return  {Array}           The HSL representation
   */
  r /= 255, g /= 255, b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;

  if(max == min){
      h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch(max){
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l){
  /**
   * Converts an HSL color value to RGB. Conversion formula
   * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
   * Assumes h, s, and l are contained in the set [0, 1] and
   * returns r, g, and b in the set [0, 255].
   *
   * @param   {number}  h       The hue
   * @param   {number}  s       The saturation
   * @param   {number}  l       The lightness
   * @return  {Array}           The RGB representation
   */
  var r, g, b;
  if(s == 0){
    r = g = b = l; // achromatic
  } else {
    var hue2rgb = function hue2rgb(p, q, t){
        if(t < 0) t += 1;
        if(t > 1) t -= 1;
        if(t < 1/6) return p + (q - p) * 6 * t;
        if(t < 1/2) return q;
        if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function getNamespacesForElement(elem) {
  nses = elem.dataset.appNamespaces
  nses = nses ? nses.split(',') : []
  return nses
}
function setNamespacesForElement(elem, namespacesArr) {
  elem.dataset.appNamespaces = namespacesArr
}
function getScriptsForElement(elem) {
  scripts = elem.dataset.appScripts
  scripts = scripts ? scripts.split(',') : []
  return scripts
}
function setScriptsForElement(elem, scriptsArr) {
  elem.dataset.appScripts = scriptsArr
}
function appendDocumentScript(scriptElem, parentElem) {
  // Make the scripts run by putting them into the live DOM
  console.log("appendDocumentScript", scriptElem.id, g(scriptElem, 'src'))
  debugBar("appendDocumentScript" + scriptElem.id + g(scriptElem, 'src'))
  let newScript = document.createElement('script')
  let scriptUrl = g(scriptElem, 'src')
  if (scriptUrl) {
    newScript.src = g(scriptElem, 'src')
  } else if (scriptElem.textContent) {
    if (parentElem.dataset.appUrl) {
      scriptUrl = parentElem.dataset.appUrl
    }
    newScript.textContent = scriptElem.textContent
  } else {
    throw Error(`Imported script (${scriptElem.id}) had no src or textContent`)
  }
  currentScripts = getScriptsForElement(parentElem)
  currentScripts.push(scriptUrl)

  let namespace = g(scriptElem, 'data-namespace')
  if (namespace) {
    newNamespaces = getNamespacesForElement(parentElem)
    newNamespaces.push(namespace)
    setNamespacesForElement(parentElem, newNamespaces)
  }

  s(newScript, 'id', scriptElem.id)
  s(newScript, 'data-orig-url', scriptUrl)
  s(newScript, 'data-namespace', g(scriptElem, 'data-namespace'))

  ga = byId('gamearea')
  if (!ga.querySelector(`[data-orig-url="${scriptUrl}"]`)) {
    ga.appendChild(newScript)
  }
  // Remove the javascript node so it doesn't clutter up the svg_table DOM
  scriptElem.remove()
}

function initialize_with_ns(elem, ns, serializedState) {
  console.log('initialize_with_ns', elem.id)
  // The foreign <svg> should have an onLoad to do this, but
  // Chrome has problems doing onLoad
  if (g(elem, 'data-ui-initialized')) {
    return
  }
  if (ns.initialize) {
    ns.initialize(elem, serializedState)
  }
  if (ns.menu) {
    ui.hookup_menu_actions(elem, ns.menu)
  }
  s(elem, 'data-ui-initialized', true)
}

function hookup_foreign_scripts(elem, url, serializedState) {
  console.log('hookup_foreign_scripts', elem, url, serializedState)
  // This assumes import_foreign_svg has already been executed
  // and the svg element has been added to the DOM
  getNamespacesForElement(elem).forEach((nsName) => {
    let ns = window[nsName]
    initialize_with_ns(elem, ns, serializedState)
    //console.log("adding ser and deser", Object.keys(ns))
    if (ns.serialize) {
      serializers[url] = ns.serialize
    }

    if (ns.deserialize) {
      deserializers[url] = ns.deserialize
    }
  })
}

function hookup_self_event_handlers(el, actionMenu) {
  Object.keys(actionMenu).map((title) => {
    if (!actionMenu[title].handler) {
      return
    }
    console.log("hooking up", actionMenu[title].eventName, actionMenu[title].handler)
    el.addEventListener(actionMenu[title].eventName, actionMenu[title].handler)
  })
}

async function add_object(url, attrs) {
  console.log('add_object', url, attrs)
  let nest = await import_foreign_svg(url)
  setColor(nest.node, (attrs && attrs.color) || getUserColor())
  if (attrs && attrs.center !== undefined) {
    nest.cx(attrs.center[0])
    nest.cy(attrs.center[1])
  }
  svg_table.add(nest)
  ui.hookup_ui(nest.node)
  hookup_foreign_scripts(nest.node, url, attrs && attrs.serializedState)
  ui.do_animate(nest.node)
  ui.fire({type: "create", data: { createdEl: nest.node }});
  net_fire({type: "create", data: serialize(nest)});
}

function add_object_from_payload(payload) {
  url = payload['data-app-url']
  return import_foreign_svg(url)
  .then((nest) => {
    if (payload['data-color']) {
      setColor(nest.node, payload['data-color'])
    }
    nest.attr(payload)
    return nest
  })
  .then((nest) => {
    ui.do_animate(nest.node)
    return nest.node
  })
}

function pop_from_parent(childElem) {
  console.log('pop child', childElem.id, 'from_parent')
  if (childElem.tagName !== 'svg') {
    throw Error('Not an SVG element')
  }
  parentWithXY = childElem.parentNode.closest('svg')
  grandparent = parentWithXY.parentNode.closest('svg')
  console.log('child', childElem.id, 'parent', parentWithXY.id, 'gp', grandparent.id)
  child = SVG.adopt(childElem)
  parentWithXY = SVG.adopt(parentWithXY)

  console.log('setting to', child.x() + parentWithXY.x())
  child.x(child.x() + parentWithXY.x())
  console.log('now ', child.x() )
  child.y(child.y() + parentWithXY.y())

  getNamespacesForElement(childElem).forEach((nsName) => {
    let ns = window[nsName]
    initialize_with_ns(childElem, ns)
    ui.hookup_ui(childElem)
    childElem.dataset.appClass = 'nest'
  })

  push_to_parent(childElem, grandparent, (c, p) => {
    p.appendChild(c)
  })
}

function push_to_parent(childEl, parentEl, pushFn) {
  console.log("push_to_parent", childEl.id, parentEl.id)
  console.log("parent dataset", parentEl.dataset)
  if (parentEl.dataset.nestFor === 'mark') {
    // if the parent is just a mark, step the focus up one level
    mark = SVG.adopt(parentEl)
    markXY = { x: mark.x(), y: mark.y() }
    parentEl = parentEl.parentNode.closest('svg')
  } else if (parentEl.dataset.enveloped) {
    mark = SVG.adopt(parentEl.parentElement)
    markXY = { x: -mark.x(), y: -mark.y() }
  } else {
    markXY = { x: 0, y: 0 }
  }
  if (childEl.dataset.nestFor === 'mark') {
    childEl = childEl.firstChild
    ui.raw_unmark(childEl)
  } else if (childEl.dataset.enveloped) {
    // re-parenting removes the mark
    ui.raw_unmark(childEl)
  }

  if (parentEl.id === 'svg_table') {
    ui.hookup_ui(childEl)
  } else {
    ui.un_hookup_ui(childEl)
  }
  origParentEl = childEl.parentNode.closest('svg')
  childEl.remove()
  c = SVG.adopt(childEl)
  p = SVG.adopt(parentEl)
  //console.log('c', c.x(), c.y(), 'mark', markXY, 'p', p.x(), p.y())
  //console.log('crbox', c.rbox(), 'prbox', p.rbox())
  c.x( c.x() + markXY.x - p.x() )
  c.y( c.y() + markXY.y - p.y() )
  pushFn(childEl, parentEl)
  if (origParentEl) {
    evt_fire('change', origParentEl, {})
  }
}

function delete_element(el) {
  var payload = { id: null, kids: [] }
  ui.animated_ghost(el, {animation: 'rotateOut'})
  el.remove()
  payload.kids.push({ id: el.id })
  net_fire({ type: 'delete', data: payload });
  ui.fire({type: 'delete', data: payload });
}

function evt_fire(eventName, triggerNode, origEvent, other) {
  console.log("dispatching", eventName, 'to', triggerNode.id, 'other', other)
  triggerNode.dispatchEvent(new CustomEvent(eventName, {
    bubbles: true,
    detail: Object.assign(
      { origEvent: origEvent, elemId: triggerNode.id },
      other
    ),
  }))
}

function delete_marked(evt) {
  var payload = { id: null, kids: [] }
  document.querySelectorAll('[data-ui-marked]').forEach(el => {
    ui.animated_ghost(el, {animation: 'rotateOut'})
    el.remove()
    payload.kids.push({ id: el.id })
  })
  net_fire({ type: 'delete', data: payload });
  ui.fire({type: 'delete', data: payload });
}

