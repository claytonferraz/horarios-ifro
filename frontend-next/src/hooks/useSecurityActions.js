import { useState } from 'react';
import { apiClient } from "@/lib/apiClient";

export function useSecurityActions({ isUnlocked, login }) {
  const [authModal, setAuthModal] = useState({ show: false, pendingAction: null, mode: 'login' });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  
  const [securityTab, setSecurityTab] = useState('password'); 
  const [pwdModal, setPwdModal] = useState({ show: false, current: '', newPwd: '', confirm: '', error: '', success: '' });
  const [newUserForm, setNewUserForm] = useState({ username: '', password: '', confirm: '', role: 'publico' });
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

  const handleSecuritySubmit = async (e) => {
    e.preventDefault();
    if (securityTab === 'password') {
      if (pwdModal.newPwd.length < 4) { setPwdModal(p => ({ ...p, error: 'A nova senha deve ter no mínimo 4 caracteres.', success: '' })); return; }
      if (pwdModal.newPwd !== pwdModal.confirm) { setPwdModal(p => ({ ...p, error: 'As novas senhas não coincidem.', success: '' })); return; }
      
      try {
        await apiClient.changePassword(pwdModal.current, pwdModal.newPwd);
        setPwdModal(p => ({ ...p, success: 'Senha atualizada com sucesso!', error: '', current: '', newPwd: '', confirm: '' }));
        setTimeout(() => { setPwdModal({ show: false, current: '', newPwd: '', confirm: '', error: '', success: '' }); }, 2000);
      } catch (err) {
        setPwdModal(p => ({ ...p, error: err.message, success: '' }));
      }
    } else {
      if (newUserForm.password.length < 4) { setPwdModal(p => ({ ...p, error: 'A senha deve ter no mínimo 4 caracteres.', success: '' })); return; }
      if (newUserForm.password !== newUserForm.confirm) { setPwdModal(p => ({ ...p, error: 'As senhas não coincidem.', success: '' })); return; }
      if (newUserForm.username.length < 3) { setPwdModal(p => ({ ...p, error: 'O usuário deve ter no mínimo 3 caracteres.', success: '' })); return; }
      
      try {
        await apiClient.registerUser(newUserForm.username, newUserForm.password, newUserForm.role);
        setPwdModal(p => ({ ...p, success: `Usuário '${newUserForm.username}' criado com sucesso!`, error: '' }));
        setNewUserForm({ username: '', password: '', confirm: '', role: 'publico' });
        setTimeout(() => { setPwdModal({ show: false, current: '', newPwd: '', confirm: '', error: '', success: '' }); }, 2000);
      } catch (err) {
        setPwdModal(p => ({ ...p, error: err.message, success: '' }));
      }
    }
  };

  const closeAuthModal = () => { setAuthModal({ show: false, pendingAction: null, mode: 'login' }); setPasswordInput(''); setUsernameInput(''); };

  return {
    authModal, setAuthModal,
    usernameInput, setUsernameInput,
    passwordInput, setPasswordInput,
    securityTab, setSecurityTab,
    pwdModal, setPwdModal,
    newUserForm, setNewUserForm,
    errorMsg, setErrorMsg,
    requireAuth,
    handleAuthSubmit,
    handleSecuritySubmit,
    closeAuthModal
  };
}
