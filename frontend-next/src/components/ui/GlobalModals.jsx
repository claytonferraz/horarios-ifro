import React from 'react';
import { AuthModal } from './modals/AuthModal';
import { SecurityModal } from './modals/SecurityModal';
import { ImportUrlModal } from './modals/ImportUrlModal';
import { PendingUploadModal } from './modals/PendingUploadModal';
import { ConflictModal } from './modals/ConflictModal';
import { DeleteModal } from './modals/DeleteModal';

export function GlobalModals({
  // General
  isDarkMode,
  
  // Auth & Security
  authModal, closeAuthModal, handleAuthSubmit, usernameInput, setUsernameInput, passwordInput, setPasswordInput, errorMsg,
  pwdModal, setPwdModal, securityTab, setSecurityTab, handleSecuritySubmit, newUserForm, setNewUserForm,
  
  // Imports & Core Admin Flags
  importUrlModal, setImportUrlModal, processUrlUpload, uploadType, isLoading,
  pendingUpload, setPendingUpload, academicWeeks, finalizeUpload, onGoToConfig,
  
  // Operations & Conflicts
  conflictModal, setConflictModal, handleConflictResolve,
  deleteModal, setDeleteModal, confirmDeletion
}) {
  return (
    <>
      <ImportUrlModal
        importUrlModal={importUrlModal}
        setImportUrlModal={setImportUrlModal}
        isDarkMode={isDarkMode}
        processUrlUpload={processUrlUpload}
        uploadType={uploadType}
        isLoading={isLoading}
      />

      <PendingUploadModal
        pendingUpload={pendingUpload}
        setPendingUpload={setPendingUpload}
        isDarkMode={isDarkMode}
        uploadType={uploadType}
        academicWeeks={academicWeeks}
        finalizeUpload={finalizeUpload}
        onGoToConfig={onGoToConfig}
      />

      <SecurityModal
        pwdModal={pwdModal}
        setPwdModal={setPwdModal}
        securityTab={securityTab}
        setSecurityTab={setSecurityTab}
        isDarkMode={isDarkMode}
        handleSecuritySubmit={handleSecuritySubmit}
        newUserForm={newUserForm}
        setNewUserForm={setNewUserForm}
      />

      <ConflictModal
        conflictModal={conflictModal}
        setConflictModal={setConflictModal}
        isDarkMode={isDarkMode}
        handleConflictResolve={handleConflictResolve}
      />

      <DeleteModal
        deleteModal={deleteModal}
        setDeleteModal={setDeleteModal}
        isDarkMode={isDarkMode}
        confirmDeletion={confirmDeletion}
      />

      <AuthModal
        authModal={authModal}
        isDarkMode={isDarkMode}
        closeAuthModal={closeAuthModal}
        handleAuthSubmit={handleAuthSubmit}
        usernameInput={usernameInput}
        setUsernameInput={setUsernameInput}
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        errorMsg={errorMsg}
      />
    </>
  );
}
