import React from 'react';
import { PortalAluno } from './PortalAluno';

export function AlunoView(props) {
  return <PortalAluno appMode="aluno" {...props} />;
}
