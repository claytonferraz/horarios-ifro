import React from 'react';
import { AuthModal } from './modals/AuthModal';
import { ImportUrlModal } from './modals/ImportUrlModal';
import { PendingUploadModal } from './modals/PendingUploadModal';
import { ConflictModal } from './modals/ConflictModal';
import { DeleteModal } from './modals/DeleteModal';

export function GlobalModals({
  // General
  isDarkMode,
  
  // Auth & Security
  authModal, closeAuthModal, handleAuthSubmit, usernameInput, setUsernameInput, passwordInput, setPasswordInput, errorMsg,
  
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
