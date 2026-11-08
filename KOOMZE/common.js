/* ============================================================
   KOOMZE Common Scripts — shared across all pages
   ============================================================ */

/**
 * Escape a string for safe insertion into HTML text or attribute context.
 * Escapes & < > " ' so it is safe for both element content and double/single-quoted attributes.
 */
function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// 仅保留当前介绍编辑器支持的格式；所有事件、样式和额外属性均不输出。
function sanitizeRichText(html) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const allowed = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'OL', 'UL', 'LI', 'A', 'SPAN']);
    const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'SVG', 'MATH', 'TEMPLATE', 'NOSCRIPT']);
    function clean(parent) {
        Array.from(parent.childNodes).forEach(el => {
            if (el.nodeType === 8) { el.remove(); return; }
            if (el.nodeType !== 1) return;
            if (blocked.has(el.tagName)) { el.remove(); return; }
            clean(el);
            if (!allowed.has(el.tagName)) { el.replaceWith(...el.childNodes); return; }
            const href = el.tagName === 'A' ? (el.getAttribute('href') || '').trim() : '';
            Array.from(el.attributes).forEach(attr => el.removeAttribute(attr.name));
            if (href) {
                try {
                    const url = new URL(href, window.location.href);
                    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
                        el.setAttribute('href', url.href);
                        el.setAttribute('target', '_blank');
                        el.setAttribute('rel', 'noopener noreferrer');
                    }
                } catch (_) { /* 无效链接保留文字 */ }
            }
        });
    }
    clean(doc.body);
    return doc.body.innerHTML;
}

function contentStateHTML(failed) {
    return failed
        ? '<span class="lang-zh">加载失败，请刷新重试</span><span class="lang-tw">載入失敗，請重新整理再試</span><span class="lang-en">Could not load. Please refresh to retry.</span>'
        : '<span class="lang-zh">暂无内容</span><span class="lang-tw">暫無內容</span><span class="lang-en">No content available.</span>';
}

function safeWebURL(value) {
    const link = String(value || '').trim();
    if (!link) return '';
    try {
        return ['http:', 'https:'].includes(new URL(link, window.location.href).protocol) ? link : '';
    } catch (_) { return ''; }
}

let currentLang = 'zh-CN';

/**
 * Initialize all dropdown menus (hover + click toggle for mobile).
 * Applies to every .dropdown element inside .nav-links.
 */
function initDropdown() {
    const dropdowns = document.querySelectorAll('.nav-links .dropdown');
    dropdowns.forEach(function (dropdown) {
        const menu = dropdown.querySelector('.dropdown-menu');
        if (!menu) return;

        let hideTimer, isHovering = false;

        function show() {
            clearTimeout(hideTimer);
            menu.classList.add('show');
            dropdown.classList.add('open');
        }
        function hide(delay) {
            delay = delay === undefined ? 400 : delay;
            if (isHovering) return;
            clearTimeout(hideTimer);
            hideTimer = setTimeout(function () {
                if (!isHovering) {
                    menu.classList.remove('show');
                    dropdown.classList.remove('open');
                }
            }, delay);
        }

        dropdown.addEventListener('mouseenter', function () { isHovering = true; show(); });
        dropdown.addEventListener('mouseleave', function () { isHovering = false; hide(150); });

        const toggle = dropdown.querySelector('.dropdown-toggle');
        if (toggle) {
            toggle.addEventListener('click', function (e) {
                if (window.innerWidth <= 768) {
                    e.preventDefault();
                    menu.classList.contains('show') ? hide(0) : show();
                }
            });
        }

        document.addEventListener('click', function (e) {
            if (!dropdown.contains(e.target)) { isHovering = false; hide(0); }
        });
    });
}

/**
 * Restore saved language, bind the #langSelect change event,
 * and invoke the per-page `onLangChanged` callback.
 * Returns the initial language string.
 */
