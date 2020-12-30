const ui = {

  _quickButtonSVG: null,
  selectBoxPrototype: null,
  selectOpenBoxPrototype: null,

  escapedClientId: () => {
    return myClientId ? myClientId.replace('.', '-') : ''
  },

  initializeDragSelectBox: (viewportEl) => {
    return import_foreign_svg('svg/v1/select_box.svg')
    .then((nest) => {
      this.selectBoxPrototype = nest
      dragSelBoxEl = nest.node.cloneNode(true)
      dragSelBox = SVG.adopt(dragSelBoxEl)
      dragSelBox.id('drag_select_box')
      dragSelBox.addClass('drag_select_box')

      viewportEl.addEventListener('dragselect_init', (evt) => {
        // console.log('viewport got svg_dragselect_init', evt)
      })
      viewportEl.addEventListener('svg_dragselect_start', (evt) => {
        // console.log('viewport got svg_dragselect_start', evt, evt.detail.box)
        ui.unselectAll()
        let selbox = svg_table.node.querySelector('#drag_select_box')
        if (!selbox) {
          dragSelBox.attr(evt.detail.box)
          layer_ui.add(SVG.adopt(dragSelBoxEl))
        }
        if (myClientId) {
          dragSelBoxEl.classList.add(
            'has-owner', 'owner-' + ui.escapedClientId()
          )
        }
        select_box.initialize(dragSelBoxEl)
      })
      viewportEl.addEventListener('svg_dragselect_drag', (evt) => {
        // console.log('viewport got svg_dragselect_drag', evt, evt.detail.box)
        select_box.reshape(dragSelBoxEl, evt.detail.box)
      })
      viewportEl.addEventListener('svg_dragselect_end', (evt) => {
        // console.log('viewport got svg_dragselect_end', evt)
        let surrounded = spatial.topLevelSurrounded(evt.detail.box)
        let peerSelectBoxes = document.querySelectorAll(
          '.select_box:not(.owner-' + ui.escapedClientId() + ')'
        )
        exemptedIds = {}
        peerSelectBoxes.forEach(sbox => {
          ui.getSelectBoxSelectedElements(sbox).forEach(el => {
            exemptedIds[el.id] = true
          })
        })
        surrounded = surrounded.filter((el) => {
          return !exemptedIds[el.id]
        })
        select_box.selectElements(dragSelBoxEl, surrounded)
        layer_ui.add(SVG.adopt(dragSelBoxEl))

      })
    })
    .then(() => {
      return import_foreign_svg('svg/v1/select_open_box.svg')
    })
    .then((nest) => {
      this.selectOpenBoxPrototype = nest
    })
  },

  getSelectOpenBox: () => {
    // console.log('getSelectOpenBox', this.selectOpenBoxPrototype.node)
    ui.unselectAll()
    let newSelOpenBox = this.selectOpenBoxPrototype.node.cloneNode(true)
    newSelOpenBox.classList.remove('draggable-group')
    if (myClientId) {
      newSelOpenBox.classList.add('has-owner', 'owner-' + ui.escapedClientId())
    }
    select_open_box.initialize(newSelOpenBox)
    layer_ui.add(SVG.adopt(newSelOpenBox))
    return newSelOpenBox
  },

  getSelectBoxes: () => {
    let selBoxes = []
    layer_ui.node.querySelectorAll('.select_box').forEach(el => {
      selBoxes.push(el)
    })
    layer_ui.node.querySelectorAll('.select_open_box').forEach(el => {
      selBoxes.push(el)
    })
    return selBoxes
  },

  getSelectBoxSelectedElements: (selBoxElem) => {
    let selected = []
    let newIds = []
    let ids = []

    if (selBoxElem.dataset.for.includes(',')) {
      ids = selBoxElem.dataset.for.split(',')
    } else if (selBoxElem.dataset.for.length > 0) {
      ids = [selBoxElem.dataset.for]
    }

    ids.forEach(id => {
      el = layer_objects.node.querySelector('#' + id)
      if (el) {
        selected.push(el)
        newIds.push(id)
      }
    })
    if (newIds.length !== ids.length) { // If avoidable, don't change the DOM
      selBoxElem.dataset.for = newIds
    }
    return selected
  },

  selectElement: (elem, evt) => {
    // console.log('selectElement', elem.id, evt)

    ui.unselectAll()

    let svgSelBoxEl = this.selectBoxPrototype.node.cloneNode(true)
    // console.log("made select_box", svgSelBoxEl)
    svg_elem = SVG.adopt(elem)
    if (myClientId) {
      svgSelBoxEl.classList.add('has-owner', 'owner-' + ui.escapedClientId())
    }
    select_box.initialize(svgSelBoxEl)
    select_box.reshape(svgSelBoxEl, {
      x: svg_elem.x(),
      y: svg_elem.y(),
      width: svg_elem.width(),
      height: svg_elem.height(),
    })
    select_box.selectElements(svgSelBoxEl, [elem])
    layer_ui.add(SVG.adopt(svgSelBoxEl))
  },

  removeEmptySelectBoxes: () => {
    // console.log("remove empty boxes")
    ui.getSelectBoxes().forEach(sbox => {
      // console.log("box", sbox)
      if (ui.getSelectBoxSelectedElements(sbox).length < 1) {
        sbox.remove()
      }
    })
  },

  belongsToPeer: (el) => {
    return (
      el.classList.contains('has-owner')
      &&
      !el.classList.contains('owner-' + ui.escapedClientId())
    )
  },

  unselectAll: () => {
    ui.getSelectBoxes().forEach(el => {
      // console.log("removing", el)
      if(ui.belongsToPeer(el)) {
        return // skip this peer's select box
      }
      if (el.classList.contains('drag-open')) {
        unlock_selection(el)
      }
      el.remove()
    })
  },

  hookup_ui: (elem) => {
    // console.log("hookup_ui", elem.id)
    let allHandlers = ui.augmented_handlers_for_element(elem)
    let nest = SVG.adopt(elem)
    nest.on('svg_dragsafe_click', (evt) => {
      // console.log('id', elem.id, 'got click', evt)
      ui.selectElement(elem, evt)
    })
    elem.addEventListener('mouseover', ui.buildRightClickMenu)
    if (allHandlers['dblclick']) {
      elem.addEventListener('dblclick', allHandlers['dblclick'])
    }
  },

  un_hookup_ui: (elem) => {
    //console.log("un_hookup_ui", elem.id)
    nest = SVG.adopt(elem)
    nest.off('svg_dragsafe_click')
  },

  augmented_handlers_for_element: (svgEl) => {
    let eventHandlers = {}
    let actionMenu = ui.getFullMenuForElement(svgEl)
    Object.keys(actionMenu).forEach((title) => {
      let menuItem = actionMenu[title]
      if (!menuItem.handler) {
        return
      }
      let boundHandler = (evt) => {
        userlog.add({ user: myClientId, title: title, event: evt, el: svgEl })
        menuItem.handler.bind(svgEl)(evt)
      }
      eventHandlers[menuItem.eventName] = boundHandler
      if (menuItem.otherEvents) {
        menuItem.otherEvents.forEach(evName => {
          eventHandlers[evName] = boundHandler
        })
      }
    })
    return eventHandlers
  },

  buildRightClickMenu: function (evt) {
    // Add clickable (right-click) options onto the menu
    // Note: addEventListener must use this named, static, non-arrow function
    //       to prevent memory-leak bug:
    // https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#Memory_issues
    //console.log('ui.buildRightClickMenu', evt, this)
    let hoveredEl = this

    deleteList = document.querySelectorAll('.cloned-menuitem')
    Array.prototype.forEach.call(deleteList, (el) => {
      el.remove();
    })

    let actionMenu = ui.getFullMenuForElement(hoveredEl)
    let allHandlers = ui.augmented_handlers_for_element(hoveredEl)
    var menu = byId('gamemenu')
    var template = byId('template_menuitem')
    Object.keys(actionMenu).map((title) => {
      if (!actionMenu[title].applicable(hoveredEl)) {
        return
      }
      var uiLabel = (
        actionMenu[title].uiLabel
        ?
        actionMenu[title].uiLabel(hoveredEl)
        :
        title
      )
      var clone = template.content.firstElementChild.cloneNode(true)
      s(clone, 'id', 'menuitem-' + hoveredEl.id)
      s(clone, 'label', uiLabel)
      clone.classList.add('cloned-menuitem')
      clone.addEventListener('click', (evt) => {
        console.log('LOG user', myClientId,
          'does', title, // evt,
          'on', hoveredEl.id, hoveredEl.dataset.appUrl,
        )
        let handler = allHandlers[actionMenu[title].eventName]
        handler(evt)
      })
      menu.insertAdjacentElement('beforeend', clone)
    })

  },

  getFullMenuForElement: function(elem) {
    let actionMenu = {}
    getNamespacesForElement(elem).forEach((nsName) => {
      let ns = window[nsName]
      if (!ns) {
        console.error(`The "${nsName}" namespace was not found in the window`)
        return {}
      }
      if (ns.menu) {
        actionMenu = Object.assign(actionMenu, ns.menu)
      }
      if (ns.makeMenu) {
        actionMenu = Object.assign(actionMenu, ns.makeMenu(elem))
      }
    })
    return actionMenu
  },

  getMySelectedElements: () => {
    let selected = []
    layer_ui.node.querySelectorAll('.select_box').forEach(el => {
      if (ui.belongsToPeer(el)) {
        return // skip select boxes owned by other users
      }
      let nodes = ui.getSelectBoxSelectedElements(el)
      selected = selected.concat(nodes)
    })
    return selected
  },

  updateButtons: () => {
    // console.log("ui.updateButtons")
    let focusedNodes = ui.getMySelectedElements()
    let numMarked = focusedNodes.length
    let buttons = {}
    let template = byId('template_object_actions')

    let submenu = byId('object_actions')
    submenu.querySelectorAll('.cloned-button').forEach((btn) => {
      btn.remove()
    })
    ui.setHeaderText('Select dice by clicking on them; roll by double-clicking; zoom with Ctrl-wheel')

    function addNewButton(title) {
      let btn = template.content.firstElementChild.cloneNode(true)
      btn.id = 'button-' + title
      btn.dataset.eventTitle = title
      btn.innerText = title
      btn.classList.add('cloned-button')
      buttons[title] = {
        btn: btn,
        clickFns: [],
      }
    }
    function attachButton(title, svgNode, handler, applicableFn) {
      if (buttons[title] === undefined) {
        addNewButton(title)
      }
      if (!applicableFn(svgNode)) {
        buttons[title].btn.disabled = 'disabled'
      }
      buttons[title].clickFns.push(handler)
    }

    let i = 0
    focusedNodes.forEach((focusedSVG) => {
      i++
      let allHandlers = ui.augmented_handlers_for_element(focusedSVG)
      let actionMenu = ui.getFullMenuForElement(focusedSVG)
      // console.log("focusedSVG", focusedSVG.id, allHandlers, actionMenu)
      if (numMarked === 1) {
        ui.setHeaderText(g(focusedSVG, 'data-orig-name'))

        Object.keys(actionMenu).map((title) => {
          let handler = allHandlers[actionMenu[title].eventName]
          attachButton(title, focusedSVG, handler, actionMenu[title].applicable)
        })

        ui.updateQuickButton(focusedSVG)

      } else { // more than 1
        ui.setHeaderText(g(numMarked + ' objects selected'))
        Object.keys(actionMenu).map((title) => {
          let handler = allHandlers[actionMenu[title].eventName]

          if (i === 1) { // the first one sets up the 'buttons' object
            attachButton(title, focusedSVG, handler, actionMenu[title].applicable)
          } else if (title in buttons) {
            attachButton(title, focusedSVG, handler, actionMenu[title].applicable)
          }
        })
        // Remove any 'verbs' that don't pertain to ALL focused nodes
        Object.keys(buttons).map((key) => {
          if (actionMenu[key] === undefined) {
            delete buttons[key]
          }
        })
      }
    })

    let selectBoxes = ui.getSelectBoxes()
    if (focusedNodes.length > 0 && selectBoxes.length > 0) {
      let sBoxNode = selectBoxes[0]
      attachButton(
        'Delete',
        sBoxNode,
        (evt) => {
          userlog.add({ user: myClientId, event: 'DELETE', el: sBoxNode })
          ui.getSelectBoxSelectedElements(sBoxNode).forEach(el => {
            ui.animated_ghost(el, {animation: 'rotateOut'})
            el.remove()
          })
          ui.removeEmptySelectBoxes()
        },
        () => { return true },
      )
      buttons['Delete'].btn.accessKey = 'delete'
    }

    /*
     * Attach the created buttons onto the DOM
     */
    Object.keys(buttons).map((key) => {
      buttonRecord = buttons[key]
      buttonRecord.clickFns.forEach(clickFn => {
        buttonRecord.btn.addEventListener('click', clickFn)
      })
      template.parentElement.appendChild(buttonRecord.btn)
      // Hookup hotkeys (after we're attaching to DOM to avoid collisions)
      accessKey = buttonRecord.btn.innerText[0].toLocaleLowerCase()
      if (document.querySelector('[accessKey=' + accessKey + ']') === null) {
        // console.log( 'a key', accessKey)
        // TODO make better
        buttonRecord.btn.accessKey = accessKey
      }
    })

  },

  setHeaderText: function(msg) {
    msgEl = document.querySelector('#object_actions_header')
    if (msgEl) {
      msgEl.textContent = msg
    }
  },

  clickQuickButton: function() {
    if (!this._quickButtonSVG) {
      url = document.querySelector('#quick_die_button img').src
      add_object( url, {
        'center': [100, 100],
      })
      return
    }
    qb_svg = SVG.adopt(this._quickButtonSVG)
    clone_object( this._quickButtonSVG, {
      'center': [qb_svg.x() + 50, qb_svg.y() + 50],
    })
  },

  updateQuickButton: function(el) {
    this._quickButtonSVG = el
    placeholder = `data:image/svg+xml;utf8,<svg
      xmlns="http://www.w3.org/2000/svg" x="0" y="0">
      <rect x="0" y="0" width="48" height="48" fill="white"/>
      <rect x="4" y="4" width="40" height="40" fill="black"/>
      <rect x="23" y="12" width="2" height="24" fill="white"/>
      <rect x="12" y="23" width="24" height="2" fill="white"/>
      </svg>
    `
    newSrc = el.dataset.appUrl || placeholder
    if (newSrc[0] === '#') {
      // TODO make a <use href="..."> tag here
      newSrc = placeholder
    }
    document.querySelector('#quick_die_button img').src = newSrc
  },

  broadcast: (eventName, detail, dispatchEl) => {
    //console.log('broadcasting', eventName, detail)
    if (dispatchEl === undefined) {
      dispatchEl = svg_table.node
    }
    dispatchEl.dispatchEvent(new CustomEvent(eventName, {
      bubbles: true,
      detail: detail,
    }))
  },

  flatten_translation: (el) => {
    //console.log('flattn el', el)
    //console.log('flattn baseval', el.transform.baseVal)
    if (el.transform.baseVal.length === 0) {
      return;
    }
    var translate = el.transform.baseVal.getItem(0)
    if (el.tagName === 'g') {
      el.querySelectorAll('[data-app-url]').forEach((kid) => {
        s(kid, 'x', translate.matrix.e)
        s(kid, 'y', translate.matrix.f)
      })
    } else {
      s(el, 'x', translate.matrix.e)
      s(el, 'y', translate.matrix.f)
    }
    el.transform.baseVal.removeItem(0)
  },

  animated_ghost: (el, attrs) => {
    var { ms, animation, before_begin, on_done } = Object.assign({
      ms: 900,
      animation: 'slideInDown',
      before_begin: () => { return },
      on_done: () => { return },
    }, attrs)
    var animationClone = el.cloneNode(true)

    // Disable interactivity
    animationClone.id = 'clone' + Date.now()
    animationClone.classList.add('ghost')
    animationClone.getAttributeNames().map((n) => {
      if (n.indexOf('data-ui-') !== -1) {
        s(animationClone, n, null);
      }
    });
    s(animationClone, 'draggable-group', null);

    // Move to the start position
    ui.flatten_translation(animationClone)
    cc = SVG(animationClone)
    ee = SVG(el.id)
    cc.move(ee.x(), ee.y())

    el.parentNode.appendChild(animationClone, el)

    before_begin(animationClone)

    // Animate, then die
    ui.do_animate(animationClone, {animation: animation, ms: ms})
    var timedFn;
    timedFn = setInterval(() => {
      animationClone.remove()
      clearInterval(timedFn)
      on_done(el)
    }, ms);
  },

  do_animate: (node, attrs) => {
    if (node.classList.contains('animated')) {
      // do not play 2 animations simultaneously
      return
    }
    let { ms, animation, from } = Object.assign({
      ms: 900,
      animation: 'slideInDown',
      from: {},
    }, attrs)
    node.classList.add('animated', animation)
    let timedFn = setTimeout(() => {
      node.classList.remove('animated', animation)
    }, ms)
  },

  popup_dialog: (target) => {
    elem = byId(g(target, 'data-dialog-id'))
    instance = M.Modal.getInstance(elem)
    instance.open()
  },

  popdown_dialog: (elem_id) => {
    elem = document.querySelector('#' + elem_id)
    instance = M.Modal.getInstance(elem)
    instance.close()
  },

}
