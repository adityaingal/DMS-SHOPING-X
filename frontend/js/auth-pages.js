function showAlert(id, message) {
  const box = document.getElementById(id);
  if (!message) {
    box.classList.add('hidden');
    return;
  }
  box.textContent = message;
  box.classList.remove('hidden');
}

function fieldError(input, message) {
  input.classList.add('invalid');
  const span = document.createElement('span');
  span.className = 'field-error';
  span.textContent = message;
  input.parentElement.appendChild(span);
}

function clearErrors(form) {
  qsa('.invalid', form).forEach((i) => i.classList.remove('invalid'));
  qsa('.field-error', form).forEach((e) => e.remove());
}

function redirectAfterAuth(user) {
  const params = new URLSearchParams(location.search);
  const returnTo = params.get('returnTo');
  if (returnTo && returnTo.startsWith('/')) {
    location.href = returnTo;
    return;
  }
  location.href = user && user.role === 'admin' ? '/admin/index.html' : '/index.html';
}

async function afterAuth(user) {
  await CartStore.syncGuestCart();
  showToast(`Welcome${user ? ', ' + user.name.split(' ')[0] : ''}!`, 'success');
  setTimeout(() => redirectAfterAuth(user), 600);
}

function initLogin() {
  const form = document.getElementById('loginForm');
  if (Auth.isLoggedIn()) {
    redirectAfterAuth(Auth.user);
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    showAlert('loginAlert', '');

    const email = form.email.value.trim();
    const password = form.password.value;
    let valid = true;

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      fieldError(form.email, 'Enter a valid email address.');
      valid = false;
    }
    if (!password) {
      fieldError(form.password, 'Password is required.');
      valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Signing in…';

    try {
      const user = await AuthAPI.login(email, password);
      await afterAuth(user);
    } catch (err) {
      showAlert('loginAlert', err.message);
      btn.disabled = false;
      btn.textContent = 'Sign in';
      if (err.errors && err.errors.length) {
        err.errors.forEach((e) => {
          const input = form[e.field];
          if (input) fieldError(input, e.message);
        });
      }
    }
  });
}

function initRegister() {
  const form = document.getElementById('registerForm');
  if (Auth.isLoggedIn()) {
    redirectAfterAuth(Auth.user);
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);
    showAlert('registerAlert', '');

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;
    let valid = true;

    if (name.length < 2) {
      fieldError(form.name, 'Name must be at least 2 characters.');
      valid = false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      fieldError(form.email, 'Enter a valid email address.');
      valid = false;
    }
    if (password.length < 8 || !/\d/.test(password)) {
      fieldError(form.password, 'Use at least 8 characters including a number.');
      valid = false;
    }
    if (confirmPassword !== password) {
      fieldError(form.confirmPassword, 'Passwords do not match.');
      valid = false;
    }
    if (!document.getElementById('terms').checked) {
      showAlert('registerAlert', 'Please accept the terms to continue.');
      valid = false;
    }
    if (!valid) return;

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating account…';

    try {
      const user = await AuthAPI.register({ name, email, password, confirmPassword, phone });
      await afterAuth(user);
    } catch (err) {
      showAlert('registerAlert', err.message);
      btn.disabled = false;
      btn.textContent = 'Create account';
      if (err.errors && err.errors.length) {
        err.errors.forEach((e2) => {
          const input = form[e2.field];
          if (input) fieldError(input, e2.message);
        });
      }
    }
  });
}

document.addEventListener('shopx:ready', () => {
  if (document.getElementById('loginForm')) initLogin();
  if (document.getElementById('registerForm')) initRegister();
});
