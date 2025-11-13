// Login form handler
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const loginBtn = document.getElementById('loginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  const loginSpinner = document.getElementById('loginSpinner');
  const alertMessage = document.getElementById('alertMessage');
  const tokenInput = document.getElementById('token');

  // Check if already authenticated
  checkAuthStatus();

  // Handle form submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const tokenInput = document.getElementById('token');
    const token = tokenInput.value.trim();

    if (!token) {
      showAlert('Please enter your access token', 'error');
      return;
    }

    // Basic token format validation
    if (!token.startsWith('eyJ')) {
      showAlert('Invalid token format. Token should start with "eyJ"', 'error');
      return;
    }

    // Disable form during login
    setLoading(true);
    hideAlert();

    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showAlert('Authentication successful! Redirecting...', 'success');

        // Redirect to dashboard after short delay
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1000);
      } else {
        showAlert(data.error || 'Authentication failed. Please check your token.', 'error');
        setLoading(false);

        // Clear token field on error
        tokenInput.value = '';
        tokenInput.focus();
      }
    } catch (error) {
      console.error('Authentication error:', error);
      showAlert('Connection error. Please try again.', 'error');
      setLoading(false);
    }
  });

  // Check authentication status
  async function checkAuthStatus() {
    try {
      const response = await fetch('/api/auth/status');
      const data = await response.json();

      // If already authenticated, redirect to dashboard
      if (data.authenticated) {
        window.location.href = '/dashboard';
      }
    } catch (error) {
      console.error('Auth check error:', error);
    }
  }

  // Show alert message
  function showAlert(message, type) {
    alertMessage.textContent = message;
    alertMessage.className = `alert alert-${type}`;
    alertMessage.classList.remove('hidden');
  }

  // Hide alert message
  function hideAlert() {
    alertMessage.classList.add('hidden');
  }

  // Set loading state
  function setLoading(loading) {
    loginBtn.disabled = loading;

    if (loading) {
      loginBtnText.classList.add('hidden');
      loginSpinner.classList.remove('hidden');
    } else {
      loginBtnText.classList.remove('hidden');
      loginSpinner.classList.add('hidden');
    }
  }

  // Focus token field on load
  tokenInput.focus();

  // Clear any previous error on input
  tokenInput.addEventListener('input', () => {
    if (!alertMessage.classList.contains('hidden')) {
      hideAlert();
    }
  });
});
