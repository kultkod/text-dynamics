import { buildGraphIndex } from './tdjGraph.js';
import { createGraphMap } from './graphMap.js';
import { createEdgePlayer } from './edgePlayer.js';


const NOSP = new Set([...'.,!?;:)»”“…>']);
const OPEN = new Set([...'(\u00ab„<']);


function needSpace(prevChar, tok) {
  if (!prevChar) return false;
  if (tok.startsWith('...')) return false;
  if (NOSP.has(tok[0])) return false;
  if (OPEN.has(prevChar)) return false;

  return true;
}


function flushParagraph(box, pEl) {
  if (pEl && pEl.childNodes.length) {
    box.appendChild(pEl);
  }
}


function paragraphIndexForOp(tokens, curOp) {
  if (curOp == null || curOp < 0) return null;

  let p = 0;

  for (const t of tokens) {
    if (t.para) {
      p++;
      continue;
    }

    if (t.op === curOp) return p;
  }

  return null;
}


function drawText(tokens, exact, curOp, settings) {
  const box = document.getElementById('text');

  box.innerHTML = '';

  const mode = settings.highlightMode;

  const pTarget =
    (mode === 'para' && !exact)
      ? paragraphIndexForOp(tokens, curOp)
      : null;


  function isActive(tok, pIdx) {
    if (exact) return false;
    if (tok.op === -1) return false;
    if (mode === 'off') return false;

    const within = tok.op <= curOp;

    if (mode === 'doc') return within;

    if (mode === 'para') {
      return within && (pTarget == null || pIdx === pTarget);
    }

    return false;
  }


  let pEl = document.createElement('p');

  pEl.className = 'paragraph';

  let prevChar = '';
  let pIdx = 0;
  let focusRendered = false;


  for (const tok of tokens) {

    if (tok.para) {
      flushParagraph(box, pEl);

      pEl = document.createElement('p');
      pEl.className = 'paragraph';

      prevChar = '';
      pIdx++;

      continue;
    }


    const active = isActive(tok, pIdx);


    // Если это удаленный токен и подсветка выключена
    if (tok.st === 'del' && !active) {
      // Если это текущая правка — ставим невидимый якорь для автоскролла
      if (!exact && tok.op === curOp && !focusRendered) {
        const anchor = document.createElement('span');
        anchor.className = 'token focus';
        anchor.style.cssText = 'display:inline-block;width:0;height:0;overflow:hidden;vertical-align:baseline;';
        pEl.appendChild(anchor);
        focusRendered = true;
      }
      continue;
    }


    if (needSpace(prevChar, tok.v)) {
      pEl.appendChild(
        document.createTextNode(' ')
      );
    }


    const span = document.createElement('span');

    span.textContent = tok.v;

    // Фокус для автоскролла ставится ВСЕГДА, независимо от режима подсветки
    const isFocus = !exact && tok.op === curOp;
    if (isFocus) {
      focusRendered = true;
    }

    span.className =
      'token'
      + (active && tok.st === 'ins' ? ' ins' : '')
      + (active && tok.st === 'del' ? ' del' : '')
      + (isFocus ? ' focus' : '');


    pEl.appendChild(span);

    prevChar = tok.v[tok.v.length - 1];
  }


  flushParagraph(box, pEl);
}


function escapeHTML(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}



/* MOBILE GRAPH */

