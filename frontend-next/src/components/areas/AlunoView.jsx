import React from 'react';
import { MasterGrid } from '../ui/admin/MasterGrid';

export function AlunoView(props) {
  return <MasterGrid appMode="aluno" {...props} />;
}
