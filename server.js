const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

// ==========================================
// CẤU HÌNH KẾT NỐI BOT DISCORD
// ==========================================
// Lưu ý: Đảm bảo bạn đã khai báo DISCORD_BOT_TOKEN trong biến môi trường của Render
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

// Kho lưu trữ mã xác nhận tạm thời trên RAM { roblox_id: { code: '123456', timestamp: 123456789 } }
const verificationStorage = {};

// Danh sách các Discord ID được phép sử dụng hệ thống (Whitelist)
const allowedDiscordIds = [
  "1312336007852462080", // Thêm các Discord ID được phép vào đây
];

client.on('ready', () => {
  console.log(`Bot Discord đã đăng nhập thành công với tên: ${client.user.tag}`);
});

// Đăng nhập bot bằng Token từ biến môi trường
if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.error('Không thể đăng nhập bot Discord:', err);
  });
} else {
  console.warn('CẢNH BÁO: Chưa cấu hình DISCORD_BOT_TOKEN trong biến môi trường!');
}

// ==========================================
// CÁC API XÁC THỰC QUA DISCORD
// ==========================================

// 1. API sinh mã và gửi tin nhắn (DM) qua Bot Discord
app.post('/api/verify-roblox', async (req, res) => {
  const { roblox_id, discord_id } = req.body; // Nhận thêm discord_id từ client gửi lên
  
  if (!roblox_id || !discord_id) {
    return res.status(400).json({ error: 'Thiếu thông tin Roblox ID hoặc Discord ID!' });
  }

  // Kiểm tra xem discord_id có nằm trong danh sách cho phép (whitelist) không
  if (!allowedDiscordIds.includes(discord_id)) {
    return res.status(403).json({ error: 'Discord ID này không có liên kết tài roblox đó!' });
  }

  try {
    // Tạo mã xác nhận ngẫu nhiên 6 chữ số
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Lưu lại mã theo Roblox ID
    verificationStorage[roblox_id] = {
      code: verificationCode,
      timestamp: Date.now()
    };

    // Lấy user Discord dựa vào discord_id do chính người đó nhập vào
    const discordUser = await client.users.fetch(discord_id);
    if (!discordUser) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản Discord tương ứng!' });
    }

    await discordUser.send(`🔐 Mã xác nhận Roblox Tracker của bạn là: **${verificationCode}**\nMã này dùng để xác thực tài khoản Roblox ID: ${roblox_id}`);

    console.log(`Đã gửi mã ${verificationCode} cho Roblox ID: ${roblox_id} qua Discord ID: ${discord_id}`);
    return res.status(200).json({ 
      success: true, 
      message: 'Mã xác nhận đã được gửi thành công vào tin nhắn riêng (DM) trên Discord của bạn!' 
    });
  } catch (error) {
    console.error('Lỗi khi gửi mã qua Discord:', error);
    return res.status(500).json({ error: 'Không thể gửi tin nhắn qua Discord. Hãy chắc chắn bạn đã bật cho phép nhận tin nhắn từ thành viên trong server chung với bot.' });
  }
});

// 2. API kiểm tra mã xác nhận do người dùng nhập vào web
app.post('/api/confirm-code', async (req, res) => {
  const { roblox_id, code } = req.body;

  if (!roblox_id || !code) {
    return res.status(400).json({ error: 'Thiếu mã xác nhận hoặc Roblox ID!' });
  }

  const storedData = verificationStorage[roblox_id];

  if (!storedData) {
    return res.status(400).json({ error: 'Không tìm thấy yêu cầu xác thực cho Roblox ID này. Vui lòng bấm gửi lại mã!' });
  }

  // Kiểm tra thời gian hết hạn mã (ví dụ: hết hạn sau 5 phút = 300000 ms)
  if (Date.now() - storedData.timestamp > 300000) {
    delete verificationStorage[roblox_id];
    return res.status(400).json({ error: 'Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới!' });
  }

  // Đối chiếu mã người dùng nhập với mã hệ thống đã sinh
  if (storedData.code !== code.trim()) {
    return res.status(400).json({ error: 'Mã xác nhận không chính xác. Vui lòng kiểm tra lại tin nhắn Discord!' });
  }

  // Xóa mã sau khi xác thực thành công để bảo mật
  delete verificationStorage[roblox_id];

  console.log(`Xác thực thành công cho Roblox ID: ${roblox_id}`);
  return res.status(200).json({ 
    success: true, 
    message: 'Xác thực tài khoản thành công!' 
  });
});

// ==========================================
// CÁC ROUTE ROBLOX OAUTH
// ==========================================

app.get('/auth/roblox', (req, res) => {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent('https://roblox-tracker-g1vm.onrender.com/roblox/callback');
  
  const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20profile`;
  
  res.redirect(robloxAuthUrl);
});

app.get('/roblox/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Không nhận được mã xác thực từ Roblox!');
  }

  try {
    const tokenRes = await fetch('https://apis.roblox.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.ROBLOX_CLIENT_ID,
        client_secret: process.env.ROBLOX_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'https://roblox-tracker-g1vm.onrender.com/roblox/callback'
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error('Không thể lấy Access Token từ Roblox');
    }

    const userRes = await fetch('https://apis.roblox.com/oauth/v1/userinfo', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await userRes.json();

    res.redirect(`/?logged_in=true&user_id=${userData.sub}&name=${encodeURIComponent(userData.name || userData.preferred_username)}`);
  } catch (error) {
    console.error('Lỗi xác thực OAuth:', error);
    res.status(500).send('Lỗi xác thực tài khoản Roblox.');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
