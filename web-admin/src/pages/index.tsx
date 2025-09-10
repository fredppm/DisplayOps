import React from 'react';
import { GetServerSideProps, NextPage } from 'next';
import { verifyToken } from '@/lib/auth-postgres';

// Esta página nunca é renderizada - apenas redireciona no servidor
const HomePage: NextPage = () => {
  return null;
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Pega o token do cookie
  const token = context.req.cookies['auth-token'];
  
  // Se não tem token → redirect para login
  if (!token) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  // Verifica se o token é válido
  const user = verifyToken(token);
  
  // Se token inválido → redirect para login
  if (!user) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  // Token válido → redirect baseado no role
  let destination = '/login'; // fallback
  
  switch (user.role) {
    case 'admin':
      destination = '/admin';
      break;
    case 'site-manager':
    case 'viewer':
      destination = '/sites';
      break;
  }

  return {
    redirect: {
      destination,
      permanent: false,
    },
  };
};

export default HomePage;