function setupMobileGraphToggle() {
  const btn = document.getElementById('graphToggle');
  const panel = document.getElementById('graphPanel');

  if (!btn || !panel) return;


  function setOpen(open) {
    btn.setAttribute(
      'aria-expanded',
      String(open)
    );

    panel.classList.toggle(
      'mobile-open',
      open
    );
  }


  btn.addEventListener('click', () => {
    const open =
      btn.getAttribute('aria-expanded') === 'true';

    setOpen(!open);
  });


  /*
    Если пользователь раскрыл карту на телефоне,
    а затем увеличил окно до desktop, никаких
    специальных состояний там не требуется.

    При возвращении к mobile карта снова будет
    соответствовать aria-expanded.
  */

  const media = window.matchMedia('(max-width: 920px)');

  media.addEventListener?.('change', event => {
    if (!event.matches) {
      panel.classList.remove('mobile-open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}


/* TOOLTIP */

function setupInstantTooltip() {
  const tip = document.createElement('div');

  tip.id = 'uiTooltip';
  tip.className = 'ui-tooltip';

  document.body.appendChild(tip);


  let activeEl = null;
  let savedTitle = '';


  function place(x, y) {
    const pad = 12;

    const rect = tip.getBoundingClientRect();

    const w = rect.width || 240;
    const h = rect.height || 40;

    let left = x + pad;
    let top = y + pad;

    const vw = window.innerWidth;
    const vh = window.innerHeight;


    if (left + w + 8 > vw) {
      left = Math.max(8, x - w - pad);
    }


    if (top + h + 8 > vh) {
      top = Math.max(8, y - h - pad);
    }


    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }


  function show(text, x, y) {
    tip.textContent = text;

    tip.classList.add('on');

    place(x, y);
  }


  function hide() {
    tip.classList.remove('on');

    if (activeEl) {
      activeEl.setAttribute(
        'title',
        savedTitle
      );
    }

    activeEl = null;
    savedTitle = '';
  }


  document.addEventListener(
    'pointerover',
    e => {
      const el = e.target.closest('[title]');

      if (!el) return;


      const t = el.getAttribute('title');

      if (!t) return;


      if (activeEl !== el) {

        if (activeEl) {
          activeEl.setAttribute(
            'title',
            savedTitle
          );
        }


        activeEl = el;
        savedTitle = t;

        el.setAttribute('title', '');
      }


      show(
        savedTitle,
        e.clientX,
        e.clientY
      );
    },
    true
  );


  document.addEventListener(
    'pointermove',
    e => {
      if (!activeEl) return;

      place(
        e.clientX,
        e.clientY
      );
    },
    true
  );


  document.addEventListener(
    'pointerout',
    e => {
      if (!activeEl) return;


      const related = e.relatedTarget;


      if (
        related &&
        activeEl.contains(related)
      ) {
        return;
      }


      hide();
    },
    true
  );


  window.addEventListener(
    'blur',
    hide
  );
}


/* GRAPH ZOOM + PAN */

function setupGraphZoomAndPan() {
  const viewport =
    document.getElementById('graphViewport');

  const graphEl =
    document.getElementById('graph');

  const zoomIn =
    document.getElementById('zoomIn');

  const zoomOut =
    document.getElementById('zoomOut');


  if (
    !viewport ||
    !graphEl ||
    !zoomIn ||
    !zoomOut
  ) {
    return;
  }


  const clamp = (x, a, b) =>
    Math.max(a, Math.min(b, x));


  const load = () => {
    const v =
      parseFloat(
        localStorage.getItem('td_graph_zoom') || '1'
      );

    return Number.isFinite(v)
      ? v
      : 1;
  };


  const save = z =>
    localStorage.setItem(
      'td_graph_zoom',
      String(z)
    );


  let zoom = load();

  let baseW = 0;
  let baseH = 0;


  function recomputeBase() {
    const w = Math.round(viewport.clientWidth);
    const h = Math.round(viewport.clientHeight);

    /*
      При закрытой мобильной карте display:none
      даёт размеры 0. В таком состоянии просто
      ждём ResizeObserver после раскрытия.
    */

    if (w > 0) baseW = w;
    if (h > 0) baseH = h;
  }


  function applyZoom(keepCenter = true) {
    zoom = clamp(zoom, 1, 3);

    if (!baseW || !baseH) {
      recomputeBase();
    }

    if (!baseW || !baseH) {
      return;
    }


    const prevZoom =
      graphEl._prevZoom || 1;


    const wPrev =
      Math.round(baseW * prevZoom);

    const hPrev =
      Math.round(baseH * prevZoom);


    const wNext =
      Math.round(baseW * zoom);

    const hNext =
      Math.round(baseH * zoom);


    if (
      keepCenter &&
      wPrev > 0 &&
      hPrev > 0
    ) {

      const cx =
        (
          viewport.scrollLeft +
          viewport.clientWidth / 2
        ) / wPrev;


      const cy =
        (
          viewport.scrollTop +
          viewport.clientHeight / 2
        ) / hPrev;


      graphEl.style.width =
        wNext + 'px';

      graphEl.style.height =
        hNext + 'px';


      viewport.scrollLeft =
        cx * wNext -
        viewport.clientWidth / 2;


      viewport.scrollTop =
        cy * hNext -
        viewport.clientHeight / 2;

    } else {

      graphEl.style.width =
        wNext + 'px';

      graphEl.style.height =
        hNext + 'px';
    }


    graphEl._prevZoom = zoom;

    save(zoom);
  }


  function zoomBy(delta) {
    zoom =
      clamp(
        zoom + delta,
        1,
        3
      );

    applyZoom(true);
  }


  zoomIn.onclick = () =>
    zoomBy(0.25);


  zoomOut.onclick = () =>
    zoomBy(-0.25);


  viewport.addEventListener(
    'wheel',
    e => {
      e.preventDefault();

      const delta =
        e.deltaY > 0
          ? -0.15
          : 0.15;

      zoomBy(delta);
    },
    { passive: false }
  );


  const THRESH = 4;

  let candidate = false;
  let dragging = false;

  let startX = 0;
  let startY = 0;

  let startSL = 0;
  let startST = 0;


  viewport.addEventListener(
    'pointerdown',
    e => {
      if (e.button !== 0) return;

      if (e.target.closest('.g-node')) {
        return;
      }

      candidate = true;
      dragging = false;

      startX = e.clientX;
      startY = e.clientY;

      startSL = viewport.scrollLeft;
      startST = viewport.scrollTop;
    }
  );


  viewport.addEventListener(
    'pointermove',
    e => {
      if (!candidate) return;


      const dx =
        e.clientX - startX;

      const dy =
        e.clientY - startY;


      if (!dragging) {

        if (
          Math.hypot(dx, dy) <
          THRESH
        ) {
          return;
        }


        dragging = true;

        viewport.classList.add(
          'dragging'
        );

        viewport.setPointerCapture(
          e.pointerId
        );
      }


      viewport.scrollLeft =
        startSL - dx;

      viewport.scrollTop =
        startST - dy;
    }
  );


  viewport.addEventListener(
    'pointerup',
    () => {
      candidate = false;

      if (dragging) {
        dragging = false;

        viewport.classList.remove(
          'dragging'
        );
      }
    }
  );


  viewport.addEventListener(
    'pointercancel',
    () => {
      candidate = false;
      dragging = false;

      viewport.classList.remove(
        'dragging'
      );
    }
  );


  const ro =
    new ResizeObserver(() => {

      const oldW = baseW;
      const oldH = baseH;

      recomputeBase();


      if (
        Math.abs(oldW - baseW) <= 1 &&
        Math.abs(oldH - baseH) <= 1
      ) {
        return;
      }


      applyZoom(false);
    });


  ro.observe(viewport);


  requestAnimationFrame(() => {
    recomputeBase();
    applyZoom(false);
  });
}


/* SETTINGS STORAGE */

function loadSettings() {
  try {

    const raw =
      localStorage.getItem(
        'td_settings'
      );

    return raw
      ? JSON.parse(raw)
      : null;

  } catch {
    return null;
  }
}


function saveSettings(st) {
  localStorage.setItem(
    'td_settings',
    JSON.stringify(st)
  );
}


/* APP */

function buildPillHTML(v) {
  if (!v) return '';

  const tipLines = [
    `${v.id}`,
    `${v.title}`,
    v.date ? `Дата: ${v.date}` : '',
    v.note ? `Прим.: ${v.note}` : ''
  ].filter(Boolean);

  const tip = tipLines.join('\n');

  return `
    <span class="edge-pill" title="${escapeHTML(tip)}">
      <span class="id">${escapeHTML(v.id)}</span>
      <span class="edge-pill-text">
        ${escapeHTML(v.title)}${v.date ? ` · ${escapeHTML(v.date)}` : ''}
      </span>
    </span>
  `;
}

// Умная функция автопрокрутки
function smartScrollToToken(focusEl, smooth = false) {
  if (!focusEl) return;

  const stickyHost = document.querySelector('.sticky-host');
  const stickyHeight = stickyHost ? stickyHost.getBoundingClientRect().height : 0;

  const rect = focusEl.getBoundingClientRect();
  const viewH = window.innerHeight;

  const topComfort = stickyHeight + 60;
  const bottomComfort = viewH - 80;

  if (rect.top >= topComfort && rect.bottom <= bottomComfort) {
    return;
  }

  const availableH = viewH - stickyHeight;
  const targetY = window.scrollY + rect.top - stickyHeight - (availableH / 2) + (rect.height / 2);

  window.scrollTo({
    top: Math.max(0, targetY),
    behavior: smooth ? 'smooth' : 'auto'
  });
}

// ГЛОБАЛЬНАЯ ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
async function boot() {
  
  // Глобальные переменные текущего открытого проекта
  let currentPlayer = null;
  let currentRender = null;
  let currentState = null;
  let graphMap = null;

  // --- НАСТРОЙКИ ---
  const settings = {
    highlightMode: 'doc',
    fontSize: 17,
    autoScroll: true
  };

  Object.assign(settings, loadSettings() || {});

  document.documentElement.style.setProperty('--textSize', settings.fontSize + 'px');

  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const fontMinus = document.getElementById('fontMinus');
  const fontPlus = document.getElementById('fontPlus');
  const fontValue = document.getElementById('fontValue');
  const autoScrollEl = document.getElementById('autoScroll');

  function updateSettingsUI() {
    if (!settingsPanel) return;
    settingsPanel.querySelectorAll('input[type="radio"][name="hl"]').forEach(r => {
      r.checked = r.value === settings.highlightMode;
    });
    if (autoScrollEl) autoScrollEl.checked = !!settings.autoScroll;
    if (fontValue) fontValue.textContent = settings.fontSize + 'px';
  }

  function applySettings() {
    document.documentElement.style.setProperty('--textSize', settings.fontSize + 'px');
    saveSettings(settings);
    updateSettingsUI();
    
    // Если проект уже загружен, перерисовываем его с новыми настройками
    if (currentRender && currentState) {
      currentRender(currentState);
    }
  }

  if (settingsBtn && settingsPanel) {
    settingsBtn.onclick = () => {
      settingsPanel.hidden = !settingsPanel.hidden;
      updateSettingsUI();
    };
    document.addEventListener('mousedown', e => {
      if (settingsPanel.hidden) return;
      if (settingsPanel.contains(e.target) || settingsBtn.contains(e.target)) return;
      settingsPanel.hidden = true;
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') settingsPanel.hidden = true;
    });
    settingsPanel.querySelectorAll('input[type="radio"][name="hl"]').forEach(r => {
      r.onchange = () => {
        settings.highlightMode = r.value;
        applySettings();
      };
    });
  }

  if (fontMinus) {
    fontMinus.onclick = () => {
      settings.fontSize = Math.max(11, settings.fontSize - 1);
      applySettings();
    };
  }
  if (fontPlus) {
    fontPlus.onclick = () => {
      settings.fontSize = Math.min(26, settings.fontSize + 1);
      applySettings();
    };
  }
  if (autoScrollEl) {
    autoScrollEl.onchange = () => {
      settings.autoScroll = !!autoScrollEl.checked;
      applySettings();
    };
  }

  updateSettingsUI();
  applySettings();

  // --- ОБРАБОТКА КЛАВИАТУРЫ ---
  let isContinuousMovement = false;
  let resetMovementTimer = null;
  let keyRepeatRaf = null;

  function markContinuousMovement() {
    isContinuousMovement = true;
    clearTimeout(resetMovementTimer);
    resetMovementTimer = setTimeout(() => {
      isContinuousMovement = false;
    }, 150);
  }

  document.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'range') return;
    if (!currentPlayer) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (e.repeat) markContinuousMovement();

      if (!keyRepeatRaf) {
        keyRepeatRaf = requestAnimationFrame(() => {
          if (e.key === 'ArrowLeft') currentPlayer.prev();
          if (e.key === 'ArrowRight') currentPlayer.next();
          keyRepeatRaf = null;
        });
      }
    }
  });

  // Инициализация статических плагинов интерфейса
  setupMobileGraphToggle();
  setupGraphZoomAndPan();
  setupInstantTooltip();


  // --- ФУНКЦИЯ ЗАГРУЗКИ КОНКРЕТНОГО ПРОЕКТА ---
  function loadProject(data) {
    // 1. Обновляем заголовки
    document.getElementById('title').textContent = data.meta?.work || 'Без названия';
    document.getElementById('part').textContent = data.meta?.part || '';
    document.getElementById('srcNote').textContent = data.meta?.src || '';
    document.getElementById('methodNote').textContent = data.meta?.note || '';
    document.getElementById('projectName').textContent = data.meta?.work || 'Без названия';
    document.getElementById('partName').textContent = data.meta?.part || '';

    const graph = buildGraphIndex(data);
    let lastAutoKey = null;

    const els = {
      graphSvg: document.getElementById('graphSvg'),
      graphNodes: document.getElementById('graphNodes'),
      edgeOptions: document.getElementById('edgeOptions'),
      edgeProgress: document.getElementById('edgeProgress'),
      slider: document.getElementById('slider'),
      opsFill: document.getElementById('opsFill')
    };

    const transLabelEl = document.getElementById('transitionLabel');

    // 2. Создаем функцию рендера для этого проекта
    currentRender = function render(st) {
      currentState = st;
      const view = st.buildViewState();

      drawText(view.tokens, view.exact, view.curOp, settings);

      const status = st.getStatusLabel();
      const statusEl = document.getElementById('status');
      if (statusEl) {
        statusEl.textContent = status.text;
        statusEl.className = status.cls;
      }

      const stepEl = document.getElementById('stepLabel');
      if (stepEl) stepEl.textContent = '';

      if (transLabelEl) {
        if (st.mode === 'node') {
          const curV = graph.versionsById.get(st.nodeId);
          transLabelEl.innerHTML = buildPillHTML(curV);
        } else if (st.mode === 'edge' && st.currentEdge) {
          const e = st.currentEdge;
          const fromV = graph.versionsById.get(e.from);
          const toV = graph.versionsById.get(e.to);
          const maxStep = (e.ops?.length ?? 0) + 1;

          if (st.step === 0) {
            transLabelEl.innerHTML = buildPillHTML(fromV);
          } else if (st.step >= maxStep) {
            transLabelEl.innerHTML = buildPillHTML(toV);
          } else {
            transLabelEl.innerHTML = `${buildPillHTML(fromV)} <span class="transition-arrow">→</span> ${buildPillHTML(toV)}`;
          }
        }
      }

      graphMap?.update(st);

      if (settings.autoScroll && st.mode === 'edge') {
        const key = `${st.edgeKey}:${st.step}:${settings.highlightMode}`;
        if (key !== lastAutoKey) {
          lastAutoKey = key;
          const focusEl = document.querySelector('#text .token.focus');
          if (focusEl) {
            smartScrollToToken(focusEl, !isContinuousMovement);
          }
        }
      }
    };

    // 3. Создаем новые сущности графа и плеера
    currentPlayer = createEdgePlayer({
      data,
      graph,
      els,
      onStateChange: st => currentRender(st)
    });

    graphMap = createGraphMap({
      data,
      graph,
      els,
      onNodeClick: id => {
        if (currentPlayer.jumpToNodeAtEnd) {
          currentPlayer.jumpToNodeAtEnd(id);
        } else {
          currentPlayer.setPathToNode?.(id);
          currentPlayer.goToNode?.(id);
        }
      }
    });

    graphMap.update(currentPlayer.getState());

    // 4. Привязываем кнопки именно к текущему плееру (перезаписываем старые)
    document.getElementById('prev').onclick = () => {
      isContinuousMovement = false;
      currentPlayer.prev();
    };

    document.getElementById('next').onclick = () => {
      isContinuousMovement = false;
      currentPlayer.next();
    };

    document.getElementById('slider').oninput = e => {
      markContinuousMovement();
      currentPlayer.setStep(e.target.value);
    };
  }

  // --- ОБРАБОТЧИК ЗАГРУЗКИ КАСТОМНОГО ФАЙЛА ---
  const fileInput = document.getElementById('tdjFileInput');
  const loadBtn = document.getElementById('loadTdjBtn');
  
  if (!fileInput || !loadBtn) {
    console.error('❌ ВНИМАНИЕ: Не найдены элементы для загрузки файла (tdjFileInput или loadTdjBtn)');
  } else {
    // 1. По клику на красивую кнопку симулируем клик по скрытому инпуту
    loadBtn.addEventListener('click', () => {
      fileInput.click();
    });

    // 2. Слушаем реальное изменение файла
    fileInput.addEventListener('change', async (e) => {
      console.log('✅ Файл выбран, начинаем обработку...');
      
      const file = e.target.files[0];
      if (!file) {
        console.log('❌ Файл не был передан браузером');
        return;
      }

      try {
        // Показываем экран загрузки
        document.getElementById('text').innerHTML = '<div style="padding: 60px 20px; text-align: center; color: #888; font-size: 18px;">Собираем граф и тексты...</div>';
        document.getElementById('title').textContent = 'Загрузка...';
        document.getElementById('part').textContent = '';
        
        const svgEl = document.getElementById('graphSvg');
        const nodesEl = document.getElementById('graphNodes');
        if (svgEl) svgEl.innerHTML = '';
        if (nodesEl) nodesEl.innerHTML = '';

        // Читаем файл
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.meta || !data.versions || !Array.isArray(data.versions)) {
          throw new Error('Файл не похож на TDJ-проект (нет meta или versions)');
        }

        // Рендерим новый граф с небольшой задержкой для перерисовки DOM
        setTimeout(() => {
          try {
            loadProject(data);
            window.scrollTo({ top: 0, behavior: 'auto' });
            console.log('✅ Новый проект успешно загружен!');
          } catch (projectErr) {
            alert('Ошибка при построении графа:\n' + projectErr.message);
            console.error(projectErr);
          }
        }, 50);

      } catch (err) {
        alert('Ошибка при загрузке или чтении файла:\n' + err.message);
        console.error(err);
        // Восстанавливаем прошлый стейт при ошибке
        if (currentRender && currentState) {
          currentRender(currentState);
        }
      } finally {
        // Сбрасываем input, чтобы событие change сработало, даже если выбрать тот же файл еще раз
        e.target.value = ''; 
      }
    });
  }

  // --- ЗАГРУЗКА ФАЙЛА ПО УМОЛЧАНИЮ ---
  try {
    const data = window.TXTS_INLINE 
      ? window.TXTS_INLINE 
      : await (await fetch('./tdj-text.json')).json();
    loadProject(data);
  } catch (err) {
    console.error("Не удалось загрузить базовый текст:", err);
    document.getElementById('title').textContent = 'Ошибка загрузки базового файла';
  }
}

// Запускаем приложение
boot();