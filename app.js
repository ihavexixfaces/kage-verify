(() => {
  const config = window.KAGE_VERIFY_CONFIG || {};
  const workerBase = String(config.workerBaseUrl || '').replace(/\/$/, '');
  const button = document.getElementById('verify-button');
  const status = document.getElementById('status-card');
  const statusTitle = document.getElementById('status-title');
  const statusCopy = document.getElementById('status-copy');
  const identityCard = document.getElementById('identity-card');
  const identityName = document.getElementById('identity-name');
  const identityId = document.getElementById('identity-id');
  const identityAvatar = document.getElementById('identity-avatar');

  const setStatus = (state, title, copy) => {
    status.dataset.state = state;
    statusTitle.textContent = title;
    statusCopy.textContent = copy;
  };

  const avatarUrl = user => user?.avatar
    ? `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=128`
    : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#1b1b22"/><circle cx="64" cy="49" r="22" fill="#70707a"/><path d="M25 112c6-24 22-37 39-37s33 13 39 37" fill="#70707a"/></svg>');

  const showVerified = payload => {
    const user = payload.user || {};
    identityName.textContent = user.global_name || user.username || 'Discord user';
    identityId.textContent = user.id ? `ID ${user.id}` : 'ID —';
    identityAvatar.src = avatarUrl(user);
    identityCard.classList.remove('hidden');
    setStatus('success', 'Verification complete', 'This browser session is verified. KAGE integration can be connected later.');
    button.disabled = true;
    button.querySelector('span').textContent = 'Verified';
  };

  const getSessionId = () => new URLSearchParams(location.search).get('session') || sessionStorage.getItem('kage_verify_session') || '';

  async function readSession(sessionId) {
    const response = await fetch(`${workerBase}/v1/session/${encodeURIComponent(sessionId)}`, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('Could not read verification session.');
    return response.json();
  }

  async function resumeSession() {
    const sessionId = getSessionId();
    if (!sessionId || !workerBase || workerBase.includes('YOUR-WORKER')) return;
    setStatus('working', 'Checking verification', 'Confirming the Discord authorization result…');
    try {
      const result = await readSession(sessionId);
      if (result.status === 'verified') showVerified(result);
      else if (result.status === 'denied') setStatus('error', 'Access not verified', result.message || 'This Discord account is not allowed to use KAGE.');
      else setStatus('idle', 'Verification pending', 'Use the button below to continue with Discord.');
    } catch (error) {
      setStatus('error', 'Could not check verification', error.message || 'Try again.');
    }
  }

  button.addEventListener('click', async () => {
    if (!workerBase || workerBase.includes('YOUR-WORKER')) {
      setStatus('error', 'Worker URL not configured', 'Set workerBaseUrl in config.js before testing the prototype.');
      return;
    }
    button.disabled = true;
    setStatus('working', 'Creating secure session', 'Preparing Discord authorization…');
    try {
      const response = await fetch(`${workerBase}/v1/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('The verification service could not create a session.');
      const payload = await response.json();
      if (!payload.sessionId || !payload.authorizeUrl) throw new Error('The verification service returned an invalid session.');
      sessionStorage.setItem('kage_verify_session', payload.sessionId);
      location.href = payload.authorizeUrl;
    } catch (error) {
      button.disabled = false;
      setStatus('error', 'Verification could not start', error.message || 'Try again.');
    }
  });

  resumeSession();
})();
