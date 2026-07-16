require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const basicAuth = require('express-basic-auth');

// ===== 路由引入 =====
const productRoutes = require('./routes/products');   // 原有的产品管理
const contentRoutes = require('./routes/content');    // 【新增】内容管理

const app = express();
const PORT = process.env.PORT || 3000;

// ===== IP 白名单配置（可通过 .env 的 ADMIN_IP_WHITELIST 用逗号分隔多个 IP） =====
const IP_WHITELIST = (process.env.ADMIN_IP_WHITELIST || '127.0.0.1,::1,::ffff:127.0.0.1').split(',').map(s => s.trim());

// ===== 管理员访问控制中间件（IP 白名单 + HTTP Basic Auth 双层防护） =====
function adminGuard(req, res, next) {
  // 仅保护 /admin 相关路径，不影响前台页面和 API
  if (!req.path.startsWith('/admin')) {
    return next();
  }

  const clientIP = req.ip || req.socket?.remoteAddress || '';

  // 第一层：IP 白名单 — 白名单内 IP 直接放行，无需认证
  if (IP_WHITELIST.includes(clientIP)) {
    console.log(`[Admin] IP 白名单放行: ${clientIP}`);
    return next();
  }

  // 第二层：HTTP Basic Authentication — 非白名单 IP 必须输入账号密码
  const auth = basicAuth({
    users: { 'admin': process.env.ADMIN_PASSWORD || 'koomze2024' },
    challenge: true,
    realm: 'KOOMZE Admin Area — 请输入管理员账号密码'
  });
  return auth(req, res, next);
}

// ===== 中间件 =====
app.use(cors());
app.use(express.json());
app.use(adminGuard);  // 管理员访问控制（仅拦截 /admin 开头的路径）

// 托管前端网站页面（KOOMZE 文件夹），放在前面避免被 BackEnd 文件覆盖
app.use(express.static(__dirname + '/../KOOMZE'));

// 【新增】托管静态文件（让 admin.html 可以被浏览器访问）
app.use(express.static(__dirname));

// 托管上传的图片
app.use('/uploads', express.static(__dirname + '/uploads'));

// 托管前端已有的图片文件夹（方便直接引用本地图片）
app.use('/pictures', express.static(__dirname + '/../KOOMZE/Pictures'));

// 访问根路径时自动跳转到后台管理页
app.get('/', (req, res) => {
  res.redirect('/admin.html');
});

// ===== 挂载路由 =====
app.use('/api/products', productRoutes);   // 原有：产品 CRUD
app.use('/api/content', contentRoutes);    // 【新增】内容管理（4个集合）

// ===== 数据库连接 + 启动服务器 =====
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000
})
.then(() => {
  console.log('✅ 数据库连接成功！');
  app.listen(PORT, () => {
    console.log(`🚀 后端服务已启动: http://localhost:${PORT}`);
  });
})
.catch(err => {
  console.error('❌ 数据库连接失败:', err);
  process.exit(1);
});