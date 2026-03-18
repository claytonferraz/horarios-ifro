import { useState } from 'react';
import { apiClient } from "@/lib/apiClient";

export function useSecurityActions({ isUnlocked, login }) {
  const [authModal, setAuthModal] = useState({ show: false, pendingAction: null, mode: 'login' });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const requireAuth = async (action, setMobileMenuOpen) => {
    if (isUnlocked) {
      action();
      if (setMobileMenuOpen) setMobileMenuOpen(false);
    } else { 
      try {
        const setupInfo = await apiClient.checkSetup();
        setAuthModal({ show: true, pendingAction: action, mode: setupInfo.needsSetup ? 'setup' : 'login' });
        setUsernameInput('');
        setPasswordInput('');
        if (setMobileMenuOpen) setMobileMenuOpen(false);
      } catch (e) {
        setErrorMsg("Erro ao checar status do banco de dados.");
      }
    }
  };

  const handleAuthSubmit = async (e) => {
    e?.preventDefault();
    if (authModal.mode === 'setup') {
      if (passwordInput.length < 4) { setErrorMsg('A senha deve ter pelo menos 4 caracteres.'); return; }
      if (usernameInput.length < 3) { setErrorMsg('O usuário deve ter pelo menos 3 caracteres.'); return; }
      
      try {
        await login(usernameInput, passwordInput, 'setup', passwordInput);
        const action = authModal.pendingAction;
        setAuthModal({ show: false, pendingAction: null, mode: 'login' });
        if (action) action();
      } catch (err) {
        setErrorMsg(`Erro: ${err.message}`);
      }
    } else {
      try {
        await login(usernameInput, passwordInput, 'login');
        const action = authModal.pendingAction;
        setAuthModal({ show: false, pendingAction: null, mode: 'login' });
        if (action) action();
      } catch (err) {
        setErrorMsg(err.message || 'Usuário ou senha incorretos!');
      }
    }
  };

  const closeAuthModal = () => { setAuthModal({ show: false, pendingAction: null, mode: 'login' }); setPasswordInput(''); setUsernameInput(''); };

  return {
    authModal, setAuthModal,
    usernameInput, setUsernameInput,
    passwordInput, setPasswordInput,
    errorMsg, setErrorMsg,
    requireAuth,
    handleAuthSubmit,
    closeAuthModal
  };
}
