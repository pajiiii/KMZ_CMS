/* ============================================================
   KOOMZE Common Scripts — shared across all pages
   ============================================================ */

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
            delay = delay || 400;
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
const NAV_FALLBACK = {
    keyboard: [
        { productId: 'H71', name: 'H71' }, { productId: 'H75', name: 'H75' },
        { productId: 'H81', name: 'H81' }, { productId: 'H98', name: 'H98' },
        { productId: 'H102', name: 'H102' }, { productId: '75', name: '75' }
    ],
    mouse:    [{ productId: 'M7', name: 'M7' }],
    earphone: [{ productId: 'K1', name: 'K1' }, { productId: 'K7', name: 'K7' }, { productId: 'K9pAI', name: 'K9pAI' }],
    speaker:  [{ productId: 'S6', name: 'S6' }, { productId: 'S9', name: 'S9' }, { productId: 'CD', name: 'CD' }],
    camera:   [{ productId: 'C25', name: 'C25' }]
};

async function initDynamicNav() {
    const catMap = { '键盘': 'keyboard', '鼠标': 'mouse', '耳机': 'earphone', '音箱': 'speaker', '相机': 'camera' };
    const groups = { keyboard: [], mouse: [], earphone: [], speaker: [], camera: [] };
    try {
        const res = await fetch('/api/content/product');
        if (res.ok) {
            const products = await res.json();
            products.forEach(p => {
                const key = catMap[p.category] || null;
                if (key && groups[key]) groups[key].push({ productId: p.productId, name: p.name });
            });
        }
    } catch(e) {}

    Object.keys(groups).forEach(cat => {
        const menu = document.querySelector('.dropdown-menu[data-category="' + cat + '"]');
        if (!menu) return;
        let items = groups[cat];
        if (items.length === 0) items = NAV_FALLBACK[cat] || [];
        menu.innerHTML = items.map(p =>
            '<a class="dropdown-item" href="product-detail.html?id=' + encodeURIComponent(p.productId) + '">' + p.name + '</a>'
        ).join('');
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
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                el.innerHTML = data.sort((a,b) => (a.order||0)-(b.order||0)).map(item =>
                    '<span class="social-platform">' +
                    '<span class="social-name">' + item.name + '</span>' +
                    '<span class="social-qr"><img src="' + item.qrImage + '" alt="' + item.name + ' 二维码"></span>' +
                    '</span>'
                ).join('<span class="social-sep">|</span>');
                return;
            }
        }
    } catch(e) {}
    el.textContent = '暂无官方账号信息';
}
