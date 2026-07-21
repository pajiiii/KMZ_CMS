require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');

// ===== 路由引入 =====
const contentRoutes = require('./routes/content');    // 内容管理（产品/轮播/标签/详情/驱动/社交）

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'koomze2024';

// ===== 令牌认证系统（替代纯 Basic Auth，解决浏览器缓存 + HTTP 屏蔽问题） =====
// 内存存储有效令牌：token → { username, createdAt }
const tokenStore = new Map();

// 令牌有效期：24 小时
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

// 定期清理过期令牌（每 10 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore) {
    if (now - data.createdAt > TOKEN_EXPIRY_MS) {
      tokenStore.delete(token);
      console.log(`[Auth] 过期令牌已清理: ${token.substring(0, 8)}...`);
    }
  }
}, 10 * 60 * 1000);

/**
 * 生成加密安全的随机令牌
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * API / 管理页面认证中间件
 * 支持三种认证方式（任一通过即可）：
 *   1) Cookie 中的 admin_token（页面加载时，解决浏览器导航不携带 Authorization 头的问题）
 *   2) Authorization: Bearer <token>（AJAX/API 请求）
 *   3) Authorization: Basic <base64>（兜底，直接浏览器访问时的标准 Basic Auth）
 */
function authGuard(req, res, next) {
  console.log(`[AuthGuard] 收到请求: ${req.method} ${req.path}`);
  // 检查是否需要保护：管理页面 + API 写操作
  // GET 请求公开（前台页面需要读取数据展示），POST/PUT/DELETE 需认证
  const isApiContent = req.path.startsWith('/api/content');
  const isAdminPath = req.path === '/admin.html' || req.path.startsWith('/admin');

  if (isApiContent && req.method === 'GET') {
    return next(); // 前台页面读取内容，不需要认证
  }

  const needsAuth = isAdminPath || isApiContent;

  if (!needsAuth) {
    return next();
  }

  // ---- 解析 Cookie（手动解析，无需额外依赖） ----
  const cookies = {};
  const cookieHeader = req.headers.cookie || '';
  cookieHeader.split(';').forEach(pair => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) {
      const key = pair.substring(0, eqIdx).trim();
      const val = pair.substring(eqIdx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });

  // ---- 方式一：Cookie 令牌认证（页面加载时浏览器自动携带） ----
  const cookieToken = cookies['admin_token'];
  if (cookieToken) {
    const tokenData = tokenStore.get(cookieToken);
    if (tokenData) {
      if (Date.now() - tokenData.createdAt > TOKEN_EXPIRY_MS) {
        tokenStore.delete(cookieToken);
        console.log(`[Auth] Cookie 令牌已过期: ${cookieToken.substring(0, 8)}... | IP: ${req.ip}`);
      } else {
        req.adminUser = tokenData.username;
        console.log(`[Auth] 🍪 Cookie 验证通过 | 用户: ${tokenData.username} | IP: ${req.ip} | 路径: ${req.path}`);
        return next();
      }
    }
  }

  // ---- 方式二：Bearer 令牌认证（AJAX/API 请求） ----
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const tokenData = tokenStore.get(token);
    if (tokenData) {
      if (Date.now() - tokenData.createdAt > TOKEN_EXPIRY_MS) {
        tokenStore.delete(token);
        console.log(`[Auth] Bearer 令牌已过期: ${token.substring(0, 8)}... | IP: ${req.ip}`);
        return res.status(401).json({ error: '令牌已过期，请重新登录', needLogin: true });
      }
      req.adminUser = tokenData.username;
      console.log(`[Auth] 🔑 Bearer 验证通过 | 用户: ${tokenData.username} | IP: ${req.ip} | 路径: ${req.path}`);
      return next();
    }
    console.log(`[Auth] 无效 Bearer 令牌: ${token.substring(0, 8)}... | IP: ${req.ip} | 路径: ${req.path}`);
    return res.status(401).json({ error: '令牌无效，请重新登录', needLogin: true });
  }

  // ---- 方式三：HTTP Basic Auth（仅在登录接口 /api/auth/login 中使用，不再触发浏览器弹窗） ----
  // 此分支保留仅为兼容直接携带 Authorization 头的旧请求
  if (authHeader.startsWith('Basic ')) {
    try {
      const base64 = authHeader.slice(6);
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      const colonIdx = decoded.indexOf(':');
      if (colonIdx > 0) {
        const username = decoded.substring(0, colonIdx);
        const password = decoded.substring(colonIdx + 1);
        if (username === 'admin' && password === ADMIN_PASSWORD) {
          const basicToken = generateToken();
          tokenStore.set(basicToken, { username, createdAt: Date.now() });
          res.setHeader('Set-Cookie', `admin_token=${basicToken}; Path=/; HttpOnly; SameSite=Lax`);
          console.log(`[Auth] 🔐 Basic Auth 验证通过 → 已颁发 Cookie 令牌 | IP: ${req.ip} | 路径: ${req.path} | 当前有效令牌数: ${tokenStore.size}`);
          return next();
        }
      }
    } catch (e) {
      // 解码失败
    }
    console.log(`[Auth] Basic Auth 密码错误 | IP: ${req.ip} | 路径: ${req.path}`);
  }

  // 未认证 — 区分 AJAX 请求和浏览器直接访问
  const isAjax = req.headers['x-requested-with'] === 'XMLHttpRequest' ||
                 req.headers['accept']?.includes('application/json') ||
                 req.headers['content-type']?.includes('application/json');

  if (isAjax || req.path.startsWith('/api/')) {
    // API / AJAX 请求：返回 JSON 错误
    console.log(`[Auth] 未认证 API 请求 | IP: ${req.ip} | 路径: ${req.path} | User-Agent: ${(req.headers['user-agent']||'').substring(0, 60)}`);
    return res.status(401).json({ error: '请先登录', needLogin: true });
  }

  // 浏览器直接访问：返回自定义 HTML 登录页（不再使用浏览器原生 Basic Auth 弹窗）
  console.log(`[Auth] 要求认证（浏览器直接访问） | IP: ${req.ip} | 路径: ${req.path} | User-Agent: ${(req.headers['user-agent']||'').substring(0, 60)}`);
  return res.status(401).send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>KOOMZE 管理后台 — 登录</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#0b0c10;color:#e8e8f0;display:flex;justify-content:center;align-items:center;min-height:100vh}
