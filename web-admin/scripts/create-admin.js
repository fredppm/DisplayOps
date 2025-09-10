const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function createInitialAdmin() {
  const usersFile = path.join(__dirname, '..', 'data', 'users.json');
  
  // Hash da senha "admin"
  const hashedPassword = await bcrypt.hash('admin', 10);
  
  const initialAdmin = {
    users: [
      {
        id: "admin",
        email: "admin@displayops.com",
        name: "Administrator",
        password: hashedPassword,
        role: "admin",
        sites: ["*"],
        createdAt: new Date().toISOString(),
        lastLogin: null
      }
    ]
  };

  // Criar diretório data se não existir
  const dataDir = path.dirname(usersFile);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('📁 Created data directory');
  }

  // Salvar arquivo
  fs.writeFileSync(usersFile, JSON.stringify(initialAdmin, null, 2));
  
  console.log('✅ Initial admin user created successfully!');
  console.log('📧 Email: admin@displayops.com');
  console.log('🔑 Password: admin');
  console.log('👑 Role: admin');
  console.log('🏢 Sites: All sites (*)');
  console.log('');
  console.log('🚀 You can now login with these credentials.');
}

// Executar o script
createInitialAdmin().catch(console.error);