function initCommon(onLangChanged) {
    /* restore saved language */
    var saved = localStorage.getItem('koomze_lang');
    if (saved && ['zh-CN', 'zh-TW', 'en'].indexOf(saved) !== -1) {
        currentLang = saved;
    }
    document.documentElement.lang = currentLang;

    /* dropdown */
    initDropdown();

    /* language selector */
    var sel = document.getElementById('langSelect');
    if (sel) {
        sel.value = currentLang;
        sel.addEventListener('change', function () {
            currentLang = sel.value;
            localStorage.setItem('koomze_lang', currentLang);
            document.documentElement.lang = currentLang;
            if (typeof onLangChanged === 'function') onLangChanged(currentLang);
        });
    }

    return currentLang;
}

// ============================================================
//  动态导航下拉菜单 — 从数据库加载产品按分类填充
// ============================================================
/**
 * 获取产品列表：缓存成功结果，共用进行中的请求；失败可再次请求。
 * @returns {Promise<Array>} 产品数组
 */
let _cachedProducts = null;
let _productsRequest = null;
let productCatalogLoadFailed = false;
async function fetchProducts() {
    if (_cachedProducts !== null) return _cachedProducts;
    if (_productsRequest) return _productsRequest;
    _productsRequest = (async () => {
        try {
            const res = await fetch('/api/content/product');
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error('产品数据格式错误');
            _cachedProducts = data;
            productCatalogLoadFailed = false;
            return _cachedProducts;
        } catch (e) {
            productCatalogLoadFailed = true;
            console.warn('产品列表加载失败:', e.message);
            return [];
        } finally {
            _productsRequest = null;
        }
    })();
    return _productsRequest;
}

/**
 * 初始化导航下拉菜单（填充产品列表）
 * @param {Array|null} products 可选的预获取产品数据，传入则跳过内部 fetch
 */
async function initDynamicNav(products) {
    const catMap = { '键盘': 'keyboard', '鼠标': 'mouse', '耳机': 'earphone', '音箱': 'speaker', '相机': 'camera' };
    const groups = { keyboard: [], mouse: [], earphone: [], speaker: [], camera: [] };

    // 优先使用传入的数据，其次使用缓存，最后才自己请求
    let data = products;
    if (!Array.isArray(data)) {
        data = await fetchProducts();
    }

    if (data && data.length > 0) {
        data.forEach(p => {
            const key = catMap[p.category] || null;
            if (key && groups[key]) groups[key].push({ productId: p.productId, name: p.name });
        });
    }

    Object.keys(groups).forEach(cat => {
        const menu = document.querySelector('.dropdown-menu[data-category="' + cat + '"]');
        if (!menu) return;
        const items = groups[cat];
        menu.innerHTML = items.length ? items.map(p =>
            '<a class="dropdown-item" href="product-detail.html?id=' + encodeURIComponent(p.productId) + '">' + escapeHTML(p.name) + '</a>'
        ).join('') : '<div class="dropdown-item" role="status">' + contentStateHTML(productCatalogLoadFailed) + '</div>';
    });
}

// ============================================================
//  动态底部官方账号 — 从数据库加载，hover 显示二维码
// ============================================================
async function initFooterSocial() {
    const el = document.getElementById('footerSocial');
    if (!el) return;
    try {
        const res = await fetch('/api/content/social');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error('官方账号数据格式错误');
        if (data.length > 0) {
            el.innerHTML = data.sort((a,b) => (a.order||0)-(b.order||0)).map(item =>
                '<span class="social-platform">' +
                '<span class="social-name">' + escapeHTML(item.name) + '</span>' +
                '<span class="social-qr"><img src="' + escapeHTML(item.qrImage) + '" alt="' + escapeHTML(item.name) + ' 二维码"></span>' +
                '</span>'
            ).join('<span class="social-sep">|</span>');
            return;
        }
    } catch(e) { el.innerHTML = contentStateHTML(true); return; }
    el.innerHTML = contentStateHTML(false);
}
