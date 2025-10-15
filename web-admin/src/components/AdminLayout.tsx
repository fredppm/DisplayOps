import React from 'react';
import Layout from '@/components/Layout';
import { AdminStatusProvider } from '@/contexts/AdminStatusContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

/**
 * AdminLayout - Layout específico para páginas administrativas
 * 
 * Este layout inclui o AdminStatusProvider que faz polling de /api/health/status
 * para monitorar o status do sistema. Deve ser usado apenas nas páginas que
 * realmente precisam desses dados (ex: /admin/index, /admin/health).
 * 
 * Isso evita polling desnecessário em outras páginas como /hosts, /dashboards, etc.
 */
const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  return (
    <AdminStatusProvider>
      <Layout>{children}</Layout>
    </AdminStatusProvider>
  );
};

export default AdminLayout;