.card{background:#1d1e26;border-radius:20px;padding:36px 32px;border:1px solid #2e303a;max-width:400px;width:90%;text-align:center}
.card h1{font-size:22px;margin-bottom:8px;color:#e33f3f}
.card p{color:#a8aab8;font-size:13px;margin-bottom:24px}
.card input{width:100%;padding:12px 16px;background:#0b0c10;border:1px solid #2e303a;border-radius:10px;color:#e8e8f0;font-size:15px;margin-bottom:14px;outline:none;transition:border-color .25s}
.card input:focus{border-color:#e33f3f;box-shadow:0 0 0 3px rgba(227,63,63,0.2)}
.card button{width:100%;padding:12px;border:none;border-radius:10px;background:#e33f3f;color:#fff;font-weight:600;font-size:15px;cursor:pointer;transition:background .25s}
.card button:hover{background:#ff5252}
.card .error{color:#e74c3c;font-size:13px;margin-top:12px;display:none}
</style></head>
<body>
<div class="card">
<h1>🔐 KOOMZE 管理后台</h1>
<p>请输入管理员账号和密码</p>
<form id="loginForm">
<input type="text" id="uname" placeholder="管理员账号" autofocus required>
<input type="password" id="pw" placeholder="管理员密码" required>
<button type="submit">登 录</button>
<div class="error" id="errMsg">账号或密码错误，请重试</div>
</form>
</div>
<script>
document.getElementById('loginForm').addEventListener('submit', async e => {
e.preventDefault();
const uname = document.getElementById('uname').value.trim();
const pw = document.getElementById('pw').value;
if (!uname || !pw) return;
const basic = btoa(unescape(encodeURIComponent(uname)) + ':' + unescape(encodeURIComponent(pw)));
try {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Basic ' + basic }
  });
  if (res.ok) {
    const data = await res.json();
    // 存储令牌到 sessionStorage（关闭标签页即清除，实现"每次打开都需登录"）
    sessionStorage.setItem('admin_token', data.token);
    // 跳转到管理页面
    window.location.href = '/admin.html';
  } else {
    document.getElementById('errMsg').style.display = 'block';
    document.getElementById('pw').value = '';
    document.getElementById('pw').focus();
  }
} catch(err) {
  document.getElementById('errMsg').textContent = '网络错误: ' + err.message;
  document.getElementById('errMsg').style.display = 'block';
}
});
</script>
</body></html>`);
}

// ===== 中间件 =====
app.use(cors());
app.use(express.json({ limit: '150mb' }));

// ===== 请求日志（方便排查云服务器问题） =====
app.use((req, res, next) => {
  const authInfo = req.headers.authorization
    ? ` | Auth: ${req.headers.authorization.startsWith('Bearer ') ? 'BearerToken' : 'Basic'}`
    : ' | Auth: 无';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | IP: ${req.ip}${authInfo}`);
  next();
});

// ===== 认证相关 API（必须在 authGuard 之前注册，因为登录不需要认证） =====
// 登录接口：验证 Basic Auth 后颁发令牌（无需 authGuard，公开访问）
app.post('/api/auth/login', (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Basic ')) {
    console.log(`[Login] 缺少 Basic Auth 头 | IP: ${req.ip}`);
    return res.status(401).json({ error: '请提供认证信息' });
  }

  try {
    const base64 = authHeader.slice(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx <= 0) {
      console.log(`[Login] Basic Auth 格式错误（缺少用户名） | IP: ${req.ip}`);
      return res.status(401).json({ error: '认证信息格式错误' });
    }
    const username = decoded.substring(0, colonIdx);
    const password = decoded.substring(colonIdx + 1);

    if (username === 'admin' && password === ADMIN_PASSWORD) {
      const token = generateToken();
      tokenStore.set(token, { username, createdAt: Date.now() });
      // 🔑 设置 HttpOnly 会话 Cookie（关闭浏览器后自动清除 → 下次打开需重新登录）
      res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax`);
      console.log(`[Login] ✅ 登录成功 | 用户: ${username} | IP: ${req.ip} | 令牌: ${token.substring(0, 8)}... | 当前有效令牌数: ${tokenStore.size}`);
      return res.json({ token, message: '登录成功' });
    }

    console.log(`[Login] ❌ 密码错误 | IP: ${req.ip}`);
    return res.status(401).json({ error: '用户名或密码错误' });
  } catch (e) {
    console.error(`[Login] 解码失败 | IP: ${req.ip}`, e.message);
    return res.status(401).json({ error: '认证信息格式错误' });
  }
});

// 登出接口（路由级 authGuard 保护）
app.post('/api/auth/logout', authGuard, (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    tokenStore.delete(token);
    console.log(`[Logout] Bearer 令牌已销毁: ${token.substring(0, 8)}... | IP: ${req.ip}`);
  }
  // 同时也清除 Cookie 中的令牌
  const cookies = {};
  (req.headers.cookie || '').split(';').forEach(pair => {
    const eqIdx = pair.indexOf('=');
    if (eqIdx > 0) cookies[pair.substring(0, eqIdx).trim()] = pair.substring(eqIdx + 1).trim();
  });
  const cookieToken = cookies['admin_token'];
  if (cookieToken) {
    tokenStore.delete(cookieToken);
    console.log(`[Logout] Cookie 令牌已销毁: ${cookieToken.substring(0, 8)}... | IP: ${req.ip}`);
  }
  // 清除浏览器 Cookie
  res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ message: '已登出' });
});

// 检查令牌是否有效（路由级 authGuard 保护）
app.get('/api/auth/check', authGuard, (req, res) => {
  res.json({ valid: true, user: req.adminUser });
});

// ===== 公开静态资源（不需要认证） =====
// 前台网站页面 — 公开
app.use(express.static(__dirname + '/../KOOMZE'));
// 上传的图片 — 公开（前台页面需要引用）
app.use('/uploads', express.static(__dirname + '/uploads'));
// 图片文件夹 — 公开
app.use('/pictures', express.static(__dirname + '/../KOOMZE/Pictures'));

// ===== 🔐 认证中间件 — 以下所有路由都需要认证 =====
app.use(authGuard);

// ===== 受保护的静态资源和管理页面 =====
// 管理后台（admin.html 等）— 受 authGuard 保护
app.use(express.static(__dirname));

// 访问根路径 → 跳转管理页（受 authGuard 保护）
app.get('/', (req, res) => {
  res.redirect('/admin.html');
});

// ===== 受保护的 API 路由 =====
app.use('/api/content', contentRoutes);

// ===== 数据库连接 + 启动服务器 =====
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000
})
.then(() => {
  console.log('数据库连接成功！');
  app.listen(PORT, () => {
    console.log(`后端服务已启动: http://localhost:${PORT}`);
  });
})
.catch(err => {
  console.error('数据库连接失败:', err);
  process.exit(1);
});