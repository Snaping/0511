import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: '',
    confirmPassword: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('两次输入的密码不一致');
        }
        await register({
          email: formData.email,
          password: formData.password,
          username: formData.username,
          displayName: formData.displayName,
        });
      }
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>EIM</h1>
        <h2>{isLogin ? '登录' : '注册'}</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <div className="form-group">
                <label>用户名</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  placeholder="请输入用户名"
                />
              </div>

              <div className="form-group">
                <label>显示名称</label>
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleChange}
                  required
                  placeholder="请输入显示名称"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label>邮箱</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="请输入邮箱"
            />
          </div>

          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="请输入密码"
              minLength={6}
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label>确认密码</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="请再次输入密码"
                minLength={6}
              />
            </div>
          )}

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? '处理中...' : isLogin ? '登录' : '注册'}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? '还没有账号？' : '已有账号？'}
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? '立即注册' : '立即登录'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;