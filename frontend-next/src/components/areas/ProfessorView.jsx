import React from 'react';
import { MasterGrid } from '../ui/admin/MasterGrid';

export function ProfessorView(props) {
  return <MasterGrid appMode="professor" {...props} />;
}
