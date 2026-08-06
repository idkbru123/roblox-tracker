const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình để server đọc được dữ liệu dạng JSON từ web gửi lên
app.use(express.json());

// Phục vụ giao diện tĩnh từ thư mục public
app.use(express.static('public'));

// ==========================================
// CÁC API PHỤC VỤ TÍNH NĂNG GỬI MÃ XÁC NHẬN DISCORD
// ==========================================

// 1. API nhận yêu cầu gửi mã xác nhận qua Discord dựa vào Roblox ID
app.post('/api/verify-roblox', async (req, res) => {
  const { roblox_id } = req.body;
  
  if (!roblox_id) {
    return res.status(400).json({ error: 'Thiếu thông tin Roblox ID!' });
  }

  try {
    // TODO: Thêm logic tìm tài khoản Discord đã liên kết với roblox_id của bạn ở đây
    // và dùng bot Discord gửi mã xác nhận (DM) cho người dùng.

    // Tạm thời trả về kết quả giả lập thành công để test giao diện
    console.log(`Đang yêu cầu gửi mã xác nhận cho Roblox ID: ${roblox_id}`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Mã xác nhận đã được gửi thành công vào tin nhắn riêng (DM) trên Discord của bạn!' 
    });
  } catch (error) {
    console.error('Lỗi khi gửi mã xác nhận:', error);
    return res.status(500).json({ error: 'Không thể tìm thấy tài khoản Discord liên kết với ID này.' });
  }
});

// 2. API kiểm tra mã xác nhận do người dùng nhập vào web
app.post('/api/confirm-code', async (req, res) => {
  const { roblox_id, code } = req.body;

  if (!roblox_id || !code) {
    return res.status(400).json({ error: 'Thiếu mã xác nhận hoặc Roblox ID!' });
  }

  try {
    // TODO: Thêm logic kiểm tra mã code người dùng nhập có khớp với mã hệ thống đã sinh ra hay không ở đây

    console.log(`Xác nhận mã ${code} cho Roblox ID: ${roblox_id}`);

    return res.status(200).json({ 
      success: true, 
      message: 'Xác thực tài khoản thành công!' 
    });
  } catch (error) {
    console.error('Lỗi khi xác nhận mã:', error);
    return res.status(400).json({ error: 'Mã xác nhận không chính xác hoặc đã hết hạn.' });
  }
});

// ==========================================
// CÁC ROUTE ROBLOX OAUTH (ĐÃ CÓ SẴN CỦA BẠN)
// ==========================================

// 1. Route xử lý khi bấm nút "Đăng nhập bằng Roblox"
app.get('/auth/roblox', (req, res) => {
  const clientId = process.env.ROBLOX_CLIENT_ID;
  const redirectUri = encodeURIComponent('https://roblox-tracker-g1vm.onrender.com/roblox/callback');
  
  const robloxAuthUrl = `https://apis.roblox.com/oauth/v1/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid%20profile`;
  
  res.redirect(robloxAuthUrl);
});

// 2. Route nhận callback trả về từ Roblox OAuth
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
