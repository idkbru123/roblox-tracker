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
